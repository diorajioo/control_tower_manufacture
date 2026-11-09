import type { OutputSel, OutputSelDim } from "@/lib/outputSel";
import { executeQuery } from "@/lib/db";
import { activeDims, type LtDims } from "@/lib/leadTimeFilters";
import { LEAD_TIME_START_SQL, NDC_RECEIVED_AT_SQL, NETT_ROW_SQL, NETT_START_AT_SQL, PO_CREATED_AT_SQL, PO_RELEASED_AT_SQL, LEAD_TIME_TARGET_DAYS } from "@/lib/leadTimeDefinition";
import { prodDate, PROD_TODAY_SQL } from "@/lib/productionDay";

interface QueryFilters {
  plant?: string;
  startDate?: string;
  endDate?: string;
  period?: string;       // "YTD" | "30D" | "90D" | "6M" | "Today" | "This Week" | "Last Week" | "This Month" | "Last Month" | "Custom"
  leadTimeType?: string; // "Gross Time" | "Nett Time"
  timeUnit?: string;     // "Daily" | "Hourly"
  /** Lead Time page filters (PO-level) — only read by lead time queries via ltWhere() / ltBinds() */
  lt?: LtDims;
}

// Lead time rows with PLANT = the PO's LAST plant (the row with the highest ACTIVITY_SEQUENCE, latest stop on ties).
// ~145 POs run bulk in one plant and pack in another; read per (plant, PO) they have no start or no end and drop out.
// Every lead time query reads this instead of the table, so the plant filter and per-plant groupings attribute
// each PO to one plant (decided 2026-10-13: last plant). Small table (~0.8M rows) — the window costs ~0.3 s.
export const LT_TABLE = `(
  SELECT t.* EXCLUDE (PLANT),
    FIRST_VALUE(t.PLANT) OVER (PARTITION BY t.PROCESS_ORDER_FG ORDER BY t.ACTIVITY_SEQUENCE DESC NULLS LAST, t.ACTIVITY_STOP DESC NULLS LAST) AS PLANT
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME t
)`;

// Plant filter as a parameterized predicate: plantWhere() gives the SQL (with ?),
// plantBinds() the matching values — append them after the date binds.
const hasPlant = (plant?: string): plant is string => !!plant && plant !== "All Plant";
const plantWhere = (plant?: string, col = "PLANT") => (hasPlant(plant) ? `AND ${col} = ?` : "");
const plantBinds = (plant?: string): unknown[] => (hasPlant(plant) ? [plant] : []);

// Lead time queries: plant filter + the Lead Time page filters (lib/leadTimeFilters.ts). A dimension filter keeps
// whole POs that have at least one row matching each value; it reads the raw table (these attributes do not depend
// on the owner plant). Use ltWhere()/ltBinds() exactly where plantWhere()/plantBinds() would go.
const ltWhere = (f: QueryFilters) => {
  const dims = activeDims(f.lt);
  return plantWhere(f.plant) + (dims.length === 0 ? "" : `
    AND PROCESS_ORDER_FG IN (
      SELECT PROCESS_ORDER_FG FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
      GROUP BY PROCESS_ORDER_FG
      HAVING ${dims.map((d) => `MAX(IFF(${d.column} IN (${d.values.map(() => "?").join(",")}), 1, 0)) = 1`).join(" AND ")}
    )`);
};
const ltBinds = (f: QueryFilters): unknown[] => [...plantBinds(f.plant), ...activeDims(f.lt).flatMap((d) => d.values)];

export type LtScopeArg = "created" | "released";
export type LtMetricArg = "gross" | "nett";
const ltStartSql = (scope: LtScopeArg = "created") => (scope === "released" ? PO_RELEASED_AT_SQL : PO_CREATED_AT_SQL);
/** Split column + the matching PO count column name for a Gross / Nett choice (ltSplitSql). */
const splitCol = (metric: LtMetricArg = "gross") => (metric === "nett" ? "NETT_MIN" : "GROSS_MIN");

// Lead time split per activity row, additive (one rule for the plant table, the PO table and the sunburst):
//   GROSS_MIN — every minute of the PO's gross window (start → Receive NDC) belongs to exactly one row: the row that
//               started last. Rows running in parallel hand the time over when the next one starts, so the rows of a PO
//               add up to its gross lead time exactly. Every ACTIVITY_TYPE counts (ACTUAL, WAITING, WIP).
//   NETT_MIN  — the same hand-over rule inside the nett window (NETT_START_AT_SQL → Receive NDC), for the rows that
//               are not PO / WIP (lib/leadTimeDefinition.ts): nett = window minus WIP time, and the rows add up to it.
// `src` = an SQL source with the lead time columns (already filtered); every source column is passed through. The next start is MIN over the following rows
// (explicit frame) rather than LEAD(), which ClickHouse does not have.
const ltSplitSql = (src: string, startSql: string) => `
  SELECT r.*,
    CASE WHEN w.w_start IS NULL OR w.w_end IS NULL THEN NULL
         ELSE GREATEST(DATEDIFF('minute', GREATEST(r.ACTIVITY_START, w.w_start), LEAST(COALESCE(r.next_start, w.w_end), w.w_end)), 0)
    END AS GROSS_MIN,
    CASE WHEN w.n_start IS NULL OR w.w_end IS NULL OR NOT (${NETT_ROW_SQL}) THEN NULL
         ELSE GREATEST(DATEDIFF('minute', GREATEST(r.ACTIVITY_START, w.n_start), LEAST(COALESCE(r.next_start, w.w_end), w.w_end)), 0)
    END AS NETT_MIN
  FROM (
    SELECT s.*,
      MIN(s.ACTIVITY_START) OVER (PARTITION BY s.PROCESS_ORDER_FG
        ORDER BY s.ACTIVITY_START, s.ACTIVITY_SEQUENCE, s.ACTIVITY_STOP
        ROWS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING) AS next_start
    FROM (${src}) s
    WHERE s.ACTIVITY_START IS NOT NULL
  ) r
  LEFT JOIN (
    SELECT PROCESS_ORDER_FG, ${startSql} AS w_start, ${NETT_START_AT_SQL} AS n_start, ${NDC_RECEIVED_AT_SQL} AS w_end
    FROM (${src}) s
    GROUP BY PROCESS_ORDER_FG
  ) w ON w.PROCESS_ORDER_FG = r.PROCESS_ORDER_FG`;

/** Nett minutes per PO (NETT_PO_KEY = PROCESS_ORDER_FG, nett_minutes): NETT_MIN of ltSplitSql summed. `src` is bound twice. */
const ltNettPerPoSql = (src: string) =>
  `SELECT PROCESS_ORDER_FG AS NETT_PO_KEY, SUM(NETT_MIN) AS nett_minutes FROM (${ltSplitSql(src, PO_CREATED_AT_SQL)}) np GROUP BY PROCESS_ORDER_FG`;

/** Join for a per-PO query on LT_TABLE (unqualified PROCESS_ORDER_FG): adds `n.nett_minutes`. Its binds
 *  (date + ltBinds, twice) come before the query's WHERE binds. */
const ltNettJoin = (datePred: string, filters: QueryFilters) =>
  `LEFT JOIN (${ltNettPerPoSql(`SELECT * FROM ${LT_TABLE} WHERE ${datePred} ${ltWhere(filters)}`)}) n ON n.NETT_PO_KEY = PROCESS_ORDER_FG`;

// Trend granularity for line charts. Only these two literals are ever put into DATE_TRUNC.
export type TrendGrain = "week" | "month";
const truncUnit = (grain?: string): TrendGrain => (grain === "month" ? "month" : "week");

// Translates the Tableau Period calc filter to a parameterized Snowflake WHERE predicate.
// Returns { sql, binds } — sql uses ? placeholders, binds holds the values.
// Days are production days (07:00 → 07:00 WIB, lib/productionDay.ts): a timestamp before 07:00 counts in the
// previous day, week and month. DATE-only columns (CORRECTION_DATE) are already a day.
// Period-relative cases use the server clock (no drift); custom/fallback cases bind the dates as typed DATE params.
const DATE_ONLY_COLS = new Set(["CORRECTION_DATE"]);
const dayOf = (col: string) => (DATE_ONLY_COLS.has(col.replace(/^\w+\./, "")) ? `${col}::DATE` : prodDate(col));

function periodDateWhere(
  col: string,
  period?: string,
  start?: string,
  end?: string
): { sql: string; binds: unknown[] } {
  const d = dayOf(col);
  const t = PROD_TODAY_SQL;
  switch (period) {
    case "Today":
      return { sql: `${d} = ${t}`, binds: [] };
    case "This Week":
      return { sql: `DATEADD('day', 1-DAYOFWEEKISO(${d}), ${d}) = DATEADD('day', 1-DAYOFWEEKISO(${t}), ${t})`, binds: [] };
    case "Last Week":
      return { sql: `DATEADD('day', 1-DAYOFWEEKISO(${d}), ${d}) = DATEADD('day', 1-DAYOFWEEKISO(DATEADD('week',-1,${t})), DATEADD('week',-1,${t}))`, binds: [] };
    case "This Month":
      return { sql: `DATE_TRUNC('month', ${d}) = DATE_TRUNC('month', ${t})`, binds: [] };
    case "Last Month":
      return { sql: `DATE_TRUNC('month', ${d}) = DATE_TRUNC('month', DATEADD('month',-1,${t}))`, binds: [] };
    case "YTD":
      return { sql: `${d} BETWEEN DATE_TRUNC('year', ${t}) AND ${t}`, binds: [] };
    case "30D":
      return { sql: `${d} BETWEEN DATEADD('day',-30,${t}) AND ${t}`, binds: [] };
    case "90D":
      return { sql: `${d} BETWEEN DATEADD('day',-90,${t}) AND ${t}`, binds: [] };
    case "6M":
      return { sql: `${d} BETWEEN DATEADD('month',-6,${t}) AND ${t}`, binds: [] };
    default:
      return { sql: `${d} BETWEEN ?::DATE AND ?::DATE`, binds: [start, end] };
  }
}

// Lead Time phases — both PO phases side by side, independent of LEAD_TIME_BASIS (for the Lead Time page).
// Gross lead time from PO Released → NDC (mirrors getLeadTimeKPI gross but using ACTIVITY_STOP of 'PO' as start).
export async function getLeadTimeReleasedGross(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  const rows = await executeQuery<{ AVG_GROSS: number }>(`
    SELECT AVG(gross_minutes) / 1440.0 AS AVG_GROSS
    FROM (
      SELECT
        PROCESS_ORDER_FG,
        DATEDIFF('minute', ${PO_RELEASED_AT_SQL}, ${NDC_RECEIVED_AT_SQL}) AS gross_minutes
      FROM ${LT_TABLE}
      WHERE ${datePred}
        ${ltWhere(filters)}
      GROUP BY PROCESS_ORDER_FG
      HAVING ${PO_RELEASED_AT_SQL} IS NOT NULL
        AND ${NDC_RECEIVED_AT_SQL} IS NOT NULL
    ) sub
  `, [...dateBinds, ...ltBinds(filters)]);
  return rows[0];
}

// Lead Time → CT_MANUF_LEADTIME
// Gross: DATEDIFF(lead time start → RECEIVE NDC stop) per PO — start per LEAD_TIME_BASIS (lib/leadTimeDefinition.ts)
// Nett:  per PO, first Weighing → Receive NDC minus WIP (ltNettPerPoSql, lib/leadTimeDefinition.ts)
export async function getLeadTimeKPI(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  const plantFilter = ltWhere(filters);

  const [grossRows, nettRows] = await Promise.all([
    executeQuery<{ AVG_GROSS: number }>(`
      SELECT AVG(gross_minutes) / 1440.0 AS AVG_GROSS
      FROM (
        SELECT
          PROCESS_ORDER_FG,
          DATEDIFF('minute',
            ${LEAD_TIME_START_SQL},
            ${NDC_RECEIVED_AT_SQL}
          ) AS gross_minutes
        FROM ${LT_TABLE}
        WHERE ${datePred}
          ${plantFilter}
        GROUP BY PROCESS_ORDER_FG
        HAVING ${LEAD_TIME_START_SQL} IS NOT NULL
          AND ${NDC_RECEIVED_AT_SQL} IS NOT NULL
      ) sub
    `, [...dateBinds, ...ltBinds(filters)]),
    executeQuery<{ AVG_NETT: number }>(`
      SELECT AVG(nett_minutes) / 1440.0 AS AVG_NETT
      FROM (${ltNettPerPoSql(`SELECT * FROM ${LT_TABLE} WHERE ${datePred} ${plantFilter}`)}) sub
    `, [...dateBinds, ...ltBinds(filters), ...dateBinds, ...ltBinds(filters)]),
  ]);

  return {
    AVG_LEADTIME: grossRows[0]?.AVG_GROSS ?? 0,
    AVG_GROSS_LEADTIME: grossRows[0]?.AVG_GROSS ?? 0,
    AVG_NETT_LEADTIME: nettRows[0]?.AVG_NETT ?? 0,
  };
}

// Lead Time composition → CT_MANUF_LEADTIME.ACTIVITY_CATEGORY (VA / NNVA / UNVA)
// Per PO: SUM(NET_LEADTIME) per category, then AVG across POs (days).
// WIP = UNVA rows with ACTIVITY_TYPE = 'WIP' (potential saving if WIP is removed).
// Activities run in parallel, so VA + NNVA + UNVA can exceed gross lead time.
// With `split`, the categories come from ltSplitSql (gross or nett), so VA + NNVA + UNVA add up to the lead time
// (Lead Time page + Tactical donut); without, the KPI snapshot's original NET_LEADTIME sums.
export async function getLeadTimeComposition(filters: QueryFilters, split?: { scope: LtScopeArg; metric: LtMetricArg }) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  if (split) {
    const binds = [...dateBinds, ...ltBinds(filters)];
    const col = splitCol(split.metric);
    const r = await executeQuery<{ VA: number; NNVA: number; UNVA: number; WIP: number }>(`
      SELECT AVG(va) / 1440.0 AS VA, AVG(nnva) / 1440.0 AS NNVA, AVG(unva) / 1440.0 AS UNVA, AVG(wip) / 1440.0 AS WIP
      FROM (
        SELECT PROCESS_ORDER_FG,
          SUM(CASE WHEN ACTIVITY_CATEGORY = 'VA'   THEN COALESCE(${col}, 0) ELSE 0 END) AS va,
          SUM(CASE WHEN ACTIVITY_CATEGORY = 'NNVA' THEN COALESCE(${col}, 0) ELSE 0 END) AS nnva,
          SUM(CASE WHEN ACTIVITY_CATEGORY = 'UNVA' THEN COALESCE(${col}, 0) ELSE 0 END) AS unva,
          SUM(CASE WHEN ACTIVITY_CATEGORY = 'UNVA' AND ACTIVITY_TYPE = 'WIP' THEN COALESCE(${col}, 0) ELSE 0 END) AS wip,
          SUM(${col}) AS total
        FROM (${ltSplitSql(`
          SELECT * FROM ${LT_TABLE}
          WHERE ${datePred}
            ${ltWhere(filters)}`, ltStartSql(split.scope))}) x
        GROUP BY PROCESS_ORDER_FG
      ) sub
      WHERE total IS NOT NULL
    `, [...binds, ...binds]);
    return { va: r[0]?.VA ?? 0, nnva: r[0]?.NNVA ?? 0, unva: r[0]?.UNVA ?? 0, wip: r[0]?.WIP ?? 0 };
  }
  const rows = await executeQuery<{ VA: number; NNVA: number; UNVA: number; WIP: number }>(`
    SELECT
      AVG(va_min)   / 1440.0 AS VA,
      AVG(nnva_min) / 1440.0 AS NNVA,
      AVG(unva_min) / 1440.0 AS UNVA,
      AVG(wip_min)  / 1440.0 AS WIP
    FROM (
      SELECT
        PROCESS_ORDER_FG,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'VA'   THEN NET_LEADTIME ELSE 0 END) AS va_min,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'NNVA' THEN NET_LEADTIME ELSE 0 END) AS nnva_min,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'UNVA' THEN NET_LEADTIME ELSE 0 END) AS unva_min,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'UNVA' AND ACTIVITY_TYPE = 'WIP' THEN NET_LEADTIME ELSE 0 END) AS wip_min
      FROM ${LT_TABLE}
      WHERE ${datePred}
        ${ltWhere(filters)}
      GROUP BY PROCESS_ORDER_FG
    ) sub
  `, [...dateBinds, ...ltBinds(filters)]);
  return {
    va:   rows[0]?.VA   ?? 0,
    nnva: rows[0]?.NNVA ?? 0,
    unva: rows[0]?.UNVA ?? 0,
    wip:  rows[0]?.WIP  ?? 0,
  };
}

