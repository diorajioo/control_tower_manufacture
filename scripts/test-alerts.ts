import { readFileSync } from "fs";
const env = readFileSync(".env.local", "utf-8");
for (const l of env.split("\n")) { const eq = l.indexOf("="); if (eq > 0 && !l.trim().startsWith("#")) { const k = l.slice(0, eq).trim(), v = l.slice(eq + 1).trim().replace(/^"|"$/g, ""); if (!process.env[k]) process.env[k] = v; } }
process.env.DATA_SOURCE = "clickhouse";

import { alertsFromKpi } from "../lib/alerts";
import { getKpiSnapshot } from "../lib/kpiData";

(async () => {
  const snap = await getKpiSnapshot("All Plant", "YTD", "2026-01-01", "2026-10-15");
  console.log("leadTime.grossDays:", snap.leadTime.grossDays);
  console.log("leadTime.nettDays: ", snap.leadTime.nettDays);
  const alerts = alertsFromKpi(snap);
  console.log("alerts generated:", alerts.length);
  for (const a of alerts) console.log(" →", a.severity.toUpperCase(), `[${a.kpi}]`, a.message);
  if (alerts.length === 0) console.log(" → No alerts — all KPIs within normal range");
})().catch((e) => console.error("FAIL:", e.message));
