// Single entry point for every data query in the app.
// DATA_SOURCE=snowflake (default) | clickhouse — same table names, same SQL (written in Snowflake syntax;
// ClickHouse gets it translated). Switching source = one env var; see docs/ARCHITECTURE.md → Data source.

import { executeQuery as executeSnowflake, assertTablesAllowed } from "@/lib/snowflake";
import { executeClickHouse, isClickHouseConfigured } from "@/lib/clickhouse";

export type DataSource = "snowflake" | "clickhouse";

export function activeDataSource(): DataSource {
  return process.env.DATA_SOURCE === "clickhouse" ? "clickhouse" : "snowflake";
}

// ── ClickHouse health check ───────────────────────────────────────────────────
// Checked once per process (module-level singleton). If ClickHouse is unreachable
// at first use, the whole session falls back to Snowflake automatically.
// Re-checked on the next server restart so a recovered ClickHouse is picked up.
let _chHealthy: boolean | null = null;
let _chHealthPromise: Promise<boolean> | null = null;

async function clickHouseHealthy(): Promise<boolean> {
  if (_chHealthy !== null) return _chHealthy;
  if (_chHealthPromise) return _chHealthPromise;
  _chHealthPromise = (async () => {
    try {
      if (!isClickHouseConfigured()) return false;
      await executeClickHouse("SELECT 1", []);
      console.info("[db] ClickHouse health check passed — using ClickHouse");
      return true;
    } catch (e) {
      console.warn("[db] ClickHouse health check failed — falling back to Snowflake:", (e as Error).message);
      return false;
    }
  })().then((v) => { _chHealthy = v; _chHealthPromise = null; return v; });
  return _chHealthPromise;
}

export async function executeQuery<T = Record<string, unknown>>(sql: string, binds: unknown[] = []): Promise<T[]> {
  if (activeDataSource() === "clickhouse") {
    assertTablesAllowed(sql);
    return (await clickHouseHealthy()) ? executeClickHouse<T>(sql, binds) : executeSnowflake<T>(sql, binds);
  }
  return executeSnowflake<T>(sql, binds);
}
