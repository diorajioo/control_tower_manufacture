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
 * buildSummaryCard() is the scheduled summary in the same shape: header (cadence · plant, headline,
 * range · time), KPI facts + active alerts, main drivers, 3-sentence AI "what it means".
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

// ── Summary card (scheduled daily / weekly) ──────────────────────────────────

export interface SummaryContext {
  plant?:        string;
  /** e.g. "Last 30 days" */
  rangeLabel:    string;
  cadence:       "Daily" | "Weekly";
  dashboardUrl?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kpi:           any;
  /** Alerts active for the same snapshot */
  alerts:        KPIAlert[];
  narrative?:    string;
}

const pctText = (v: unknown) => (typeof v === "number" && isFinite(v) ? `${v > 0 ? "+" : ""}${v.toFixed(1)}% vs prior period` : "no prior period data");
const compact = (v: number) => Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);

/** Headline: one clause per KPI, computed in code. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summaryHeadline(kpi: any): string {
  const parts: string[] = [];
  const lt = kpi?.leadTime?.grossDays;
  if (typeof lt === "number" && lt > 0) {
    const over = lt - LEAD_TIME_TARGET_DAYS;
    parts.push(over > 0 ? `Lead time ${over.toFixed(2)} days over target` : "Lead time within target");
  }
  const fg = kpi?.output?.fgTrend;
  if (typeof fg === "number") parts.push(`Released FG ${fg > 0 ? "up" : "down"} ${Math.abs(fg).toFixed(1)}%`);
  const e2e = kpi?.productivity?.e2eTrend;
  if (typeof e2e === "number") parts.push(`E2E productivity ${e2e > 0 ? "up" : "down"} ${Math.abs(e2e).toFixed(1)}%`);
  return parts.join(" · ") || "No KPI data for this period";
}

export function summaryPreview(ctx: Pick<SummaryContext, "cadence" | "plant" | "kpi">): string {
  return `${ctx.cadence} summary · ${ctx.plant || "All Plant"}: ${summaryHeadline(ctx.kpi)}`;
}

export function buildSummaryCard(ctx: SummaryContext): AdaptiveCard {
  const { kpi } = ctx;
  const lt = kpi?.leadTime, o = kpi?.output, p = kpi?.productivity;
  const values: { title: string; value: string }[] = [];
  if (typeof lt?.grossDays === "number") values.push({ title: "Gross lead time", value: `${lt.grossDays.toFixed(2)} days · target ≤ ${LEAD_TIME_TARGET_DAYS} · ${pctText(lt.grossTrend)}` });
  if (typeof o?.fgQty === "number") values.push({ title: "Released FG", value: `${compact(o.fgQty)} pcs · ${pctText(o.fgTrend)}` });
  if (typeof p?.e2e === "number") values.push({ title: "E2E productivity", value: `${p.e2e.toFixed(1)} pcs/manhour · ${pctText(p.e2eTrend)}` });
  values.push({
    title: "Alerts",
    value: ctx.alerts.length > 0 ? ctx.alerts.map((a) => `${SEVERITY_LABEL[a.severity]} · ${a.message}`).join("; ") : "None",
  });

  const drivers = (["leadtime", "output", "productivity"] as const)
    .map((id) => ({ title: { leadtime: "Lead time", output: "Output", productivity: "Productivity" }[id], value: cardCause(kpi, id) }))
    .filter((d): d is { title: string; value: string } => !!d.value)
    .map((d) => ({ ...d, value: d.value.replace(/ \(largest (stage|plant)\)$/, "") }));

  const body: ACElement[] = [
    {
      type: "Container",
      style: "emphasis",
      bleed: true,
      items: [
        { type: "TextBlock", text: `${ctx.cadence.toUpperCase()} SUMMARY · ${(ctx.plant || "All Plant").toUpperCase()}`, size: "Small", weight: "Bolder", color: "Accent" },
        { type: "TextBlock", text: summaryHeadline(kpi), size: "Medium", weight: "Bolder", wrap: true, spacing: "Small" },
        { type: "TextBlock", text: `${ctx.rangeLabel} · ${nowWib()} WIB`, size: "Small", isSubtle: true, wrap: true, spacing: "None" },
      ],
    },
    { type: "FactSet", facts: values, spacing: "Medium" },
  ];
  if (drivers.length > 0) {
    body.push(
      { type: "TextBlock", text: "MAIN DRIVERS", size: "Small", weight: "Bolder", isSubtle: true, spacing: "Large" },
      { type: "FactSet", facts: drivers, spacing: "Small" },
    );
  }
  if (ctx.narrative) {
    body.push(
      { type: "TextBlock", text: "WHAT IT MEANS", size: "Small", weight: "Bolder", isSubtle: true, spacing: "Large" },
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

const SUMMARY_PROMPT = `You write the "what it means" part of a scheduled Microsoft Teams summary of the manufacturing dashboard,
read by plant and operations managers.

Rules:
- EXACTLY 3 sentences, at most 60 words in total, plain English. No markdown, bullets, headings or emojis.
- Sentence 1 — the most important condition and how it connects to another KPI (the story, not a list of numbers).
- Sentence 2 — why: the cause from the "Card causes" lines and Signals; keep numbers exactly as given, with units.
- Sentence 3 — so what: the business impact and one concrete action for this week.
- The card already lists each KPI value and % change; cite at most two numbers.

${KPI_RELATIONSHIPS}

${NARRATIVE_RULES}

Only Lead Time, Output and Productivity have data. Do not mention OEE, OPE, yield/bulk/pack loss, RFT or energy.`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateSummaryNarrative(kpi: any, ctx: { plant?: string; rangeLabel: string }): Promise<string | undefined> {
  if (!kpi?.leadTime) return undefined;
  return complete(SUMMARY_PROMPT, `KPI data (Plant: ${ctx.plant || "All Plant"}, ${ctx.rangeLabel}):
${buildKpiContext(kpi)}

Write the 3 sentences:`);
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