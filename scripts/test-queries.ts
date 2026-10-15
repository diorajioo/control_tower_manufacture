import { readFileSync } from "fs";
const env = readFileSync(".env.local", "utf-8");
for (const l of env.split("\n")) { const eq = l.indexOf("="); if (eq > 0 && !l.trim().startsWith("#")) { const k = l.slice(0,eq).trim(), v = l.slice(eq+1).trim().replace(/^"|"$/g,""); if (!process.env[k]) process.env[k] = v; } }
process.env.DATA_SOURCE = "clickhouse";

import { getLeadTimeComposition, getLeadTimeAnalysisStats, getLeadTimeByPlant, getLeadTimeByStageCategory, getTrendKPIByPlant } from "../lib/queries";

const f = { plant: "All Plant", startDate: "2026-01-01", endDate: "2026-10-15", period: "YTD" };

async function run(label: string, fn: () => Promise<unknown>) {
  try {
    const r = await fn();
    const arr = Array.isArray(r) ? r : [r];
    console.log(`OK   ${label} → ${arr.length} rows, first: ${JSON.stringify(arr[0]).slice(0,120)}`);
  } catch (e) { console.log(`FAIL ${label} → ${(e as Error).message.slice(0,200)}`); }
}

(async () => {
  await run("getLeadTimeComposition",   () => getLeadTimeComposition(f));
  await run("getLeadTimeAnalysisStats", () => getLeadTimeAnalysisStats(f));
  await run("getLeadTimeByPlant",       () => getLeadTimeByPlant(f, 13));
  await run("getLeadTimeByStageCategory", () => getLeadTimeByStageCategory(f));
  await run("getTrendKPIByPlant(output)", () => getTrendKPIByPlant({ ...f, kpiType: "output", grain: "month" }));
  await run("getTrendKPIByPlant(oee)",    () => getTrendKPIByPlant({ ...f, kpiType: "oee",    grain: "month" }));
  await run("getTrendKPIByPlant(rft)",    () => getTrendKPIByPlant({ ...f, kpiType: "rft",    grain: "month" }));
})().catch(console.error);
