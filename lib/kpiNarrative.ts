// Shared narrative layer for every AI feature (AI Summary, AI Risks, Chat).
// Goal: the AI does not just read numbers back — it explains how one KPI drives another,
// grounded only in the data it is given. Scope = lib/aiScope.ts (Lead Time, Output, Productivity).

import { stageLabel } from "@/lib/leadTimeStages";
import { LEAD_TIME_TARGET_DAYS, LEAD_TIME_BASIS_LABEL } from "@/lib/leadTimeDefinition";

/** How the in-scope KPIs affect each other. Given to the model as domain knowledge, not as data. */
export const KPI_RELATIONSHIPS = `How the KPIs connect (domain knowledge — apply only when the numbers point that way):
1. Gross lead time = PO start → NDC receipt. Nett = time in actual production activities only. Gross − Nett = time outside active
   processing (queues, WIP, approvals). High Gross with low Nett means POs mostly wait: more people or overtime will not fix it,
   flow and scheduling will. The composition (Value-Added / Necessary Non-Value-Added such as PO administration and release /
   Waste such as WIP waiting) is a separate cut of the same time — never add VA + NNVA and call it Nett.
2. Lead time ↔ Released FG output: with similar work-in-process, longer lead time means POs finish later, so fewer POs release FG in the period
   (Little's law: WIP = throughput × lead time). A lead time increase usually shows up as lower FG output.
3. Upstream (bulk / mixing) feeds downstream (packing): bulk that is released late or in bursts piles up as WIP before packing —
   it raises gross lead time and leaves packing lines waiting, which lowers downstream productivity.
4. Bulk output (kg) vs Released FG (pcs): bulk rising while FG is flat or falling means bulk is waiting to be packed (downstream constraint).
5. Productivity = output per operator manhour: output down with productivity flat = fewer manhours / lower loading, not worse work;
   productivity up while output falls = fewer hours worked, not better flow; output up with productivity down = extra hours or people.
6. The stage with the most hours per PO is the first place to look; a waiting stage (WIP) larger than any processing stage points to flow, not capacity.
7. Upstream (bulk, kg-based) and downstream (packing, pcs-based) productivity use different units: never compare their values
   with each other — compare each only with its own prior period.`;

/** Writing rules that turn a data readout into a narrative. */
export const NARRATIVE_RULES = `Narrative rules:
- Tell a cause → effect story: what happened (number vs target / prior period) → why (the linked KPI or stage in the data) → what it means for the other KPIs → what to do.
- Connect at least two KPIs whenever the data allows it; name the link explicitly ("…, which is why Released FG fell …").
- Check direction before linking: only link two KPIs when their movements fit the relationship above.
  If they move against it (e.g. lead time up while Released FG is also up), say that plainly — it is a finding — and do not force a cause.
- Use only numbers and facts from the data. Never assume data you were not given (manhours, headcount, WIP counts, demand).
- Links are hypotheses: say "suggests", "likely" or "points to", never "proves".
- If the data cannot explain a movement, say what data would confirm it instead of guessing.`;

