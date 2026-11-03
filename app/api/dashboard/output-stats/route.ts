import { NextRequest, NextResponse } from "next/server";
import { prodToday } from "@/lib/productionDay";
import { getServerSession } from "next-auth";
import { unstable_cache } from "next/cache";
import { authOptions } from "@/lib/auth";
import { getOutputStats } from "@/lib/queries";
import { parseOutputSel } from "@/lib/outputSel";
import { prevPeriod } from "@/lib/kpiData";

// Tactical → Output mini cards + donuts (total, trend vs prior period, SKU / PO counts, per plant, per form).
// Follows the header filters, FG / Bulk and the Output cross-filter (fdim / fval) — CLAUDE.md → Chart cross-filter.
async function run(plant: string, startDate: string, endDate: string, period: string, metric: "fg" | "bulk", fdim: string, fval: string) {
  const sel = parseOutputSel(new URLSearchParams(fdim ? { fdim, fval } : {}));
  const [cur, prev] = await Promise.all([
    getOutputStats({ plant, startDate, endDate, period: period || undefined }, metric, sel),
    getOutputStats({ plant, ...prevPeriod(startDate, endDate) }, metric, sel),
  ]);
  const trend = prev.total > 0 ? Number((((cur.total - prev.total) / prev.total) * 100).toFixed(1)) : null;
  return { ...cur, prevTotal: prev.total, trend };
}

const cached = unstable_cache(run, ["output-stats-v3"], { revalidate: 3600, tags: ["kpi"] });

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
    console.error("output-stats error:", err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}
