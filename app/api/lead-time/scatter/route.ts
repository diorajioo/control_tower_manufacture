import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { unstable_cache } from "next/cache";
import { authOptions } from "@/lib/auth";
import { getLeadTimeScatterByDim, ScatterDimension } from "@/lib/queries";

export const maxDuration = 60;

const VALID_DIMS: ScatterDimension[] = ["brand", "variant", "su_group", "sku"];

async function runQuery(plant: string, startDate: string, endDate: string, period: string | undefined, dimension: ScatterDimension) {
  const rows = await getLeadTimeScatterByDim({ plant, startDate, endDate, period }, dimension);
  return rows.map((r) => ({
    label:   r.DIM_VALUE,
    poCount: Number(r.PO_COUNT ?? 0),
    days:    Number((r.AVG_DAYS ?? 0).toFixed(2)),
  }));
}

const cached = unstable_cache(runQuery, ["lead-time-scatter-v3"], { revalidate: 3600, tags: ["kpi"] });

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const plant     = searchParams.get("plant")     ?? "All Plant";
  const startDate = searchParams.get("startDate") ?? `${new Date().getFullYear()}-01-01`;
  const endDate   = searchParams.get("endDate")   ?? new Date().toISOString().split("T")[0];
  const period    = searchParams.get("period")    ?? undefined;
  const dim       = (searchParams.get("dim") ?? "sku") as ScatterDimension;

  if (!VALID_DIMS.includes(dim)) return NextResponse.json({ error: "Invalid dimension" }, { status: 400 });

  try {
    return NextResponse.json(await cached(plant, startDate, endDate, period, dim));
  } catch (e) {
    console.error("Lead time scatter failed:", (e as Error).message);
    return NextResponse.json([], { status: 500 });
  }
}
