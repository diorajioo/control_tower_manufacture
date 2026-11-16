import { NextRequest, NextResponse } from "next/server";
import { prodToday } from "@/lib/productionDay";
import { getServerSession } from "next-auth";
import { unstable_cache } from "next/cache";
import { authOptions } from "@/lib/auth";
import { getOutputPoList } from "@/lib/queries";
import { parseOutputSel } from "@/lib/outputSel";

// Output page → PO table: one row per FG process order (SNFG_NAME) or bulk batch (NOMO_NAME).
// Follows header filters, FG / Bulk, and the Output cross-filter (fdim / fval). Max 300 rows.
async function run(plant: string, startDate: string, endDate: string, period: string, metric: "fg" | "bulk", fdim: string, fval: string) {
  const sel = parseOutputSel(new URLSearchParams(fdim ? { fdim, fval } : {}));
  const rows = await getOutputPoList({ plant, startDate, endDate, period: period || undefined }, metric, sel);
  return { pos: rows };
}

const cached = unstable_cache(run, ["output-po-list-v1"], { revalidate: 3600, tags: ["kpi"] });

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const startDate = sp.get("startDate") ?? prodToday();
  try {
    return NextResponse.json(await cached(
      sp.get("plant") ?? "All Plant", startDate, sp.get("endDate") ?? startDate, sp.get("period") ?? "",
      sp.get("metric") === "bulk" ? "bulk" : "fg", sp.get("fdim") ?? "", sp.get("fval") ?? "",
    ));
  } catch (err) {
    console.error("output-po-list error:", err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}
