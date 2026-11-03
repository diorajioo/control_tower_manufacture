import { NextRequest, NextResponse } from "next/server";
import { prodToday, prodYearStart } from "@/lib/productionDay";
import { getServerSession } from "next-auth";
import { unstable_cache } from "next/cache";
import { authOptions } from "@/lib/auth";
import { dimsFromParams, type LtDims } from "@/lib/leadTimeFilters";
import { getLeadTimeScatterByDim, ScatterDimension } from "@/lib/queries";

export const maxDuration = 60;

const VALID_DIMS: ScatterDimension[] = ["brand", "variant", "su_group", "sku"];

// scope = where gross starts (PO Created / Released); metric = gross or nett average per PO.
async function runQuery(plant: string, startDate: string, endDate: string, period: string | undefined, dimension: ScatterDimension, dims: string, scope: "created" | "released" = "created", metric: "gross" | "nett" = "gross") {
  const rows = await getLeadTimeScatterByDim({ plant, startDate, endDate, period, lt: JSON.parse(dims) as LtDims }, dimension, scope, metric);
  return rows.map((r) => ({
    label:   r.DIM_VALUE,
    poCount: Number(r.PO_COUNT ?? 0),
    days:    Number((r.AVG_DAYS ?? 0).toFixed(2)),
  }));
}

const cached = unstable_cache(runQuery, ["lead-time-scatter-v8"], { revalidate: 3600, tags: ["kpi"] });

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const plant     = searchParams.get("plant")     ?? "All Plant";
  const startDate = searchParams.get("startDate") ?? prodYearStart();
  const endDate   = searchParams.get("endDate")   ?? prodToday();
  const period    = searchParams.get("period")    ?? undefined;
  const dim       = (searchParams.get("dim") ?? "sku") as ScatterDimension;

  if (!VALID_DIMS.includes(dim)) return NextResponse.json({ error: "Invalid dimension" }, { status: 400 });

  try {
    const scope  = searchParams.get("scope") === "released" ? "released" : "created";
    const metric = searchParams.get("metric") === "nett" ? "nett" : "gross";
    return NextResponse.json(await cached(plant, startDate, endDate, period, dim, JSON.stringify(dimsFromParams(searchParams)), scope, metric));
  } catch (e) {
    console.error("Lead time scatter failed:", (e as Error).message);
    return NextResponse.json([], { status: 500 });
  }
}
