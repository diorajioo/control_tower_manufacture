// PO Lead Time Risk Score — step 1: pull one row per PO × ACTIVITY_SEQUENCE from Snowflake.
//
//   npx tsx --env-file=.env.local scripts/risk-score/extract.ts <out-dir>
//
// Writes <out-dir>/po_steps.json. Data stays outside the repo (internal production data).
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { executeQuery } from "../../lib/db";

const outDir = process.argv[2];
if (!outDir) throw new Error("usage: extract.ts <out-dir>");

const SQL = `
  WITH po AS (
    SELECT PROCESS_ORDER_FG
    FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
    GROUP BY 1
    HAVING MAX(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_STOP END) >= ?
  )
  SELECT
    t.PROCESS_ORDER_FG                AS PO,
    ANY_VALUE(t.PLANT)                AS PLANT,
    ANY_VALUE(t.PRODUCT_CODE)         AS PRODUCT,
    ANY_VALUE(t.SKU_GROUP)            AS SKU_GROUP,
    ANY_VALUE(t.SEDIAAN)              AS SEDIAAN,
    t.ACTIVITY_SEQUENCE               AS SEQ,
    ANY_VALUE(t.ACTIVITY)             AS ACTIVITY,
    ANY_VALUE(t.LINE_NAME)            AS LINE,
    MIN(t.ACTIVITY_START)             AS START_AT,
    MAX(t.ACTIVITY_STOP)              AS STOP_AT
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME t
  JOIN po USING (PROCESS_ORDER_FG)
  WHERE t.ACTIVITY <> 'ADJUST'
  GROUP BY t.PROCESS_ORDER_FG, t.ACTIVITY_SEQUENCE
`;

(async () => {
  const rows = await executeQuery<Record<string, unknown>>(SQL, ["2026-01-01"]);
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v ?? null);
  const out: Record<string, unknown>[] = rows.map((r) => ({ ...r, START_AT: iso(r.START_AT), STOP_AT: iso(r.STOP_AT) }));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "po_steps.json"), JSON.stringify(out));
  console.log(`rows: ${out.length}, POs: ${new Set(out.map((r) => r.PO)).size}`);
  process.exit(0);
})();
