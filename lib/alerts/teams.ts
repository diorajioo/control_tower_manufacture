/**
 * lib/alerts/teams.ts — Teams alert message: one Adaptive Card for every channel
 *
 * The same card goes out as a Graph DM (lib/graph/teams.ts, main path) and through the
 * legacy Incoming Webhook (sendTeamsAlerts below). Layout:
 *   header   severity · KPI, the alert message, plant · period · time
 *   facts    value vs target, main driver (cardCause in lib/kpiNarrative.ts) — the % change is already the message
 *   narrative  2 AI sentences — why it happened and what to do (generateAlertNarrative)
 *   action   Open dashboard
 * Facts and narrative need the KPI snapshot (lib/kpiData.ts); without it the card keeps the header only.
 *
 * buildSummaryCard() is the scheduled summary: a friendly story (greeting, 2–3 sentences, 3 emoji KPI bullets,
 * focus line) written by the AI from facts computed in code — see the Summary section below.
 */

import type { KPIAlert } from "@/lib/alerts";
import { GROQ_MODEL_PRIORITY, isAIModelUnavailable, getClientForModel } from "@/lib/ai-provider";
import { KPI_RELATIONSHIPS, NARRATIVE_RULES, buildKpiContext, cardCause } from "@/lib/kpiNarrative";
import { LEAD_TIME_TARGET_DAYS, LEAD_TIME_BASIS_LABEL } from "@/lib/leadTimeDefinition";

// ── Adaptive Card payload types (minimal subset) ──────────────────────────────

interface ACTextBlock {
  type: "TextBlock";
  text: string;
  weight?: "Bolder" | "Default" | "Lighter";
  size?: "Small" | "Default" | "Medium" | "Large" | "ExtraLarge";
  color?: "Default" | "Dark" | "Light" | "Accent" | "Good" | "Warning" | "Attention";
  isSubtle?: boolean;
  wrap?: boolean;
  spacing?: "None" | "Small" | "Default" | "Medium" | "Large" | "ExtraLarge" | "Padding";
}

interface ACFactSet {
  type: "FactSet";
  facts: { title: string; value: string }[];
  spacing?: ACTextBlock["spacing"];
}

interface ACContainer {
  type: "Container";
  style?: "default" | "emphasis" | "good" | "attention" | "warning" | "accent";
  bleed?: boolean;
  items: ACElement[];
  spacing?: ACTextBlock["spacing"];
}

type ACElement = ACTextBlock | ACFactSet | ACContainer;

export interface AdaptiveCard {
  type: "AdaptiveCard";
  $schema: string;
  version: "1.4";
  body: ACElement[];
  actions?: { type: "Action.OpenUrl"; title: string; url: string }[];
}

interface TeamsWebhookPayload {
  type: "message";
  attachments: {
    contentType: "application/vnd.microsoft.card.adaptive";
    content: AdaptiveCard;
  }[];
}

