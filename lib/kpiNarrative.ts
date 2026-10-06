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

  const causes = cardCauses(lt, o, p);
  if (causes.length > 0) {
    lines.push("Card causes (computed from the data — numbers not shown on the KPI cards):");
    causes.forEach((c) => lines.push(`- ${c}`));
  }

  const signals = directionSignals(lt, o);
  if (signals.length > 0) {
    lines.push("Signals (computed from the numbers above — treat as facts, do not contradict them):");
    signals.forEach((sig) => lines.push(`- ${sig}`));
  }

  return lines.join("\n");
}

/** The computed cause for one KPI (`leadtime` | `output` | `productivity`), e.g. for Teams alerts. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cardCause(kpi: any, id: string): string | undefined {
  const line = cardCauses(kpi?.leadTime ?? {}, kpi?.output ?? {}, kpi?.productivity ?? {}).find((l) => l.startsWith(`${id}: `));
  return line?.slice(id.length + 2);
}

/**
 * One cause per KPI card, computed in code so the card one-liner explains the value instead of
 * repeating it: the stage with the most time (lead time) and the plant that drives the change
 * (output, E2E productivity). Plant rows exist only for "All Plant" (see /api/dashboard/kpi);
 * without a prior period the plant cause is a share of the current level.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cardCauses(lt: any, o: any, p: any): string[] {
  const out: string[] = [];
  const isNum = (v: unknown): v is number => typeof v === "number" && isFinite(v);
  const share = (part: number, whole: number) => `${Math.round((part / whole) * 100)}%`;
  // Part of a change; above 100% the other plants moved the other way
  const ofChange = (part: number, whole: number, what: string) =>
    part / whole > 1 ? `more than the whole ${what} (other plants offset it)` : `${share(part, whole)} of the ${what}`;

  const stages: { position: string; avgHours: number }[] = lt.byPositionGross ?? [];
  const top = [...stages].sort((a, b) => b.avgHours - a.avgHours)[0];
  if (top && isNum(lt.grossDays) && lt.grossDays > 0) {
    const days = top.avgHours / 24;
    out.push(`leadtime: ${stageLabel(top.position)} stage averages ${num(days, 2)} days, ${share(days, lt.grossDays)} of gross lead time (largest stage)`);
  }

  const fg: { plant: string; fg: number; fgPrev: number | null }[] = o.plantDrivers ?? [];
  const fgTotal = fg.reduce((a, r) => a + r.fg, 0);
  if (fg.length > 1 && fgTotal > 0) {
    const diff = fg.reduce((a, r) => a + r.fg - (r.fgPrev ?? 0), 0);
    const sameWay = !isNum(o.fgTrend) || Math.sign(o.fgTrend) === Math.sign(diff);
    if (fg[0].fgPrev !== null && diff !== 0 && sameWay) {
      const d = [...fg].sort((a, b) => Math.sign(diff) * ((b.fg - b.fgPrev!) - (a.fg - a.fgPrev!)))[0];
      const chg = d.fgPrev ? pct(((d.fg - d.fgPrev) / d.fgPrev) * 100) : null;
      out.push(`output: ${d.plant} Released FG ${chg ?? "new"} vs prior period, ${ofChange(d.fg - d.fgPrev!, diff, diff > 0 ? "FG increase" : "FG decrease")}`);
    } else {
      const d = [...fg].sort((a, b) => b.fg - a.fg)[0];
      out.push(`output: ${d.plant} makes ${share(d.fg, fgTotal)} of Released FG (largest plant)`);
    }
  }

  const e2e: { plant: string; sum: number; n: number; sumPrev: number | null; nPrev: number | null }[] = p.plantDrivers ?? [];
  const n = e2e.reduce((a, r) => a + r.n, 0);
  if (e2e.length > 1 && n > 0) {
    const avg = e2e.reduce((a, r) => a + r.sum, 0) / n;
    const nPrev = e2e.reduce((a, r) => a + (r.nPrev ?? 0), 0);
    if (nPrev > 0) {
      // contribution_i = sum_i / N − sumPrev_i / N′ — adds up exactly to the change of the card's average
      const avgPrev = e2e.reduce((a, r) => a + (r.sumPrev ?? 0), 0) / nPrev;
      const diff = avg - avgPrev;
      const contrib = (r: typeof e2e[number]) => r.sum / n - (r.sumPrev ?? 0) / nPrev;
      const sameWay = !isNum(p.e2eTrend) || Math.sign(p.e2eTrend) === Math.sign(diff);
      if (diff !== 0 && sameWay) {
        const d = [...e2e].sort((a, b) => Math.sign(diff) * (contrib(b) - contrib(a)))[0];
        const before = d.nPrev ? `${num(d.sumPrev! / d.nPrev)} → ` : "";
        out.push(`productivity: ${d.plant} E2E ${before}${num(d.sum / d.n)} pcs/manhour, ${ofChange(contrib(d), diff, diff > 0 ? "E2E rise" : "E2E drop")}`);
        // A plant with a tiny share of POs behind most of the change usually means a data issue, not a real shift
        if (d.n / n < 0.05 && contrib(d) / diff >= 0.4) {
          out.push(`check: ${d.plant} has ${share(d.n, n)} of POs but drives ${share(contrib(d), diff)} of the E2E ${diff > 0 ? "rise" : "drop"} — worth a data check`);
        }
      }
    }
    if (!out.some((c) => c.startsWith("productivity:"))) {
      // Level cause: the plant that pulls the average furthest from the overall value
      const pull = (r: typeof e2e[number]) => (r.n * (r.sum / r.n - avg)) / n;
      const d = [...e2e].sort((a, b) => Math.abs(pull(b)) - Math.abs(pull(a)))[0];
      out.push(`productivity: ${d.plant} averages ${num(d.sum / d.n)} pcs/manhour on ${share(d.n, n)} of POs, pulling E2E ${pull(d) < 0 ? "down" : "up"} the most`);
    }
  }
  return out;
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
