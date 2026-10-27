import { OUT_OF_SCOPE_NOTE } from "@/lib/aiScope";
import { KPI_RELATIONSHIPS, NARRATIVE_RULES, buildKpiContext } from "@/lib/kpiNarrative";
import { LEAD_TIME_TARGET_DAYS } from "@/lib/leadTimeDefinition";

// Only in-scope fields are rendered into the prompt (see lib/aiScope.ts).
export interface KPISnapshot {
  oee?: number | null;
  oeePerformance?: number | null;
  oeeQuality?: number | null;
  leadTimeGross?: number | null;
  bulkLoss?: number | null;
  packLoss?: number | null;
  rft?: number | null;
  outputFg?: number | null;
  outputBulk?: number | null;
  productivityE2e?: number | null;
}

export interface PromptContext {
  plant?: string;
  startDate?: string;
  endDate?: string;
  period?: string;
  kpiSnapshot?: KPISnapshot;
  /** In-scope parts of the /api/dashboard/kpi response (leadTime, output, productivity) — richer than kpiSnapshot */
  kpi?: unknown;
  alerts?: { severity: string; kpi: string; message: string }[];
}

function n(v: number | null | undefined, decimals = 1): string {
  const num = Number(v);
  return isNaN(num) ? "—" : num.toFixed(decimals);
}

function buildContextBlock(ctx: PromptContext): string {
  const lines: string[] = [];
  lines.push(`Filter: ${ctx.plant || "All Plant"} | ${ctx.period || "YTD"} | ${ctx.startDate || "—"} to ${ctx.endDate || "—"}`);

  if (ctx.kpi) {
    lines.push("\nKPI Snapshot (live values from dashboard):");
    lines.push(buildKpiContext(ctx.kpi));
    appendAlerts(lines, ctx);
    return lines.join("\n");
  }

  const snap = ctx.kpiSnapshot;
  if (!snap) return lines.join("\n");

  lines.push("\nKPI Snapshot (live values from dashboard):");

  if (snap.leadTimeGross != null) {
    const v = Number(snap.leadTimeGross);
    const flag = v > LEAD_TIME_TARGET_DAYS ? `⚠ above ${LEAD_TIME_TARGET_DAYS}-day target` : "✓ on target";
    lines.push(`- Lead Time Gross: ${n(v)} days  [${flag}]`);
  }
  if (snap.outputBulk != null) lines.push(`- Output Bulk: ${Math.round(Number(snap.outputBulk)).toLocaleString("en-US")} kg`);
  if (snap.outputFg != null) lines.push(`- Output FG: ${Math.round(Number(snap.outputFg)).toLocaleString("en-US")} pcs`);
  if (snap.productivityE2e != null) lines.push(`- E2E Productivity: ${n(snap.productivityE2e)} pcs/mh`);

  appendAlerts(lines, ctx);
  return lines.join("\n");
}

function appendAlerts(lines: string[], ctx: PromptContext) {
  if (!ctx.alerts?.length) return;
  lines.push("\nActive alerts:");
  for (const a of ctx.alerts)
    lines.push(`- [${a.severity.toUpperCase()}] ${a.kpi}: ${a.message}`);
}

export function buildSystemPrompt(ctx: PromptContext): string {
  return `You are a Senior Manufacturing Analyst for a large pharmaceutical company's Control Tower.

=== DASHBOARD CONTEXT ===
${buildContextBlock(ctx)}

=== HOW TO WORK ===
Use get_kpi_data or get_weekly_trend tools before answering data questions. Never fabricate numbers.
Scope: Lead Time (incl. stages), Output (bulk, FG), Productivity (E2E, upstream, downstream) only. ${OUT_OF_SCOPE_NOTE}

For WHY questions or anomalies: one Finding sentence → one Hypothesis sentence → one Question to validate. Step by step — don't dump all hypotheses at once.
For follow-up / conversational turns: just answer directly. No need to restart the full diagnostic.

${KPI_RELATIONSHIPS}

${NARRATIVE_RULES}

=== RESPONSE FORMAT ===
Language: reply in the user's language (English default).
Tone: analyst talking to a colleague. Direct, conversational — not a report.

**Summary / overview questions** (user asks "what's the status", "bagaimana performanya"):
- 4-5 tight bullet points: metric name, value, delta, one-word verdict
- ⚠️ 1-2 sentences on the biggest anomaly, with one KPI-to-KPI link
- 🔴 Risk: one sentence — what could get worse if left unaddressed
- 💡 Action: one concrete recommendation (who should look at what)
- One focused question to close

**WHY or anomaly questions**:
Finding (1 sentence) → Hypothesis (1 sentence, use "suggests" or "likely") → one Question

**Follow-up / conversational turns**:
Answer directly in 2-4 sentences or a few bullets. No headers, no restarting the diagnostic.

Rules:
- No markdown tables — bullets only
- No elaborate headers ("Bottom line:", "One caveat worth stating plainly:", etc.)
- Link one KPI to another in one sentence max — no multi-paragraph narratives
- Keep the whole response under ~180 words (split across turns if more is needed)
- Inline actual vs target when relevant (e.g. "16.9 days, target ≤13")
- Emojis as inline markers only: 📊 data · ⚠️ anomaly · ✅ on-track · 💡 insight

Highlight tags: add [kpi:ID] immediately after a cited numeric value.
IDs: [kpi:leadtime] · [kpi:output] · [kpi:productivity]
Example: "Gross lead time is 17.0 days [kpi:leadtime], above the 13-day target."
Use tags ONLY when citing actual numeric values, not when discussing in general.

Follow-up (REQUIRED in every response):
End with "**Want to explore further?**" (Bahasa Indonesia: exactly "**Mau explore lebih lanjut?**" — the chat UI detects these headings) then 2-3 questions as logical next steps.
Format: > "question text"

=== KPI TARGETS ===
Lead Time Gross ≤ ${LEAD_TIME_TARGET_DAYS} days`;
}