// Lead Time composition by month → sparklines for VA / NNVA / UNVA cards
// Same per-PO logic as getLeadTimeComposition(), grouped by week of PO_FG_DONE_DATE.
export async function getLeadTimeCompositionWeekly(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  return executeQuery<{ WEEK: string; VA: number; NNVA: number; UNVA: number; WIP: number }>(`
    SELECT
      WEEK,
      AVG(va_min)   / 1440.0 AS VA,
      AVG(nnva_min) / 1440.0 AS NNVA,
      AVG(unva_min) / 1440.0 AS UNVA,
      AVG(wip_min)  / 1440.0 AS WIP
    FROM (
      SELECT
        DATE_TRUNC('week', ${prodDate("MAX(PO_FG_DONE_DATE)")}) AS WEEK,
        PROCESS_ORDER_FG,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'VA'   THEN NET_LEADTIME ELSE 0 END) AS va_min,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'NNVA' THEN NET_LEADTIME ELSE 0 END) AS nnva_min,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'UNVA' THEN NET_LEADTIME ELSE 0 END) AS unva_min,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'UNVA' AND ACTIVITY_TYPE = 'WIP' THEN NET_LEADTIME ELSE 0 END) AS wip_min
      FROM ${LT_TABLE}
      WHERE ${datePred}
        ${ltWhere(filters)}
      GROUP BY PROCESS_ORDER_FG
    ) sub
    GROUP BY WEEK
    ORDER BY WEEK
  `, [...dateBinds, ...ltBinds(filters)]);
}

// Same per-PO logic as getLeadTimeComposition(), grouped by month of PO_FG_DONE_DATE.
export async function getLeadTimeCompositionMonthly(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  return executeQuery<{ MONTH: string; VA: number; NNVA: number; UNVA: number; WIP: number }>(`
    SELECT
      MONTH,
      AVG(va_min)   / 1440.0 AS VA,
      AVG(nnva_min) / 1440.0 AS NNVA,
      AVG(unva_min) / 1440.0 AS UNVA,
      AVG(wip_min)  / 1440.0 AS WIP
    FROM (
      SELECT
        DATE_TRUNC('month', ${prodDate("MAX(PO_FG_DONE_DATE)")}) AS MONTH,
        PROCESS_ORDER_FG,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'VA'   THEN NET_LEADTIME ELSE 0 END) AS va_min,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'NNVA' THEN NET_LEADTIME ELSE 0 END) AS nnva_min,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'UNVA' THEN NET_LEADTIME ELSE 0 END) AS unva_min,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'UNVA' AND ACTIVITY_TYPE = 'WIP' THEN NET_LEADTIME ELSE 0 END) AS wip_min
      FROM ${LT_TABLE}
      WHERE ${datePred}
        ${ltWhere(filters)}
      GROUP BY PROCESS_ORDER_FG
    ) sub
    GROUP BY MONTH
    ORDER BY MONTH
  `, [...dateBinds, ...ltBinds(filters)]);
}

// Lead Time trend per POSITION → weekly line chart on /lead-time
// Per PO + POSITION: SUM(NET_LEADTIME), then AVG across POs that have that position, per week of PO_FG_DONE_DATE.
export async function getLeadTimeWeeklyByPosition(filters: QueryFilters, grain?: TrendGrain) {
  const unit = truncUnit(grain);
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  return executeQuery<{ WEEK: string; POSITION: string; AVG_DAYS: number }>(`
    SELECT WEEK, POSITION, AVG(pos_minutes) / 1440.0 AS AVG_DAYS
    FROM (
      SELECT
        DATE_TRUNC('${unit}', ${prodDate("MAX(PO_FG_DONE_DATE)")}) AS WEEK,
        PROCESS_ORDER_FG,
        POSITION,
        SUM(NET_LEADTIME) AS pos_minutes
      FROM ${LT_TABLE}
      WHERE ${datePred}
        AND POSITION IS NOT NULL
        ${ltWhere(filters)}
      GROUP BY PROCESS_ORDER_FG, POSITION
    ) sub
    GROUP BY WEEK, POSITION
    ORDER BY WEEK, POSITION
  `, [...dateBinds, ...ltBinds(filters)]);
}

// Lead Time vs PO count per SKU → scatter plot on /lead-time
// X = COUNT(DISTINCT PROCESS_ORDER_FG), Y = AVG gross lead time (PO start → RECEIVE NDC stop) in days.
// Limited to SKUs with fewer than 100 POs in the period (100+ = few outliers that compress the axis).
// Lead time per stage (POSITION) × ACTIVITY_CATEGORY → Pareto stacked bar on /lead-time
// DAYS = the ltSplitSql split (gross or nett) per PO, so the bars add up to the lead time.
// WIP rows ("WIP AFTER <activity>") are also mapped to the stage of that activity (ATTACHED_STAGE),
// so the chart can show WIP either as its own bar or folded into the stage it follows.
export async function getLeadTimeByStageCategory(filters: QueryFilters, scope: LtScopeArg = "created", metric: LtMetricArg = "gross") {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  const binds = [...dateBinds, ...ltBinds(filters)];
  const col = splitCol(metric);
  // ACTIVITY_SEQUENCE = process flow order 1–45 (PO 1 → WIP AFTER PO 2 → WEIGHING 3 … RECEIVE NDC 45), one per activity.
  // ACTIVITY_ID is not an order (every WIP activity has 99). Days = the ltSplitSql split ÷ POs with a value, so the
  // bars add up to the gross / nett lead time (Scope sets where gross starts).
  return executeQuery<{ STAGE: string; ACTIVITY: string; MIN_ACTIVITY_ID: number; MIN_SEQUENCE: number | null; ATTACHED_STAGE: string; CATEGORY: string; DAYS: number }>(`
    WITH base AS (${ltSplitSql(`
      SELECT * FROM ${LT_TABLE}
      WHERE ${datePred}
        ${ltWhere(filters)}`, ltStartSql(scope))}
    ),
    act_pos AS (
      SELECT ACTIVITY, MAX(POSITION) AS PARENT_STAGE
      FROM base
      WHERE POSITION IS NOT NULL AND POSITION <> 'WIP'
      GROUP BY ACTIVITY
    ),
    po AS (SELECT COUNT(*) AS N FROM (SELECT PROCESS_ORDER_FG, SUM(${col}) AS v FROM base GROUP BY PROCESS_ORDER_FG) x WHERE v IS NOT NULL)
    SELECT
      b.POSITION  AS STAGE,
      b.ACTIVITY  AS ACTIVITY,
      MIN(b.ACTIVITY_ID) AS MIN_ACTIVITY_ID,
      MIN(b.ACTIVITY_SEQUENCE) AS MIN_SEQUENCE,
      CASE WHEN b.POSITION = 'WIP' THEN COALESCE(ap.PARENT_STAGE, 'WIP') ELSE b.POSITION END AS ATTACHED_STAGE,
      b.ACTIVITY_CATEGORY AS CATEGORY,
      COALESCE(SUM(b.${col}), 0) / 1440.0 / NULLIF(MAX(po.N), 0) AS DAYS
    FROM base b
    LEFT JOIN act_pos ap
      ON b.POSITION = 'WIP' AND ap.ACTIVITY = REGEXP_REPLACE(b.ACTIVITY, '^WIP AFTER ', '')
    CROSS JOIN po
    WHERE b.ACTIVITY_CATEGORY IN ('VA', 'NNVA', 'UNVA')
      AND b.POSITION IS NOT NULL
    GROUP BY b.POSITION, b.ACTIVITY, ATTACHED_STAGE, b.ACTIVITY_CATEGORY
  `, [...binds, ...binds]);
}

// Box-plot percentiles per group process — min, p25, median, mean, p75, p90, max, count.
// Groups POSITION codes into the 6 PROCESS_GROUPS; sums the ltSplitSql split (gross or nett) per PO per group first,
// then computes percentiles across POs so they reflect per-PO-per-group experience.
export async function getLeadTimeBoxPlot(filters: QueryFilters, scope: LtScopeArg = "created", metric: LtMetricArg = "gross") {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  const binds = [...dateBinds, ...ltBinds(filters)];
  return executeQuery<{
    STAGE: string; PO_COUNT: number;
    MIN_DAYS: number; P25_DAYS: number; MEDIAN_DAYS: number; MEAN_DAYS: number;
    P75_DAYS: number; P90_DAYS: number; MAX_DAYS: number;
  }>(`
    WITH base AS (
      SELECT
        PROCESS_ORDER_FG,
        CASE
          WHEN POSITION = 'PO'                                   THEN 'po'
          WHEN POSITION = 'TIMBANG'                              THEN 'weighing'
          WHEN POSITION IN ('OLAH', 'CUCI OLAH')                 THEN 'mixing'
          WHEN POSITION IN ('KEMAS 1', 'KEMAS 2', 'CUCI KEMAS') THEN 'filpac'
          WHEN POSITION = 'RECEIVE NDC'                          THEN 'ndc'
          WHEN POSITION = 'WIP'                                  THEN 'wip'
        END AS STAGE,
        SUM(${splitCol(metric)}) / 1440.0 AS days
      FROM (${ltSplitSql(`
        SELECT * FROM ${LT_TABLE}
        WHERE ${datePred}
          ${ltWhere(filters)}`, ltStartSql(scope))}) x
      WHERE POSITION IN ('PO','TIMBANG','OLAH','CUCI OLAH','KEMAS 1','KEMAS 2','CUCI KEMAS','RECEIVE NDC','WIP')
      GROUP BY PROCESS_ORDER_FG, STAGE
    )
    SELECT
      STAGE,
      COUNT(*)                                                    AS PO_COUNT,
      MIN(days)                                                   AS MIN_DAYS,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY days)         AS P25_DAYS,
      MEDIAN(days)                                                AS MEDIAN_DAYS,
      AVG(days)                                                   AS MEAN_DAYS,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY days)         AS P75_DAYS,
      PERCENTILE_CONT(0.9)  WITHIN GROUP (ORDER BY days)         AS P90_DAYS,
      MAX(days)                                                   AS MAX_DAYS
    FROM base
    WHERE STAGE IS NOT NULL AND days IS NOT NULL
    GROUP BY STAGE
    ORDER BY STAGE
  `, [...binds, ...binds]);
}

// Lead time per stage (POSITION): actual vs standard → Overview Tactical view
// ACTUAL_DAYS = SUM(NET_LEADTIME) / COUNT(DISTINCT PO in period) / 1440 (same basis as the Pareto above).
// STD_DAYS    = SUM(ACTIVITY_LEADTIME_STD) on the same basis — the column is minutes per activity row.
export async function getLeadTimeStageVsStd(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  return executeQuery<{ STAGE: string; ACTUAL_DAYS: number; STD_DAYS: number }>(`
    WITH base AS (
      SELECT PROCESS_ORDER_FG, POSITION, NET_LEADTIME, ACTIVITY_LEADTIME_STD
      FROM ${LT_TABLE}
      WHERE ${datePred}
        AND POSITION IS NOT NULL
        ${ltWhere(filters)}
    ),
    po AS (SELECT COUNT(DISTINCT PROCESS_ORDER_FG) AS N FROM base)
    SELECT
      b.POSITION AS STAGE,
      SUM(b.NET_LEADTIME) / 1440.0 / NULLIF(MAX(po.N), 0) AS ACTUAL_DAYS,
      SUM(COALESCE(b.ACTIVITY_LEADTIME_STD, 0)) / 1440.0 / NULLIF(MAX(po.N), 0) AS STD_DAYS
    FROM base b
    CROSS JOIN po
    GROUP BY 1
  `, [...dateBinds, ...ltBinds(filters)]);
}

