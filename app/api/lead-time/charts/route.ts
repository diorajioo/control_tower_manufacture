import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { unstable_cache } from "next/cache";
import { authOptions } from "@/lib/auth";
import { getLeadTimeWeekly, getLeadTimeWeeklyByPosition, getLeadTimeBySku, getLeadTimeByStageCategory, getLeadTimeTopSku } from "@/lib/queries";

// Allow up to 60 s on Vercel — needed when Snowflake warehouse auto-resumes from suspension.
export const maxDuration = 60;

// Charts on /lead-time (Strategic): weekly trend per POSITION + overall, lead time vs PO count per SKU,
// lead time per stage × VA/NNVA/UNVA (Pareto), and top 10 SKU by lead time (composition / P10–P90 range).
async function runChartQueries(plant: string, startDate: string, endDate: string, period?: string) {
  const filters = { plant, startDate, endDate, period };
  const [totalRes, byPosRes, bySkuRes, byStageRes, topSkuRes] = await Promise.allSettled([
    getLeadTimeWeekly(filters),
    getLeadTimeWeeklyByPosition(filters),
    getLeadTimeBySku(filters),
    getLeadTimeByStageCategory(filters),
    getLeadTimeTopSku(filters),
  ]);

  const failures = [["total", totalRes], ["byPosition", byPosRes], ["bySku", bySkuRes], ["byStage", byStageRes], ["topSku", topSkuRes]]
    .filter(([, r]) => (r as PromiseSettledResult<unknown>).status === "rejected");
  if (failures.length > 0) {
    console.error("Lead time chart failures:", failures.map(([name, r]) =>
      `${name}: ${(r as PromiseRejectedResult).reason?.message ?? r}`
    ));
  }

  const total  = totalRes.status  === "fulfilled" ? totalRes.value  : [];
  const byPos  = byPosRes.status  === "fulfilled" ? byPosRes.value  : [];
  const bySku  = bySkuRes.status  === "fulfilled" ? bySkuRes.value  : [];
  const byStage = byStageRes.status === "fulfilled" ? byStageRes.value : [];
  const topSku = topSkuRes.status === "fulfilled" ? topSkuRes.value : [];
  const d2 = (n: number | null) => Number((n ?? 0).toFixed(2));
  const week   = (w: string) => new Date(w).toISOString().split("T")[0];

  return {
    trend: {
      total:     total.map((r) => ({ week: week(r.WEEK), days: Number((r.AVG_DAYS ?? 0).toFixed(2)) })),
      positions: byPos.map((r) => ({ week: week(r.WEEK), position: r.POSITION, days: Number((r.AVG_DAYS ?? 0).toFixed(2)) })),
    },
    stages: byStage.map((r) => ({
      stage:    r.STAGE,
      attached: r.ATTACHED_STAGE,
      category: r.CATEGORY as "VA" | "NNVA" | "UNVA",
      days:     Number((r.DAYS ?? 0).toFixed(3)),
    })),
    skus: bySku.map((r) => ({
      code:    r.PRODUCT_CODE,
      name:    r.PRODUCT_NAME ?? r.PRODUCT_CODE,
      poCount: Number(r.PO_COUNT ?? 0),
      days:    Number((r.AVG_DAYS ?? 0).toFixed(2)),
    })),
    topSkus: topSku.map((r) => ({
      code:    r.PRODUCT_CODE,
      name:    r.PRODUCT_NAME ?? r.PRODUCT_CODE,
      poCount: Number(r.PO_COUNT ?? 0),
      avg:     d2(r.AVG_DAYS),
      p10:     d2(r.P10_DAYS),
      p90:     d2(r.P90_DAYS),
      va:      d2(r.VA),
      nnva:    d2(r.NNVA),
      unva:    d2(r.UNVA),
    })),
    _errors: failures.length > 0 ? failures.map(([name]) => name) : undefined,
  };
}

const cached = unstable_cache(runChartQueries, ["lead-time-charts-v6"], { revalidate: 3600, tags: ["kpi"] });

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const plant     = searchParams.get("plant")     ?? "All Plant";
  const startDate = searchParams.get("startDate") ?? `${new Date().getFullYear()}-01-01`;
  const endDate   = searchParams.get("endDate")   ?? new Date().toISOString().split("T")[0];
  const period    = searchParams.get("period")    ?? undefined;

  return NextResponse.json(await cached(plant, startDate, endDate, period));
}