const pct = (v: unknown) => (typeof v === "number" ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%` : null);
const num = (v: unknown, d = 1) => (typeof v === "number" ? v.toLocaleString("en-US", { maximumFractionDigits: d }) : "—");

/**
 * Compact, model-friendly context from the /api/dashboard/kpi response — in-scope KPIs only,
 * plus the breakdowns the narrative needs (lead time composition, top stages, upstream vs downstream).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildKpiContext(kpi: any): string {
  const lt = kpi?.leadTime ?? {};
  const c  = lt.composition ?? {};
  const o  = kpi?.output ?? {};
  const p  = kpi?.productivity ?? {};
  const lines: string[] = [];

  lines.push(`Lead Time Gross: ${num(lt.grossDays, 2)} days (target ≤ ${LEAD_TIME_TARGET_DAYS}, ${LEAD_TIME_BASIS_LABEL})${pct(lt.grossTrend) ? `, ${pct(lt.grossTrend)} vs prior period` : ""}`);
  lines.push(`Lead Time Nett (active processing): ${num(lt.nettDays, 2)} days${pct(lt.nettTrend) ? `, ${pct(lt.nettTrend)} vs prior period` : ""}`);

  const total = (c.vaDays ?? 0) + (c.nnvaDays ?? 0) + (c.unvaDays ?? 0);
  if (total > 0) {
    const share = (d: number) => `${Math.round((d / total) * 100)}%`;
    lines.push(
      `Lead time composition per PO: Value-Added ${num(c.vaDays, 2)} d (${share(c.vaDays)}), ` +
      `Necessary Non-Value-Added ${num(c.nnvaDays, 2)} d (${share(c.nnvaDays)}), ` +
      `Waste ${num(c.unvaDays, 2)} d (${share(c.unvaDays)}) of which WIP waiting ${num(c.wipDays, 2)} d`,
    );
  }

  const stages: { position: string; avgHours: number }[] = lt.byPositionNett ?? [];
  if (stages.length > 0) {
    const top = [...stages].sort((a, b) => b.avgHours - a.avgHours).slice(0, 3)
      .map((s) => `${stageLabel(s.position)} ${num(s.avgHours / 24, 2)} d`).join(", ");
    lines.push(`Stages with the most actual time per PO: ${top}`);
  }

  lines.push(`Output: Released FG ${num(o.fgQty, 0)} pcs${pct(o.fgTrend) ? ` (${pct(o.fgTrend)} vs prior period)` : ""}, ` +
    `Bulk ${num(o.bulkQty, 0)} kg${pct(o.bulkTrend) ? ` (${pct(o.bulkTrend)})` : ""}`);
  lines.push(`E2E Productivity: ${num(p.e2e)} pcs/manhour${pct(p.e2eTrend) ? ` (${pct(p.e2eTrend)} vs prior period)` : ""}; ` +
    `Upstream (bulk) ${num(p.upstream)} · Downstream (packing) ${num(p.downstream)} per manhour`);

  const signals = directionSignals(lt, o);
  if (signals.length > 0) {
    lines.push("Signals (computed from the numbers above — treat as facts, do not contradict them):");
    signals.forEach((sig) => lines.push(`- ${sig}`));
  }

  return lines.join("\n");
}

/**
 * Direction facts computed in code, so the model never has to infer (and get wrong)
 * whether two KPIs moved together or against each other.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function directionSignals(lt: any, o: any): string[] {
  const out: string[] = [];
  const g = lt.grossTrend, n = lt.nettTrend, fg = o.fgTrend, bulk = o.bulkTrend;
  const isNum = (v: unknown): v is number => typeof v === "number" && isFinite(v);

  if (isNum(g) && isNum(n)) {
    if (g > 0 && n <= 0) out.push("Gross lead time rose while Nett fell → the increase is waiting time, not processing time.");
    else if (g > 0 && n > 0) out.push("Gross and Nett lead time both rose → processing itself got slower, not only waiting.");
    else if (g < 0 && n >= 0) out.push("Gross lead time fell while Nett did not → less waiting between stages.");
  }
  if (isNum(g) && isNum(fg)) {
    if (g > 0 && fg > 0) out.push("Lead time and Released FG both rose → the longer lead time has NOT reduced output this period; do not blame lower output on it.");
    else if (g > 0 && fg < 0) out.push("Lead time rose while Released FG fell → consistent with longer lead time holding back output.");
    else if (g < 0 && fg > 0) out.push("Lead time fell while Released FG rose → faster flow is consistent with higher output.");
  }
  if (isNum(fg) && isNum(bulk)) {
    if (bulk > fg + 2) out.push("Bulk grew faster than Released FG → bulk may be waiting to be packed (downstream constraint).");
    else if (fg > bulk + 2) out.push("Released FG grew faster than bulk → no sign of bulk piling up before packing.");
  }
  if (isNum(lt.grossDays) && isNum(lt.nettDays) && lt.grossDays > 0) {
    const waitShare = Math.round(((lt.grossDays - lt.nettDays) / lt.grossDays) * 100);
    out.push(`${waitShare}% of gross lead time is outside active processing (Gross − Nett).`);
  }
  return out;
}