export interface AlertMessageContext {
  plant?:        string;
  period?:       string;
  dashboardUrl?: string;
  /** /api/dashboard/kpi snapshot — enables the facts block */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kpi?:          any;
  /** 2-sentence why + action, from generateAlertNarrative() */
  narrative?:    string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_LABEL: Record<KPIAlert["severity"], string> = { critical: "Critical", warning: "Warning", info: "Info" };
const SEVERITY_COLOR: Record<KPIAlert["severity"], ACTextBlock["color"]> = { critical: "Attention", warning: "Warning", info: "Accent" };
const SEVERITY_STYLE: Record<KPIAlert["severity"], ACContainer["style"]> = { critical: "attention", warning: "warning", info: "accent" };
const SEVERITY_RANK:  Record<KPIAlert["severity"], number> = { critical: 0, warning: 1, info: 2 };

function nowWib(): string {
  return new Date().toLocaleString("en-GB", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
}

/** Facts for one alert. Only KPIs in ALERT_KPIS (lib/aiScope.ts) get a KPI-specific block. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function alertFacts(alert: KPIAlert, kpi: any): { title: string; value: string }[] {
  const lt = kpi?.leadTime;
  if (alert.kpi === "Lead Time" && typeof lt?.grossDays === "number") {
    const over = lt.grossDays - LEAD_TIME_TARGET_DAYS;
    const facts = [
      { title: "Gross lead time", value: `${lt.grossDays.toFixed(2)} days (${LEAD_TIME_BASIS_LABEL})` },
      { title: "Target", value: `≤ ${LEAD_TIME_TARGET_DAYS} days${over > 0 ? ` · ${over.toFixed(2)} days over` : " · within target"}` },
    ];
    const cause = cardCause(kpi, "leadtime");
    if (cause) facts.push({ title: "Main driver", value: cause.replace(/ \(largest stage\)$/, "") });
    return facts;
  }
  return alert.threshold && alert.threshold !== "—" ? [{ title: "Threshold", value: alert.threshold }] : [];
}

/** One line for the push notification / chat list preview. */
export function alertSummary(alerts: KPIAlert[]): string {
  const top = [...alerts].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])[0];
  const more = alerts.length > 1 ? ` (+${alerts.length - 1} more)` : "";
  return top ? `${SEVERITY_LABEL[top.severity]} · ${top.kpi}: ${top.message}${more}` : "KPI alert";
}

// ── Card builder ──────────────────────────────────────────────────────────────

export function buildAlertCard(alerts: KPIAlert[], ctx: AlertMessageContext = {}): AdaptiveCard {
  const sorted = [...alerts].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  const body: ACElement[] = [];

  sorted.forEach((alert, i) => {
    body.push({
      type: "Container",
      style: SEVERITY_STYLE[alert.severity],
      bleed: i === 0,
      spacing: i === 0 ? undefined : "Medium",
      items: [
        { type: "TextBlock", text: `${SEVERITY_LABEL[alert.severity].toUpperCase()} · ${alert.kpi.toUpperCase()}`, size: "Small", weight: "Bolder", color: SEVERITY_COLOR[alert.severity] },
        { type: "TextBlock", text: alert.message, size: "Medium", weight: "Bolder", wrap: true, spacing: "Small" },
        ...(i === 0
          ? [{ type: "TextBlock" as const, text: `${ctx.plant || "All Plant"} · ${ctx.period || "Selected period"} · ${nowWib()} WIB`, size: "Small" as const, isSubtle: true, wrap: true, spacing: "None" as const }]
          : []),
      ],
    });
    const facts = alertFacts(alert, ctx.kpi);
    if (facts.length > 0) body.push({ type: "FactSet", facts, spacing: "Medium" });
  });

  if (ctx.narrative) {
    body.push(
      { type: "TextBlock", text: "WHY AND WHAT TO DO", size: "Small", weight: "Bolder", isSubtle: true, spacing: "Large" },
      { type: "TextBlock", text: ctx.narrative, wrap: true, spacing: "Small" },
    );
  }

  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    body,
    actions: ctx.dashboardUrl ? [{ type: "Action.OpenUrl", title: "Open dashboard", url: ctx.dashboardUrl }] : undefined,
  };
}

// ── AI narrative ─────────────────────────────────────────────────────────────

const NARRATIVE_PROMPT = `You write the "why and what to do" part of a Microsoft Teams KPI alert for plant and operations managers.

Rules:
- EXACTLY 2 sentences, at most 45 words in total, plain English. No markdown, bullets, headings or emojis.
- Sentence 1 — why: the cause behind the alerted KPI. Start from its "Card causes" line and the Signals; keep numbers exactly as given, with units.
- Sentence 2 — what to do: one concrete action on that cause that a plant manager can start this week.
- Do not repeat the alert's own numbers (KPI value, target, % change vs prior period) — the card already shows them.

${KPI_RELATIONSHIPS}

${NARRATIVE_RULES}

Only Lead Time, Output and Productivity have data. Do not mention OEE, OPE, yield/bulk/pack loss, RFT or energy.`;

