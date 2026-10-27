// Quick diagnostic — run with: npx tsx scripts/test-kpi.ts
// Pass --clickhouse to test ClickHouse, default is Snowflake
import { readFileSync } from "fs";

const envContent = readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim().replace(/^"|"$/g, "");
  if (!process.env[key]) process.env[key] = val;
}

if (process.argv.includes("--clickhouse")) process.env.DATA_SOURCE = "clickhouse";

import { getLeadTimeKPI, getOutputKPI, getE2EProductivity } from "../lib/queries";

const filters = {
  plant: "All Plant",
  startDate: `${new Date().getFullYear()}-01-01`,
  endDate: new Date().toISOString().split("T")[0],
  period: "YTD",
};

async function main() {
  console.log("DATA_SOURCE:", process.env.DATA_SOURCE ?? "snowflake (default)");
  console.log("Filters:", filters);
  console.log();

  try {
    console.log("→ getLeadTimeKPI...");
    const lt = await getLeadTimeKPI(filters);
    console.log("  Lead Time:", lt);
  } catch (e) {
    console.error("  FAILED:", (e as Error).message);
  }

  try {
    console.log("→ getOutputKPI...");
    const out = await getOutputKPI(filters);
    console.log("  Output:", out);
  } catch (e) {
    console.error("  FAILED:", (e as Error).message);
  }

  try {
    console.log("→ getE2EProductivity...");
    const e2e = await getE2EProductivity(filters);
    console.log("  E2E:", e2e);
  } catch (e) {
    console.error("  FAILED:", (e as Error).message);
  }
}

main().catch(console.error);