// Lead time breakdown per plant → Overview Tactical table. Network row = GROUPING(PLANT) = 1.
// Per PO: gross (PO start → RECEIVE NDC stop) and nett (ACTUAL, LINE_CATEGORY NOT NULL) as in getLeadTimeKPI.
// ONTIME_PCT = share of POs with gross ≤ targetDays. Stage minutes are summed per plant × POSITION;
// divide by GROSS_N / NETT_N for days per PO, so the process columns add up to gross / nett (ltSplitSql).
// basis = where gross starts (Overview Tactical toggle) — it also sets the window the gross split covers.
export async function getLeadTimeByPlant(filters: QueryFilters, targetDays: number, basis: "created" | "released" = "created") {
  const startSql = basis === "released" ? PO_RELEASED_AT_SQL : PO_CREATED_AT_SQL;
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  const binds = [...dateBinds, ...ltBinds(filters)];
  const base = `
    SELECT PLANT, PROCESS_ORDER_FG, POSITION, ACTIVITY, ACTIVITY_SEQUENCE, ACTIVITY_TYPE, LINE_CATEGORY, ACTIVITY_START, ACTIVITY_STOP, NET_LEADTIME
    FROM ${LT_TABLE}
    WHERE ${datePred}
      ${ltWhere(filters)}`;

  const [plantRows, stageRows] = await Promise.all([
    executeQuery<{ IS_NETWORK: number; PLANT: string | null; PO_COUNT: number; GROSS_N: number; NETT_N: number; GROSS_DAYS: number; NETT_DAYS: number; ONTIME_PCT: number | null; ONTIME_N: number; ATRISK_N: number; LATE_N: number }>(`
      WITH base AS (${base}),
      -- Plant rows: per (plant, PO). Network row: per PO over all its rows — a PO made in one plant and
      -- packed in another has no start or no end inside either plant, so a per-plant split would drop it
      -- (cross-plant POs are not attributed to a plant yet — docs/KNOWN_ISSUES.md).
      nett_po AS (${ltNettPerPoSql("SELECT * FROM base")}),
      po_raw AS (
        SELECT
          PLANT,
          PROCESS_ORDER_FG,
          DATEDIFF('minute',
            ${startSql},
            ${NDC_RECEIVED_AT_SQL}
          ) AS gross_minutes
        FROM base
        GROUP BY PLANT, PROCESS_ORDER_FG
      ),
      po AS (SELECT p.*, n.nett_minutes FROM po_raw p LEFT JOIN nett_po n ON n.NETT_PO_KEY = p.PROCESS_ORDER_FG),
      po_network_raw AS (
        SELECT
          PROCESS_ORDER_FG,
          DATEDIFF('minute',
            ${startSql},
            ${NDC_RECEIVED_AT_SQL}
          ) AS gross_minutes
        FROM base
        GROUP BY PROCESS_ORDER_FG
      ),
      po_network AS (SELECT p.*, n.nett_minutes FROM po_network_raw p LEFT JOIN nett_po n ON n.NETT_PO_KEY = p.PROCESS_ORDER_FG)
      SELECT
        0 AS IS_NETWORK,
        PLANT,
        COUNT(*) AS PO_COUNT,
        COUNT(gross_minutes) AS GROSS_N,
        COUNT(nett_minutes) AS NETT_N,
        AVG(gross_minutes) / 1440.0 AS GROSS_DAYS,
        AVG(nett_minutes) / 1440.0 AS NETT_DAYS,
        COUNT_IF(gross_minutes <= ? * 1440) * 100.0 / NULLIF(COUNT(gross_minutes), 0) AS ONTIME_PCT,
        -- Gauge buckets (same as the Tactical gauge): on time ≤ target, at risk ≤ +15%, late above — follow the basis
        COUNT_IF(gross_minutes <= ? * 1440) AS ONTIME_N,
        COUNT_IF(gross_minutes > ? * 1440 AND gross_minutes <= ? * 1440 * 1.15) AS ATRISK_N,
        COUNT_IF(gross_minutes > ? * 1440 * 1.15) AS LATE_N
      FROM po
      GROUP BY PLANT
      UNION ALL
      SELECT
        1 AS IS_NETWORK,
        NULL AS PLANT,
        COUNT(*) AS PO_COUNT,
        COUNT(gross_minutes) AS GROSS_N,
        COUNT(nett_minutes) AS NETT_N,
        AVG(gross_minutes) / 1440.0 AS GROSS_DAYS,
        AVG(nett_minutes) / 1440.0 AS NETT_DAYS,
        COUNT_IF(gross_minutes <= ? * 1440) * 100.0 / NULLIF(COUNT(gross_minutes), 0) AS ONTIME_PCT,
        -- Gauge buckets (same as the Tactical gauge): on time ≤ target, at risk ≤ +15%, late above — follow the basis
        COUNT_IF(gross_minutes <= ? * 1440) AS ONTIME_N,
        COUNT_IF(gross_minutes > ? * 1440 AND gross_minutes <= ? * 1440 * 1.15) AS ATRISK_N,
        COUNT_IF(gross_minutes > ? * 1440 * 1.15) AS LATE_N
      FROM po_network
    `, [...binds, ...Array(5).fill(targetDays), ...Array(5).fill(targetDays)]),
    // Per activity (Process view of the plant table), split so the columns add up to gross / nett (ltSplitSql);
    // the route also sums them per POSITION
    executeQuery<{ PLANT: string; STAGE: string; ACTIVITY: string; SEQ: number | null; GROSS_MIN: number | null; NETT_MIN: number | null }>(`
      SELECT PLANT, POSITION AS STAGE, ACTIVITY, MIN(ACTIVITY_SEQUENCE) AS SEQ, SUM(GROSS_MIN) AS GROSS_MIN, SUM(NETT_MIN) AS NETT_MIN
      FROM (${ltSplitSql(base, startSql)}) b
      WHERE POSITION IS NOT NULL
      GROUP BY 1, 2, 3
    `, [...binds, ...binds]),
  ]);

  return { plants: plantRows, stages: stageRows };
}

export async function getLeadTimeBySku(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  return executeQuery<{ PRODUCT_CODE: string; PRODUCT_NAME: string; PO_COUNT: number; AVG_DAYS: number }>(`
    SELECT
      PRODUCT_CODE,
      MAX(PRODUCT_NAME)                     AS PRODUCT_NAME,
      COUNT(DISTINCT PROCESS_ORDER_FG)      AS PO_COUNT,
      AVG(gross_minutes) / 1440.0           AS AVG_DAYS
    FROM (
      SELECT
        PROCESS_ORDER_FG,
        MAX(PRODUCT_CODE) AS PRODUCT_CODE,
        MAX(PRODUCT_NAME) AS PRODUCT_NAME,
        DATEDIFF('minute',
          ${LEAD_TIME_START_SQL},
          ${NDC_RECEIVED_AT_SQL}
        ) AS gross_minutes
      FROM ${LT_TABLE}
      WHERE ${datePred}
        ${ltWhere(filters)}
      GROUP BY PROCESS_ORDER_FG
      HAVING ${LEAD_TIME_START_SQL} IS NOT NULL
        AND ${NDC_RECEIVED_AT_SQL} IS NOT NULL
    ) sub
    WHERE PRODUCT_CODE IS NOT NULL
    GROUP BY PRODUCT_CODE
    HAVING COUNT(DISTINCT PROCESS_ORDER_FG) < 100
  `, [...dateBinds, ...ltBinds(filters)]);
}

export type ScatterDimension = "brand" | "variant" | "su_group" | "sku";

const SCATTER_DIM_COL: Record<ScatterDimension, string> = {
  brand:    "PRODUCT_BRAND",
  variant:  "PRODUCT_VARIANT",
  su_group: "SKU_GROUP",
  sku:      "PRODUCT_CODE",
};

export async function getLeadTimeScatterByDim(filters: QueryFilters, dimension: ScatterDimension, scope: LtScopeArg = "created", metric: LtMetricArg = "gross") {
  const startSql = ltStartSql(scope);
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  const col = SCATTER_DIM_COL[dimension];
  // Brand includes null rows (shown as "(No Brand)"); other dims filter null.
  const nullLabel = dimension === "brand" ? `COALESCE(${col}, '(No Brand)')` : col;
  const nett = metric === "nett";
  const src = `SELECT * FROM ${LT_TABLE} WHERE ${datePred} ${ltWhere(filters)}`;
  const binds = [...dateBinds, ...ltBinds(filters)];
  return executeQuery<{ DIM_VALUE: string; PO_COUNT: number; AVG_DAYS: number }>(`
    SELECT
      ${nullLabel}       AS DIM_VALUE,
      COUNT(DISTINCT sub.PROCESS_ORDER_FG) AS PO_COUNT,
      AVG(${nett ? "n.nett_minutes" : "sub.gross_minutes"}) / 1440.0 AS AVG_DAYS
    FROM (
      SELECT
        PROCESS_ORDER_FG,
        MAX(${col}) AS ${col},
        DATEDIFF('minute', ${startSql}, ${NDC_RECEIVED_AT_SQL}) AS gross_minutes
      FROM (${src}) t
      GROUP BY PROCESS_ORDER_FG
    ) sub
    ${nett ? `LEFT JOIN (${ltNettPerPoSql(src)}) n ON n.NETT_PO_KEY = sub.PROCESS_ORDER_FG` : ""}
    WHERE ${nett ? "n.nett_minutes" : "sub.gross_minutes"} IS NOT NULL
      ${dimension === "brand" ? "" : `AND ${col} IS NOT NULL`}
    GROUP BY ${nullLabel}
    ${dimension === "sku" ? "HAVING COUNT(DISTINCT sub.PROCESS_ORDER_FG) < 100" : ""}
  `, nett ? [...binds, ...binds, ...binds] : binds);
}

// Top 10 SKU by lead time → composition / range chart on /lead-time
// Per SKU (≥5 POs): AVG / P10 / P90 of the lead time (gross on the Scope, or nett) and AVG VA / NNVA / UNVA days
// from the ltSplitSql split, so the three add up to the average. Top 10 by the average.
export async function getLeadTimeTopSku(filters: QueryFilters, scope: LtScopeArg = "created", metric: LtMetricArg = "gross") {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  const binds = [...dateBinds, ...ltBinds(filters)];
  const col = splitCol(metric);
  // Per PO: lead time (gross on the Scope, or nett) and its VA / NNVA / UNVA split (ltSplitSql) — the three add up to it.
  return executeQuery<{
    PRODUCT_CODE: string; PRODUCT_NAME: string; PO_COUNT: number;
    AVG_DAYS: number; P10_DAYS: number; P90_DAYS: number; VA: number; NNVA: number; UNVA: number;
  }>(`
    WITH po AS (
      SELECT
        PROCESS_ORDER_FG,
        MAX(PRODUCT_CODE) AS PRODUCT_CODE,
        MAX(PRODUCT_NAME) AS PRODUCT_NAME,
        ${metric === "nett"
          ? "SUM(NETT_MIN) / 1440.0"
          : `CASE WHEN ${ltStartSql(scope)} IS NOT NULL AND ${NDC_RECEIVED_AT_SQL} IS NOT NULL
              THEN DATEDIFF('minute', ${ltStartSql(scope)}, ${NDC_RECEIVED_AT_SQL}) / 1440.0 END`} AS lt_days,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'VA'   THEN COALESCE(${col}, 0) ELSE 0 END) / 1440.0 AS va_days,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'NNVA' THEN COALESCE(${col}, 0) ELSE 0 END) / 1440.0 AS nnva_days,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'UNVA' THEN COALESCE(${col}, 0) ELSE 0 END) / 1440.0 AS unva_days
      FROM (${ltSplitSql(`
        SELECT * FROM ${LT_TABLE}
        WHERE ${datePred}
          ${ltWhere(filters)}`, ltStartSql(scope))}) x
      GROUP BY PROCESS_ORDER_FG
    )
    SELECT
      PRODUCT_CODE,
      MAX(PRODUCT_NAME)                                          AS PRODUCT_NAME,
      COUNT(*)                                                   AS PO_COUNT,
      AVG(lt_days)                                               AS AVG_DAYS,
      PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY lt_days)       AS P10_DAYS,
      PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY lt_days)       AS P90_DAYS,
      AVG(va_days)                                               AS VA,
      AVG(nnva_days)                                             AS NNVA,
      AVG(unva_days)                                             AS UNVA
    FROM po
    WHERE PRODUCT_CODE IS NOT NULL AND lt_days IS NOT NULL
    GROUP BY PRODUCT_CODE
    HAVING COUNT(*) >= 5
    ORDER BY AVG_DAYS DESC
    LIMIT 10
  `, [...binds, ...binds]);
}

export async function getLeadTimeByPosition(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  const plantFilter = ltWhere(filters);

  const [nettRows, grossRows] = await Promise.all([
    // Nett per stage = the nett split (ltSplitSql), so the stages add up to nett (PO / WIP have none)
    executeQuery<{ POSITION: string; AVG_HOURS: number }>(`
      SELECT POSITION, AVG(pos_minutes) / 60.0 AS AVG_HOURS
      FROM (
        SELECT PROCESS_ORDER_FG, POSITION, SUM(NETT_MIN) AS pos_minutes
        FROM (${ltSplitSql(`SELECT * FROM ${LT_TABLE} WHERE ${datePred} ${plantFilter}`, LEAD_TIME_START_SQL)}) x
        GROUP BY PROCESS_ORDER_FG, POSITION
        HAVING SUM(NETT_MIN) IS NOT NULL
      ) sub
      GROUP BY POSITION
      ORDER BY AVG_HOURS DESC
      LIMIT 10
    `, [...dateBinds, ...ltBinds(filters), ...dateBinds, ...ltBinds(filters)]),
    executeQuery<{ POSITION: string; AVG_HOURS: number }>(`
      SELECT POSITION, AVG(pos_minutes) / 60.0 AS AVG_HOURS
      FROM (
        SELECT PROCESS_ORDER_FG, POSITION,
          DATEDIFF('minute', MIN(ACTIVITY_START), MAX(ACTIVITY_STOP)) AS pos_minutes
        FROM ${LT_TABLE}
        WHERE ${datePred}
          ${plantFilter}
        GROUP BY PROCESS_ORDER_FG, POSITION
      ) sub
      GROUP BY POSITION
      ORDER BY AVG_HOURS DESC
      LIMIT 10
    `, [...dateBinds, ...ltBinds(filters)]),
  ]);

  return { nett: nettRows, gross: grossRows };
}

export async function getLeadTimeTrend(filters: QueryFilters) {
  return executeQuery<{ WEEK: string; AVG_LEADTIME_DAYS: number; PLANT: string }>(`
    SELECT
      DATE_TRUNC('week', ${prodDate("PO_FG_DONE_DATE")}) AS WEEK,
      PLANT,
      DATEDIFF('minute', MIN(PO_CREATED), MIN(PO_FG_DONE_DATE)) / 1440.0 AS AVG_LEADTIME_DAYS
    FROM ${LT_TABLE}
    WHERE ${prodDate("PO_FG_DONE_DATE")} BETWEEN ?::DATE AND ?::DATE
      AND LINE_CATEGORY IS NOT NULL
    ${plantWhere(filters.plant)}
    GROUP BY WEEK, PLANT, PROCESS_ORDER_FG
    ORDER BY 1
  `, [filters.startDate, filters.endDate, ...plantBinds(filters.plant)]);
}

// Right First Time → CT_MANUF_LEADTIME: non-ADJUST activities / total activities
// Matches Tableau: SUM(IF ACTIVITY <> "ADJUST" THEN 1 ELSE 0 END) / COUNT(ACTIVITY)
export async function getRightFirstTime(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  const rows = await executeQuery<{ RFT_PCT: number }>(`
    SELECT
      COUNT(CASE WHEN ACTIVITY <> 'ADJUST' THEN 1 END) * 100.0
        / NULLIF(COUNT(ACTIVITY), 0) AS RFT_PCT
    FROM ${LT_TABLE}
    WHERE ${datePred}
    ${plantWhere(filters.plant)}
  `, [...dateBinds, ...plantBinds(filters.plant)]);
  return { rftPct: Number((rows[0]?.RFT_PCT ?? 0).toFixed(1)) };
}

// Yield (Pack Loss) → CT_MANUF_KEMAS: QTY_FG_RETUR / QTY_TOTAL
// Yield (Bulk Loss) → DATAMART_PRODUCTION_OUTPUT_OLAH: (THEORETICAL - REALIZATION) / THEORETICAL
export async function getYieldKPI(filters: QueryFilters) {
  const { sql: kemasDatePred, binds: dateBinds } = periodDateWhere("KEMAS_COMPLETED_AT", filters.period, filters.startDate, filters.endDate);
  const { sql: corrDatePred } = periodDateWhere("CORRECTION_DATE", filters.period, filters.startDate, filters.endDate);
  const [packRows, bulkRows] = await Promise.all([
    executeQuery<{ TOTAL_GOOD: number; TOTAL_RETUR: number; TOTAL_QTY: number }>(`
      SELECT
        SUM(QTY_FG_GOOD)  AS TOTAL_GOOD,
        SUM(QTY_FG_RETUR) AS TOTAL_RETUR,
        SUM(QTY_TOTAL)    AS TOTAL_QTY
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
      WHERE ${kemasDatePred}
      ${plantWhere(filters.plant)}
    `, [...dateBinds, ...plantBinds(filters.plant)]),
    executeQuery<{ TOTAL_REALIZATION: number; TOTAL_THEORETICAL: number }>(`
      SELECT
        SUM(REALIZATION_QUANTITY) AS TOTAL_REALIZATION,
        SUM(THEORETICAL_QUANTITY) AS TOTAL_THEORETICAL
      FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
      WHERE ${corrDatePred}
    `, dateBinds),
  ]);

  const pack = packRows[0];
  const packLossPct = pack?.TOTAL_QTY > 0
    ? (pack.TOTAL_RETUR / pack.TOTAL_QTY) * 100
    : 0;

  const bulk = bulkRows[0];
  const bulkLossPct = bulk?.TOTAL_THEORETICAL > 0
    ? Math.abs(((bulk.TOTAL_THEORETICAL - bulk.TOTAL_REALIZATION) / bulk.TOTAL_THEORETICAL) * 100)
    : 0;
  const bulkLossKg = (bulk?.TOTAL_THEORETICAL ?? 0) > (bulk?.TOTAL_REALIZATION ?? 0)
    ? bulk.TOTAL_THEORETICAL - bulk.TOTAL_REALIZATION
    : 0;

  return {
    bulkLossPct: Number(bulkLossPct.toFixed(1)),
    packLossPct: Number(packLossPct.toFixed(1)),
    bulkLossKg: Math.round(bulkLossKg),
  };
}