/**
 * 2-sentence why + action for the alerted KPIs, grounded in the KPI snapshot.
 * Returns undefined when no AI key is set, the snapshot is missing or every model fails — the card goes out without it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateAlertNarrative(alerts: KPIAlert[], kpi: any, ctx: { plant?: string; period?: string } = {}): Promise<string | undefined> {
  if (!kpi?.leadTime || alerts.length === 0) return undefined;

  const user = `Alerts:
${alerts.map((a) => `- ${a.severity.toUpperCase()} ${a.kpi}: ${a.message}`).join("\n")}

KPI data (Plant: ${ctx.plant || "All Plant"}, period: ${ctx.period || "selected"}):
${buildKpiContext(kpi)}

Write the 2 sentences:`;

  return complete(NARRATIVE_PROMPT, user);
}

/** One non-streamed completion with model fallback; undefined on failure (the card goes out without it). */
async function complete(system: string, user: string): Promise<string | undefined> {
  if (!process.env.DEEPSEEK_API_KEY && !process.env.GROQ_API_KEY) return undefined;
  for (const modelId of GROQ_MODEL_PRIORITY) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (getClientForModel(modelId) as any).chat.completions.create({
        model: modelId,
        max_tokens: 500,
        temperature: 0.3,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      });
      const text = String(res.choices?.[0]?.message?.content ?? "")
        .replace(/<think>[\s\S]*?<\/think>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      return text || undefined;
    } catch (err) {
      if (isAIModelUnavailable(err)) continue;
      console.error("[teams] AI narrative failed:", err);
      return undefined;
    }
  }
  return undefined;
}

// ── Summary (scheduled daily / weekly) ──────────────────────────────────────
// Friendly ChatGPT-style update: greeting · 2–3 sentence story · 3 KPI bullets · focus line.
// Facts and numbers are computed here; the AI only writes the sentences (as JSON) and the card adds the
// emojis and bold in code. A plant recipient gets their plant compared with the network (all plants).
// No AI → the same shape from a code template, without story and focus.

interface SummaryBullet { verdict: string; text: string }
export interface SummaryStory {
  greeting: string;
  story?: string;
  bullets: { leadtime: SummaryBullet; output: SummaryBullet; productivity: SummaryBullet };
  focus?: string;
}

export interface SummaryContext {
  plant:         string;
  /** e.g. "Last 30 days" */
  rangeLabel:    string;
  cadence:       "Daily" | "Weekly";
  dashboardUrl?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kpi:           any;
  /** All Plant snapshot for the same range — only for a single-plant recipient */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  network?:      any;
  story:         SummaryStory;
}

const isNum = (v: unknown): v is number => typeof v === "number" && isFinite(v);
const signedPct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
const vsPrior = (v: unknown) => (isNum(v) ? `${signedPct(v)} vs prior period` : "no prior period data");
const compact = (v: number) => Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
const stripLargest = (s?: string) => s?.replace(/ \((largest (stage|plant))\)$/, "");
const trendWord = (v: unknown, up: string, down: string, flat: string) => (!isNum(v) || Math.abs(v) < 0.5 ? flat : v > 0 ? up : down);

