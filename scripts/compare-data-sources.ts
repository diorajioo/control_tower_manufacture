// Parity check: runs the KPI queries on Snowflake AND ClickHouse with the same filters and diffs the numbers.
// Needs both sets of credentials in .env.local. Run: npx tsx scripts/compare-data-sources.ts [plant] [startDate] [endDate]
// Exit code 1 when any value differs by more than 0.1% (rounding noise is ignored).
import fs from "fs";
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const [plant = "All Plant", startDate = `${new Date().getFullYear()}-01-01`, endDate = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);

(async () => {
  const q = await import("../lib/queries");
  const f = { plant, startDate, endDate, period: "Custom" };
  const checks: [string, () => Promise<unknown>][] = [
    ["getLeadTimeKPI", () => q.getLeadTimeKPI(f)],
    ["getLeadTimeReleasedGross", () => q.getLeadTimeReleasedGross(f)],
    ["getLeadTimeComposition", () => q.getLeadTimeComposition(f)],
    ["getLeadTimeByPlant", () => q.getLeadTimeByPlant(f, 13)],
    ["getOutputKPI", () => q.getOutputKPI(f)],
    ["getE2EProductivity", () => q.getE2EProductivity(f)],
    ["getUpstreamProductivity", () => q.getUpstreamProductivity(f)],
    ["getDownstreamProductivity", () => q.getDownstreamProductivity(f)],
    ["getLeadTimeWeekly", () => q.getLeadTimeWeekly(f)],
    ["getTrendKPIByPlant leadtime/month", () => q.getTrendKPIByPlant({ ...f, kpiType: "leadtime", grain: "month" })],
  ];

  const flat = (v: unknown, prefix = ""): Record<string, unknown> => {
    if (Array.isArray(v)) return Object.assign({}, ...v.map((x, i) => flat(x, `${prefix}[${i}]`)));
    if (v && typeof v === "object" && !(v instanceof Date)) return Object.assign({}, ...Object.entries(v).map(([k, x]) => flat(x, prefix ? `${prefix}.${k}` : k)));
    return { [prefix]: v instanceof Date ? v.toISOString().slice(0, 10) : v };
  };

  let diffs = 0;
  for (const [name, run] of checks) {
    process.env.DATA_SOURCE = "snowflake"; const a = flat(await run());
    process.env.DATA_SOURCE = "clickhouse"; const b = flat(await run());
    const keys = Array.from(new Set(Object.keys(a).concat(Object.keys(b))));
    const bad = keys.filter((k) => {
      const x = a[k], y = b[k];
      if (typeof x === "number" || typeof y === "number") {
        const nx = Number(x), ny = Number(y);
        return Math.abs(nx - ny) > Math.max(1e-6, Math.abs(nx) * 0.001);
      }
      return String(x ?? "") !== String(y ?? "").slice(0, String(x ?? "").length || undefined);
    });
    diffs += bad.length;
    console.log(`${bad.length ? "✗" : "✓"} ${name}${bad.length ? `: ${bad.length} differences` : ""}`);
    bad.slice(0, 5).forEach((k) => console.log(`    ${k}: snowflake=${a[k]} clickhouse=${b[k]}`));
  }
  console.log(diffs ? `\n${diffs} differences` : "\nAll checks match");
  process.exit(diffs ? 1 : 0);
})();