// ── Output — FG (Tactical → Output and the Output trend) ─────────────────────────────────────────────────────
// One source for every FG chart: DATAMART_PRODUCTION_OUTPUT_FG, pcs, dated by CORRECTION_DATE — the same rows as the
// FG KPI card, so every breakdown adds up to the card (before 2026-11-02 the breakdowns read RELEASE_QTY per PO from
// the lead time data on PO_FG_DONE_DATE, and the line chart counted a PO on every line it passed). A row = one FG
// release: SNFG_NAME = FG process order, COITEM_CODE / FINISHED_GOOD_NAME = SKU, LINE_NAME = filling / packing line.
// Plant = the plant of the row's form (OUTPUT_PLANT_SQL). SKU group is not in the datamart — it comes from the PO's
// lead time rows.
export type OutputGroupDim = "brand" | "variant" | "su_group";
export type { OutputSel, OutputSelDim } from "@/lib/outputSel";

const OUTPUT_NOT_SET = "(Not set)";
const FG_SEL_COL: Record<OutputSelDim, string> = {
  brand: "PRODUCT_BRAND_NAME", variant: "VARIANT_NAME", su_group: "SKU_GROUP", line: "LINE_NAME", form: "MATERIAL_FORM_NAME",
};

/** Filtered FG rows (with SKU_GROUP and PLANT) as an SQL source + its binds. */
function fgRows(filters: QueryFilters, sel?: OutputSel | null): { sql: string; binds: unknown[] } {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("b.CORRECTION_DATE", filters.period, filters.startDate, filters.endDate);
  const col = sel ? FG_SEL_COL[sel.dim] : undefined;
  const selSql = !col ? "" : sel!.value === OUTPUT_NOT_SET ? `AND ${col} IS NULL` : `AND ${col} = ?`;
  const selBinds = !col || sel!.value === OUTPUT_NOT_SET ? [] : [sel!.value];
  return {
    sql: `
      SELECT * FROM (
        SELECT b.*, g.SKU_GROUP, ${OUTPUT_PLANT_SQL} AS PLANT
        FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_FG b
        LEFT JOIN (SELECT PROCESS_ORDER_FG, MAX(SKU_GROUP) AS SKU_GROUP FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME GROUP BY PROCESS_ORDER_FG) g
          ON g.PROCESS_ORDER_FG = b.SNFG_NAME
        WHERE ${datePred}
          ${outputPlantWhere(filters.plant)}
      ) f
      WHERE 1 = 1 ${selSql}`,
    binds: [...dateBinds, ...plantBinds(filters.plant), ...selBinds],
  };
}

/** FG per filling / packing line: process orders, released pcs, share of the total. */
export async function getOutputByLine(filters: QueryFilters, sel?: OutputSel | null) {
  const src = fgRows(filters, sel);
  return executeQuery<{ LINE_NAME: string; QTY_PO: number; QTY_REAL: number; PCT_CONTRIBUTION: number }>(`
    WITH b AS (SELECT COALESCE(x.LINE_NAME, '(Not set)') AS LINE_KEY, x.* FROM (${src.sql}) x),
    totals AS (SELECT NULLIF(SUM(QUANTITY), 0) AS grand_total FROM b)
    SELECT b.LINE_KEY AS LINE_NAME,
      COUNT(DISTINCT b.SNFG_NAME)                      AS QTY_PO,
      SUM(b.QUANTITY)                                  AS QTY_REAL,
      SUM(b.QUANTITY) * 100.0 / MAX(t.grand_total)     AS PCT_CONTRIBUTION
    FROM b CROSS JOIN totals t
    GROUP BY b.LINE_KEY
    ORDER BY QTY_REAL DESC
  `, src.binds);
}

/** FG per brand / variant / SKU group (treemap) and the top 10 SKUs. */
export async function getOutputMix(filters: QueryFilters, dim: OutputGroupDim = "brand", sel?: OutputSel | null, part: "all" | "groups" | "skus" = "all") {
  const src = fgRows(filters, sel);
  const col = FG_SEL_COL[dim];
  // GRP_RAW, not GRP: with COALESCE(GRP, …) AS GRP, ClickHouse reads GRP in GROUP BY as the alias
  // (Code 215 "not under aggregate function"); Snowflake reads the column.
  const [groups, skus] = await Promise.all([
    part === "skus" ? Promise.resolve([]) : executeQuery<{ GRP: string; QTY_PO: number; QTY_REAL: number }>(`
      SELECT COALESCE(GRP_RAW, '(Not set)') AS GRP, COUNT(DISTINCT SNFG_NAME) AS QTY_PO, SUM(QUANTITY) AS QTY_REAL
      FROM (SELECT ${col} AS GRP_RAW, SNFG_NAME, QUANTITY FROM (${src.sql}) x) g
      GROUP BY COALESCE(GRP_RAW, '(Not set)')
      ORDER BY QTY_REAL DESC
    `, src.binds),
    part === "groups" ? Promise.resolve([]) : executeQuery<{ PRODUCT_CODE: string; PRODUCT_NAME: string; QTY_PO: number; QTY_REAL: number; PCT_CONTRIBUTION: number }>(`
      WITH b AS (${src.sql}),
      totals AS (SELECT NULLIF(SUM(QUANTITY), 0) AS GRAND_TOTAL FROM b)
      SELECT b.COITEM_CODE AS PRODUCT_CODE, MAX(b.FINISHED_GOOD_NAME) AS PRODUCT_NAME,
        COUNT(DISTINCT b.SNFG_NAME) AS QTY_PO, SUM(b.QUANTITY) AS QTY_REAL,
        SUM(b.QUANTITY) * 100.0 / MAX(t.GRAND_TOTAL) AS PCT_CONTRIBUTION
      FROM b CROSS JOIN totals t
      WHERE b.COITEM_CODE IS NOT NULL
      GROUP BY b.COITEM_CODE
      ORDER BY QTY_REAL DESC
      LIMIT 10
    `, src.binds),
  ]);
  return { groups, skus };
}

// Output detail stats: distinct SKU + PO counts, and output quantity split by SEDIAAN (pharmaceutical form).
// Uses LT_TABLE date column (PO_FG_DONE_DATE) — slightly different population than getOutputKPI's CORRECTION_DATE;
// counts are approximate but consistent with the Lead Time page's PO population.
export async function getOutputDetailStats(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  const pb = plantBinds(filters.plant);
  const pw = plantWhere(filters.plant);
  const [countRows, formRows] = await Promise.all([
    executeQuery<{ SKU_COUNT: number; PO_COUNT: number }>(`
      SELECT
        COUNT(DISTINCT PRODUCT_CODE)    AS SKU_COUNT,
        COUNT(DISTINCT PROCESS_ORDER_FG) AS PO_COUNT
      FROM ${LT_TABLE}
      WHERE ${datePred}
        AND PRODUCT_CODE IS NOT NULL
        ${pw}
    `, [...dateBinds, ...pb]),
    executeQuery<{ FORM: string; TOTAL_QTY: number }>(`
      WITH per_po AS (
        SELECT PROCESS_ORDER_FG,
          MAX(SEDIAAN)     AS sediaan_val,
          MAX(RELEASE_QTY) AS qty
        FROM ${LT_TABLE}
        WHERE ${datePred}
          AND SEDIAAN IS NOT NULL
          AND RELEASE_QTY IS NOT NULL
          ${pw}
        GROUP BY PROCESS_ORDER_FG
      )
      SELECT sediaan_val AS FORM, SUM(qty) AS TOTAL_QTY
      FROM per_po
      GROUP BY sediaan_val
      ORDER BY TOTAL_QTY DESC
    `, [...dateBinds, ...pb]),
  ]);
  return {
    skuCount: Number(countRows[0]?.SKU_COUNT ?? 0),
    poCount:  Number(countRows[0]?.PO_COUNT  ?? 0),
    byForm: formRows.map((r) => ({ form: r.FORM ?? "Other", qty: Number(r.TOTAL_QTY ?? 0) })),
  };
}

// ── Output datamarts: plant ────────────────────────────────────────────────────────────────────────────────
// The FG and Bulk datamarts have no PLANT column, but each material form is made in one plant (YTD 2026, FG pcs:
// LIQUID 100% J2, SEMISOLID 99% J4, POWDER 100% J1; the form "J6" is plant J6). Output's plant is the plant of its
// form (user decision 2026-11-02): the plant filter, the Output per Plant donut, Metric Trend By plant and the AI
// plant drivers all use it, so they agree to the unit and add up to the card. A form not in the map → "(Not set)".
// Update the map if a form moves plant; replace it once the datamarts carry a plant.
const OUTPUT_FORM_PLANT: Record<string, string> = { LIQUID: "J2", SEMISOLID: "J4", POWDER: "J1", J6: "J6" };
const OUTPUT_PLANT_SQL = `CASE MATERIAL_FORM_NAME ${Object.entries(OUTPUT_FORM_PLANT).map(([f, p]) => `WHEN '${f}' THEN '${p}'`).join(" ")} ELSE '${"(Not set)"}' END`;
const outputPlantWhere = (plant?: string) => (hasPlant(plant) ? `AND ${OUTPUT_PLANT_SQL} = ?` : "");

// ── Output — Bulk (Tactical → Output, FG / Bulk toggle = Bulk) ────────────────────────────────────────────────
// One source for every Bulk chart: DATAMART_PRODUCTION_OUTPUT_OLAH, kg, dated by CORRECTION_DATE (same as the
// Bulk KPI card). A row = one bulk batch: NOMO_NAME = bulk process order, COITEM_BULK_CODE / BULK_NAME = bulk SKU.
// Cross-filter (OutputSel) reads the batch's own columns; SKU group does not exist for bulk.
const BULK_SEL_COL: Partial<Record<OutputSelDim, string>> = {
  brand: "PRODUCT_BRAND_NAME", variant: "VARIANT_NAME", line: "LINE_NAME", form: "MATERIAL_FORM_NAME",
};
export type BulkGroupDim = "brand" | "variant";

/** Filtered bulk rows (with PLANT) as an SQL source + its binds. */
function bulkRows(filters: QueryFilters, sel?: OutputSel | null): { sql: string; binds: unknown[] } {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("b.CORRECTION_DATE", filters.period, filters.startDate, filters.endDate);
  const col = sel ? BULK_SEL_COL[sel.dim] : undefined;
  const selSql = !col ? "" : sel!.value === OUTPUT_NOT_SET ? `AND b.${col} IS NULL` : `AND b.${col} = ?`;
  const selBinds = !col || sel!.value === OUTPUT_NOT_SET ? [] : [sel!.value];
  return {
    sql: `
      SELECT b.*, ${OUTPUT_PLANT_SQL} AS PLANT
      FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH b
      WHERE ${datePred}
        ${outputPlantWhere(filters.plant)}
        ${selSql}`,
    binds: [...dateBinds, ...plantBinds(filters.plant), ...selBinds],
  };
}

/** Bulk per mixing line: batches, realized vs theoretical kg, share of the total. */
export async function getBulkOutputByLine(filters: QueryFilters, sel?: OutputSel | null) {
  const src = bulkRows(filters, sel);
  return executeQuery<{ LINE_NAME: string; QTY_PO: number; QTY_REAL: number; QTY_THEO: number; PCT_CONTRIBUTION: number }>(`
    WITH b AS (SELECT COALESCE(x.LINE_NAME, '(Not set)') AS LINE_KEY, x.* FROM (${src.sql}) x),
    totals AS (SELECT NULLIF(SUM(REALIZATION_QUANTITY), 0) AS grand_total FROM b)
    SELECT b.LINE_KEY AS LINE_NAME,
      COUNT(DISTINCT b.NOMO_NAME)                                  AS QTY_PO,
      SUM(b.REALIZATION_QUANTITY)                                  AS QTY_REAL,
      SUM(b.THEORETICAL_QUANTITY)                                  AS QTY_THEO,
      SUM(b.REALIZATION_QUANTITY) * 100.0 / MAX(t.grand_total)     AS PCT_CONTRIBUTION
    FROM b CROSS JOIN totals t
    GROUP BY b.LINE_KEY
    ORDER BY QTY_REAL DESC
  `, src.binds);
}

/** Bulk per brand / variant (treemap) and the top 10 bulk SKUs. */
export async function getBulkOutputMix(filters: QueryFilters, dim: BulkGroupDim = "brand", sel?: OutputSel | null, part: "all" | "groups" | "skus" = "all") {
  const src = bulkRows(filters, sel);
  const col = dim === "variant" ? "VARIANT_NAME" : "PRODUCT_BRAND_NAME";
  const [groups, skus] = await Promise.all([
    part === "skus" ? Promise.resolve([]) : executeQuery<{ GRP: string; QTY_PO: number; QTY_REAL: number }>(`
      SELECT COALESCE(GRP_RAW, '(Not set)') AS GRP, COUNT(DISTINCT NOMO_NAME) AS QTY_PO, SUM(REALIZATION_QUANTITY) AS QTY_REAL
      FROM (SELECT ${col} AS GRP_RAW, NOMO_NAME, REALIZATION_QUANTITY FROM (${src.sql}) x) g
      GROUP BY COALESCE(GRP_RAW, '(Not set)')
      ORDER BY QTY_REAL DESC
    `, src.binds),
    part === "groups" ? Promise.resolve([]) : executeQuery<{ PRODUCT_CODE: string; PRODUCT_NAME: string; QTY_PO: number; QTY_REAL: number; PCT_CONTRIBUTION: number }>(`
      WITH b AS (${src.sql}),
      totals AS (SELECT NULLIF(SUM(REALIZATION_QUANTITY), 0) AS GRAND_TOTAL FROM b)
      SELECT b.COITEM_BULK_CODE AS PRODUCT_CODE, MAX(b.BULK_NAME) AS PRODUCT_NAME,
        COUNT(DISTINCT b.NOMO_NAME) AS QTY_PO, SUM(b.REALIZATION_QUANTITY) AS QTY_REAL,
        SUM(b.REALIZATION_QUANTITY) * 100.0 / MAX(t.GRAND_TOTAL) AS PCT_CONTRIBUTION
      FROM b CROSS JOIN totals t
      WHERE b.COITEM_BULK_CODE IS NOT NULL
      GROUP BY b.COITEM_BULK_CODE
      ORDER BY QTY_REAL DESC
      LIMIT 10
    `, src.binds),
  ]);
  return { groups, skus };
}

