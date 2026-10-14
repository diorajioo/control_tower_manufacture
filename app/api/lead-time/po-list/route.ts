import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { unstable_cache } from "next/cache";
import { authOptions } from "@/lib/auth";
import { dimsFromParams, type LtDims } from "@/lib/leadTimeFilters";
import { getLeadTimePoList } from "@/lib/queries";

export const maxDuration = 60;

// Lead Time page → Analysis tab: PO list under the distribution histogram (one row per PO, same population as
// /api/lead-time/distribution). ~20k POs per year and the Next data cache holds ≤ 2 MB per entry, so the payload
// is compact: rows are arrays in PO_LIST_COLUMNS order (days, 2 decimals), process-group times only for the
// chosen metric (gross / nett), SKU names once in `skus`. The browser filters by histogram bin and sorts.

const PO_LIST_COLUMNS = ["po", "sku", "gross", "nett", "PO", "Weighing", "Mixing", "Filpac", "Receive NDC", "WIP"] as const;

const r2 = (v: unknown) => (v == null ? null : Math.round(Number(v) * 100) / 100);
const GROUP_KEYS = ["PO", "WEIGHING", "MIXING", "FILPAC", "NDC", "WIP"] as const;

async function run(plant: string, startDate: string, endDate: string, period: string | undefined, basis: "created" | "released", metric: "gross" | "nett", dims: string) {
  const lt = JSON.parse(dims) as LtDims;
  const rows = await getLeadTimePoList({ plant, startDate, endDate, period, lt }, basis);
  const skus: Record<string, string> = {};
  const p = metric === "gross" ? "G" : "N";
  return {
    columns: PO_LIST_COLUMNS,
    skus,
    rows: rows.map((r) => {
      if (r.PRODUCT_CODE && r.PRODUCT_NAME) skus[r.PRODUCT_CODE] = r.PRODUCT_NAME;
      return [r.PROCESS_ORDER_FG, r.PRODUCT_CODE, r2(r.GROSS_DAYS), r2(r.NETT_DAYS), ...GROUP_KEYS.map((k) => r2(r[`${p}_${k}`]))];
    }),
  };
}

const cached = unstable_cache(run, ["lead-time-po-list-v1"], { revalidate: 3600, tags: ["kpi"] });

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const plant     = sp.get("plant")     ?? "All Plant";
  const startDate = sp.get("startDate") ?? `${new Date().getFullYear()}-01-01`;
  const endDate   = sp.get("endDate")   ?? new Date().toISOString().split("T")[0];
  const period    = sp.get("period")    ?? undefined;
  const basis     = sp.get("basis") === "released" ? "released" : "created";
  const metric    = sp.get("metric") === "nett" ? "nett" : "gross";

  try {
    return NextResponse.json(await cached(plant, startDate, endDate, period, basis, metric, JSON.stringify(dimsFromParams(sp))));
  } catch (e) {
    console.error("Lead time PO list failed:", (e as Error).message);
    return NextResponse.json({ columns: PO_LIST_COLUMNS, skus: {}, rows: [], error: "query_failed" }, { status: 500 });
  }
}
