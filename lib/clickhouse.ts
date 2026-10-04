// ClickHouse Cloud executor — same contract as lib/snowflake.ts executeQuery (rows as objects, UPPERCASE
// aliases preserved). Uses the ClickHouse HTTP interface via fetch, so no extra dependency is needed.
// Queries arrive in Snowflake syntax and are translated by lib/sql/clickhouseDialect.ts.
//
// Env (server-only): CLICKHOUSE_URL (https://<host>:8443), CLICKHOUSE_USER, CLICKHOUSE_PASSWORD,
// CLICKHOUSE_DB_CONTROL_TOWER, CLICKHOUSE_DB_DATAMART (databases that hold the same table names as Snowflake).

import { snowflakeToClickHouse, bindParams, assertNoSnowflakeLeft } from "@/lib/sql/clickhouseDialect";

const TIMEOUT_MS = 60_000;

export function isClickHouseConfigured(): boolean {
  return !!(process.env.CLICKHOUSE_URL && process.env.CLICKHOUSE_USER && process.env.CLICKHOUSE_PASSWORD);
}

/** Translated SQL + params for a Snowflake-syntax query (exported for tests / the parity script). */
export function toClickHouseQuery(sql: string, binds: unknown[] = []) {
  const translated = snowflakeToClickHouse(sql);
  assertNoSnowflakeLeft(translated);
  return bindParams(translated, binds);
}

export async function executeClickHouse<T = Record<string, unknown>>(sql: string, binds: unknown[] = []): Promise<T[]> {
  if (!isClickHouseConfigured()) throw new Error("ClickHouse is not configured (CLICKHOUSE_URL / USER / PASSWORD)");
  const { sql: chSql, params } = toClickHouseQuery(sql, binds);

  const url = new URL(process.env.CLICKHOUSE_URL!);
  url.searchParams.set("default_format", "JSON");
  // 64-bit integers (COUNT, SUM of ints) as JSON numbers, like Snowflake rows — not strings
  url.searchParams.set("output_format_json_quote_64bit_integers", "0");
  url.searchParams.set("readonly", "1");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(`param_${k}`, String(v ?? ""));

  const auth = Buffer.from(`${process.env.CLICKHOUSE_USER}:${process.env.CLICKHOUSE_PASSWORD}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "text/plain; charset=utf-8" },
    body: chSql,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 500);
    throw new Error(`ClickHouse query failed (${res.status}): ${detail}`);
  }
  const json = (await res.json()) as { data?: T[] };
  return json.data ?? [];
}
