import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
} from "@/lib/queries";

function delta(current: number, prev: number) {
  if (!prev || prev === 0) return null;
  return Number((((current - prev) / Math.abs(prev)) * 100).toFixed(1));
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

function val<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filters = {
    plant: searchParams.get("plant") ?? "All Plant",
    startDate: searchParams.get("startDate") ?? "2024-01-01",
    endDate: searchParams.get("endDate") ?? new Date().toISOString().split("T")[0],
  };

  const prev = { ...filters, ...prevPeriod(filters.startDate, filters.endDate) };

  const [
    leadTimeRes, yieldRes, rftRes, outputRes,
    e2eRes, upstreamRes, downstreamRes, oeeRes,
    prevLeadTimeRes, prevYieldRes, prevRftRes, prevE2ERes, prevOeeRes,
    ltByPosRes, oeeWeeklyRes, e2eWeeklyRes,
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
  ]);

  // Log any individual failures for debugging
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

  const leadTime = val(leadTimeRes, { AVG_LEADTIME: 0, AVG_GROSS_LEADTIME: 0, AVG_NETT_LEADTIME: 0 });
  const yield_ = val(yieldRes, { bulkLossPct: 0, packLossPct: 0, bulkLossKg: 0 });
  const rft = val(rftRes, { rftPct: 0 });
  const output = val(outputRes, { acceptedBulkKg: 0, releasedFgPcs: 0 });
  const e2e = val(e2eRes, { avgE2EProd: 0 });
  const upstream = val(upstreamRes, { avgUpstreamProd: 0 });
  const downstream = val(downstreamRes, { avgDownstreamProd: 0 });
  const oeeByPlant = val(oeeRes, [] as { PLANT: string; OEE: number }[]);
  const ltByPos = val(ltByPosRes, { nett: [] as { POSITION: string; AVG_HOURS: number }[], gross: [] as { POSITION: string; AVG_HOURS: number }[] });
  const oeeWeekly = val(oeeWeeklyRes, [] as { WEEK: string; OEE: number }[]);
  const e2eWeekly = val(e2eWeeklyRes, [] as { WEEK: string; AVG_PROD: number }[]);

  const prevLeadTime = val(prevLeadTimeRes, { AVG_LEADTIME: 0, AVG_GROSS_LEADTIME: 0, AVG_NETT_LEADTIME: 0 });
  const prevYield = val(prevYieldRes, { bulkLossPct: 0, packLossPct: 0, bulkLossKg: 0 });
  const prevRft = val(prevRftRes, { rftPct: 0 });
  const prevE2E = val(prevE2ERes, { avgE2EProd: 0 });
  const prevOee = val(prevOeeRes, [] as { PLANT: string; OEE: number }[]);

  const avgOEE = oeeByPlant.length > 0
    ? oeeByPlant.reduce((sum, r) => sum + r.OEE, 0) / oeeByPlant.length
    : 0;
  const prevAvgOEE = prevOee.length > 0
    ? prevOee.reduce((sum, r) => sum + r.OEE, 0) / prevOee.length
    : 0;

  return NextResponse.json({
    leadTime: {
      grossDays: Number((leadTime.AVG_GROSS_LEADTIME ?? 0).toFixed(2)),
      nettDays: Number((leadTime.AVG_NETT_LEADTIME ?? 0).toFixed(2)),
      grossTrend: delta(leadTime.AVG_GROSS_LEADTIME ?? 0, prevLeadTime.AVG_GROSS_LEADTIME ?? 0),
      nettTrend: delta(leadTime.AVG_NETT_LEADTIME ?? 0, prevLeadTime.AVG_NETT_LEADTIME ?? 0),
      byPositionNett: ltByPos.nett.map((r) => ({ position: r.POSITION, avgHours: Number(r.AVG_HOURS.toFixed(1)) })),
      byPositionGross: ltByPos.gross.map((r) => ({ position: r.POSITION, avgHours: Number(r.AVG_HOURS.toFixed(1)) })),
    },
    yield: {
      bulkLossPct: yield_.bulkLossPct,
      packLossPct: yield_.packLossPct,
      bulkLossKg: yield_.bulkLossKg,
      bulkLossTrend: delta(yield_.bulkLossPct, prevYield.bulkLossPct),
      packLossTrend: delta(yield_.packLossPct, prevYield.packLossPct),
    },
    rightFirstTime: {
      value: rft.rftPct,
      trend: delta(rft.rftPct, prevRft.rftPct),
    },
    output: {
      bulkQty: output.acceptedBulkKg,
      fgQty: output.releasedFgPcs,
    },
    oee: {
      value: Number(avgOEE.toFixed(1)),
      byPlant: oeeByPlant,
      trend: delta(avgOEE, prevAvgOEE),
      sparkline: oeeWeekly.map((r) => Number(r.OEE.toFixed(1))),
    },
    productivity: {
      e2e: e2e.avgE2EProd,
      upstream: upstream.avgUpstreamProd,
      downstream: downstream.avgDownstreamProd,
      e2eTrend: delta(e2e.avgE2EProd, prevE2E.avgE2EProd),
      byPlant: oeeByPlant.map((p) => ({ PLANT: p.PLANT })),
      sparkline: e2eWeekly.map((r) => Number(r.AVG_PROD.toFixed(1))),
    },
    _errors: failures.length > 0 ? failures.map(([name]) => name) : undefined,
  });
}