/** Plant FG row from the network snapshot (CT_MANUF_TRENDS) — the card's FG source has no PLANT. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function plantFg(network: any, plant: string) {
  const rows: { plant: string; fg: number; fgPrev: number | null }[] = network?.output?.plantDrivers ?? [];
  const mine = rows.find((r) => r.plant === plant);
  const total = rows.reduce((a, r) => a + r.fg, 0);
  return mine
    ? { fg: mine.fg, trend: mine.fgPrev ? ((mine.fg - mine.fgPrev) / mine.fgPrev) * 100 : null, share: total > 0 ? Math.round((mine.fg / total) * 100) : null }
    : null;
}

/** Headline for the push preview: one clause per KPI (a single plant uses its own FG trend). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summaryHeadline(kpi: any, plant: string, network?: any): string {
  const parts: string[] = [];
  const lt = kpi?.leadTime?.grossDays;
  if (isNum(lt) && lt > 0) {
    const over = lt - LEAD_TIME_TARGET_DAYS;
    parts.push(over > 0 ? `Lead time ${over.toFixed(2)} days over target` : "Lead time within target");
  }
  const fg = network ? plantFg(network, plant)?.trend : kpi?.output?.fgTrend;
  if (isNum(fg)) parts.push(`Released FG ${fg > 0 ? "up" : "down"} ${Math.abs(fg).toFixed(1)}%`);
  const e2e = kpi?.productivity?.e2eTrend;
  if (isNum(e2e)) parts.push(`E2E productivity ${e2e > 0 ? "up" : "down"} ${Math.abs(e2e).toFixed(1)}%`);
  return parts.join(" · ") || "No KPI data for this period";
}

export function summaryPreview(ctx: Pick<SummaryContext, "cadence" | "plant" | "kpi" | "network">): string {
  return `${ctx.cadence} summary · ${ctx.plant}: ${summaryHeadline(ctx.kpi, ctx.plant, ctx.network)}`;
}

/** Facts for the model (numbers pre-formatted, to be copied) + the no-AI template for the same bullets. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summaryFacts(plant: string, kpi: any, network: any): { lines: string[]; fallback: SummaryStory["bullets"] } {
  const lt = kpi?.leadTime ?? {}, o = kpi?.output ?? {}, p = kpi?.productivity ?? {};
  const g = isNum(lt.grossDays) ? lt.grossDays : 0;
  const waiting = g > 0 && isNum(lt.nettDays) ? Math.round(((g - lt.nettDays) / g) * 100) : null;
  const ltCause = stripLargest(cardCause(kpi, "leadtime"));
  const ltVerdict = g > LEAD_TIME_TARGET_DAYS ? "Above target" : "Within target";
  const e2eVerdict = trendWord(p.e2eTrend, "Productivity up", "Productivity down", "Productivity steady");
  const lines: string[] = [];

  if (!network) {
    const outCause = stripLargest(cardCause(kpi, "output"));
    const prodCause = stripLargest(cardCause(kpi, "productivity"));
    const check = cardCause(kpi, "check");
    lines.push(
      `- Lead time: ${g.toFixed(2)} days vs ${LEAD_TIME_TARGET_DAYS}-day target, ${vsPrior(lt.grossTrend)}${waiting !== null ? `; ${waiting}% of it is waiting outside active processing` : ""}`,
      ltCause ? `- Lead time cause: ${ltCause}` : "",
      `- Output: Released FG ${compact(o.fgQty ?? 0)} pcs, ${vsPrior(o.fgTrend)}`,
      outCause ? `- Output cause: ${outCause}` : "",
      `- Productivity: E2E ${(p.e2e ?? 0).toFixed(1)} pcs/manhour, ${vsPrior(p.e2eTrend)}`,
      prodCause ? `- Productivity cause: ${prodCause}` : "",
      check ? `- Check (productivity): ${check}` : "",
    );
    return {
      lines: lines.filter(Boolean),
      fallback: {
        leadtime:     { verdict: ltVerdict, text: `${g.toFixed(2)} days vs the ${LEAD_TIME_TARGET_DAYS}-day target${ltCause ? `; ${ltCause}` : ""}.` },
        output:       { verdict: trendWord(o.fgTrend, "Output up", "Output down", "Output steady"), text: `Released FG ${compact(o.fgQty ?? 0)} pcs, ${vsPrior(o.fgTrend)}.` },
        productivity: { verdict: e2eVerdict, text: `E2E ${(p.e2e ?? 0).toFixed(1)} pcs/manhour, ${vsPrior(p.e2eTrend)}.` },
      },
    };
  }

  // Single plant vs network. FG per plant comes from CT_MANUF_TRENDS (the card's FG source has no PLANT):
  // show its pcs and share, the network total stays the card value.
  const nlt = network.leadTime ?? {}, no = network.output ?? {}, np = network.productivity ?? {};
  const mine = plantFg(network, plant);
  const fgTrend = mine?.trend ?? null;
  const outText = mine
    ? `${plant} released ${compact(mine.fg)} pcs (${vsPrior(fgTrend)}), ${mine.share}% of network FG · network Released FG ${compact(no.fgQty ?? 0)} pcs (${vsPrior(no.fgTrend)})`
    : `no ${plant} split available · network Released FG ${compact(no.fgQty ?? 0)} pcs (${vsPrior(no.fgTrend)})`;
  // Lower lead time is better, higher productivity is better — spelled out so the model cannot flip it
  const ltGap = g - (nlt.grossDays ?? 0);
  const prodGap = (p.e2e ?? 0) - (np.e2e ?? 0);
  lines.push(
    `- Lead time: ${plant} ${g.toFixed(2)} days (${vsPrior(lt.grossTrend)}) · network ${(nlt.grossDays ?? 0).toFixed(2)} days · target ${LEAD_TIME_TARGET_DAYS} days · ${plant} is ${Math.abs(ltGap) < 0.05 ? "level with" : ltGap < 0 ? "faster than" : "slower than"} the network`,
    ltCause || waiting !== null ? `- Lead time cause (${plant}): ${[ltCause, waiting !== null ? `${waiting}% of ${plant} lead time is waiting outside active processing` : ""].filter(Boolean).join("; ")}` : "",
    `- Output: ${outText}`,
    `- Productivity: ${plant} E2E ${(p.e2e ?? 0).toFixed(1)} pcs/manhour (${vsPrior(p.e2eTrend)}) · network ${(np.e2e ?? 0).toFixed(1)} pcs/manhour · ${plant} is ${Math.abs(prodGap) < 0.05 ? "level with" : prodGap > 0 ? "above" : "below"} the network`,
  );
  return {
    lines: lines.filter(Boolean),
    fallback: {
      leadtime:     { verdict: ltVerdict, text: `${plant} at ${g.toFixed(2)} days vs network ${(nlt.grossDays ?? 0).toFixed(2)}, target ${LEAD_TIME_TARGET_DAYS}${ltCause ? `; ${ltCause}` : ""}.` },
      output:       { verdict: trendWord(fgTrend, "Output up", "Output down", "Output steady"), text: `${outText}.` },
      productivity: { verdict: e2eVerdict, text: `${plant} E2E ${(p.e2e ?? 0).toFixed(1)} pcs/manhour vs network ${(np.e2e ?? 0).toFixed(1)}, ${vsPrior(p.e2eTrend)}.` },
    },
  };
}

const SUMMARY_PROMPT = `You write a short, friendly Microsoft Teams update about the manufacturing dashboard for plant and
operations managers, in the style of a helpful ChatGPT reply — like a colleague explaining the period.
For a single plant, it covers THEIR plant and compares it with the network (all plants).

Return ONLY a JSON object, no other text:
{"greeting": "...", "story": "...", "bullets": {"leadtime": {"verdict": "...", "text": "..."}, "output": {"verdict": "...", "text": "..."}, "productivity": {"verdict": "...", "text": "..."}}, "focus": "..."}

- greeting: one warm line naming the plant and period (e.g. "Good morning, J2 — here's your last 30 days at a glance."). No emoji.
- story: 2–3 sentences: what happened and how the KPIs connect (e.g. waiting time → lead time → output); for a plant,
  how it stands against the network (use the "faster/slower/above/below the network" words from Facts).
  NO numbers in the story — the bullets carry them.
- bullets.*.verdict: 2–4 words (e.g. "Waiting, not working", "Network engine").
- bullets.*.text: one sentence of at most 25 words: the value with its comparison, then the cause. At most 3 numbers.
- focus: one imperative sentence starting with a verb — a concrete action on the biggest issue (do not write "this week").
- If Facts contain a "Check" line, say in that bullet that it is worth a data check.

Rules:
- Friendly, plain, confident English; at most 140 words across all fields. No emojis, no markdown.
- Copy numbers exactly as written in Facts, with units; never compute new numbers.
- Never mention hours worked, manhours, headcount, overtime, effort, demand or any cause that is not in Facts.

${KPI_RELATIONSHIPS}

${NARRATIVE_RULES}

Only Lead Time, Output and Productivity have data. Do not mention OEE, OPE, yield/bulk/pack loss, RFT or energy.`;

const clean = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.replace(/\*\*/g, "").replace(/\s+/g, " ").trim().slice(0, max) : undefined;

