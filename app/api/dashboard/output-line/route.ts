import { NextRequest, NextResponse } from "next/server";
import { prodToday } from "@/lib/productionDay";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOutputByLine, getBulkOutputByLine } from "@/lib/queries";
import { parseOutputSel } from "@/lib/outputSel";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const plant     = sp.get("plant")     ?? "All Plant";
  const startDate = sp.get("startDate") ?? prodToday();
  const endDate   = sp.get("endDate")   ?? startDate;
  const period    = sp.get("period")    ?? undefined;

  try {
    const filters = { plant, startDate, endDate, period };
    if (sp.get("metric") === "bulk") {
      // Bulk (kg) per mixing line, with theoretical kg from the batch → Gap = realized − theoretical
      const rows = await getBulkOutputByLine(filters, parseOutputSel(sp));
      return NextResponse.json({
        lines: rows.map((r) => {
          const real = Number(r.QTY_REAL ?? 0), theo = r.QTY_THEO == null ? null : Number(r.QTY_THEO);
          return { line: r.LINE_NAME, qtyPo: Number(r.QTY_PO ?? 0), qtyReal: real, theoretical: theo,
            gap: theo == null ? null : real - theo, pctContrib: Number(Number(r.PCT_CONTRIBUTION ?? 0).toFixed(1)) };
        }),
      });
    }
    const rows = await getOutputByLine(filters, parseOutputSel(sp));
    return NextResponse.json({
      lines: rows.map((r) => ({
        line:        r.LINE_NAME,
        qtyPo:       Number(r.QTY_PO ?? 0),
        qtyReal:     Number(r.QTY_REAL ?? 0),
        theoretical: null,
        gap:         null,
        pctContrib:  Number(Number(r.PCT_CONTRIBUTION ?? 0).toFixed(1)),
      })),
    });
  } catch (err) {
    console.error("output-line error:", err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}
