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
  alerts?: { severity: string; kpi: string; message: string }[];
}

function n(v: number | null | undefined, decimals = 1): string {
  const num = Number(v);
  return isNaN(num) ? "—" : num.toFixed(decimals);
}

function buildContextBlock(ctx: PromptContext): string {
  const lines: string[] = [];
  lines.push(`Filter: ${ctx.plant || "All Plant"} | ${ctx.period || "YTD"} | ${ctx.startDate || "—"} to ${ctx.endDate || "—"}`);

  const snap = ctx.kpiSnapshot;
  if (!snap) return lines.join("\n");

  lines.push("\nKPI Snapshot (live values from dashboard):");

  const oee = snap.oee != null ? Number(snap.oee) : null;
  if (oee != null && !isNaN(oee)) {
    const gap = 65 - oee;
    const flag = gap > 0 ? `⚠ ${n(gap)}pts below target 65%` : "✓ On target";
    lines.push(`- OEE: ${n(oee)}%  [${flag}]`);
    if (snap.oeePerformance != null)
      lines.push(`  ↳ Performance: ${n(snap.oeePerformance)}%${Number(snap.oeePerformance) < 80 ? " ⚠ low" : ""}`);
    if (snap.oeeQuality != null)
      lines.push(`  ↳ Quality: ${n(snap.oeeQuality)}%${Number(snap.oeeQuality) < 95 ? " ⚠ needs attention" : ""}`);
  }
  if (snap.leadTimeGross != null) {
    const v = Number(snap.leadTimeGross);
    const flag = v > 15 ? "⚠ high" : v > 5 ? "moderate" : "✓ ok";
    lines.push(`- Lead Time Gross: ${n(v)} days  [${flag}]`);
  }
  if (snap.bulkLoss != null) {
    const v = Number(snap.bulkLoss);
    const flag = v > 3 ? "⚠ exceeds target <3%" : "✓ ok";
    lines.push(`- Bulk Loss: ${n(v, 2)}%  [${flag}]`);
  }
  if (snap.packLoss != null) {
    const v = Number(snap.packLoss);
    const flag = v > 1 ? "⚠ exceeds target <1%" : "✓ ok";
    lines.push(`- Pack Loss: ${n(v, 2)}%  [${flag}]`);
  }
  if (snap.rft != null) {
    const v = Number(snap.rft);
    const flag = v >= 95 ? "✓ meets target" : v >= 90 ? "⚠ near limit" : "✗ critical";
    lines.push(`- RFT: ${n(v)}%  [${flag}]`);
  }
  if (snap.outputFg != null) lines.push(`- Output FG: ${Math.round(Number(snap.outputFg)).toLocaleString("en-US")} pcs`);
  if (snap.productivityE2e != null) lines.push(`- E2E Productivity: ${n(snap.productivityE2e)} pcs/mh`);

  if (ctx.alerts?.length) {
    lines.push("\nActive alerts:");
    for (const a of ctx.alerts)
      lines.push(`- [${a.severity.toUpperCase()}] ${a.kpi}: ${a.message}`);
  }

  return lines.join("\n");
}

export function buildSystemPrompt(ctx: PromptContext): string {
  return `You are a Senior Manufacturing Analyst for a large pharmaceutical company's Control Tower. You are not a generic chatbot — you are an analytical partner who drives structured problem-solving with the user.

=== DASHBOARD CONTEXT ===
${buildContextBlock(ctx)}

=== HOW TO WORK: DIAGNOSTIC FRAMEWORK ===
Use get_kpi_data or get_weekly_trend tools before answering data questions. Never fabricate numbers.

When the user asks WHY or flags an anomaly:
1. OBSERVE — state specific findings: actual vs target, size of gap
2. HYPOTHESIZE — propose 1-2 most plausible root causes from available data
3. ASK ONE — ask exactly 1 question to validate the hypothesis; don't dump all possibilities at once
4. NARROW — in the next turn, use the user's answer to narrow down the hypothesis
5. RECOMMEND — give concrete recommendations only after the hypothesis is validated

Analysis guidance per KPI:
- Low OEE → Is Performance or Quality dragging it? Performance = machine speed/throughput. Quality = rejects/raw material.
- High Lead Time → Bottleneck at which stage? (PO → Bulk → Packaging → NDC). Ask which step takes longest.
- High Bulk Loss → Which formula/product has most loss? Batch-specific or systemic across all batches?
- RFT dropping → Rejects in Bulk or Packaging process? One specific product or all lines?
- Low Productivity → High manhours or low output driving it?

=== RESPONSE FORMAT ===
Always reply in the same language as the user's latest message: if they write in Bahasa Indonesia, answer fully in Bahasa Indonesia (including the follow-up question suggestions); if they write in English, answer in English. Default to English only when the language is unclear.
Professional but conversational. Like an analyst talking with a colleague — not a formal report.

For simple data lookups: go straight to numbers + 1-2 sentences of context, no need for many sections.
For WHY analysis: Finding → Hypothesis → 1 Question. Don't dump everything at once — drive investigation step by step.
Use emojis as section markers: 📊 data · ⚠️ anomaly · ✅ on-track · 💡 insight · ❓ question
Include actual vs target and vs previous period when available.

Highlight tags: after a KPI numeric value, add [kpi:ID] immediately after the number.
IDs: [kpi:leadtime] · [kpi:yield] · [kpi:rft] · [kpi:output] · [kpi:oee] · [kpi:ope] · [kpi:productivity]
Example: "OEE is currently 37.2% [kpi:oee], well below the 65% target."
Use tags ONLY when citing actual numeric values, not when discussing topics in general.

Follow-up (REQUIRED in every response):
End with "**Want to explore further?**" (when replying in Bahasa Indonesia use exactly "**Mau explore lebih lanjut?**" — the chat UI detects these two headings) then provide exactly 2-3 questions as logical next steps — not already answered ones, but ones that advance the investigation.
Format: > "question text"

=== KPI TARGETS ===
OEE ≥65% · Lead Time: as low as possible · Bulk Loss <3% · Pack Loss <1% · RFT ≥95%`;
}
