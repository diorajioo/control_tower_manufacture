import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { executeQuery } from "@/lib/snowflake";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const tables = [
      "CT_MANUF_LEADTIME",
      "CT_MANUF_KEMAS",
      "CT_MANUF_REJECT",
      "CT_MANUF_TRENDS",
    ];

    const results: Record<string, string[]> = {};

    for (const table of tables) {
      const rows = await executeQuery<{ COLUMN_NAME: string; DATA_TYPE: string }>(`
        SELECT COLUMN_NAME, DATA_TYPE
        FROM MIGRATION.INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'CONTROL_TOWER'
          AND TABLE_NAME = '${table}'
        ORDER BY ORDINAL_POSITION
      `);
      results[table] = rows.map((r) => `${r.COLUMN_NAME} (${r.DATA_TYPE})`);
    }

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
