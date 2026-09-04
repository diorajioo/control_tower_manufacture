import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { unstable_cache } from "next/cache";
import { authOptions } from "@/lib/auth";
import { getTrendKPIByPlant } from "@/lib/queries";

// ── Cached trend fetcher ───────────────────────────────────────────────────────
// Re-queries Snowflake at most once per hour per unique filter combination.

const fetchTrendData = unstable_cache(
  async (plant: string, startDate: string, endDate: string, kpiType: string) => {
    const rows = await getTrendKPIByPlant({ plant, startDate, endDate, kpiType });

    const plantsSet = new Set<string>();
    const weekMap   = new Map<string, Record<string, number>>();

    for (const row of rows) {
      const weekRaw = row.WEEK as unknown;
      const d: Date = weekRaw instanceof Date ? weekRaw : new Date(String(weekRaw));
      const week = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      const plant = String(row.PLANT ?? "Unknown");
      plantsSet.add(plant);

      if (!weekMap.has(week)) weekMap.set(week, {});
      weekMap.get(week)![plant] = Number(row.KPI_VALUE ?? 0);
    }

    const plants      = Array.from(plantsSet).sort();
    const trendSeries = Array.from(weekMap.entries())
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([date, vals]) => ({ date, ...vals }));

    return { trendSeries, plants };
  },
  ["trends-dashboard"],
  { revalidate: 3600, tags: ["trends"] }
);

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const plant     = searchParams.get("plant")     ?? "All Plant";
  const startDate = searchParams.get("startDate") ?? "2024-01-01";
  const endDate   = searchParams.get("endDate")   ?? new Date().toISOString().split("T")[0];
  const kpiType   = searchParams.get("kpiType")   ?? "leadtime";

  try {
    const data = await fetchTrendData(plant, startDate, endDate, kpiType);
    return NextResponse.json(data);
  } catch (err) {
    console.error("Trends query error:", err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}