import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { unstable_cache } from "next/cache";
import { authOptions } from "@/lib/auth";
import { getLeadTimeDistributionBins } from "@/lib/queries";

export const maxDuration = 60;

async function runDistQuery(plant: string, startDate: string, endDate: string, period?: string) {
  const rows = await getLeadTimeDistributionBins({ plant, startDate, endDate, period });
  const first = rows[0];
  return {
    bins:   rows.map((r) => ({ binStart: Number(r.BIN_START), count: Number(r.CNT) })),
    mean:   first ? Number((first.MEAN_DAYS   ?? 0).toFixed(2)) : 0,
    median: first ? Number((first.MEDIAN_DAYS ?? 0).toFixed(2)) : 0,
    stddev: first ? Number((first.STDDEV_DAYS ?? 0).toFixed(2)) : 0,
    total:  first ? Number(first.TOTAL_POS ?? 0) : 0,
  };
}

const cached = unstable_cache(runDistQuery, ["lead-time-distribution-v1"], { revalidate: 3600, tags: ["kpi"] });

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const plant     = searchParams.get("plant")     ?? "All Plant";
  const startDate = searchParams.get("startDate") ?? `${new Date().getFullYear()}-01-01`;
  const endDate   = searchParams.get("endDate")   ?? new Date().toISOString().split("T")[0];
  const period    = searchParams.get("period")    ?? undefined;

  try {
    return NextResponse.json(await cached(plant, startDate, endDate, period));
  } catch (e) {
    console.error("Lead time distribution failed:", (e as Error).message);
    return NextResponse.json({ bins: [], mean: 0, median: 0, stddev: 0, total: 0, error: "query_failed" }, { status: 500 });
  }
}
