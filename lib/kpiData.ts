// KPI snapshot behind /api/dashboard/kpi — moved out of the route so server code
// (e.g. Teams alerts) reads the same cached data without an HTTP round trip.
import { unstable_cache } from "next/cache";
import {
  getLeadTimeKPI,
  getLeadTimeByPosition,
  getYieldKPI,
  getRightFirstTime,
  getOutputKPI,
  getE2EProductivity,
  getUpstreamProductivity,
  getDownstreamProductivity,
  getOEEByPlant,
  getOEEWeekly,
  getE2EWeekly,
  getProductivityDetails,
  getEtlTimestamp,
  getLeadTimeWeekly,
  getOutputWeekly,
  getBulkOutputWeekly,
  getYieldWeekly,
  getRFTWeekly,
  getLeadTimeComposition,
  getLeadTimeCompositionMonthly,
  getLeadTimeCompositionWeekly,
  getLeadTimeReleasedGross,
  getStageProductivity,
  getPlantDrivers,
} from "@/lib/queries";

// ── Helpers ────────────────────────────────────────────────────────────────────

function delta(current: number, prev: number) {
  if (!prev || prev === 0) return null;
  return Number((((current - prev) / Math.abs(prev)) * 100).toFixed(1));
}

type StageRows = { WEEK: string | null; PROD: number | null }[];
function stageProd(cur: PromiseSettledResult<StageRows>, prev: PromiseSettledResult<StageRows>, weekly: PromiseSettledResult<StageRows>) {
  const one = (r: PromiseSettledResult<StageRows>) => (r.status === "fulfilled" ? Number(r.value[0]?.PROD ?? 0) : 0);
  const value = Number(one(cur).toFixed(1)), prevValue = Number(one(prev).toFixed(1));
  return {
    value,
    prev: prevValue,
    trend: delta(value, prevValue),
    sparkline: weekly.status === "fulfilled" ? weekly.value.map((r) => Number(Number(r.PROD ?? 0).toFixed(1))) : [],
  };
}

// Per-plant rows for the AI one-liner causes (lib/kpiNarrative.ts). prev* stays null when the prior
// period has no rows (the CT tables start in 2026), so the narrative falls back to level shares.
type PlantDrivers = Awaited<ReturnType<typeof getPlantDrivers>> | null;
function plantFg(cur: PlantDrivers, prev: PlantDrivers) {
  if (!cur) return undefined;
  const before = new Map(prev?.fg.map((r) => [r.plant, r.fg]) ?? []);
  const hasPrev = before.size > 0;
  return cur.fg.map((r) => ({ plant: r.plant, fg: r.fg, fgPrev: hasPrev ? before.get(r.plant) ?? 0 : null }));
}
function plantE2E(cur: PlantDrivers, prev: PlantDrivers) {
  if (!cur) return undefined;
  const before = new Map(prev?.e2e.map((r) => [r.plant, r]) ?? []);
  const hasPrev = before.size > 0;
  return cur.e2e.map((r) => ({
    plant: r.plant, sum: r.sum, n: r.n,
    sumPrev: hasPrev ? before.get(r.plant)?.sum ?? 0 : null,
    nPrev:   hasPrev ? before.get(r.plant)?.n   ?? 0 : null,
  }));
}