/** Bulk realized vs theoretical kg per week / month (Output trend bars, Bulk). */
export async function getBulkOutputTrend(filters: QueryFilters, grain?: TrendGrain, sel?: OutputSel | null) {
  const src = bulkRows(filters, sel);
  return executeQuery<{ BUCKET: string; QTY_REAL: number; QTY_THEO: number }>(`
    SELECT DATE_TRUNC('${truncUnit(grain)}', CORRECTION_DATE::DATE) AS BUCKET,
      SUM(REALIZATION_QUANTITY) AS QTY_REAL, SUM(THEORETICAL_QUANTITY) AS QTY_THEO
    FROM (${src.sql}) x
    GROUP BY 1
    ORDER BY 1
  `, src.binds);
}

/** Output section mini cards + plant donut, following the plant filter and the Output cross-filter. FG and Bulk
 *  each read their own datamart (fgRows / bulkRows), so the total is the KPI card's; plant = the form's plant. */
export async function getOutputStats(filters: QueryFilters, metric: "fg" | "bulk", sel?: OutputSel | null) {
  const bulk = metric === "bulk";
  const src = bulk ? bulkRows(filters, sel) : fgRows(filters, sel);
  const c = bulk
    ? { qty: "REALIZATION_QUANTITY", theo: "SUM(THEORETICAL_QUANTITY)", sku: "COITEM_BULK_CODE", po: "NOMO_NAME" }
    : { qty: "QUANTITY", theo: "NULL", sku: "COITEM_CODE", po: "SNFG_NAME" };
  const [tot, byPlant] = await Promise.all([
    executeQuery<{ TOTAL: number; THEO: number | null; SKU_COUNT: number; PO_COUNT: number }>(`
      SELECT SUM(${c.qty}) AS TOTAL, ${c.theo} AS THEO, COUNT(DISTINCT ${c.sku}) AS SKU_COUNT, COUNT(DISTINCT ${c.po}) AS PO_COUNT
      FROM (${src.sql}) x`, src.binds),
    executeQuery<{ GRP: string; QTY: number }>(`
      SELECT PLANT AS GRP, SUM(${c.qty}) AS QTY FROM (${src.sql}) x GROUP BY 1 ORDER BY QTY DESC`, src.binds),
  ]);
  return { total: Number(tot[0]?.TOTAL ?? 0), theoretical: tot[0]?.THEO == null ? null : Number(tot[0].THEO),
    skuCount: Number(tot[0]?.SKU_COUNT ?? 0), poCount: Number(tot[0]?.PO_COUNT ?? 0),
    byPlant: byPlant.map((r) => ({ name: r.GRP, qty: Number(r.QTY ?? 0) })) };
}

// Output (Bulk) → DATAMART_PRODUCTION_OUTPUT_OLAH.REALIZATION_QUANTITY filtered on CORRECTION_DATE
// Output (FG)   → DATAMART_PRODUCTION_OUTPUT_FG.QUANTITY filtered on CORRECTION_DATE
// Plant filter through the row's form (outputPlantWhere).
export async function getOutputKPI(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("CORRECTION_DATE", filters.period, filters.startDate, filters.endDate);
  const binds = [...dateBinds, ...plantBinds(filters.plant)];
  const [bulk, fgRows] = await Promise.all([
    executeQuery<{ TOTAL_BULK: number }>(`
      SELECT SUM(REALIZATION_QUANTITY) AS TOTAL_BULK
      FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
      WHERE ${datePred}
        ${outputPlantWhere(filters.plant)}
    `, binds),
    executeQuery<{ TOTAL_FG: number }>(`
      SELECT SUM(QUANTITY) AS TOTAL_FG
      FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_FG
      WHERE ${datePred}
        ${outputPlantWhere(filters.plant)}
    `, binds),
  ]);

  return {
    acceptedBulkKg: bulk[0]?.TOTAL_BULK ?? 0,
    releasedFgPcs: fgRows[0]?.TOTAL_FG ?? 0,
  };
}

// E2E Productivity: SUM per PO first, then AVG across POs — QTY_KEMAS / (upstream_mh + downstream_mh).
// CT_MANUF_E2E already has all columns; UNBOXING excluded in upstream/downstream by the table definition.
export async function getE2EProductivity(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("KEMAS_COMPLETED_AT", filters.period, filters.startDate, filters.endDate);
  const rows = await executeQuery<{ AVG_E2E_PROD: number }>(`
    WITH po_level AS (
      SELECT PROCESS_ORDER_FG,
        SUM(QTY_KEMAS) AS qty,
        SUM(UPSTREAM_LEADTIME_IN_HOUR * UPSTREAM_OPERATOR) AS up_mh,
        SUM(DOWNSTREAM_LEADTIME_IN_HOUR * DOWNSTREAM_OPERATOR) AS dn_mh
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
      WHERE ${datePred} ${plantWhere(filters.plant)}
        AND QTY_KEMAS > 0
        AND (UPSTREAM_LEADTIME_IN_HOUR * UPSTREAM_OPERATOR) + (DOWNSTREAM_LEADTIME_IN_HOUR * DOWNSTREAM_OPERATOR) > 0
      GROUP BY PROCESS_ORDER_FG
    )
    SELECT AVG(qty / NULLIF(up_mh + dn_mh, 0)) AS AVG_E2E_PROD
    FROM po_level
    WHERE qty > 0 AND up_mh + dn_mh > 0
  `, [...dateBinds, ...plantBinds(filters.plant)]);
  return { avgE2EProd: Number((rows[0]?.AVG_E2E_PROD ?? 0).toFixed(1)) };
}

// Per-plant FG and E2E productivity — only to find which plant drives the Output / Productivity
// cards (AI one-liner causes, lib/kpiNarrative.ts). FG = the card's FG datamart per plant of the form
// (OUTPUT_PLANT_SQL), so the plants add up to the card.
// E2E keeps SUM + COUNT so per-plant contributions add up exactly to the card's AVG.
export async function getPlantDrivers(filters: QueryFilters) {
  const fgDate  = periodDateWhere("CORRECTION_DATE",    filters.period, filters.startDate, filters.endDate);
  const e2eDate = periodDateWhere("KEMAS_COMPLETED_AT", filters.period, filters.startDate, filters.endDate);
  const [fgRows, e2eRows] = await Promise.all([
    executeQuery<{ PLANT: string; FG: number }>(`
      SELECT ${OUTPUT_PLANT_SQL} AS PLANT, SUM(QUANTITY) AS FG
      FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_FG
      WHERE ${fgDate.sql}
      GROUP BY 1
    `, fgDate.binds),
    executeQuery<{ PLANT: string; E2E_SUM: number; E2E_N: number }>(`
      SELECT PLANT, SUM(E2E_PRODUCTIVITY) AS E2E_SUM, COUNT(E2E_PRODUCTIVITY) AS E2E_N
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
      WHERE ${e2eDate.sql}
      GROUP BY PLANT
    `, e2eDate.binds),
  ]);
  return {
    fg:  fgRows.filter((r) => r.PLANT).map((r) => ({ plant: r.PLANT, fg: Number(r.FG ?? 0) })),
    e2e: e2eRows.filter((r) => r.PLANT).map((r) => ({ plant: r.PLANT, sum: Number(r.E2E_SUM ?? 0), n: Number(r.E2E_N ?? 0) })),
  };
}

// Upstream Productivity → CT_MANUF_OLAH
// Tableau LOD: {FIXED [Process Order Sfg]: MAX(Release_Bulk_per_SFG) / (SUM(Leadtime_per_ActivityID)/60) / SUM(Operator_per_Position)}
export async function getUpstreamProductivity(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("OLAH_COMPLETED_AT", filters.period, filters.startDate, filters.endDate);
  const rows = await executeQuery<{ AVG_UPSTREAM_PROD: number }>(`
    WITH activity_lvl AS (
      SELECT
        PROCESS_ORDER_SFG,
        POSITION,
        ACTIVITY,
        ACTIVITY_ID,
        MAX(CASE WHEN RELEASE_BULK IS NOT NULL THEN RELEASE_BULK END)       AS release_bulk_sfg,
        MAX(CASE WHEN RELEASE_BULK IS NOT NULL THEN LEADTIME_IN_MINUTE END) AS leadtime_per_act,
        MAX(CASE WHEN RELEASE_BULK IS NOT NULL THEN OPERATOR_COUNT END)     AS operator_per_act
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH
      WHERE ${datePred}
      ${plantWhere(filters.plant)}
      GROUP BY PROCESS_ORDER_SFG, POSITION, ACTIVITY, ACTIVITY_ID
    ),
    position_lvl AS (
      SELECT
        PROCESS_ORDER_SFG,
        MAX(release_bulk_sfg)      AS release_bulk_sfg,
        SUM(leadtime_per_act)      AS leadtime_sum,
        SUM(operator_per_act)      AS operator_per_position
      FROM activity_lvl
      GROUP BY PROCESS_ORDER_SFG, POSITION
    ),
    sfg_lvl AS (
      SELECT
        PROCESS_ORDER_SFG,
        MAX(release_bulk_sfg)      AS max_release_bulk,
        SUM(leadtime_sum)          AS total_leadtime_min,
        SUM(operator_per_position) AS total_operators
      FROM position_lvl
      GROUP BY PROCESS_ORDER_SFG
    )
    SELECT
      AVG(
        CASE WHEN total_leadtime_min > 0 AND total_operators > 0
        THEN max_release_bulk / (total_leadtime_min / 60.0) / total_operators
        END
      ) AS AVG_UPSTREAM_PROD
    FROM sfg_lvl
    WHERE max_release_bulk > 0
  `, [...dateBinds, ...plantBinds(filters.plant)]);
  return { avgUpstreamProd: Number((rows[0]?.AVG_UPSTREAM_PROD ?? 0).toFixed(1)) };
}

// Downstream Productivity → CT_MANUF_KEMAS: QTY_FG_GOOD / (LEADTIME_IN_MINUTE/60) / OPERATOR_COUNT
// Matches Tableau LOD: {FIXED [PROCESS_ORDER_FG]: SUM/SUM/MAX}
export async function getDownstreamProductivity(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("KEMAS_COMPLETED_AT", filters.period, filters.startDate, filters.endDate);
  const rows = await executeQuery<{ AVG_DOWNSTREAM_PROD: number }>(`
    SELECT AVG(PO_PROD) AS AVG_DOWNSTREAM_PROD
    FROM (
      SELECT
        PROCESS_ORDER_FG,
        SUM(QTY_FG_GOOD)
          / NULLIF(SUM(LEADTIME_IN_MINUTE) / 60.0, 0)
          / NULLIF(MAX(OPERATOR_COUNT), 0) AS PO_PROD
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
      WHERE ${datePred}
        AND LEADTIME_IN_MINUTE > 0 AND OPERATOR_COUNT > 0
      ${plantWhere(filters.plant)}
      GROUP BY PROCESS_ORDER_FG
    ) sub
  `, [...dateBinds, ...plantBinds(filters.plant)]);
  return { avgDownstreamProd: Number((rows[0]?.AVG_DOWNSTREAM_PROD ?? 0).toFixed(1)) };
}

// Stage productivity → Overview Productivity card toggle (E2E · Mixing · Filpac).
// Both tables have one row per operator per activity; MANHOUR/LEADTIME_IN_MINUTE and qty repeat on every operator row.
// Shared dedup pattern: per ACTIVITY_ID → MAX(qty), MAX(duration) × MAX(OPERATOR_COUNT) = man-hours for that slot.
// Mixing: then aggregate ACTIVITY_IDs → SFG level (SFGs can have multiple MIXING slots).
// Filpac: ACTIVITY_ID is already the terminal unit; no SFG rollup.
// Final period aggregate: Σ qty / Σ man-hours (volume-weighted).
// grain = 'week' adds a WEEK column for the sparkline; otherwise one row for the period.
export type StageProductivity = "mixing" | "filpac";
export async function getStageProductivity(filters: QueryFilters, stage: StageProductivity, grain?: "week") {
  const dateCol = stage === "mixing" ? "OLAH_COMPLETED_AT" : "KEMAS_COMPLETED_AT";
  const { sql: datePred, binds: dateBinds } = periodDateWhere(dateCol, filters.period, filters.startDate, filters.endDate);
  const binds = [...dateBinds, ...plantBinds(filters.plant)];
  const week = grain === "week" ? `DATE_TRUNC('week', ${prodDate("DONE_AT")})` : "NULL";
  const unitSql = stage === "mixing"
    ? `SELECT PROCESS_ORDER_SFG, MAX(release_bulk) AS QTY, SUM(mh) AS MH, MAX(done_at) AS DONE_AT
       FROM (
         SELECT PROCESS_ORDER_SFG, ACTIVITY_ID,
           MAX(RELEASE_BULK) AS release_bulk,
           MAX(MANHOUR) * MAX(OPERATOR_COUNT) AS mh,
           MAX(OLAH_COMPLETED_AT) AS done_at
         FROM MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH
         WHERE ACTIVITY = 'MIXING' AND ${datePred} ${plantWhere(filters.plant)}
         GROUP BY PROCESS_ORDER_SFG, ACTIVITY_ID
       ) act_lvl
       GROUP BY PROCESS_ORDER_SFG`
    : `SELECT ACTIVITY_ID, MAX(QTY_FG_GOOD) AS QTY, MAX(LEADTIME_IN_MINUTE) / 60.0 * MAX(OPERATOR_COUNT) AS MH, MAX(KEMAS_COMPLETED_AT) AS DONE_AT
       FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
       WHERE ACTIVITY = 'FILPAC' AND ${datePred} ${plantWhere(filters.plant)}
       GROUP BY ACTIVITY_ID`;
  return executeQuery<{ WEEK: string | null; PROD: number | null }>(`
    SELECT ${week} AS WEEK, SUM(QTY) / NULLIF(SUM(MH), 0) AS PROD
    FROM (${unitSql}) u
    WHERE QTY > 0 AND MH > 0
    GROUP BY 1
    ORDER BY 1
  `, binds);
}

// OEE → CT_MANUF_KEMAS: Quality × Performance per plant + component breakdown
export async function getOEEByPlant(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("KEMAS_COMPLETED_AT", filters.period, filters.startDate, filters.endDate);
  return executeQuery<{ PLANT: string; OEE: number; QUALITY: number; PERFORMANCE: number }>(`
    SELECT
      PLANT,
      AVG(CASE WHEN QTY_TOTAL > 0 THEN QTY_FG_GOOD::FLOAT / QTY_TOTAL ELSE 0 END) * 100 AS QUALITY,
      AVG(CASE WHEN ACTIVITY_PRODUCTIVITY_STD > 0
              THEN LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0)
              ELSE 0 END) * 100 AS PERFORMANCE,
      AVG(
        (CASE WHEN QTY_TOTAL > 0 THEN QTY_FG_GOOD::FLOAT / QTY_TOTAL ELSE 0 END) *
        (CASE WHEN ACTIVITY_PRODUCTIVITY_STD > 0
              THEN LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0)
              ELSE 0 END)
      ) * 100 AS OEE
    FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
    WHERE ${datePred}
    ${plantWhere(filters.plant)}
    GROUP BY PLANT
  `, [...dateBinds, ...plantBinds(filters.plant)]);
}

// Productivity details → CT_MANUF_KEMAS: total manhours and avg operator count
export async function getProductivityDetails(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("KEMAS_COMPLETED_AT", filters.period, filters.startDate, filters.endDate);
  const rows = await executeQuery<{ TOTAL_MANHOURS: number; AVG_OPERATORS: number }>(`
    SELECT
      ROUND(SUM(LEADTIME_IN_MINUTE / 60.0 * OPERATOR_COUNT)) AS TOTAL_MANHOURS,
      ROUND(AVG(OPERATOR_COUNT))                              AS AVG_OPERATORS
    FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
    WHERE ${datePred}
      AND LEADTIME_IN_MINUTE > 0 AND OPERATOR_COUNT > 0
    ${plantWhere(filters.plant)}
  `, [...dateBinds, ...plantBinds(filters.plant)]);
  return {
    totalManhours: Math.round(rows[0]?.TOTAL_MANHOURS ?? 0),
    avgOperators:  Math.round(rows[0]?.AVG_OPERATORS  ?? 0),
  };
}

