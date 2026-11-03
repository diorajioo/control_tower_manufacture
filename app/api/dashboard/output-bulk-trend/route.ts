import { NextRequest, NextResponse } from "next/server";
import { prodToday } from "@/lib/productionDay";
import { getServerSession } from "next-auth";
import { unstable_cache } from "next/cache";
import { authOptions } from "@/lib/auth";
import { getBulkOutputTrend } from "@/lib/queries";
import { parseOutputSel } from "@/lib/outputSel";

// Tactical → Output trend bars when FG / Bulk = Bulk: realized vs theoretical kg per month / week, grouped in SQL
// (DATE_TRUNC). Follows the header filters and the Output cross-filter. FG keeps /api/dashboard/trends.
async function run(plant: string, startDate: string, endDate: string, period: string, grain: "week" | "month", fdim: string, fval: string) {
  const sel = parseOutputSel(new URLSearchParams(fdim ? { fdim, fval } : {}));
  const rows = await getBulkOutputTrend({ plant, startDate, endDate, period: period || undefined }, grain, sel);
  return {
    series: rows.map((r) => ({
      date: new Date(r.BUCKET).toISOString().split("T")[0],
      real: Number(r.QTY_REAL ?? 0),
      theoretical: r.QTY_THEO == null ? null : Number(r.QTY_THEO),
    })),
  };
}

const cached = unstable_cache(run, ["output-bulk-trend-v3"], { revalidate: 3600, tags: ["kpi"] });

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const startDate = sp.get("startDate") ?? prodToday();
  try {
    return NextResponse.json(await cached(
      sp.get("plant") ?? "All Plant", startDate, sp.get("endDate") ?? startDate, sp.get("period") ?? "",
      sp.get("grain") === "week" ? "week" : "month", sp.get("fdim") ?? "", sp.get("fval") ?? "",
    ));
  } catch (err) {
    console.error("output-bulk-trend error:", err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}
