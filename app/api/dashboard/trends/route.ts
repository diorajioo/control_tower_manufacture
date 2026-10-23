import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { unstable_cache } from "next/cache";
import { authOptions } from "@/lib/auth";
import { getTrendKPIByPlant, type TrendGrain } from "@/lib/queries";
import { parseOutputSel, type OutputSel } from "@/lib/outputSel";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

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

async function runTrendQuery(plant: string, startDate: string, endDate: string, kpiType: string, period: string | undefined, grain: TrendGrain, outputSel: OutputSel | null = null) {
  const rows = await getTrendKPIByPlant({ plant, startDate, endDate, kpiType, period, grain, outputSel });

  const plantsSet = new Set<string>();
  const weekMap   = new Map<string, Record<string, number>>();
  // Lead time only: PO count + POs above target per point → Laney P′ chart on the client (KPI_VALUE stays avg days)
  const statsMap  = new Map<string, Record<string, { n: number; late: number; avgDays: number }>>();

  for (const row of rows) {
    const weekRaw = row.WEEK as unknown;
    const d: Date = weekRaw instanceof Date ? weekRaw : new Date(String(weekRaw));
    const week = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    // ClickHouse returns null/'' for the GROUPING SETS aggregate row; Snowflake returns 'All plants'
    const rawPlant = row.PLANT != null ? String(row.PLANT).trim() : "";
    const rowPlant = rawPlant === "" ? "All plants" : rawPlant;
    plantsSet.add(rowPlant);

    if (!weekMap.has(week)) weekMap.set(week, {});
    weekMap.get(week)![rowPlant] = Number(row.KPI_VALUE ?? 0);
    const r = row as { N?: number; LATE?: number };
    if (r.N != null) {
      if (!statsMap.has(week)) statsMap.set(week, {});
      statsMap.get(week)![rowPlant] = { n: Number(r.N), late: Number(r.LATE ?? 0), avgDays: Number(row.KPI_VALUE ?? 0) };
    }
  }

  return {
    trendSeries: Array.from(weekMap.entries())
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([date, vals]) => ({ date, ...vals })),
    plants: Array.from(plantsSet).sort(),
    pointStats: statsMap.size ? Object.fromEntries(statsMap) : undefined,
  };
}

// Cache key: [plant, period, kpiType, grain, Output cross-filter] for presets — stable regardless of exact dates.
const fetchTrendByPeriod = unstable_cache(
  async (plant: string, period: string, kpiType: string, grain: TrendGrain, fdim = "", fval = "") => {
    const { startDate, endDate } = resolvePeriodDates(period);
    return runTrendQuery(plant, startDate, endDate, kpiType, period, grain, fdim ? { dim: fdim, value: fval } as OutputSel : null);
  },
  ["trends-by-period-v7"],
  { revalidate: 3600, tags: ["trends"] }
);

// Cache key: [plant, startDate, endDate, kpiType, grain, Output cross-filter] for custom date ranges.
const fetchTrendByDates = unstable_cache(
  async (plant: string, startDate: string, endDate: string, kpiType: string, grain: TrendGrain, fdim = "", fval = "") => {
    return runTrendQuery(plant, startDate, endDate, kpiType, undefined, grain, fdim ? { dim: fdim, value: fval } as OutputSel : null);
  },
  ["trends-by-dates-v7"],
  { revalidate: 3600, tags: ["trends"] }
);

const KNOWN_PERIODS = new Set(["Today", "YTD", "30D", "90D", "6M"]);

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const plant     = searchParams.get("plant")     ?? "All Plant";
  const startDate = searchParams.get("startDate") ?? "2024-01-01";
  const endDate   = searchParams.get("endDate")   ?? new Date().toISOString().split("T")[0];
  const kpiType   = searchParams.get("kpiType")   ?? "leadtime";
  const period    = searchParams.get("period")    ?? "";
  const grain: TrendGrain = searchParams.get("grain") === "month" ? "month" : "week";
  // Output cross-filter (brand / line / …) — only the Output trend uses it
  const sel = kpiType === "output" ? parseOutputSel(searchParams) : null;

  try {
    const data = KNOWN_PERIODS.has(period)
      ? await fetchTrendByPeriod(plant, period, kpiType, grain, sel?.dim ?? "", sel?.value ?? "")
      : await fetchTrendByDates(plant, startDate, endDate, kpiType, grain, sel?.dim ?? "", sel?.value ?? "");
    return NextResponse.json(data);
  } catch (err) {
    console.error("Trends query error:", err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}