// OEE weekly series → used for sparklines in dashboard cards
export async function getOEEWeekly(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("KEMAS_COMPLETED_AT", filters.period, filters.startDate, filters.endDate);
  return executeQuery<{ WEEK: string; OEE: number }>(`
    SELECT
      DATE_TRUNC('week', ${prodDate("KEMAS_COMPLETED_AT")}) AS WEEK,
      AVG(
        (CASE WHEN QTY_TOTAL > 0 THEN QTY_FG_GOOD::FLOAT / QTY_TOTAL ELSE 0 END) *
        (CASE WHEN ACTIVITY_PRODUCTIVITY_STD > 0
              THEN LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0)
              ELSE 0 END)
      ) * 100 AS OEE
    FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
    WHERE ${datePred}
    ${plantWhere(filters.plant)}
    GROUP BY 1
    ORDER BY 1
  `, [...dateBinds, ...plantBinds(filters.plant)]);
}

// E2E Productivity weekly series → sparkline on dashboard card. Same formula as getE2EProductivity.
export async function getE2EWeekly(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("KEMAS_COMPLETED_AT", filters.period, filters.startDate, filters.endDate);
  return executeQuery<{ WEEK: string; AVG_PROD: number }>(`
    WITH po_level AS (
      SELECT PROCESS_ORDER_FG,
        DATE_TRUNC('week', ${prodDate("KEMAS_COMPLETED_AT")}) AS WEEK,
        SUM(QTY_KEMAS) AS qty,
        SUM(UPSTREAM_LEADTIME_IN_HOUR * UPSTREAM_OPERATOR) AS up_mh,
        SUM(DOWNSTREAM_LEADTIME_IN_HOUR * DOWNSTREAM_OPERATOR) AS dn_mh
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
      WHERE ${datePred} ${plantWhere(filters.plant)}
        AND QTY_KEMAS > 0
        AND (UPSTREAM_LEADTIME_IN_HOUR * UPSTREAM_OPERATOR) + (DOWNSTREAM_LEADTIME_IN_HOUR * DOWNSTREAM_OPERATOR) > 0
      GROUP BY PROCESS_ORDER_FG, DATE_TRUNC('week', ${prodDate("KEMAS_COMPLETED_AT")})
    )
    SELECT WEEK, AVG(qty / NULLIF(up_mh + dn_mh, 0)) AS AVG_PROD
    FROM po_level
    WHERE qty > 0 AND up_mh + dn_mh > 0
    GROUP BY 1 ORDER BY 1
  `, [...dateBinds, ...plantBinds(filters.plant)]);
}

// Lead Time weekly series → sparkline for dashboard card
export async function getLeadTimeWeekly(filters: QueryFilters, grain?: TrendGrain) {
  const unit = truncUnit(grain);
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  return executeQuery<{ WEEK: string; AVG_DAYS: number }>(`
    SELECT WEEK, AVG(DAYS) AS AVG_DAYS
    FROM (
      SELECT
        DATE_TRUNC('${unit}', ${prodDate("PO_FG_DONE_DATE")}) AS WEEK,
        DATEDIFF('minute',
          ${LEAD_TIME_START_SQL},
          ${NDC_RECEIVED_AT_SQL}
        ) / 1440.0 AS DAYS
      FROM ${LT_TABLE}
      WHERE ${datePred}
        ${ltWhere(filters)}
      GROUP BY 1, PROCESS_ORDER_FG
      HAVING ${LEAD_TIME_START_SQL} IS NOT NULL
        AND ${NDC_RECEIVED_AT_SQL} IS NOT NULL
    )
    GROUP BY 1
    ORDER BY 1
  `, [...dateBinds, ...ltBinds(filters)]);
}

// Output FG weekly series → sparkline for dashboard card
export async function getOutputWeekly(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("CORRECTION_DATE", filters.period, filters.startDate, filters.endDate);
  return executeQuery<{ WEEK: string; TOTAL_FG: number }>(`
    SELECT
      DATE_TRUNC('week', CORRECTION_DATE::DATE) AS WEEK,
      SUM(QUANTITY) AS TOTAL_FG
    FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_FG
    WHERE ${datePred}
      ${outputPlantWhere(filters.plant)}
    GROUP BY 1
    ORDER BY 1
  `, [...dateBinds, ...plantBinds(filters.plant)]);
}

// Output Bulk weekly series → sparkline for dashboard card (plant through the form, outputPlantWhere)
export async function getBulkOutputWeekly(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("CORRECTION_DATE", filters.period, filters.startDate, filters.endDate);
  return executeQuery<{ WEEK: string; TOTAL_BULK: number }>(`
    SELECT
      DATE_TRUNC('week', CORRECTION_DATE::DATE) AS WEEK,
      SUM(REALIZATION_QUANTITY) AS TOTAL_BULK
    FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
    WHERE ${datePred}
      ${outputPlantWhere(filters.plant)}
    GROUP BY 1
    ORDER BY 1
  `, [...dateBinds, ...plantBinds(filters.plant)]);
}

// Bulk Loss % weekly series → sparkline for dashboard card (no PLANT col)
export async function getYieldWeekly(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("CORRECTION_DATE", filters.period, filters.startDate, filters.endDate);
  return executeQuery<{ WEEK: string; BULK_LOSS_PCT: number }>(`
    SELECT
      DATE_TRUNC('week', CORRECTION_DATE::DATE) AS WEEK,
      ABS(SUM(THEORETICAL_QUANTITY) - SUM(REALIZATION_QUANTITY)) / NULLIF(SUM(THEORETICAL_QUANTITY), 0) * 100 AS BULK_LOSS_PCT
    FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
    WHERE ${datePred}
    GROUP BY 1
    ORDER BY 1
  `, dateBinds);
}

// RFT weekly series → sparkline for dashboard card
export async function getRFTWeekly(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  return executeQuery<{ WEEK: string; RFT_PCT: number }>(`
    SELECT
      DATE_TRUNC('week', ${prodDate("PO_FG_DONE_DATE")}) AS WEEK,
      COUNT(CASE WHEN ACTIVITY <> 'ADJUST' THEN 1 END) * 100.0
        / NULLIF(COUNT(*), 0) AS RFT_PCT
    FROM ${LT_TABLE}
    WHERE ${datePred}
      ${plantWhere(filters.plant)}
    GROUP BY 1
    ORDER BY 1
  `, [...dateBinds, ...plantBinds(filters.plant)]);
}

// Trend Line → CT_MANUF_TRENDS for charting (weekly aggregated)
export async function getTrendsData(filters: QueryFilters) {
  return executeQuery<{
    WEEK: string;
    PLANT: string;
    AVG_LEADTIME: number;
    RELEASE_BULK: number;
    RELEASE_FG: number;
  }>(`
    SELECT
      DATE_TRUNC('week', ${prodDate("PO_FG_DONE_DATE")}) AS WEEK,
      PLANT,
      AVG(LEADTIME_IN_DAY)  AS AVG_LEADTIME,
      SUM(RELEASE_BULK)     AS RELEASE_BULK,
      SUM(RELEASE_FG)       AS RELEASE_FG
    FROM MIGRATION.CONTROL_TOWER.CT_MANUF_TRENDS
    WHERE ${prodDate("PO_FG_DONE_DATE")} BETWEEN ?::DATE AND ?::DATE
    ${plantWhere(filters.plant)}
    GROUP BY 1, 2
    ORDER BY 1
  `, [filters.startDate, filters.endDate, ...plantBinds(filters.plant)]);
}

// SPC Trend Chart — per-plant weekly KPI matching Tableau LOD expressions:
//   Lead Time:   AVG({FIXED [Process Order Fg]: AVG([Leadtime In Day])})
//   Upstream:    AVG({FIXED [Process Order Fg]: avg([Upstream Productivity])})
//   Downstream:  AVG({FIXED [Process Order Fg]: avg([Downstream Productivity])})
//   E2E:         AVG({FIXED [Process Order Fg]: avg([E2E Productivity])})
//   Output:      SUM({FIXED [Process Order Fg]: sum([Release Fg])})
//   Batch:       SUM({FIXED [Process Order Fg]: MAX([Release Bulk])})
// Every trend KPI also returns an "All plants" row per period (GROUPING SETS), computed from the raw rows —
// the Overview TrendChart Overall view uses it, so sums / ratios are exact, not averages of plant values.
// Output trend rows: one series per plant (the form's plant, OUTPUT_PLANT_SQL) + the "All plants" total.
function outputTrendByPlant(src: { sql: string; binds: unknown[] }, qty: string, unit: TrendGrain) {
  return executeQuery<{ WEEK: string; PLANT: string; KPI_VALUE: number }>(`
    SELECT WEEK, PLANT_KEY AS PLANT, SUM(QTY) AS KPI_VALUE
    FROM (SELECT DATE_TRUNC('${unit}', CORRECTION_DATE::DATE) AS WEEK, PLANT AS PLANT_KEY, ${qty} AS QTY FROM (${src.sql}) x) f
    GROUP BY WEEK, PLANT_KEY
    UNION ALL
    SELECT DATE_TRUNC('${unit}', CORRECTION_DATE::DATE) AS WEEK, 'All plants' AS PLANT, SUM(${qty}) AS KPI_VALUE
    FROM (${src.sql}) x
    GROUP BY 1
    ORDER BY WEEK
  `, [...src.binds, ...src.binds]);
}