/** Story for one recipient's plant + range. Never throws; any field the AI misses falls back to the template. */
export async function generateSummaryStory(ctx: Pick<SummaryContext, "plant" | "rangeLabel" | "cadence" | "kpi" | "network">): Promise<SummaryStory> {
  const { lines, fallback } = summaryFacts(ctx.plant, ctx.kpi, ctx.network);
  const base: SummaryStory = { greeting: `Here's ${ctx.plant} for the ${ctx.rangeLabel.toLowerCase()}.`, bullets: fallback };
  if (!ctx.kpi?.leadTime) return base;

  const raw = await complete(SUMMARY_PROMPT, `Facts (Plant: ${ctx.plant}, ${ctx.rangeLabel}, ${ctx.cadence.toLowerCase()} update):
${lines.join("\n")}

Write the JSON:`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let j: any;
  try { j = JSON.parse(raw?.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1) ?? ""); } catch { return base; }
  const bullet = (k: keyof SummaryStory["bullets"]): SummaryBullet => {
    const verdict = clean(j?.bullets?.[k]?.verdict, 40), text = clean(j?.bullets?.[k]?.text, 260);
    return verdict && text ? { verdict, text } : fallback[k];
  };
  return {
    greeting: clean(j?.greeting, 120) ?? base.greeting,
    story:    clean(j?.story, 600),
    bullets:  { leadtime: bullet("leadtime"), output: bullet("output"), productivity: bullet("productivity") },
    focus:    clean(j?.focus, 240),
  };
}

