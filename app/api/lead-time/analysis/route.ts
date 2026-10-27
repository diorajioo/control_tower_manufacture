import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { unstable_cache } from "next/cache";
import { authOptions } from "@/lib/auth";
import { dimsFromParams, type LtDims } from "@/lib/leadTimeFilters";
import { LEAD_TIME_TARGET_DAYS } from "@/lib/leadTimeDefinition";
import {
  getLeadTimeAnalysisStats, getLeadTimeAnalysisWeekly, getLeadTimeProcessBreakdown, getLeadTimeComposition,
  getLeadTimeBoxPlot,
} from "@/lib/queries";

export const maxDuration = 60;

// Lead Time page → Analysis tab: Lead Time card (avg / median / quartiles / max, gross + nett, vs prior period,
// weekly sparkline), composition (VA / NNVA / UNVA) and time per activity (Group Process and Process sunburst).
// Scope = start of gross lead time (PO Created / Released); basis and unit are switched in the browser.

function prevPeriod(startDate: string, endDate: string) {
  const s = new Date(startDate), e = new Date(endDate);
  const prevEnd = new Date(s.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - (e.getTime() - s.getTime()));
  const iso = (d: Date) => d.toISOString().split("T")[0];
  return { startDate: iso(prevStart), endDate: iso(prevEnd) };
}

const num = (v: unknown) => (v == null ? null : Number(Number(v).toFixed(3)));
const trend = (cur: number | null, prev: number | null) =>
  cur == null || !prev ? null : Number((((cur - prev) / Math.abs(prev)) * 100).toFixed(1));

async function run(plant: string, startDate: string, endDate: string, period: string | undefined, scope: "created" | "released", dims: string) {
  const lt = JSON.parse(dims) as LtDims;
  const filters = { plant, startDate, endDate, period, lt };
  const prev = { plant, ...prevPeriod(startDate, endDate), lt };
  const [stats, prevStats, weekly, breakdown, comp, boxPlotRows] = await Promise.all([
    getLeadTimeAnalysisStats(filters, scope),
    getLeadTimeAnalysisStats(prev, scope),
    getLeadTimeAnalysisWeekly(filters, scope),
    getLeadTimeProcessBreakdown(filters),
    getLeadTimeComposition(filters),
    getLeadTimeBoxPlot(filters),
  ]);
  const block = (k: "GROSS" | "NETT") => {
    const s = stats as unknown as Record<string, unknown>, p = prevStats as unknown as Record<string, unknown>;
    const avg = num(s?.[`${k}_AVG`]);
    return {
      avg, median: num(s?.[`${k}_MEDIAN`]), p25: num(s?.[`${k}_P25`]), p75: num(s?.[`${k}_P75`]), p90: num(s?.[`${k}_P90`]), max: num(s?.[`${k}_MAX`]),
      poCount: Number(s?.[`${k}_N`] ?? 0),
      prevAvg: num(p?.[`${k}_AVG`]), trend: trend(avg, num(p?.[`${k}_AVG`])),
    };
  };
  return {
    targetDays: LEAD_TIME_TARGET_DAYS,
    gross: { ...block("GROSS"), onTimeCount: Number(stats?.ONTIME ?? 0), atRiskCount: Number(stats?.AT_RISK ?? 0), lateCount: Number(stats?.LATE ?? 0) },
    nett: block("NETT"),
    weekly: weekly.map((w) => ({ week: new Date(w.WEEK).toISOString().split("T")[0], gross: num(w.GROSS), nett: num(w.NETT) })),
    composition: { va: num(comp.va) ?? 0, nnva: num(comp.nnva) ?? 0, unva: num(comp.unva) ?? 0, wip: num(comp.wip) ?? 0 },
    activities: breakdown
      .map((r) => ({ stage: r.STAGE, activity: r.ACTIVITY, sequence: r.SEQ == null ? null : Number(r.SEQ), gross: num(r.GROSS_DAYS) ?? 0, nett: num(r.NETT_DAYS) ?? 0 }))
      .sort((a, b) => (a.sequence ?? 999) - (b.sequence ?? 999)),
    boxPlot: boxPlotRows.map((r) => ({
      stage:   r.STAGE,
      poCount: Number(r.PO_COUNT),
      min:     num(r.MIN_DAYS)    ?? 0,
      p25:     num(r.P25_DAYS)    ?? 0,
      median:  num(r.MEDIAN_DAYS) ?? 0,
      mean:    num(r.MEAN_DAYS)   ?? 0,
      p75:     num(r.P75_DAYS)    ?? 0,
      p90:     num(r.P90_DAYS)    ?? 0,
      max:     num(r.MAX_DAYS)    ?? 0,
    })),
  };
}

const cached = unstable_cache(run, ["lead-time-analysis-v4"], { revalidate: 3600, tags: ["kpi"] });

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const plant     = sp.get("plant")     ?? "All Plant";
  const startDate = sp.get("startDate") ?? `${new Date().getFullYear()}-01-01`;
  const endDate   = sp.get("endDate")   ?? new Date().toISOString().split("T")[0];
  const period    = sp.get("period")    ?? undefined;
  const scope     = sp.get("scope") === "released" ? "released" : "created";
  try {
    return NextResponse.json(await cached(plant, startDate, endDate, period, scope, JSON.stringify(dimsFromParams(sp))));
  } catch (e) {
    console.error("[lead-time/analysis] failed:", (e as Error).message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