export async function getTrendKPIByPlant(
  filters: QueryFilters & { kpiType?: string; grain?: TrendGrain; outputSel?: OutputSel | null }
) {
  const { startDate, endDate, plant, kpiType = "leadtime" } = filters;
  const unit = truncUnit(filters.grain); // WEEK column = start of the week or month
  const dateRange = "?::DATE AND ?::DATE";
  const pf = plantWhere(plant);

  switch (kpiType) {
    case "leadtime":
      // {FIXED [Process Order Fg]: AVG([Leadtime In Day])} — gross lead time
      // Same DATEDIFF logic as getLeadTimeKPI: ACTIVITY='PO' start → ACTIVITY='RECEIVE NDC' stop
      // N + LATE (POs above the Lead Time target) feed the Laney P′ chart on the Overview (% PO > target).
      // "All plants" is computed per PO over all its rows: a PO made in one plant and packed in another
      // (bulk J2 → packing J4) has no start or no end inside either plant, so a per-plant split would drop it.
      // Plant lines keep the per-plant rows (cross-plant POs are not attributed to a plant yet — docs/KNOWN_ISSUES.md).
      return executeQuery<{ WEEK: string; PLANT: string; KPI_VALUE: number; N: number; LATE: number }>(`
        WITH base AS (
          SELECT PROCESS_ORDER_FG, PLANT, ACTIVITY, ACTIVITY_START, ACTIVITY_STOP,
            DATE_TRUNC('${unit}', ${prodDate("PO_FG_DONE_DATE")}) AS WEEK
          FROM ${LT_TABLE}
          WHERE ${prodDate("PO_FG_DONE_DATE")} BETWEEN ${dateRange}
            ${pf}
        ),
        by_plant AS (
          SELECT PROCESS_ORDER_FG, WEEK, PLANT,
            DATEDIFF('minute', ${LEAD_TIME_START_SQL}, ${NDC_RECEIVED_AT_SQL}) / 1440.0 AS po_days
          FROM base
          GROUP BY PROCESS_ORDER_FG, WEEK, PLANT
          HAVING ${LEAD_TIME_START_SQL} IS NOT NULL AND ${NDC_RECEIVED_AT_SQL} IS NOT NULL
        ),
        by_po AS (
          SELECT PROCESS_ORDER_FG, WEEK,
            DATEDIFF('minute', ${LEAD_TIME_START_SQL}, ${NDC_RECEIVED_AT_SQL}) / 1440.0 AS po_days
          FROM base
          GROUP BY PROCESS_ORDER_FG, WEEK
          HAVING ${LEAD_TIME_START_SQL} IS NOT NULL AND ${NDC_RECEIVED_AT_SQL} IS NOT NULL
        )
        SELECT WEEK, PLANT, AVG(po_days) AS KPI_VALUE, COUNT(*) AS N, COUNT_IF(po_days > ?) AS LATE
        FROM by_plant GROUP BY WEEK, PLANT
        UNION ALL
        SELECT WEEK, 'All plants' AS PLANT, AVG(po_days) AS KPI_VALUE, COUNT(*) AS N, COUNT_IF(po_days > ?) AS LATE
        FROM by_po GROUP BY WEEK
        ORDER BY WEEK
      `, [startDate, endDate, ...plantBinds(plant), LEAD_TIME_TARGET_DAYS, LEAD_TIME_TARGET_DAYS]);

    case "upstream":
    case "downstream": {
      // Mixing (kg/manhour) / Filpac (pcs/manhour) — the same units and rule as the Productivity card's toggle
      // (getStageProductivity): Σ qty / Σ manhour per week / month, so the trend's last point matches the card.
      // Each unit (SFG for Mixing, activity for Filpac) counts in its own plant; "All plants" sums every unit
      // (empty grouping-set PLANT, same detection as OEE — ClickHouse has no GROUPING()).
      const mixing = kpiType === "upstream";
      const doneCol = mixing ? "OLAH_COMPLETED_AT" : "KEMAS_COMPLETED_AT";
      const unitSql = mixing
        ? `SELECT PROCESS_ORDER_SFG, MAX(PLANT) AS UNIT_PLANT, MAX(release_bulk) AS QTY, SUM(mh) AS MH, MAX(done_at) AS DONE_AT
           FROM (
             SELECT PROCESS_ORDER_SFG, ACTIVITY_ID,
               MAX(PLANT) AS PLANT,
               MAX(RELEASE_BULK) AS release_bulk,
               MAX(MANHOUR) * MAX(OPERATOR_COUNT) AS mh,
               MAX(OLAH_COMPLETED_AT) AS done_at
             FROM MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH
             WHERE ACTIVITY = 'MIXING' AND ${prodDate(doneCol)} BETWEEN ${dateRange} ${pf}
             GROUP BY PROCESS_ORDER_SFG, ACTIVITY_ID
           ) act_lvl
           GROUP BY PROCESS_ORDER_SFG`
        : `SELECT ACTIVITY_ID, MAX(PLANT) AS UNIT_PLANT, MAX(QTY_FG_GOOD) AS QTY, MAX(LEADTIME_IN_MINUTE) / 60.0 * MAX(OPERATOR_COUNT) AS MH, MAX(KEMAS_COMPLETED_AT) AS DONE_AT
           FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
           WHERE ACTIVITY = 'FILPAC' AND ${prodDate(doneCol)} BETWEEN ${dateRange} ${pf}
           GROUP BY ACTIVITY_ID`;
      return executeQuery<{ WEEK: string; PLANT: string; KPI_VALUE: number }>(`
        SELECT WK AS WEEK, CASE WHEN COALESCE(UNIT_PLANT, '') = '' THEN 'All plants' ELSE UNIT_PLANT END AS PLANT,
          SUM(QTY) / NULLIF(SUM(MH), 0) AS KPI_VALUE
        FROM (
          SELECT DATE_TRUNC('${unit}', ${prodDate("DONE_AT")}) AS WK, COALESCE(UNIT_PLANT, '(Not set)') AS UNIT_PLANT, QTY, MH
          FROM (${unitSql}) u
          WHERE QTY > 0 AND MH > 0
        ) w
        GROUP BY GROUPING SETS ((WK, UNIT_PLANT), (WK))
        ORDER BY WK
      `, [startDate, endDate, ...plantBinds(plant)]);
    }

    case "e2e":
      return executeQuery<{ WEEK: string; PLANT: string; KPI_VALUE: number }>(`
        WITH po_level AS (
          SELECT PROCESS_ORDER_FG,
            DATE_TRUNC('${unit}', ${prodDate("KEMAS_COMPLETED_AT")}) AS WEEK,
            PLANT,
            SUM(QTY_KEMAS) AS qty,
            SUM(UPSTREAM_LEADTIME_IN_HOUR * UPSTREAM_OPERATOR) AS up_mh,
            SUM(DOWNSTREAM_LEADTIME_IN_HOUR * DOWNSTREAM_OPERATOR) AS dn_mh
          FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
          WHERE ${prodDate("KEMAS_COMPLETED_AT")} BETWEEN ${dateRange} ${pf}
            AND QTY_KEMAS > 0
            AND (UPSTREAM_LEADTIME_IN_HOUR * UPSTREAM_OPERATOR) + (DOWNSTREAM_LEADTIME_IN_HOUR * DOWNSTREAM_OPERATOR) > 0
          GROUP BY PROCESS_ORDER_FG, WEEK, PLANT
        )
        SELECT WEEK,
          CASE WHEN COALESCE(PLANT, '') = '' THEN 'All plants' ELSE PLANT END AS PLANT,
          AVG(qty / NULLIF(up_mh + dn_mh, 0)) AS KPI_VALUE
        FROM po_level
        WHERE qty > 0 AND up_mh + dn_mh > 0
        GROUP BY GROUPING SETS ((WEEK, PLANT), (WEEK))
        ORDER BY WEEK
      `, [startDate, endDate, ...plantBinds(plant)]);

    case "output":
      // Released FG pcs per week / month from the FG datamart (CORRECTION_DATE) — the same rows as the Output card
      // and every Tactical FG chart. By plant = the form's plant (outputTrendByPlant).
      return outputTrendByPlant(fgRows({ plant, startDate, endDate }, filters.outputSel), "QUANTITY", unit);

    case "oee":
      return executeQuery<{ WEEK: string; PLANT: string; KPI_VALUE: number }>(`
        SELECT DATE_TRUNC('${unit}', ${prodDate("KEMAS_COMPLETED_AT")}) AS WEEK, CASE WHEN COALESCE(PLANT, '') = '' THEN 'All plants' ELSE PLANT END AS PLANT,
          AVG(
            (CASE WHEN QTY_TOTAL > 0 THEN QTY_FG_GOOD::FLOAT / QTY_TOTAL ELSE 0 END) *
            (CASE WHEN ACTIVITY_PRODUCTIVITY_STD > 0
              THEN LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0) ELSE 0 END)
          ) * 100 AS KPI_VALUE
        FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
        WHERE ${prodDate("KEMAS_COMPLETED_AT")} BETWEEN ${dateRange}
          ${pf}
        GROUP BY GROUPING SETS ((WEEK, PLANT), (WEEK))
        ORDER BY WEEK
      `, [startDate, endDate, ...plantBinds(plant)]);

    case "rft":
      // N + LATE (here: activities without ADJUST) feed the Laney P′ chart, same as lead time
      return executeQuery<{ WEEK: string; PLANT: string; KPI_VALUE: number; N: number; LATE: number }>(`
        SELECT DATE_TRUNC('${unit}', ${prodDate("PO_FG_DONE_DATE")}) AS WEEK, CASE WHEN COALESCE(PLANT, '') = '' THEN 'All plants' ELSE PLANT END AS PLANT,
          COUNT(CASE WHEN ACTIVITY <> 'ADJUST' THEN 1 END) * 100.0
            / NULLIF(COUNT(*), 0) AS KPI_VALUE,
          COUNT(*) AS N,
          COUNT(CASE WHEN ACTIVITY <> 'ADJUST' THEN 1 END) AS LATE
        FROM ${LT_TABLE}
        WHERE ${prodDate("PO_FG_DONE_DATE")} BETWEEN ${dateRange}
          ${pf}
        GROUP BY GROUPING SETS ((WEEK, PLANT), (WEEK))
        ORDER BY WEEK
      `, [startDate, endDate, ...plantBinds(plant)]);

    case "productivity":
      // E2E productivity — same formula as getE2EProductivity: SUM per PO, then AVG across POs.
      return executeQuery<{ WEEK: string; PLANT: string; KPI_VALUE: number }>(`
        WITH po_level AS (
          SELECT PROCESS_ORDER_FG,
            DATE_TRUNC('${unit}', ${prodDate("KEMAS_COMPLETED_AT")}) AS WEEK,
            PLANT,
            SUM(QTY_KEMAS) AS qty,
            SUM(UPSTREAM_LEADTIME_IN_HOUR * UPSTREAM_OPERATOR) AS up_mh,
            SUM(DOWNSTREAM_LEADTIME_IN_HOUR * DOWNSTREAM_OPERATOR) AS dn_mh
          FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
          WHERE ${prodDate("KEMAS_COMPLETED_AT")} BETWEEN ${dateRange}
            ${pf}
            AND QTY_KEMAS > 0
            AND (UPSTREAM_LEADTIME_IN_HOUR * UPSTREAM_OPERATOR) + (DOWNSTREAM_LEADTIME_IN_HOUR * DOWNSTREAM_OPERATOR) > 0
          GROUP BY PROCESS_ORDER_FG, WEEK, PLANT
        )
        SELECT WEEK,
          CASE WHEN COALESCE(PLANT, '') = '' THEN 'All plants' ELSE PLANT END AS PLANT,
          AVG(qty / NULLIF(up_mh + dn_mh, 0)) AS KPI_VALUE
        FROM po_level
        WHERE qty > 0 AND up_mh + dn_mh > 0
        GROUP BY GROUPING SETS ((WEEK, PLANT), (WEEK))
        ORDER BY WEEK
      `, [startDate, endDate, ...plantBinds(plant)]);

    case "bulkloss":
      // No PLANT column in this table — only the "All plants" series (By plant view is locked)
      return executeQuery<{ WEEK: string; PLANT: string; KPI_VALUE: number }>(`
        SELECT DATE_TRUNC('${unit}', CORRECTION_DATE::DATE) AS WEEK,
          'All plants' AS PLANT,
          ABS(SUM(THEORETICAL_QUANTITY) - SUM(REALIZATION_QUANTITY)) / NULLIF(SUM(THEORETICAL_QUANTITY), 0) * 100 AS KPI_VALUE
        FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
        WHERE CORRECTION_DATE::DATE BETWEEN ${dateRange}
        GROUP BY WEEK
        ORDER BY WEEK
      `, [startDate, endDate]);

    case "output_bulk":
      // Output trend when the Output card is on Bulk: kg per week / month (CORRECTION_DATE, same as the card).
      return outputTrendByPlant(bulkRows({ plant, startDate, endDate }), "REALIZATION_QUANTITY", unit);

    default:
      return [] as { WEEK: string; PLANT: string; KPI_VALUE: number }[];
  }
}

export async function getPlantList() {
  const rows = await executeQuery<{ PLANT: string }>(`
    SELECT DISTINCT PLANT
    FROM MIGRATION.CONTROL_TOWER.CT_MANUF_TRENDS
    WHERE PLANT IS NOT NULL
    ORDER BY PLANT
  `);
  return rows.map((r) => r.PLANT);
}

export async function getEtlTimestamp(): Promise<string | null> {
  const rows = await executeQuery<{ LAST_ETL: string | null }>(`
    SELECT MAX(LOAD_TIMESTAMP) AS LAST_ETL
    FROM ${LT_TABLE}
  `);
  return rows[0]?.LAST_ETL ?? null;
}

// Tactical Overview donut (Lead Time tab): avg days per ACTIVITY across completed POs in the period.
export async function getLeadTimeGroupProcess(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  // Group by POSITION (stage code) so the result matches PROCESS_GROUPS.stages for the DonutCard.
  return executeQuery<{ ACTIVITY: string; AVG_DAYS: number; PO_COUNT: number }>(`
    SELECT POSITION AS ACTIVITY, AVG(net_lt) AS AVG_DAYS, COUNT(*) AS PO_COUNT
    FROM (
      SELECT PROCESS_ORDER_FG, POSITION,
             SUM(NET_LEADTIME) / 1440.0 AS net_lt
      FROM ${LT_TABLE}
      WHERE ACTIVITY_TYPE = 'ACTUAL'
        AND PO_FG_DONE_DATE IS NOT NULL
        AND ACTIVITY <> 'ADJUST'
        AND POSITION IS NOT NULL
        AND ${datePred}
        ${ltWhere(filters)}
      GROUP BY PROCESS_ORDER_FG, POSITION
    ) sub
    GROUP BY POSITION
    ORDER BY AVG_DAYS DESC
  `, [...dateBinds, ...ltBinds(filters)]);
}

// Tactical Overview histogram (Lead Time tab): 2-day bins up to >38d, with mean/median/stddev/total.
// gross = start (basis) → RECEIVE NDC; nett = first Weighing → Receive NDC minus WIP (ltNettPerPoSql, same as getLeadTimeKPI),
// which does not depend on the basis.
export async function getLeadTimeDistributionBins(filters: QueryFilters, basis: "created" | "released" = "created", metric: "gross" | "nett" = "gross") {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  const startSql = basis === "released" ? PO_RELEASED_AT_SQL : PO_CREATED_AT_SQL;
  const grossMinutes = `DATEDIFF('minute', ${startSql}, ${NDC_RECEIVED_AT_SQL})`;
  // Nett reads every row type (WIP rows mark the time left out), so no ACTUAL filter there
  const perPo = metric === "nett"
    ? `SELECT NETT_PO_KEY AS PROCESS_ORDER_FG, nett_minutes / 1440.0 AS lt_days
      FROM (${ltNettPerPoSql(`SELECT * FROM ${LT_TABLE} WHERE PO_FG_DONE_DATE IS NOT NULL AND ${datePred} ${ltWhere(filters)}`)}) n
      WHERE nett_minutes IS NOT NULL`
    : `SELECT PROCESS_ORDER_FG, ${grossMinutes} / 1440.0 AS lt_days
      FROM ${LT_TABLE}
      WHERE PO_FG_DONE_DATE IS NOT NULL
        AND ACTIVITY_TYPE = 'ACTUAL'
        AND ${datePred}
        ${ltWhere(filters)}
      GROUP BY PROCESS_ORDER_FG
      HAVING ${startSql} IS NOT NULL
        AND  ${NDC_RECEIVED_AT_SQL} IS NOT NULL
        AND  ${grossMinutes} >= 0`;
  return executeQuery<{ BIN_START: number; CNT: number; MEAN_DAYS: number; MEDIAN_DAYS: number; STDDEV_DAYS: number; TOTAL_POS: number }>(`
    WITH per_po AS (
      ${perPo}
    ),
    stats AS (
      SELECT AVG(lt_days)    AS mean_days,
             MEDIAN(lt_days) AS median_days,
             STDDEV(lt_days) AS stddev_days,
             COUNT(*)        AS total_pos
      FROM per_po
    ),
    bins AS (
      SELECT FLOOR(LEAST(lt_days, 38) / 2) * 2 AS bin_start, COUNT(*) AS cnt
      FROM per_po
      GROUP BY FLOOR(LEAST(lt_days, 38) / 2) * 2
    )
    SELECT
      b.bin_start   AS BIN_START,
      b.cnt         AS CNT,
      s.mean_days   AS MEAN_DAYS,
      s.median_days AS MEDIAN_DAYS,
      s.stddev_days AS STDDEV_DAYS,
      s.total_pos   AS TOTAL_POS
    FROM bins b CROSS JOIN stats s
    ORDER BY b.bin_start
  `, Array(metric === "nett" ? 2 : 1).fill([...dateBinds, ...ltBinds(filters)]).flat());
}

// Lead Time page → Analysis tab: one row per PO under the distribution histogram (same population as
// getLeadTimeDistributionBins: completed in the period, ACTUAL rows, Lead Time page filters). Gross = start
// (PO Created / Released) → RECEIVE NDC; nett = first Weighing → Receive NDC minus WIP. Per process group (PROCESS_GROUPS):
// the ltSplitSql split, so the group columns add up to the PO's gross / nett — same rule as the plant table and the
// sunburst. The browser bins the POs with the same rule as the SQL to filter by a clicked bar.
const PO_GROUP_COLS: { key: string; positions: string[] }[] = [
  { key: "PO",       positions: ["PO"] },
  { key: "WEIGHING", positions: ["TIMBANG"] },
  { key: "MIXING",   positions: ["OLAH", "CUCI OLAH"] },
  { key: "FILPAC",   positions: ["KEMAS 1", "KEMAS 2", "CUCI KEMAS"] },
  { key: "NDC",      positions: ["RECEIVE NDC"] },
  { key: "WIP",      positions: ["WIP"] },
];

export type LeadTimePoRow = {
  PROCESS_ORDER_FG: string; PRODUCT_CODE: string | null; PRODUCT_NAME: string | null; PLANT: string | null;
  GROSS_DAYS: number | null; NETT_DAYS: number | null;
} & Record<`${"G" | "N"}_${"PO" | "WEIGHING" | "MIXING" | "FILPAC" | "NDC" | "WIP"}`, number | null>;

export async function getLeadTimePoList(filters: QueryFilters, basis: "created" | "released" = "created") {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  const startSql = basis === "released" ? PO_RELEASED_AT_SQL : PO_CREATED_AT_SQL;
  const groupCols = PO_GROUP_COLS.map(({ key, positions }) => {
    const inList = positions.map((p) => `'${p}'`).join(", ");
    return `SUM(CASE WHEN POSITION IN (${inList}) THEN GROSS_MIN END) / 1440.0 AS G_${key},
      SUM(CASE WHEN POSITION IN (${inList}) THEN NETT_MIN END) / 1440.0 AS N_${key}`;
  }).join(",\n      ");
  return executeQuery<LeadTimePoRow>(`
    WITH lt_rows AS (
      SELECT *
      FROM ${LT_TABLE}
      WHERE PO_FG_DONE_DATE IS NOT NULL
        AND ACTIVITY_TYPE = 'ACTUAL'
        AND ${datePred}
        ${ltWhere(filters)}
    ),
    po AS (
      SELECT PROCESS_ORDER_FG,
        MAX(PRODUCT_CODE) AS PRODUCT_CODE,
        MAX(PRODUCT_NAME) AS PRODUCT_NAME,
        MAX(PLANT)        AS PLANT,
        CASE WHEN ${startSql} IS NOT NULL AND ${NDC_RECEIVED_AT_SQL} IS NOT NULL
               AND DATEDIFF('minute', ${startSql}, ${NDC_RECEIVED_AT_SQL}) >= 0
             THEN DATEDIFF('minute', ${startSql}, ${NDC_RECEIVED_AT_SQL}) / 1440.0 END AS GROSS_DAYS
      FROM lt_rows
      GROUP BY PROCESS_ORDER_FG
    ),
    -- Group columns: the split that adds up to gross / nett (ltSplitSql) — every row type, not only ACTUAL.
    -- Nett per PO = the sum of its nett split (first Weighing → Receive NDC minus WIP).
    grp AS (
      SELECT PROCESS_ORDER_FG,
      SUM(NETT_MIN) / 1440.0 AS NETT_DAYS,
      ${groupCols}
      FROM (${ltSplitSql(`
        SELECT * FROM ${LT_TABLE}
        WHERE PO_FG_DONE_DATE IS NOT NULL AND ${datePred}
          ${ltWhere(filters)}`, startSql)}) x
      GROUP BY PROCESS_ORDER_FG
    )
    SELECT po.PROCESS_ORDER_FG, po.PRODUCT_CODE, po.PRODUCT_NAME, po.PLANT, po.GROSS_DAYS, grp.NETT_DAYS,
      ${PO_GROUP_COLS.map(({ key }) => `grp.G_${key}, grp.N_${key}`).join(", ")}
    FROM po LEFT JOIN grp ON grp.PROCESS_ORDER_FG = po.PROCESS_ORDER_FG
    WHERE po.GROSS_DAYS IS NOT NULL OR grp.NETT_DAYS IS NOT NULL
    ORDER BY po.GROSS_DAYS DESC NULLS LAST
    LIMIT 50000
  `, Array(3).fill([...dateBinds, ...ltBinds(filters)]).flat());
}

