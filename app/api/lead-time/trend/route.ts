import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { unstable_cache } from "next/cache";
import { authOptions } from "@/lib/auth";
import { getLeadTimeWeekly, getLeadTimeWeeklyByPosition, type TrendGrain } from "@/lib/queries";

export const maxDuration = 60;

// Lead Time Trend at a chosen granularity (week | month) — same shape as `trend` in /api/lead-time/charts.
// Used by LeadTimeTrendChart when the user switches to Monthly, so the other 4 charts are not re-queried.
async function runTrend(plant: string, startDate: string, endDate: string, period: string | undefined, grain: TrendGrain) {
  const filters = { plant, startDate, endDate, period };
  const [total, byPos] = await Promise.all([
    getLeadTimeWeekly(filters, grain),
    getLeadTimeWeeklyByPosition(filters, grain),
  ]);
  const day = (w: string) => new Date(w).toISOString().split("T")[0];
  return {
    total:     total.map((r) => ({ week: day(r.WEEK), days: Number((r.AVG_DAYS ?? 0).toFixed(2)) })),
    positions: byPos.map((r) => ({ week: day(r.WEEK), position: r.POSITION, days: Number((r.AVG_DAYS ?? 0).toFixed(2)) })),
  };
}

const cached = unstable_cache(runTrend, ["lead-time-trend-v1"], { revalidate: 3600, tags: ["kpi"] });

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const plant     = searchParams.get("plant")     ?? "All Plant";
  const startDate = searchParams.get("startDate") ?? `${new Date().getFullYear()}-01-01`;
  const endDate   = searchParams.get("endDate")   ?? new Date().toISOString().split("T")[0];
  const period    = searchParams.get("period")    ?? undefined;
  const grain: TrendGrain = searchParams.get("grain") === "month" ? "month" : "week";

  try {
    return NextResponse.json(await cached(plant, startDate, endDate, period, grain));
  } catch (err) {
    console.error("[lead-time/trend] query failed:", err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}
