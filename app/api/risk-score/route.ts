import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { unstable_cache } from "next/cache";
import { executeQuery } from "@/lib/db";
import { loadModel, scoreActivePOs, type ActivePoRow } from "@/lib/riskScore";
import { LT_TABLE } from "@/lib/queries"; // lead time rows with PLANT = the PO's last plant

// Active POs released in the last 60 days that have not yet reached NDC (SEQ 45).
const SQL = `
  WITH released AS (
    SELECT PROCESS_ORDER_FG,
           MAX(ACTIVITY_STOP)    AS RELEASED_AT,
           ANY_VALUE(PLANT)      AS PLANT
    FROM ${LT_TABLE}
    WHERE ACTIVITY = 'PO'
      AND ACTIVITY_STOP IS NOT NULL
      AND ACTIVITY_STOP >= DATEADD(day, -60, CURRENT_DATE())
    GROUP BY 1
  ),
  received AS (
    SELECT DISTINCT PROCESS_ORDER_FG
    FROM ${LT_TABLE}
    WHERE ACTIVITY_SEQUENCE = 45
      AND ACTIVITY_STOP IS NOT NULL
  ),
  active_po AS (
    SELECT r.PROCESS_ORDER_FG, r.RELEASED_AT
    FROM released r
    LEFT JOIN received rc USING (PROCESS_ORDER_FG)
    WHERE rc.PROCESS_ORDER_FG IS NULL
  )
  SELECT
    t.PROCESS_ORDER_FG                               AS PO,
    ANY_VALUE(a.RELEASED_AT)                         AS RELEASED_AT,
    ANY_VALUE(t.PLANT)                               AS PLANT,
    ANY_VALUE(t.PRODUCT_CODE)                        AS PRODUCT,
    CONCAT(ANY_VALUE(t.SKU_GROUP), '|', ANY_VALUE(t.SEDIAAN)) AS "GROUP",
    ANY_VALUE(t.SEDIAAN)                             AS SEDIAAN,
    t.ACTIVITY_SEQUENCE                              AS SEQ,
    ANY_VALUE(t.ACTIVITY)                            AS ACTIVITY,
    MIN(t.ACTIVITY_START)                            AS START_AT,
    MAX(t.ACTIVITY_STOP)                             AS STOP_AT
  FROM ${LT_TABLE} t
  JOIN active_po a USING (PROCESS_ORDER_FG)
  WHERE t.ACTIVITY <> 'ADJUST'
  GROUP BY t.PROCESS_ORDER_FG, t.ACTIVITY_SEQUENCE
  ORDER BY t.PROCESS_ORDER_FG, t.ACTIVITY_SEQUENCE
`;

// Cache all POs once — plant filter applied per request outside the cache boundary.
const fetchAllScores = unstable_cache(
  async () => {
    const model = loadModel();
    if (!model) return { scores: [] as ReturnType<typeof scoreActivePOs>, modelMissing: true as const, asOf: "" };

    const rows = await executeQuery<ActivePoRow>(SQL, []);
    return { scores: scoreActivePOs(model, rows), modelMissing: false as const, asOf: model.asOf };
  },
  ["risk-score-v2"],
  { revalidate: 900 } // 15 min
);

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const plant = searchParams.get("plant") ?? "All Plant";
    const data = await fetchAllScores();
    const scores = (plant && plant !== "All Plant"
      ? data.scores.filter((r) => r.plant === plant)
      : data.scores
    ).filter((r) => r.score >= 0.5);
    return NextResponse.json({ ...data, scores });
  } catch (err) {
    console.error("[risk-score]", err);
    return NextResponse.json({ scores: [], error: String(err) }, { status: 500 });
  }
}