// Lead Time page → Analysis tab: "Lead Time per Line" bubble chart + "Lead Time SKU per Line" table.
// Process time at a line = span of the activity rows of that process on that line per PO (first start → last stop);
// Mixing = OLAH, Filling Packing = KEMAS 1 / KEMAS 2 (cleaning rows left out). Volume = RELEASE_QTY (pcs, one
// value per PO). One row per line × SKU with sums, so the browser can aggregate per line exactly
// (avg = SPAN_DAYS / PO_COUNT). Same population as the PO list (completed in the period, ACTUAL rows, page filters).
export type LineActivity = "mixing" | "filpac";
const LINE_POSITIONS: Record<LineActivity, string[]> = { mixing: ["OLAH"], filpac: ["KEMAS 1", "KEMAS 2"] };

export async function getLeadTimeByLineSku(filters: QueryFilters, activity: LineActivity = "filpac", scope: LtScopeArg = "created", metric: LtMetricArg = "gross") {
  const startSql = ltStartSql(scope);
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  const positions = LINE_POSITIONS[activity].map((p) => `'${p}'`).join(", ");
  // Two CTEs: per_po reads all rows per PO so PO+NDC rows are visible (same gross / nett as getLeadTimeAnalysisStats);
  // per_sku uses ACTUAL+POSITION filter like the original to get LINE_NAME and span.
  const ltCol = metric === "nett" ? "nett_days" : "gross_days";
  return executeQuery<{ LINE_NAME: string; PRODUCT_CODE: string | null; PRODUCT_NAME: string | null; PO_COUNT: number; SPAN_DAYS: number; QTY: number | null; AVG_LT_DAYS: number | null }>(`
    WITH per_po AS (
      SELECT
        PROCESS_ORDER_FG,
        DATEDIFF('minute', ${startSql}, ${NDC_RECEIVED_AT_SQL}) / 1440.0 AS gross_days,
        MAX(n.nett_minutes) / 1440.0 AS nett_days
      FROM ${LT_TABLE}
      ${ltNettJoin(datePred, filters)}
      WHERE ${datePred}
        ${ltWhere(filters)}
      GROUP BY PROCESS_ORDER_FG
    ),
    per_sku AS (
      SELECT
        PROCESS_ORDER_FG,
        LINE_NAME,
        PRODUCT_CODE,
        MAX(PRODUCT_NAME) AS PRODUCT_NAME,
        GREATEST(COALESCE(DATEDIFF('minute', MIN(ACTIVITY_START), MAX(ACTIVITY_STOP)), 0), 0) / 1440.0 AS span_days,
        MAX(RELEASE_QTY) AS qty
      FROM ${LT_TABLE}
      WHERE PO_FG_DONE_DATE IS NOT NULL
        AND ACTIVITY_TYPE = 'ACTUAL'
        AND POSITION IN (${positions})
        AND LINE_NAME IS NOT NULL
        AND ${datePred}
        ${ltWhere(filters)}
      GROUP BY PROCESS_ORDER_FG, LINE_NAME, PRODUCT_CODE
    )
    SELECT
      s.LINE_NAME,
      s.PRODUCT_CODE,
      MAX(s.PRODUCT_NAME) AS PRODUCT_NAME,
      COUNT(*) AS PO_COUNT,
      SUM(s.span_days) AS SPAN_DAYS,
      SUM(s.qty) AS QTY,
      AVG(g.${ltCol}) AS AVG_LT_DAYS
    FROM per_sku s
    LEFT JOIN per_po g ON g.PROCESS_ORDER_FG = s.PROCESS_ORDER_FG
    GROUP BY s.LINE_NAME, s.PRODUCT_CODE
  `, Array(4).fill([...dateBinds, ...ltBinds(filters)]).flat());
}

// Tactical Overview gauge stats (Lead Time tab): max gross LT (gauge right end), avg PO-stage days, PO count.
export async function getLeadTimeTacticalStats(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  const rows = await executeQuery<{ MAX_GROSS_DAYS: number | null; AVG_PO_STAGE_DAYS: number | null; PO_COUNT: number; ON_TIME_COUNT: number; AT_RISK_COUNT: number; LATE_COUNT: number }>(`
    WITH per_po AS (
      SELECT PROCESS_ORDER_FG,
        DATEDIFF('minute',
          MIN(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_STOP END),
          MAX(CASE WHEN ACTIVITY_SEQUENCE = 45 THEN ACTIVITY_STOP END)
        ) / 1440.0 AS gross_lt_days,
        SUM(CASE WHEN ACTIVITY = 'PO' THEN NET_LEADTIME ELSE 0 END) / 1440.0 AS po_stage_days
      FROM ${LT_TABLE}
      WHERE PO_FG_DONE_DATE IS NOT NULL
        AND ACTIVITY_TYPE = 'ACTUAL'
        AND ${datePred}
        ${ltWhere(filters)}
      GROUP BY PROCESS_ORDER_FG
      HAVING MIN(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_STOP END) IS NOT NULL
        AND  MAX(CASE WHEN ACTIVITY_SEQUENCE = 45 THEN ACTIVITY_STOP END) IS NOT NULL
        AND  DATEDIFF('minute',
               MIN(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_STOP END),
               MAX(CASE WHEN ACTIVITY_SEQUENCE = 45 THEN ACTIVITY_STOP END)
             ) >= 0
    )
    SELECT
      MAX(gross_lt_days)   AS MAX_GROSS_DAYS,
      AVG(po_stage_days)   AS AVG_PO_STAGE_DAYS,
      COUNT(*)             AS PO_COUNT,
      SUM(CASE WHEN gross_lt_days <= 13 THEN 1 ELSE 0 END)                               AS ON_TIME_COUNT,
      SUM(CASE WHEN gross_lt_days > 13 AND gross_lt_days <= 13 * 1.15 THEN 1 ELSE 0 END) AS AT_RISK_COUNT,
      SUM(CASE WHEN gross_lt_days > 13 * 1.15 THEN 1 ELSE 0 END)                         AS LATE_COUNT
    FROM per_po
  `, [...dateBinds, ...ltBinds(filters)]);
  return rows[0] ?? { MAX_GROSS_DAYS: null, AVG_PO_STAGE_DAYS: null, PO_COUNT: 0, ON_TIME_COUNT: 0, AT_RISK_COUNT: 0, LATE_COUNT: 0 };
}

// ── Lead Time page (Analysis tab) ─────────────────────────────────────────────
// Per PO: gross = start (scope: PO Created / Released) → RECEIVE NDC; nett = ltNettJoin (first Weighing → NDC minus WIP); was rows with a
// LINE_CATEGORY (same as getLeadTimeKPI). Stats are over POs that have the value.
export async function getLeadTimeAnalysisStats(filters: QueryFilters, scope: "created" | "released" = "created") {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  const startSql = scope === "released" ? PO_RELEASED_AT_SQL : PO_CREATED_AT_SQL;
  const rows = await executeQuery<{
    GROSS_AVG: number | null; GROSS_MEDIAN: number | null; GROSS_P25: number | null; GROSS_P75: number | null; GROSS_P90: number | null; GROSS_MAX: number | null; GROSS_N: number;
    NETT_AVG: number | null; NETT_MEDIAN: number | null; NETT_P25: number | null; NETT_P75: number | null; NETT_P90: number | null; NETT_MAX: number | null; NETT_N: number;
    ONTIME: number; AT_RISK: number; LATE: number;
  }>(`
    WITH per_po AS (
      SELECT PROCESS_ORDER_FG,
        DATEDIFF('minute', ${startSql}, ${NDC_RECEIVED_AT_SQL}) / 1440.0 AS gross,
        MAX(n.nett_minutes) / 1440.0 AS nett
      FROM ${LT_TABLE}
      ${ltNettJoin(datePred, filters)}
      WHERE ${datePred}
        ${ltWhere(filters)}
      GROUP BY PROCESS_ORDER_FG
    )
    SELECT
      AVG(gross) AS GROSS_AVG, MEDIAN(gross) AS GROSS_MEDIAN,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY gross) AS GROSS_P25,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY gross) AS GROSS_P75,
      PERCENTILE_CONT(0.9)  WITHIN GROUP (ORDER BY gross) AS GROSS_P90,
      MAX(gross) AS GROSS_MAX, COUNT(gross) AS GROSS_N,
      AVG(nett) AS NETT_AVG, MEDIAN(nett) AS NETT_MEDIAN,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY nett) AS NETT_P25,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY nett) AS NETT_P75,
      PERCENTILE_CONT(0.9)  WITHIN GROUP (ORDER BY nett) AS NETT_P90,
      MAX(nett) AS NETT_MAX, COUNT(nett) AS NETT_N,
      -- Same buckets as the Tactical gauge (getLeadTimeTacticalStats): on time ≤ target, at risk ≤ +15%, late above
      COUNT_IF(gross <= ?) AS ONTIME,
      COUNT_IF(gross > ? AND gross <= ? * 1.15) AS AT_RISK,
      COUNT_IF(gross > ? * 1.15) AS LATE
    FROM per_po
  `, [...Array(3).fill([...dateBinds, ...ltBinds(filters)]).flat(), LEAD_TIME_TARGET_DAYS, LEAD_TIME_TARGET_DAYS, LEAD_TIME_TARGET_DAYS, LEAD_TIME_TARGET_DAYS]);
  return rows[0];
}

/** Weekly average gross (scope) and nett per PO — sparkline of the Lead Time card. */
export async function getLeadTimeAnalysisWeekly(filters: QueryFilters, scope: "created" | "released" = "created") {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  const startSql = scope === "released" ? PO_RELEASED_AT_SQL : PO_CREATED_AT_SQL;
  return executeQuery<{ WEEK: string; GROSS: number | null; NETT: number | null }>(`
    SELECT WEEK, AVG(gross) AS GROSS, AVG(nett) AS NETT
    FROM (
      SELECT PROCESS_ORDER_FG,
        DATE_TRUNC('week', ${prodDate("MAX(PO_FG_DONE_DATE)")}) AS WEEK,
        DATEDIFF('minute', ${startSql}, ${NDC_RECEIVED_AT_SQL}) / 1440.0 AS gross,
        MAX(n.nett_minutes) / 1440.0 AS nett
      FROM ${LT_TABLE}
      ${ltNettJoin(datePred, filters)}
      WHERE ${datePred}
        ${ltWhere(filters)}
      GROUP BY PROCESS_ORDER_FG
    ) sub
    GROUP BY WEEK
    ORDER BY WEEK
  `, Array(3).fill([...dateBinds, ...ltBinds(filters)]).flat());
}

/**
 * Time per activity per PO (Group Process and Process sunburst). Values are summed over POs ÷ all POs, so they add up.
 * Gross / Nett = the ltSplitSql split (nett: first Weighing → Receive NDC minus WIP).
 */
export async function getLeadTimeProcessBreakdown(filters: QueryFilters, scope: "created" | "released" = "created") {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  const startSql = scope === "released" ? PO_RELEASED_AT_SQL : PO_CREATED_AT_SQL;
  const binds = [...dateBinds, ...ltBinds(filters)];
  // ltSplitSql: gross ÷ POs with a gross value, nett ÷ POs with a nett value, so the activities add up to the
  // Lead Time card's gross / nett average.
  return executeQuery<{ STAGE: string; ACTIVITY: string; SEQ: number | null; GROSS_DAYS: number; NETT_DAYS: number }>(`
    WITH split AS (${ltSplitSql(`
      SELECT * FROM ${LT_TABLE}
      WHERE ${datePred}
        ${ltWhere(filters)}`, startSql)}
    ),
    po AS (
      SELECT PROCESS_ORDER_FG, SUM(GROSS_MIN) AS g, SUM(NETT_MIN) AS n
      FROM split
      GROUP BY PROCESS_ORDER_FG
    ),
    cnt AS (SELECT COUNT(g) AS GN, COUNT(n) AS NN FROM po)
    SELECT s.POSITION AS STAGE, s.ACTIVITY AS ACTIVITY, MIN(s.ACTIVITY_SEQUENCE) AS SEQ,
      COALESCE(SUM(s.GROSS_MIN), 0) / 1440.0 / NULLIF(MAX(c.GN), 0) AS GROSS_DAYS,
      COALESCE(SUM(s.NETT_MIN), 0) / 1440.0 / NULLIF(MAX(c.NN), 0) AS NETT_DAYS
    FROM split s CROSS JOIN cnt c
    WHERE s.POSITION IS NOT NULL
    GROUP BY s.POSITION, s.ACTIVITY
  `, [...binds, ...binds]);
}

/** Dropdown values for the Lead Time page filters, for the current period and plant (other filters ignored). */
export async function getLeadTimeFilterOptions(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  const binds = [...dateBinds, ...plantBinds(filters.plant)];
  const where = `WHERE ${datePred} ${plantWhere(filters.plant)}`;
  const list = (col: string, extra = "") => executeQuery<{ V: string; L: string | null; S: number | null }>(`
    SELECT ${col} AS V, ${extra || "NULL"} AS L, MIN(ACTIVITY_SEQUENCE) AS S
    FROM ${LT_TABLE} ${where} AND ${col} IS NOT NULL
    GROUP BY ${col}
    ORDER BY ${col}
    LIMIT 30000
  `, binds);
  const activityList = () => executeQuery<{ V: string; L: string | null; S: number | null; P: string | null }>(`
    SELECT ACTIVITY AS V, NULL AS L, MIN(ACTIVITY_SEQUENCE) AS S, MAX(POSITION) AS P
    FROM ${LT_TABLE} ${where} AND ACTIVITY IS NOT NULL
    GROUP BY ACTIVITY
    ORDER BY ACTIVITY
    LIMIT 30000
  `, binds);
  const [po, activity, lineCategory, line, skuGroup, sku, variant] = await Promise.all([
    list("PROCESS_ORDER_FG"),
    activityList(),
    list("LINE_CATEGORY"),
    list("LINE_NAME"),
    list("SKU_GROUP"),
    list("PRODUCT_CODE", "MAX(PRODUCT_NAME)"),
    list("PRODUCT_VARIANT"),
  ]);
  return { po, activity, lineCategory, line, skuGroup, sku, variant };
}
