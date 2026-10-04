// Single entry point for every data query in the app.
// DATA_SOURCE=snowflake (default) | clickhouse — same table names, same SQL (written in Snowflake syntax;
// ClickHouse gets it translated). Switching source = one env var; see docs/ARCHITECTURE.md → Data source.

import { executeQuery as executeSnowflake, assertTablesAllowed } from "@/lib/snowflake";
import { executeClickHouse } from "@/lib/clickhouse";

export type DataSource = "snowflake" | "clickhouse";

export function activeDataSource(): DataSource {
  return process.env.DATA_SOURCE === "clickhouse" ? "clickhouse" : "snowflake";
}

export async function executeQuery<T = Record<string, unknown>>(sql: string, binds: unknown[] = []): Promise<T[]> {
  if (activeDataSource() === "clickhouse") {
    assertTablesAllowed(sql); // same table allowlist for both sources (checked on the Snowflake-style names)
    return executeClickHouse<T>(sql, binds);
  }
  return executeSnowflake<T>(sql, binds);
}
