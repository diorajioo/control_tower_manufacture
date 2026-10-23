import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOutputByLine } from "@/lib/queries";
import { parseOutputSel } from "@/lib/outputSel";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const plant     = sp.get("plant")     ?? "All Plant";
  const startDate = sp.get("startDate") ?? new Date().toISOString().split("T")[0];
  const endDate   = sp.get("endDate")   ?? startDate;
  const period    = sp.get("period")    ?? undefined;

  try {
    const rows = await getOutputByLine({ plant, startDate, endDate, period }, parseOutputSel(sp));
    return NextResponse.json({
      lines: rows.map((r) => ({
        line:          r.LINE_NAME,
        qtyPo:         Number(r.QTY_PO  ?? 0),
        qtyReal:       Number(r.QTY_REAL ?? 0),
        theoretical:   null,
        gap:           null,
        pctContrib:    Number((r.PCT_CONTRIBUTION ?? 0).toFixed(1)),
      })),
    });
  } catch (err) {
    console.error("output-line error:", err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}
