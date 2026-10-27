import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOutputMix, type OutputGroupDim } from "@/lib/queries";
import { parseOutputSel } from "@/lib/outputSel";

const DIMS: OutputGroupDim[] = ["brand", "variant", "su_group"];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const plant     = sp.get("plant")     ?? "All Plant";
  const startDate = sp.get("startDate") ?? new Date().toISOString().split("T")[0];
  const endDate   = sp.get("endDate")   ?? startDate;
  const period    = sp.get("period")    ?? undefined;
  const dimParam  = sp.get("dim") as OutputGroupDim | null;
  const dim       = dimParam && DIMS.includes(dimParam) ? dimParam : "brand";
  const partParam = sp.get("part");
  const part      = partParam === "groups" || partParam === "skus" ? partParam : "all";

  try {
    const { groups, skus } = await getOutputMix({ plant, startDate, endDate, period }, dim, parseOutputSel(sp), part);
    return NextResponse.json({
      groups: groups.map((g) => ({ name: g.GRP, qtyPo: Number(g.QTY_PO ?? 0), qtyReal: Number(g.QTY_REAL ?? 0) })),
      skus: skus.map((s) => ({
        code:       s.PRODUCT_CODE,
        name:       s.PRODUCT_NAME ?? s.PRODUCT_CODE,
        qtyPo:      Number(s.QTY_PO ?? 0),
        qtyReal:    Number(s.QTY_REAL ?? 0),
        pctContrib: Number(Number(s.PCT_CONTRIBUTION ?? 0).toFixed(1)),
      })),
    });
  } catch (err) {
    console.error("output-mix error:", err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}
