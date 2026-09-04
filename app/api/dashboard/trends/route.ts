import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { unstable_cache } from "next/cache";
import { authOptions } from "@/lib/auth";
import { getTrendKPIByPlant } from "@/lib/queries";

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

async function runTrendQuery(plant: string, startDate: string, endDate: string, kpiType: string, period?: string) {
  const rows = await getTrendKPIByPlant({ plant, startDate, endDate, kpiType, period });

  const plantsSet = new Set<string>();
  const weekMap   = new Map<string, Record<string, number>>();

  for (const row of rows) {
    const weekRaw = row.WEEK as unknown;
    const d: Date = weekRaw instanceof Date ? weekRaw : new Date(String(weekRaw));
    const week = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const rowPlant = String(row.PLANT ?? "Unknown");
    plantsSet.add(rowPlant);

    if (!weekMap.has(week)) weekMap.set(week, {});
    weekMap.get(week)![rowPlant] = Number(row.KPI_VALUE ?? 0);
  }

  return {
    trendSeries: Array.from(weekMap.entries())
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([date, vals]) => ({ date, ...vals })),
    plants: Array.from(plantsSet).sort(),
  };
}

// Cache key: [plant, period, kpiType] for presets — stable regardless of exact dates.
const fetchTrendByPeriod = unstable_cache(
  async (plant: string, period: string, kpiType: string) => {
    const { startDate, endDate } = resolvePeriodDates(period);
    return runTrendQuery(plant, startDate, endDate, kpiType, period);
  },
  ["trends-by-period"],
  { revalidate: 3600, tags: ["trends"] }
);

// Cache key: [plant, startDate, endDate, kpiType] for custom date ranges.
const fetchTrendByDates = unstable_cache(
  async (plant: string, startDate: string, endDate: string, kpiType: string) => {
    return runTrendQuery(plant, startDate, endDate, kpiType, undefined);
  },
  ["trends-by-dates"],
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

  try {
    const data = KNOWN_PERIODS.has(period)
      ? await fetchTrendByPeriod(plant, period, kpiType)
      : await fetchTrendByDates(plant, startDate, endDate, kpiType);
    return NextResponse.json(data);
  } catch (err) {
    console.error("Trends query error:", err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}