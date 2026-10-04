// Translates every query the app can send into ClickHouse SQL — no ClickHouse server needed.
// Run: npx tsx scripts/check-clickhouse-sql.ts   (add --print to dump the translated SQL)
// Fails if any query still contains Snowflake-only syntax or has a bind mismatch.
process.env.DATA_SOURCE = "clickhouse";
process.env.CLICKHOUSE_URL ||= "https://example.clickhouse.cloud:8443";
process.env.CLICKHOUSE_USER ||= "check";
process.env.CLICKHOUSE_PASSWORD ||= "check";

const captured: { sql: string; params: Record<string, string> }[] = [];
globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  const params = Object.fromEntries(Array.from(url.searchParams).filter(([k]) => k.startsWith("param_")));
  captured.push({ sql: String(init?.body ?? ""), params });
  return new Response(JSON.stringify({ data: [] }), { status: 200 });
}) as typeof fetch;

(async () => {
  const q = await import("../lib/queries");
  const periods = ["Today", "This Week", "Last Week", "This Month", "Last Month", "YTD", "30D", "90D", "6M", "Custom"];
  const failures: string[] = [];
  let calls = 0;
  for (const period of periods) {
    const f = { plant: "J1", startDate: "2026-01-01", endDate: "2026-09-30", period, leadTimeType: "Gross Time" };
    for (const [name, fn] of Object.entries(q)) {
      if (typeof fn !== "function") continue;
      const args: unknown[] = name === "getLeadTimeByPlant" ? [f, 13] : name === "getTrendKPIByPlant" ? [{ ...f, kpiType: "leadtime" }] : [f];
      try { calls++; await (fn as (...a: unknown[]) => Promise<unknown>)(...args); }
      catch (e) { failures.push(`${name} [${period}]: ${(e as Error).message}`); }
    }
    for (const kpiType of ["leadtime", "upstream", "downstream", "e2e", "output", "oee", "rft", "bulkloss"])
      for (const grain of ["week", "month"] as const) {
        try { calls++; await q.getTrendKPIByPlant({ ...f, kpiType, grain }); }
        catch (e) { failures.push(`getTrendKPIByPlant ${kpiType}/${grain} [${period}]: ${(e as Error).message}`); }
      }
  }
  const unique = new Set(captured.map((c) => c.sql)).size;
  console.log(`calls: ${calls} · queries translated: ${captured.length} (${unique} distinct) · failures: ${failures.length}`);
  failures.slice(0, 20).forEach((f) => console.log("  ✗ " + f));
  if (process.argv.includes("--print")) for (const s of Array.from(new Set(captured.map((c) => c.sql)))) console.log("\n----\n" + s.trim());
  process.exit(failures.length ? 1 : 0);
})();
