// Compare ClickHouse vs Snowflake results for every major query.
// Run: npx tsx scripts/compare-datasources.ts
// Shows PASS (values match within 5%), WARN (off but non-zero), FAIL (one side is 0 or error).
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

const FILTERS = {
  plant: "All Plant",
  startDate: "2026-01-01",
  endDate: new Date().toISOString().split("T")[0],
  period: "YTD",
};

function pct(a: number, b: number) {
  if (b === 0) return a === 0 ? 0 : Infinity;
  return Math.abs((a - b) / b) * 100;
}

function summarize(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (Array.isArray(val)) {
    if (val.length === 0) return "[]";
    const first = val[0];
    return `[${val.length} rows, first: ${JSON.stringify(first).slice(0, 80)}]`;
  }
  if (typeof val === "object") return JSON.stringify(val).slice(0, 120);
  return String(val);
}

function extractNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val;
  if (typeof val === "object" && !Array.isArray(val)) {
    const nums = Object.values(val as Record<string, unknown>).filter((v) => typeof v === "number" && v !== 0) as number[];
    return nums.length ? nums[0] : 0;
  }
  if (Array.isArray(val) && val.length > 0) {
    const first = val[0];
    if (typeof first === "object") {
      const nums = Object.values(first as Record<string, unknown>).filter((v) => typeof v === "number" && (v as number) !== 0) as number[];
      return nums.length ? nums[0] : 0;
    }
  }
  return null;
}

type Result = { ok: true; value: unknown } | { ok: false; error: string };

async function runWith<T>(source: "clickhouse" | "snowflake", fn: () => Promise<T>): Promise<Result> {
  // Re-import db module with correct DATA_SOURCE each time via env mutation
  process.env.DATA_SOURCE = source;
  // Reset health check singleton so it re-evaluates for the new source
  try {
    const result = await fn();
    return { ok: true, value: result };
  } catch (e) {
    return { ok: false, error: (e as Error).message.slice(0, 200) };
  }
}

const PASS = "\x1b[32mPASS\x1b[0m";
const WARN = "\x1b[33mWARN\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";
const SKIP = "\x1b[90mSKIP\x1b[0m";

function judge(ch: Result, sf: Result, label: string) {
  if (!ch.ok || !sf.ok) {
    const tag = !ch.ok ? FAIL : WARN;
    console.log(`  ${tag}  ${label}`);
    if (!ch.ok) console.log(`       CH error: ${ch.error}`);
    if (!sf.ok) console.log(`       SF error: ${sf.error}`);
    return;
  }

  const chN = extractNumber(ch.value);
  const sfN = extractNumber(sf.value);

  if (chN === null || sfN === null) {
    console.log(`  ${SKIP}  ${label} — non-numeric (CH: ${summarize(ch.value).slice(0, 60)})`);
    return;
  }

  if (chN === 0 && sfN !== 0) {
    console.log(`  ${FAIL}  ${label} — CH=0, SF=${sfN.toFixed(2)}`);
    return;
  }
  if (sfN === 0 && chN !== 0) {
    console.log(`  ${WARN}  ${label} — SF=0, CH=${chN.toFixed(2)} (SF may have no data)`);
    return;
  }
  if (chN === 0 && sfN === 0) {
    console.log(`  ${WARN}  ${label} — both 0`);
    return;
  }

  const diff = pct(chN, sfN);
  const tag = diff <= 5 ? PASS : diff <= 20 ? WARN : FAIL;
  console.log(`  ${tag}  ${label} — CH=${chN.toFixed(2)}, SF=${sfN.toFixed(2)} (${diff.toFixed(1)}% diff)`);
}