function prevPeriod(startDate: string, endDate: string) {
  const startDt = new Date(startDate);
  const endDt = new Date(endDate);
  const durationMs = endDt.getTime() - startDt.getTime();
  const prevEnd = new Date(startDt.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return {
    startDate: prevStart.toISOString().split("T")[0],
    endDate: prevEnd.toISOString().split("T")[0],
  };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

/** Server-side date resolution for preset periods — mirrors client-side Header.tsx logic. */
function resolvePeriodDates(period: string): { startDate: string; endDate: string } {
  const today = new Date().toISOString().split("T")[0];
  const year  = new Date().getFullYear();
  switch (period) {
    case "Today": return { startDate: today, endDate: today };
    case "YTD":   return { startDate: `${year}-01-01`, endDate: today };
    case "30D":   return { startDate: daysAgo(30),  endDate: today };
    case "90D":   return { startDate: daysAgo(90),  endDate: today };
    case "6M":    return { startDate: daysAgo(180), endDate: today };
    default:      return { startDate: `${year}-01-01`, endDate: today };
  }
}

function val<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

// ── Core query executor (not cached — called by the two cached wrappers) ───────

async function runKPIQueries(
  plant: string,
  startDate: string,
  endDate: string,
  period?: string,
) {
  const filters = { plant, startDate, endDate, period };
  const prev    = { plant, ...prevPeriod(startDate, endDate), period: undefined };

  const [
    leadTimeRes, yieldRes, rftRes, outputRes,
    e2eRes, upstreamRes, downstreamRes, oeeRes,
    prevLeadTimeRes, prevYieldRes, prevRftRes, prevE2ERes, prevOeeRes,
    ltByPosRes, oeeWeeklyRes, e2eWeeklyRes,
    prevOutputRes, productivityDetailsRes, etlTimestampRes,
    leadTimeWeeklyRes, outputWeeklyRes, bulkOutputWeeklyRes, yieldWeeklyRes, rftWeeklyRes,
    ltCompRes, prevLtCompRes, ltCompMonthlyRes, ltCompWeeklyRes, ltReleasedGrossRes,
    mixingRes, prevMixingRes, mixingWeeklyRes, filpacRes, prevFilpacRes, filpacWeeklyRes,
    plantDriversRes, prevPlantDriversRes,
  ] = await Promise.allSettled([
    getLeadTimeKPI(filters),
    getYieldKPI(filters),
    getRightFirstTime(filters),
    getOutputKPI(filters),
    getE2EProductivity(filters),
    getUpstreamProductivity(filters),
    getDownstreamProductivity(filters),
    getOEEByPlant(filters),
    getLeadTimeKPI(prev),
    getYieldKPI(prev),
    getRightFirstTime(prev),
    getE2EProductivity(prev),
    getOEEByPlant(prev),
    getLeadTimeByPosition(filters),
    getOEEWeekly(filters),
    getE2EWeekly(filters),
    getOutputKPI(prev),
    getProductivityDetails(filters),
    getEtlTimestamp(),
    getLeadTimeWeekly(filters),
    getOutputWeekly(filters),
    getBulkOutputWeekly(filters),
    getYieldWeekly(filters),
    getRFTWeekly(filters),
    getLeadTimeComposition(filters),
    getLeadTimeComposition(prev),
    getLeadTimeCompositionMonthly(filters),
    getLeadTimeCompositionWeekly(filters),
    getLeadTimeReleasedGross(filters),
    getStageProductivity(filters, "mixing"),
    getStageProductivity(prev, "mixing"),
    getStageProductivity(filters, "mixing", "week"),
    getStageProductivity(filters, "filpac"),
    getStageProductivity(prev, "filpac"),
    getStageProductivity(filters, "filpac", "week"),
    // Per-plant split only means something across plants (AI one-liner causes)
    plant === "All Plant" ? getPlantDrivers(filters) : Promise.resolve(null),
    plant === "All Plant" ? getPlantDrivers(prev)    : Promise.resolve(null),
  ]);

  const failures = [
    ["leadTime", leadTimeRes], ["yield", yieldRes], ["rft", rftRes],
    ["output", outputRes], ["e2e", e2eRes], ["upstream", upstreamRes],
    ["downstream", downstreamRes], ["oee", oeeRes],
  ].filter(([, r]) => (r as PromiseSettledResult<unknown>).status === "rejected");
  if (failures.length > 0) {
    console.error("KPI partial failures:", failures.map(([name, r]) =>
      `${name}: ${(r as PromiseRejectedResult).reason?.message ?? r}`
    ));
  }

  const leadTime       = val(leadTimeRes,          { AVG_LEADTIME: 0, AVG_GROSS_LEADTIME: 0, AVG_NETT_LEADTIME: 0 });
  const yield_         = val(yieldRes,             { bulkLossPct: 0, packLossPct: 0, bulkLossKg: 0 });
  const rft            = val(rftRes,               { rftPct: 0 });
  const output         = val(outputRes,            { acceptedBulkKg: 0, releasedFgPcs: 0 });
  const e2e            = val(e2eRes,               { avgE2EProd: 0 });
  const upstream       = val(upstreamRes,          { avgUpstreamProd: 0 });
  const downstream     = val(downstreamRes,        { avgDownstreamProd: 0 });
  const oeeByPlant     = val(oeeRes,               [] as { PLANT: string; OEE: number }[]);
  const ltByPos        = val(ltByPosRes,           { nett: [] as { POSITION: string; AVG_HOURS: number }[], gross: [] as { POSITION: string; AVG_HOURS: number }[] });
  const oeeWeekly      = val(oeeWeeklyRes,         [] as { WEEK: string; OEE: number }[]);
  const e2eWeekly      = val(e2eWeeklyRes,         [] as { WEEK: string; AVG_PROD: number }[]);
  const prevOutput     = val(prevOutputRes,        { acceptedBulkKg: 0, releasedFgPcs: 0 });
  const productivityDets = val(productivityDetailsRes, { totalManhours: 0, avgOperators: 0 });
  const prevLeadTime   = val(prevLeadTimeRes,      { AVG_LEADTIME: 0, AVG_GROSS_LEADTIME: 0, AVG_NETT_LEADTIME: 0 });
  const prevYield      = val(prevYieldRes,         { bulkLossPct: 0, packLossPct: 0, bulkLossKg: 0 });
  const prevRft        = val(prevRftRes,           { rftPct: 0 });
  const prevE2E        = val(prevE2ERes,           { avgE2EProd: 0 });
  const prevOee        = val(prevOeeRes,           [] as { PLANT: string; OEE: number }[]);
  const etlTimestamp     = val(etlTimestampRes,      null as string | null);
  const leadTimeWeekly   = val(leadTimeWeeklyRes,    [] as { WEEK: string; AVG_DAYS: number }[]);
  const outputWeekly     = val(outputWeeklyRes,      [] as { WEEK: string; TOTAL_FG: number }[]);
  const bulkOutputWeekly = val(bulkOutputWeeklyRes,  [] as { WEEK: string; TOTAL_BULK: number }[]);
  const yieldWeekly      = val(yieldWeeklyRes,       [] as { WEEK: string; BULK_LOSS_PCT: number }[]);
  const rftWeekly        = val(rftWeeklyRes,         [] as { WEEK: string; RFT_PCT: number }[]);
  const emptyComp        = { va: 0, nnva: 0, unva: 0, wip: 0 };
  const ltComp           = val(ltCompRes,            emptyComp);
  const prevLtComp       = val(prevLtCompRes,        emptyComp);
  const ltCompMonthly    = val(ltCompMonthlyRes,     [] as { MONTH: string; VA: number; NNVA: number; UNVA: number; WIP: number }[]);
  const ltCompWeekly     = val(ltCompWeeklyRes,      [] as { WEEK: string;  VA: number; NNVA: number; UNVA: number; WIP: number }[]);
  const ltReleasedGross  = val(ltReleasedGrossRes, null as { AVG_GROSS: number | null } | null);

  const avg = (arr: { OEE: number; QUALITY?: number; PERFORMANCE?: number }[], key: "OEE" | "QUALITY" | "PERFORMANCE") =>
    arr.length > 0 ? arr.reduce((s, r) => s + (r[key] ?? 0), 0) / arr.length : 0;

  const avgOEE         = avg(oeeByPlant, "OEE");
  const avgQuality     = avg(oeeByPlant, "QUALITY");
  const avgPerformance = avg(oeeByPlant, "PERFORMANCE");
  const prevAvgOEE     = avg(prevOee,    "OEE");

  return {
    leadTime: {
      grossDays:         Number((leadTime.AVG_GROSS_LEADTIME ?? 0).toFixed(2)),
      grossReleasedDays: ltReleasedGross?.AVG_GROSS != null ? Number(ltReleasedGross.AVG_GROSS.toFixed(2)) : undefined,
      nettDays:          Number((leadTime.AVG_NETT_LEADTIME  ?? 0).toFixed(2)),
      grossTrend:     delta(leadTime.AVG_GROSS_LEADTIME ?? 0, prevLeadTime.AVG_GROSS_LEADTIME ?? 0),
      nettTrend:      delta(leadTime.AVG_NETT_LEADTIME  ?? 0, prevLeadTime.AVG_NETT_LEADTIME  ?? 0),
      byPositionNett:  ltByPos.nett.map((r) => ({ position: r.POSITION, avgHours: Number(r.AVG_HOURS.toFixed(1)) })),
      byPositionGross: ltByPos.gross.map((r) => ({ position: r.POSITION, avgHours: Number(r.AVG_HOURS.toFixed(1)) })),
      sparkline: leadTimeWeekly.map((r) => Number((r.AVG_DAYS ?? 0).toFixed(2))),
      composition: {
        vaDays:     Number(ltComp.va.toFixed(2)),
        nnvaDays:   Number(ltComp.nnva.toFixed(2)),
        unvaDays:   Number(ltComp.unva.toFixed(2)),
        wipDays:    Number(ltComp.wip.toFixed(2)),
        vaPrev:     Number(prevLtComp.va.toFixed(2)),
        nnvaPrev:   Number(prevLtComp.nnva.toFixed(2)),
        unvaPrev:   Number(prevLtComp.unva.toFixed(2)),
        wipPrev:    Number(prevLtComp.wip.toFixed(2)),
        vaTrend:    delta(ltComp.va,   prevLtComp.va),
        nnvaTrend:  delta(ltComp.nnva, prevLtComp.nnva),
        unvaTrend:  delta(ltComp.unva, prevLtComp.unva),
        wipTrend:   delta(ltComp.wip,  prevLtComp.wip),
        vaMonthly:   ltCompMonthly.map((r) => Number((r.VA   ?? 0).toFixed(2))),
        nnvaMonthly: ltCompMonthly.map((r) => Number((r.NNVA ?? 0).toFixed(2))),
        unvaMonthly: ltCompMonthly.map((r) => Number((r.UNVA ?? 0).toFixed(2))),
        wipMonthly:  ltCompMonthly.map((r) => Number((r.WIP  ?? 0).toFixed(2))),
        vaWeekly:    ltCompWeekly.map((r) => Number((r.VA   ?? 0).toFixed(2))),
        nnvaWeekly:  ltCompWeekly.map((r) => Number((r.NNVA ?? 0).toFixed(2))),
        unvaWeekly:  ltCompWeekly.map((r) => Number((r.UNVA ?? 0).toFixed(2))),
        wipWeekly:   ltCompWeekly.map((r) => Number((r.WIP  ?? 0).toFixed(2))),
      },
    },
    yield: {
      bulkLossPct:   yield_.bulkLossPct,
      packLossPct:   yield_.packLossPct,
      bulkLossKg:    yield_.bulkLossKg,
      bulkLossTrend: delta(yield_.bulkLossPct, prevYield.bulkLossPct),
      packLossTrend: delta(yield_.packLossPct, prevYield.packLossPct),
      sparkline: yieldWeekly.map((r) => Number((r.BULK_LOSS_PCT ?? 0).toFixed(2))),
    },
    rightFirstTime: {
      value: rft.rftPct,
      trend: delta(rft.rftPct, prevRft.rftPct),
      sparkline: rftWeekly.map((r) => Number((r.RFT_PCT ?? 0).toFixed(1))),
    },
    output: {
      bulkQty:   output.acceptedBulkKg,
      fgQty:     output.releasedFgPcs,
      fgTrend:   delta(output.releasedFgPcs,  prevOutput.releasedFgPcs),
      bulkTrend: delta(output.acceptedBulkKg, prevOutput.acceptedBulkKg),
      sparkline:     outputWeekly.map((r) => Number((r.TOTAL_FG   ?? 0).toFixed(0))),
      bulkSparkline: bulkOutputWeekly.map((r) => Number((r.TOTAL_BULK ?? 0).toFixed(0))),
      plantDrivers:  plantFg(val(plantDriversRes, null), val(prevPlantDriversRes, null)),
    },
    oee: {
      value:       Number(avgOEE.toFixed(1)),
      quality:     Number(avgQuality.toFixed(1)),
      performance: Number(avgPerformance.toFixed(1)),
      byPlant:     oeeByPlant,
      trend:       delta(avgOEE, prevAvgOEE),
      sparkline:   oeeWeekly.map((r) => Number(r.OEE.toFixed(1))),
    },
    productivity: {
      e2e:          e2e.avgE2EProd,
      e2ePrev:      prevE2E.avgE2EProd,
      upstream:     upstream.avgUpstreamProd,
      downstream:   downstream.avgDownstreamProd,
      e2eTrend:     delta(e2e.avgE2EProd, prevE2E.avgE2EProd),
      manhours:     productivityDets.totalManhours,
      avgOperators: productivityDets.avgOperators,
      byPlant:      oeeByPlant.map((p) => ({ PLANT: p.PLANT })),
      sparkline:    e2eWeekly.map((r) => Number(r.AVG_PROD.toFixed(1))),
      plantDrivers: plantE2E(val(plantDriversRes, null), val(prevPlantDriversRes, null)),
      // Toggle on the Overview card: Mixing (kg/mh) and Filpac (pcs/mh) — see getStageProductivity()
      stages: {
        mixing: stageProd(mixingRes, prevMixingRes, mixingWeeklyRes),
        filpac: stageProd(filpacRes, prevFilpacRes, filpacWeeklyRes),
      },
    },
    etlTimestamp,
    _errors: failures.length > 0 ? failures.map(([name]) => name) : undefined,
  };
}

// ── Cache layer ────────────────────────────────────────────────────────────────
//
// TWO separate cached functions with different key strategies:
//
// 1. Preset periods (YTD, 30D, 90D, 6M, Today)
//    Cache key: [plant, period]  ← e.g. ["All Plant", "YTD"]
//    All requests for the same plant+preset hit the same cache entry regardless
//    of what dates the client sent. Snowflake already uses CURRENT_DATE() for
//    presets via periodDateWhere(), so the client dates don't affect the result.
//
// 2. Custom date ranges
//    Cache key: [plant, startDate, endDate]
//    Cache hit only when multiple requests use the exact same date range.
//    Acceptable — custom ranges are rare; the user explicitly opted out of presets.

const fetchByPeriod = unstable_cache(
  async (plant: string, period: string) => {
    // Resolve dates server-side — needed for prevPeriod() comparison window.
    const { startDate, endDate } = resolvePeriodDates(period);
    return runKPIQueries(plant, startDate, endDate, period);
  },
  ["kpi-by-period-v10"],
  { revalidate: 3600, tags: ["kpi"] }
);

const fetchByDates = unstable_cache(
  async (plant: string, startDate: string, endDate: string) => {
    return runKPIQueries(plant, startDate, endDate, undefined);
  },
  ["kpi-by-dates-v10"],
  { revalidate: 3600, tags: ["kpi"] }
);

const KNOWN_PERIODS = new Set(["Today", "YTD", "30D", "90D", "6M"]);

/** Cached KPI snapshot: preset periods share one entry per plant; anything else is cached per date range. */
export async function getKpiSnapshot(plant: string, period: string, startDate: string, endDate: string) {
  if (!KNOWN_PERIODS.has(period) && !(startDate && endDate)) throw new Error("getKpiSnapshot: custom period needs startDate and endDate");
  return KNOWN_PERIODS.has(period)
    ? fetchByPeriod(plant, period)
    : fetchByDates(plant, startDate, endDate);
}

export type KpiSnapshot = Awaited<ReturnType<typeof runKPIQueries>>;
