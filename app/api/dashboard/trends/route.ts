import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTrendKPIByPlant } from "@/lib/queries";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filters = {
    plant:     searchParams.get("plant")     ?? "All Plant",
    startDate: searchParams.get("startDate") ?? "2024-01-01",
    endDate:   searchParams.get("endDate")   ?? new Date().toISOString().split("T")[0],
    kpiType:   searchParams.get("kpiType")   ?? "leadtime",
  };

  try {
    const rows = await getTrendKPIByPlant(filters);

    const plantsSet = new Set<string>();
    const weekMap   = new Map<string, Record<string, number>>();

    for (const row of rows) {
      // Normalize WEEK → YYYY-MM-DD using local date components to avoid
      // UTC offset shifting the date (e.g. 2026-04-06 07:00 +0700 → 2026-04-05 UTC)
      // cast to any so instanceof compiles; Snowflake may return Date or string
      const weekRaw = row.WEEK as any;
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

    return NextResponse.json({ trendSeries, plants });
  } catch (err) {
    console.error("Trends query error:", err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}
