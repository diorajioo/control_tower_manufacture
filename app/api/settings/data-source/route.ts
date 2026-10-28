import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { activeDataSource } from "@/lib/db";
import { isClickHouseConfigured, executeClickHouse } from "@/lib/clickhouse";
import { executeQuery as executeSnowflake } from "@/lib/snowflake";

async function pingClickHouse(): Promise<boolean> {
  if (!isClickHouseConfigured()) return false;
  try {
    await executeClickHouse("SELECT 1", []);
    return true;
  } catch {
    return false;
  }
}

async function pingSnowflake(): Promise<boolean> {
  try {
    await executeSnowflake("SELECT 1 AS N", []);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const active = activeDataSource();

  const [chOk, sfOk] = await Promise.all([pingClickHouse(), pingSnowflake()]);

  return NextResponse.json({
    active,
    clickhouse: {
      configured: isClickHouseConfigured(),
      connected: chOk,
      url: process.env.CLICKHOUSE_URL
        ? new URL(process.env.CLICKHOUSE_URL).hostname
        : null,
      db: process.env.CLICKHOUSE_DB_CONTROL_TOWER ?? null,
    },
    snowflake: {
      connected: sfOk,
      account: process.env.SNOWFLAKE_ACCOUNT ?? null,
      database: process.env.SNOWFLAKE_DATABASE ?? null,
      schema: process.env.SNOWFLAKE_SCHEMA ?? null,
      warehouse: process.env.SNOWFLAKE_WAREHOUSE ?? null,
    },
  });
}
