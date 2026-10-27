import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { unstable_cache } from "next/cache";
import { authOptions } from "@/lib/auth";
import { dimsFromParams, type LtDims } from "@/lib/leadTimeFilters";
import { getLeadTimeByLineSku, type LineActivity } from "@/lib/queries";

export const maxDuration = 60;

// Lead Time page → Analysis tab: process time per line × SKU for the "Lead Time per Line" bubble chart and the
// "Lead Time SKU per Line" table. Rows = [line, sku, poCount, spanDays (sum), qty (sum), avgGrossDays]; SKU names once in `skus`.

const r3 = (v: unknown) => (v == null ? null : Math.round(Number(v) * 1000) / 1000);

async function run(plant: string, startDate: string, endDate: string, period: string | undefined, activity: LineActivity, dims: string) {
  const lt = JSON.parse(dims) as LtDims;
  const rows = await getLeadTimeByLineSku({ plant, startDate, endDate, period, lt }, activity);
  const skus: Record<string, string> = {};
  return {
    skus,
    rows: rows.map((r) => {
      if (r.PRODUCT_CODE && r.PRODUCT_NAME) skus[r.PRODUCT_CODE] = r.PRODUCT_NAME;
      return [r.LINE_NAME, r.PRODUCT_CODE, Number(r.PO_COUNT), r3(r.SPAN_DAYS), r.QTY == null ? null : Number(r.QTY), r3(r.AVG_GROSS_DAYS)];
    }),
  };
}

const cached = unstable_cache(run, ["lead-time-lines-v3"], { revalidate: 3600, tags: ["kpi"] });

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const plant     = sp.get("plant")     ?? "All Plant";
  const startDate = sp.get("startDate") ?? `${new Date().getFullYear()}-01-01`;
  const endDate   = sp.get("endDate")   ?? new Date().toISOString().split("T")[0];
  const period    = sp.get("period")    ?? undefined;
  // `lineActivity`, not `activity`: that name is the page's ACTIVITY dimension filter (dimsFromParams)
  const activity: LineActivity = sp.get("lineActivity") === "mixing" ? "mixing" : "filpac";

  try {
    return NextResponse.json(await cached(plant, startDate, endDate, period, activity, JSON.stringify(dimsFromParams(sp))));
  } catch (e) {
    console.error("Lead time per line failed:", (e as Error).message);
    return NextResponse.json({ skus: {}, rows: [], error: "query_failed" }, { status: 500 });
  }
}
