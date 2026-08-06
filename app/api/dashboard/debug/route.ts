import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { executeQuery } from "@/lib/snowflake";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ALLOWED_TABLES = new Set([
    "CT_MANUF_LEADTIME", "CT_MANUF_KEMAS", "CT_MANUF_OLAH",
    "CT_MANUF_E2E", "CT_MANUF_TRENDS",
  ]);

  const table = new URL(req.url).searchParams.get("table") ?? "CT_MANUF_LEADTIME";
  const upper = table.toUpperCase();
  if (!ALLOWED_TABLES.has(upper)) {
    return NextResponse.json({ error: "Unknown table" }, { status: 400 });
  }

  const [cols, sample, distincts] = await Promise.all([
    executeQuery<{ COLUMN_NAME: string; DATA_TYPE: string }>(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM MIGRATION.INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'CONTROL_TOWER' AND TABLE_NAME = '${upper}'
      ORDER BY ORDINAL_POSITION
    `).catch(() => []),

    executeQuery(`
      SELECT * FROM MIGRATION.CONTROL_TOWER.${upper} LIMIT 3
    `).catch(() => []),

    // For CT_MANUF_LEADTIME: show distinct ACTIVITY_TYPE and LINE_CATEGORY values
    upper === "CT_MANUF_LEADTIME"
      ? executeQuery<{ COL: string; VAL: string; CNT: number }>(`
          SELECT 'ACTIVITY_TYPE' AS COL, ACTIVITY_TYPE::VARCHAR AS VAL, COUNT(*) AS CNT
          FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
          GROUP BY ACTIVITY_TYPE
          UNION ALL
          SELECT 'LINE_CATEGORY', LINE_CATEGORY::VARCHAR, COUNT(*)
          FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
          GROUP BY LINE_CATEGORY
          UNION ALL
          SELECT 'ACTIVITY', ACTIVITY::VARCHAR, COUNT(*)
          FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
          GROUP BY ACTIVITY
          ORDER BY COL, CNT DESC
        `).catch((e) => [{ error: e.message }])
      : Promise.resolve([]),
  ]);

  return NextResponse.json({ table: upper, columns: cols, sample, distincts });
}