export function buildSummaryCard(ctx: SummaryContext): AdaptiveCard {
  const { story } = ctx;
  const line = (emoji: string, b: SummaryBullet, first = false): ACTextBlock =>
    ({ type: "TextBlock", text: `${emoji} **${b.verdict}** — ${b.text}`, wrap: true, spacing: first ? "Medium" : "Small" });
  const body: ACElement[] = [
    { type: "TextBlock", text: `${ctx.cadence === "Weekly" ? "👋" : "☀️"} ${story.greeting}`, weight: "Bolder", wrap: true },
  ];
  if (story.story) body.push({ type: "TextBlock", text: story.story, wrap: true, spacing: "Medium" });
  body.push(
    line("⏱️", story.bullets.leadtime, true),
    line("📦", story.bullets.output),
    line("⚙️", story.bullets.productivity),
  );
  if (story.focus) body.push({ type: "TextBlock", text: `👉 **Focus this week:** ${story.focus}`, wrap: true, spacing: "Medium" });
  body.push({ type: "TextBlock", text: `${ctx.cadence} summary · ${ctx.plant} · ${ctx.rangeLabel} · ${nowWib()} WIB`, size: "Small", isSubtle: true, wrap: true, spacing: "Medium" });
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    body,
    actions: ctx.dashboardUrl ? [{ type: "Action.OpenUrl", title: "Open dashboard", url: ctx.dashboardUrl }] : undefined,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface SendTeamsAlertsOptions {
  /** Override the webhook URL (falls back to TEAMS_WEBHOOK_URL env var) */
  webhookUrl?: string;
  /** Public URL of the dashboard for the card's CTA button */
  dashboardUrl?: string;
  /** Active plant filter label shown in the card header */
  plant?: string;
  /** Active period label shown in the card header */
  period?: string;
  /** 2-sentence why + action (generateAlertNarrative) */
  narrative?: string;
  /** KPI snapshot for the facts block */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kpi?: any;
}

// ── Power Automate payload ────────────────────────────────────────────────────
// PA HTTP trigger accepts any JSON via triggerBody(). We send a flat object
// so the PA flow can use individual fields directly in its "Post to Teams" action
// without needing to parse a nested Adaptive Card structure.

function buildPowerAutomatePayload(
  alerts: KPIAlert[],
  options: { plant?: string; period?: string; dashboardUrl?: string; recommendation?: string }
) {
  const critical = alerts.filter((a) => a.severity === "critical");
  const warnings = alerts.filter((a) => a.severity === "warning");

  const now = new Date().toLocaleString("en-GB", {
    timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short",
  });

  // Pre-formatted text block — PA can paste this straight into a Teams message
  const alertsText = alerts
    .map((a) => {
      const icon = a.severity === "critical" ? "🔴" : a.severity === "warning" ? "🟡" : "🔵";
      const trend = a.trend != null ? ` (${a.trend > 0 ? "+" : ""}${a.trend.toFixed(1)}% MoM)` : "";
      return `${icon} **${a.kpi}**: ${a.message}${trend}`;
    })
    .join("\n\n");

  return {
    title:          "⚠️ Control Tower Manufacturing — KPI Alert",
    plant:          options.plant ?? "All Plant",
    period:         options.period ?? "",
    timestamp:      `${now} WIB`,
    criticalCount:  critical.length,
    warningCount:   warnings.length,
    dashboardUrl:   options.dashboardUrl ?? "",
    recommendation: options.recommendation ?? "",
    alertsText,
    alerts: alerts.map((a) => ({
      severity:  a.severity,
      kpi:       a.kpi,
      message:   a.message,
      trend:     a.trend,
      threshold: a.threshold,
    })),
  };
}

/**
 * Send a Teams alert card for a list of KPI alerts.
 *
 * Auto-detects webhook type:
 *   - powerplatform.com URL → Power Automate HTTP trigger (flat JSON)
 *   - everything else       → Teams Incoming Webhook (Adaptive Card)
 *
 * Returns { ok: true } on success, { ok: false, error } on failure.
 * Never throws — safe to call from background jobs and cron routes.
 */
export async function sendTeamsAlerts(
  alerts: KPIAlert[],
  options: SendTeamsAlertsOptions = {}
): Promise<{ ok: boolean; error?: string }> {
  const webhookUrl = options.webhookUrl ?? process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) {
    return { ok: false, error: "TEAMS_WEBHOOK_URL not configured" };
  }
  if (alerts.length === 0) {
    return { ok: true };
  }

  const isPowerAutomate = webhookUrl.includes("powerplatform.com") ||
                          webhookUrl.includes("logic.azure.com");

  const payload = isPowerAutomate
    ? buildPowerAutomatePayload(alerts, {
        plant:          options.plant,
        period:         options.period,
        dashboardUrl:   options.dashboardUrl,
        recommendation: options.narrative,
      })
    : ({
        type: "message",
        attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", content: buildAlertCard(alerts, options) }],
      } satisfies TeamsWebhookPayload);

  try {
    const res = await fetch(webhookUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    // Power Automate returns 202 Accepted; Teams Incoming Webhook returns 200
    if (!res.ok && res.status !== 202) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Webhook returned ${res.status}: ${text}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}