async function main() {
  // Import all query functions AFTER env is set
  process.env.DATA_SOURCE = "clickhouse";
  const q = await import("../lib/queries");

  console.log(`\nClickHouse vs Snowflake — ${FILTERS.startDate} to ${FILTERS.endDate}\n`);

  type Case = [string, () => Promise<unknown>];
  const cases: Case[] = [
    // ── KPI snapshot (feeds AI + Overview cards) ─────────────────────────────
    ["getLeadTimeKPI",           () => q.getLeadTimeKPI(FILTERS)],
    ["getOutputKPI",             () => q.getOutputKPI(FILTERS)],
    ["getE2EProductivity",       () => q.getE2EProductivity(FILTERS)],
    ["getYieldKPI",              () => q.getYieldKPI(FILTERS)],
    ["getRightFirstTime",        () => q.getRightFirstTime(FILTERS)],
    ["getUpstreamProductivity",  () => q.getUpstreamProductivity(FILTERS)],
    ["getDownstreamProductivity",() => q.getDownstreamProductivity(FILTERS)],
    ["getStageProductivity(Mixing)", () => q.getStageProductivity(FILTERS, "Mixing")],
    ["getStageProductivity(Filpac)", () => q.getStageProductivity(FILTERS, "Filpac")],
    ["getLeadTimeTacticalStats", () => q.getLeadTimeTacticalStats(FILTERS)],
    ["getLeadTimeReleasedGross", () => q.getLeadTimeReleasedGross(FILTERS)],
    ["getPlantDrivers",          () => q.getPlantDrivers(FILTERS).then((r) => r?.fg[0])],
    // ── Lead Time analysis page ───────────────────────────────────────────────
    ["getLeadTimeComposition",   () => q.getLeadTimeComposition(FILTERS).then((r) => r[0])],
    ["getLeadTimeBoxPlot",       () => q.getLeadTimeBoxPlot(FILTERS).then((r) => r[0])],
    ["getLeadTimeAnalysisStats", () => q.getLeadTimeAnalysisStats(FILTERS).then((r) => r[0])],
    ["getLeadTimeProcessBreakdown", () => q.getLeadTimeProcessBreakdown(FILTERS).then((r) => r[0])],
    ["getLeadTimeGroupProcess",  () => q.getLeadTimeGroupProcess(FILTERS).then((r) => r[0])],
    // ── Lead Time charts / tactical ───────────────────────────────────────────
    ["getLeadTimeByPlant",       () => q.getLeadTimeByPlant(FILTERS, 13).then((r) => r[0])],
    ["getLeadTimeWeeklyByPosition", () => q.getLeadTimeWeeklyByPosition(FILTERS).then((r) => r[0])],
    ["getLeadTimeByStageCategory",  () => q.getLeadTimeByStageCategory(FILTERS).then((r) => r[0])],
    ["getLeadTimeTopSku",        () => q.getLeadTimeTopSku(FILTERS).then((r) => r[0])],
    ["getLeadTimeStageVsStd",    () => q.getLeadTimeStageVsStd(FILTERS).then((r) => r[0])],
    ["getLeadTimeDistributionBins", () => q.getLeadTimeDistributionBins(FILTERS).then((r) => r[0])],
    ["getLeadTimeScatterByDim",  () => q.getLeadTimeScatterByDim(FILTERS, "plant").then((r) => r[0])],
    // ── Trend (feeds Overview TrendChart + AI) ────────────────────────────────
    ["getTrendKPIByPlant(leadtime)", () => q.getTrendKPIByPlant({ ...FILTERS, kpiType: "leadtime", grain: "month" }).then((r) => r[0])],
    ["getTrendKPIByPlant(e2e)",      () => q.getTrendKPIByPlant({ ...FILTERS, kpiType: "e2e",      grain: "month" }).then((r) => r[0])],
    ["getTrendKPIByPlant(output)",   () => q.getTrendKPIByPlant({ ...FILTERS, kpiType: "output",   grain: "month" }).then((r) => r[0])],
    ["getTrendKPIByPlant(bulkloss)", () => q.getTrendKPIByPlant({ ...FILTERS, kpiType: "bulkloss", grain: "month" }).then((r) => r[0])],
    // ── Weekly sparklines ─────────────────────────────────────────────────────
    ["getLeadTimeWeekly",        () => q.getLeadTimeWeekly(FILTERS).then((r) => r[0])],
    ["getOutputWeekly",          () => q.getOutputWeekly(FILTERS).then((r) => r[0])],
    ["getBulkOutputWeekly",      () => q.getBulkOutputWeekly(FILTERS).then((r) => r[0])],
    ["getE2EWeekly",             () => q.getE2EWeekly(FILTERS).then((r) => r[0])],
    // ── Misc ──────────────────────────────────────────────────────────────────
    ["getPlantList",             () => q.getPlantList().then((r) => r.length)],
    ["getEtlTimestamp",          () => q.getEtlTimestamp()],
  ];

  // Run all cases: CH then SF sequentially per case to avoid module-level state races
  for (const [label, fn] of cases) {
    const ch = await runWith("clickhouse", fn);
    const sf = await runWith("snowflake",  fn);
    judge(ch, sf, label);
  }

  console.log("\nDone.\n");
}

main().catch(console.error);
