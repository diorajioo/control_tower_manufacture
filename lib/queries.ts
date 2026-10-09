import { executeQuery } from "@/lib/db";
import { LEAD_TIME_START_SQL, NDC_RECEIVED_AT_SQL, PO_CREATED_AT_SQL, PO_RELEASED_AT_SQL, LEAD_TIME_TARGET_DAYS } from "@/lib/leadTimeDefinition";

interface QueryFilters {
  plant?: string;
  startDate?: string;
  endDate?: string;
  period?: string;       // "YTD" | "30D" | "90D" | "6M" | "Today" | "This Week" | "Last Week" | "This Month" | "Last Month" | "Custom"
  leadTimeType?: string; // "Gross Time" | "Nett Time"
  timeUnit?: string;     // "Daily" | "Hourly"
}

// Plant filter as a parameterized predicate: plantWhere() gives the SQL (with ?),
// plantBinds() the matching values — append them after the date binds.
const hasPlant = (plant?: string): plant is string => !!plant && plant !== "All Plant";
const plantWhere = (plant?: string, col = "PLANT") => (hasPlant(plant) ? `AND ${col} = ?` : "");
const plantBinds = (plant?: string): unknown[] => (hasPlant(plant) ? [plant] : []);

// Trend granularity for line charts. Only these two literals are ever put into DATE_TRUNC.
export type TrendGrain = "week" | "month";
const truncUnit = (grain?: string): TrendGrain => (grain === "month" ? "month" : "week");

// Translates the Tableau Period calc filter to a parameterized Snowflake WHERE predicate.
// Returns { sql, binds } — sql uses ? placeholders, binds holds the values.
// Period-relative cases use CURRENT_DATE() (server-side, no drift).
// Custom/fallback cases bind the actual date strings as typed DATE params.
function periodDateWhere(
  col: string,
  period?: string,
  start?: string,
  end?: string
): { sql: string; binds: unknown[] } {
  switch (period) {
    case "Today":
      return { sql: `${col}::DATE = CURRENT_DATE()`, binds: [] };
    case "This Week":
      return { sql: `DATEADD('day', 1-DAYOFWEEKISO(${col}::DATE), ${col}::DATE) = DATEADD('day', 1-DAYOFWEEKISO(CURRENT_DATE()), CURRENT_DATE())`, binds: [] };
    case "Last Week":
      return { sql: `DATEADD('day', 1-DAYOFWEEKISO(${col}::DATE), ${col}::DATE) = DATEADD('day', 1-DAYOFWEEKISO(DATEADD('week',-1,CURRENT_DATE())), DATEADD('week',-1,CURRENT_DATE()))`, binds: [] };
    case "This Month":
      return { sql: `DATE_TRUNC('month', ${col}::DATE) = DATE_TRUNC('month', CURRENT_DATE())`, binds: [] };
    case "Last Month":
      return { sql: `DATE_TRUNC('month', ${col}::DATE) = DATE_TRUNC('month', DATEADD('month',-1,CURRENT_DATE()))`, binds: [] };
    case "YTD":
      return { sql: `${col}::DATE BETWEEN DATE_TRUNC('year', CURRENT_DATE()) AND CURRENT_DATE()`, binds: [] };
    case "30D":
      return { sql: `${col}::DATE BETWEEN DATEADD('day',-30,CURRENT_DATE()) AND CURRENT_DATE()`, binds: [] };
    case "90D":
      return { sql: `${col}::DATE BETWEEN DATEADD('day',-90,CURRENT_DATE()) AND CURRENT_DATE()`, binds: [] };
    case "6M":
      return { sql: `${col}::DATE BETWEEN DATEADD('month',-6,CURRENT_DATE()) AND CURRENT_DATE()`, binds: [] };
    default:
      return { sql: `${col}::DATE BETWEEN ?::DATE AND ?::DATE`, binds: [start, end] };
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
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
      WHERE ${datePred}
        ${plantWhere(filters.plant)}
      GROUP BY PROCESS_ORDER_FG
      HAVING ${PO_RELEASED_AT_SQL} IS NOT NULL
        AND ${NDC_RECEIVED_AT_SQL} IS NOT NULL
    ) sub
  `, [...dateBinds, ...plantBinds(filters.plant)]);
  return rows[0];
}

// Lead Time → CT_MANUF_LEADTIME
// Gross: DATEDIFF(lead time start → RECEIVE NDC stop) per PO — start per LEAD_TIME_BASIS (lib/leadTimeDefinition.ts)
// Nett:  SUM(NET_LEADTIME) for ACTUAL rows where LINE_CATEGORY IS NOT NULL per PO
export async function getLeadTimeKPI(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  const plantFilter = plantWhere(filters.plant);

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
        FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
        WHERE ${datePred}
          ${plantFilter}
        GROUP BY PROCESS_ORDER_FG
        HAVING ${LEAD_TIME_START_SQL} IS NOT NULL
          AND ${NDC_RECEIVED_AT_SQL} IS NOT NULL
      ) sub
    `, [...dateBinds, ...plantBinds(filters.plant)]),
    executeQuery<{ AVG_NETT: number }>(`
      SELECT AVG(nett_minutes) / 1440.0 AS AVG_NETT
      FROM (
        SELECT PROCESS_ORDER_FG, SUM(NET_LEADTIME) AS nett_minutes
        FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
        WHERE ${datePred}
          AND ACTIVITY_TYPE = 'ACTUAL'
          AND LINE_CATEGORY IS NOT NULL
          ${plantFilter}
        GROUP BY PROCESS_ORDER_FG
      ) sub
    `, [...dateBinds, ...plantBinds(filters.plant)]),
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
export async function getLeadTimeComposition(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
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
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
      WHERE ${datePred}
        ${plantWhere(filters.plant)}
      GROUP BY PROCESS_ORDER_FG
    ) sub
  `, [...dateBinds, ...plantBinds(filters.plant)]);
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
        DATE_TRUNC('week', MAX(PO_FG_DONE_DATE)::DATE) AS WEEK,
        PROCESS_ORDER_FG,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'VA'   THEN NET_LEADTIME ELSE 0 END) AS va_min,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'NNVA' THEN NET_LEADTIME ELSE 0 END) AS nnva_min,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'UNVA' THEN NET_LEADTIME ELSE 0 END) AS unva_min,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'UNVA' AND ACTIVITY_TYPE = 'WIP' THEN NET_LEADTIME ELSE 0 END) AS wip_min
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
      WHERE ${datePred}
        ${plantWhere(filters.plant)}
      GROUP BY PROCESS_ORDER_FG
    ) sub
    GROUP BY WEEK
    ORDER BY WEEK
  `, [...dateBinds, ...plantBinds(filters.plant)]);
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
        DATE_TRUNC('month', MAX(PO_FG_DONE_DATE)::DATE) AS MONTH,
        PROCESS_ORDER_FG,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'VA'   THEN NET_LEADTIME ELSE 0 END) AS va_min,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'NNVA' THEN NET_LEADTIME ELSE 0 END) AS nnva_min,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'UNVA' THEN NET_LEADTIME ELSE 0 END) AS unva_min,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'UNVA' AND ACTIVITY_TYPE = 'WIP' THEN NET_LEADTIME ELSE 0 END) AS wip_min
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
      WHERE ${datePred}
        ${plantWhere(filters.plant)}
      GROUP BY PROCESS_ORDER_FG
    ) sub
    GROUP BY MONTH
    ORDER BY MONTH
  `, [...dateBinds, ...plantBinds(filters.plant)]);
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
        DATE_TRUNC('${unit}', MAX(PO_FG_DONE_DATE)::DATE) AS WEEK,
        PROCESS_ORDER_FG,
        POSITION,
        SUM(NET_LEADTIME) AS pos_minutes
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
      WHERE ${datePred}
        AND POSITION IS NOT NULL
        ${plantWhere(filters.plant)}
      GROUP BY PROCESS_ORDER_FG, POSITION
    ) sub
    GROUP BY WEEK, POSITION
    ORDER BY WEEK, POSITION
  `, [...dateBinds, ...plantBinds(filters.plant)]);
}

// Lead Time vs PO count per SKU → scatter plot on /lead-time
// X = COUNT(DISTINCT PROCESS_ORDER_FG), Y = AVG gross lead time (PO start → RECEIVE NDC stop) in days.
// Limited to SKUs with fewer than 100 POs in the period (100+ = few outliers that compress the axis).
// Lead time per stage (POSITION) × ACTIVITY_CATEGORY → Pareto stacked bar on /lead-time
// DAYS = SUM(NET_LEADTIME) / COUNT(DISTINCT PO in period) / 1440 — contribution per PO, so bars add up.
// WIP rows ("WIP AFTER <activity>") are also mapped to the stage of that activity (ATTACHED_STAGE),
// so the chart can show WIP either as its own bar or folded into the stage it follows.
export async function getLeadTimeByStageCategory(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  return executeQuery<{ STAGE: string; ACTIVITY: string; MIN_ACTIVITY_ID: number; ATTACHED_STAGE: string; CATEGORY: string; DAYS: number }>(`
    WITH base AS (
      SELECT PROCESS_ORDER_FG, POSITION, ACTIVITY, ACTIVITY_ID, ACTIVITY_CATEGORY, NET_LEADTIME
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
      WHERE ${datePred}
        AND POSITION IS NOT NULL
        ${plantWhere(filters.plant)}
    ),
    act_pos AS (
      SELECT ACTIVITY, MAX(POSITION) AS POSITION
      FROM base
      WHERE POSITION <> 'WIP'
      GROUP BY ACTIVITY
    ),
    po AS (SELECT COUNT(DISTINCT PROCESS_ORDER_FG) AS N FROM base)
    SELECT
      b.POSITION  AS STAGE,
      b.ACTIVITY  AS ACTIVITY,
      MIN(b.ACTIVITY_ID) AS MIN_ACTIVITY_ID,
      CASE WHEN b.POSITION = 'WIP' THEN COALESCE(ap.POSITION, 'WIP') ELSE b.POSITION END AS ATTACHED_STAGE,
      b.ACTIVITY_CATEGORY AS CATEGORY,
      SUM(b.NET_LEADTIME) / 1440.0 / NULLIF(MAX(po.N), 0) AS DAYS
    FROM base b
    LEFT JOIN act_pos ap
      ON b.POSITION = 'WIP' AND ap.ACTIVITY = REGEXP_REPLACE(b.ACTIVITY, '^WIP AFTER ', '')
    CROSS JOIN po
    WHERE b.ACTIVITY_CATEGORY IN ('VA', 'NNVA', 'UNVA')
    GROUP BY b.POSITION, b.ACTIVITY, ATTACHED_STAGE, b.ACTIVITY_CATEGORY
  `, [...dateBinds, ...plantBinds(filters.plant)]);
}

// Lead time per stage (POSITION): actual vs standard → Overview Tactical view
// ACTUAL_DAYS = SUM(NET_LEADTIME) / COUNT(DISTINCT PO in period) / 1440 (same basis as the Pareto above).
// STD_DAYS    = SUM(ACTIVITY_LEADTIME_STD) on the same basis — the column is minutes per activity row.
export async function getLeadTimeStageVsStd(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  return executeQuery<{ STAGE: string; ACTUAL_DAYS: number; STD_DAYS: number }>(`
    WITH base AS (
      SELECT PROCESS_ORDER_FG, POSITION, NET_LEADTIME, ACTIVITY_LEADTIME_STD
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
      WHERE ${datePred}
        AND POSITION IS NOT NULL
        ${plantWhere(filters.plant)}
    ),
    po AS (SELECT COUNT(DISTINCT PROCESS_ORDER_FG) AS N FROM base)
    SELECT
      b.POSITION AS STAGE,
      SUM(b.NET_LEADTIME) / 1440.0 / NULLIF(MAX(po.N), 0) AS ACTUAL_DAYS,
      SUM(COALESCE(b.ACTIVITY_LEADTIME_STD, 0)) / 1440.0 / NULLIF(MAX(po.N), 0) AS STD_DAYS
    FROM base b
    CROSS JOIN po
    GROUP BY 1
  `, [...dateBinds, ...plantBinds(filters.plant)]);
}

// Lead time breakdown per plant → Overview Tactical table. Network row = GROUPING(PLANT) = 1.
// Per PO: gross (PO start → RECEIVE NDC stop) and nett (ACTUAL, LINE_CATEGORY NOT NULL) as in getLeadTimeKPI.
// ONTIME_PCT = share of POs with gross ≤ targetDays. Stage minutes are summed per plant × POSITION;
// divide by PO_COUNT for days per PO (same basis as getLeadTimeStageVsStd).
// basis = where gross starts (Overview Tactical toggle); stage minutes do not depend on it.
export async function getLeadTimeByPlant(filters: QueryFilters, targetDays: number, basis: "created" | "released" = "created") {
  const startSql = basis === "released" ? PO_RELEASED_AT_SQL : PO_CREATED_AT_SQL;
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  const binds = [...dateBinds, ...plantBinds(filters.plant)];
  const base = `
    SELECT PLANT, PROCESS_ORDER_FG, POSITION, ACTIVITY, ACTIVITY_TYPE, LINE_CATEGORY, ACTIVITY_START, ACTIVITY_STOP, NET_LEADTIME
    FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
    WHERE ${datePred}
      ${plantWhere(filters.plant)}`;

  const [plantRows, stageRows] = await Promise.all([
    executeQuery<{ IS_NETWORK: number; PLANT: string | null; PO_COUNT: number; GROSS_DAYS: number; NETT_DAYS: number; ONTIME_PCT: number | null }>(`
      WITH base AS (${base}),
      po AS (
        SELECT
          PLANT,
          PROCESS_ORDER_FG,
          DATEDIFF('minute',
            ${startSql},
            ${NDC_RECEIVED_AT_SQL}
          ) AS gross_minutes,
          SUM(CASE WHEN ACTIVITY_TYPE = 'ACTUAL' AND LINE_CATEGORY IS NOT NULL THEN NET_LEADTIME END) AS nett_minutes
        FROM base
        GROUP BY PLANT, PROCESS_ORDER_FG
      )
      SELECT
        GROUPING(PLANT) AS IS_NETWORK,
        PLANT,
        COUNT(*) AS PO_COUNT,
        AVG(gross_minutes) / 1440.0 AS GROSS_DAYS,
        AVG(nett_minutes) / 1440.0 AS NETT_DAYS,
        COUNT_IF(gross_minutes <= ? * 1440) * 100.0 / NULLIF(COUNT(gross_minutes), 0) AS ONTIME_PCT
      FROM po
      GROUP BY ROLLUP (PLANT)
    `, [...binds, targetDays]),
    executeQuery<{ PLANT: string; STAGE: string; MINUTES: number }>(`
      SELECT PLANT, POSITION AS STAGE, SUM(NET_LEADTIME) AS MINUTES
      FROM (${base}) b
      WHERE POSITION IS NOT NULL
      GROUP BY 1, 2
    `, binds),
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
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
      WHERE ${datePred}
        ${plantWhere(filters.plant)}
      GROUP BY PROCESS_ORDER_FG
      HAVING ${LEAD_TIME_START_SQL} IS NOT NULL
        AND ${NDC_RECEIVED_AT_SQL} IS NOT NULL
    ) sub
    WHERE PRODUCT_CODE IS NOT NULL
    GROUP BY PRODUCT_CODE
    HAVING COUNT(DISTINCT PROCESS_ORDER_FG) < 100
  `, [...dateBinds, ...plantBinds(filters.plant)]);
}

// Top 10 SKU by lead time → composition / range chart on /lead-time
// Per PO: gross lead time (PO start → RECEIVE NDC stop) + SUM(NET_LEADTIME) per ACTIVITY_CATEGORY.
// Per SKU (≥5 POs): AVG / P10 / P90 of gross days, AVG VA / NNVA / UNVA days. Top 10 by AVG gross.
export async function getLeadTimeTopSku(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  return executeQuery<{
    PRODUCT_CODE: string; PRODUCT_NAME: string; PO_COUNT: number;
    AVG_DAYS: number; P10_DAYS: number; P90_DAYS: number; VA: number; NNVA: number; UNVA: number;
  }>(`
    WITH po AS (
      SELECT
        PROCESS_ORDER_FG,
        MAX(PRODUCT_CODE) AS PRODUCT_CODE,
        MAX(PRODUCT_NAME) AS PRODUCT_NAME,
        DATEDIFF('minute',
          ${LEAD_TIME_START_SQL},
          ${NDC_RECEIVED_AT_SQL}
        ) / 1440.0 AS gross_days,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'VA'   THEN NET_LEADTIME ELSE 0 END) / 1440.0 AS va_days,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'NNVA' THEN NET_LEADTIME ELSE 0 END) / 1440.0 AS nnva_days,
        SUM(CASE WHEN ACTIVITY_CATEGORY = 'UNVA' THEN NET_LEADTIME ELSE 0 END) / 1440.0 AS unva_days
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
      WHERE ${datePred}
        ${plantWhere(filters.plant)}
      GROUP BY PROCESS_ORDER_FG
      HAVING ${LEAD_TIME_START_SQL} IS NOT NULL
        AND ${NDC_RECEIVED_AT_SQL} IS NOT NULL
    )
    SELECT
      PRODUCT_CODE,
      MAX(PRODUCT_NAME)                                          AS PRODUCT_NAME,
      COUNT(*)                                                   AS PO_COUNT,
      AVG(gross_days)                                            AS AVG_DAYS,
      PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY gross_days)    AS P10_DAYS,
      PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY gross_days)    AS P90_DAYS,
      AVG(va_days)                                               AS VA,
      AVG(nnva_days)                                             AS NNVA,
      AVG(unva_days)                                             AS UNVA
    FROM po
    WHERE PRODUCT_CODE IS NOT NULL
    GROUP BY PRODUCT_CODE
    HAVING COUNT(*) >= 5
    ORDER BY AVG_DAYS DESC
    LIMIT 10
  `, [...dateBinds, ...plantBinds(filters.plant)]);
}

export async function getLeadTimeByPosition(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  const plantFilter = plantWhere(filters.plant);

  const [nettRows, grossRows] = await Promise.all([
    executeQuery<{ POSITION: string; AVG_HOURS: number }>(`
      SELECT POSITION, AVG(pos_minutes) / 60.0 AS AVG_HOURS
      FROM (
        SELECT PROCESS_ORDER_FG, POSITION, SUM(NET_LEADTIME) AS pos_minutes
        FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
        WHERE ${datePred}
          AND ACTIVITY_TYPE = 'ACTUAL'
          ${plantFilter}
        GROUP BY PROCESS_ORDER_FG, POSITION
      ) sub
      GROUP BY POSITION
      ORDER BY AVG_HOURS DESC
      LIMIT 10
    `, [...dateBinds, ...plantBinds(filters.plant)]),
    executeQuery<{ POSITION: string; AVG_HOURS: number }>(`
      SELECT POSITION, AVG(pos_minutes) / 60.0 AS AVG_HOURS
      FROM (
        SELECT PROCESS_ORDER_FG, POSITION,
          DATEDIFF('minute', MIN(ACTIVITY_START), MAX(ACTIVITY_STOP)) AS pos_minutes
        FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
        WHERE ${datePred}
          ${plantFilter}
        GROUP BY PROCESS_ORDER_FG, POSITION
      ) sub
      GROUP BY POSITION
      ORDER BY AVG_HOURS DESC
      LIMIT 10
    `, [...dateBinds, ...plantBinds(filters.plant)]),
  ]);

  return { nett: nettRows, gross: grossRows };
}

export async function getLeadTimeTrend(filters: QueryFilters) {
  return executeQuery<{ WEEK: string; AVG_LEADTIME_DAYS: number; PLANT: string }>(`
    SELECT
      DATE_TRUNC('week', PO_FG_DONE_DATE::DATE) AS WEEK,
      PLANT,
      DATEDIFF('minute', MIN(PO_CREATED), MIN(PO_FG_DONE_DATE)) / 1440.0 AS AVG_LEADTIME_DAYS
    FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
    WHERE PO_FG_DONE_DATE::DATE BETWEEN ?::DATE AND ?::DATE
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
    FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
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

// Output (Bulk) → DATAMART_PRODUCTION_OUTPUT_OLAH.REALIZATION_QUANTITY filtered on CORRECTION_DATE
// Output (FG)   → DATAMART_PRODUCTION_OUTPUT_FG.QUANTITY filtered on CORRECTION_DATE
export async function getOutputKPI(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("CORRECTION_DATE", filters.period, filters.startDate, filters.endDate);
  const [bulkRows, fgRows] = await Promise.all([
    executeQuery<{ TOTAL_BULK: number }>(`
      SELECT SUM(REALIZATION_QUANTITY) AS TOTAL_BULK
      FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
      WHERE ${datePred}
    `, dateBinds),
    executeQuery<{ TOTAL_FG: number }>(`
      SELECT SUM(QUANTITY) AS TOTAL_FG
      FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_FG
      WHERE ${datePred}
    `, dateBinds),
  ]);

  return {
    acceptedBulkKg: bulkRows[0]?.TOTAL_BULK ?? 0,
    releasedFgPcs: fgRows[0]?.TOTAL_FG ?? 0,
  };
}

// E2E Productivity → CT_MANUF_E2E.E2E_PRODUCTIVITY averaged per period
export async function getE2EProductivity(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("KEMAS_COMPLETED_AT", filters.period, filters.startDate, filters.endDate);
  const rows = await executeQuery<{ AVG_E2E_PROD: number }>(`
    SELECT AVG(E2E_PRODUCTIVITY) AS AVG_E2E_PROD
    FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
    WHERE ${datePred}
    ${plantWhere(filters.plant)}
  `, [...dateBinds, ...plantBinds(filters.plant)]);
  return { avgE2EProd: Number((rows[0]?.AVG_E2E_PROD ?? 0).toFixed(1)) };
}

// Per-plant FG and E2E productivity — only to find which plant drives the Output / Productivity
// cards (AI one-liner causes, lib/kpiNarrative.ts). FG comes from CT_MANUF_TRENDS because the card's
// FG table has no PLANT column: use its shares, never its pcs, next to the card value.
// E2E keeps SUM + COUNT so per-plant contributions add up exactly to the card's AVG.
export async function getPlantDrivers(filters: QueryFilters) {
  const fgDate  = periodDateWhere("PO_FG_DONE_DATE",    filters.period, filters.startDate, filters.endDate);
  const e2eDate = periodDateWhere("KEMAS_COMPLETED_AT", filters.period, filters.startDate, filters.endDate);
  const [fgRows, e2eRows] = await Promise.all([
    executeQuery<{ PLANT: string; FG: number }>(`
      SELECT PLANT, SUM(RELEASE_FG) AS FG
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_TRENDS
      WHERE ${fgDate.sql}
      GROUP BY PLANT
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
// Mixing: CT_MANUF_OLAH, ACTIVITY = 'MIXING'. kg per manhour = Σ RELEASE_BULK / Σ MANHOUR.
//   RELEASE_BULK repeats on every row of an SFG → taken once per PROCESS_ORDER_SFG; MANHOUR is per operator row → summed.
// Filpac: CT_MANUF_KEMAS, ACTIVITY = 'FILPAC'. pcs per manhour = Σ QTY_FG_GOOD / Σ (LEADTIME_IN_MINUTE/60 × OPERATOR_COUNT).
//   KEMAS has one row per operator (same qty on each) → taken once per ACTIVITY_ID.
// grain = 'week' adds a WEEK column for the sparkline; otherwise one row for the period.
export type StageProductivity = "mixing" | "filpac";
export async function getStageProductivity(filters: QueryFilters, stage: StageProductivity, grain?: "week") {
  const dateCol = stage === "mixing" ? "OLAH_COMPLETED_AT" : "KEMAS_COMPLETED_AT";
  const { sql: datePred, binds: dateBinds } = periodDateWhere(dateCol, filters.period, filters.startDate, filters.endDate);
  const binds = [...dateBinds, ...plantBinds(filters.plant)];
  const week = grain === "week" ? "DATE_TRUNC('week', DONE_AT::DATE)" : "NULL";
  const unitSql = stage === "mixing"
    ? `SELECT PROCESS_ORDER_SFG, MAX(RELEASE_BULK) AS QTY, SUM(MANHOUR) AS MH, MAX(OLAH_COMPLETED_AT) AS DONE_AT
       FROM MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH
       WHERE ACTIVITY = 'MIXING' AND ${datePred} ${plantWhere(filters.plant)}
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
      DATE_TRUNC('week', KEMAS_COMPLETED_AT::DATE) AS WEEK,
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

// E2E Productivity weekly series → used for sparklines in dashboard cards
export async function getE2EWeekly(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("KEMAS_COMPLETED_AT", filters.period, filters.startDate, filters.endDate);
  return executeQuery<{ WEEK: string; AVG_PROD: number }>(`
    SELECT
      DATE_TRUNC('week', KEMAS_COMPLETED_AT::DATE) AS WEEK,
      AVG(E2E_PRODUCTIVITY) AS AVG_PROD
    FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
    WHERE ${datePred}
    ${plantWhere(filters.plant)}
    GROUP BY 1
    ORDER BY 1
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
        DATE_TRUNC('${unit}', PO_FG_DONE_DATE::DATE) AS WEEK,
        DATEDIFF('minute',
          ${LEAD_TIME_START_SQL},
          ${NDC_RECEIVED_AT_SQL}
        ) / 1440.0 AS DAYS
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
      WHERE ${datePred}
        ${plantWhere(filters.plant)}
      GROUP BY 1, PROCESS_ORDER_FG
      HAVING ${LEAD_TIME_START_SQL} IS NOT NULL
        AND ${NDC_RECEIVED_AT_SQL} IS NOT NULL
    )
    GROUP BY 1
    ORDER BY 1
  `, [...dateBinds, ...plantBinds(filters.plant)]);
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
    GROUP BY 1
    ORDER BY 1
  `, dateBinds);
}

// Output Bulk weekly series → sparkline for dashboard card (no PLANT col in this table)
export async function getBulkOutputWeekly(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("CORRECTION_DATE", filters.period, filters.startDate, filters.endDate);
  return executeQuery<{ WEEK: string; TOTAL_BULK: number }>(`
    SELECT
      DATE_TRUNC('week', CORRECTION_DATE::DATE) AS WEEK,
      SUM(REALIZATION_QUANTITY) AS TOTAL_BULK
    FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
    WHERE ${datePred}
    GROUP BY 1
    ORDER BY 1
  `, dateBinds);
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
      DATE_TRUNC('week', PO_FG_DONE_DATE::DATE) AS WEEK,
      COUNT(CASE WHEN ACTIVITY <> 'ADJUST' THEN 1 END) * 100.0
        / NULLIF(COUNT(*), 0) AS RFT_PCT
    FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
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
      DATE_TRUNC('week', PO_FG_DONE_DATE::DATE) AS WEEK,
      PLANT,
      AVG(LEADTIME_IN_DAY)  AS AVG_LEADTIME,
      SUM(RELEASE_BULK)     AS RELEASE_BULK,
      SUM(RELEASE_FG)       AS RELEASE_FG
    FROM MIGRATION.CONTROL_TOWER.CT_MANUF_TRENDS
    WHERE PO_FG_DONE_DATE::DATE BETWEEN ?::DATE AND ?::DATE
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
export async function getTrendKPIByPlant(
  filters: QueryFilters & { kpiType?: string; grain?: TrendGrain }
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
      return executeQuery<{ WEEK: string; PLANT: string; KPI_VALUE: number; N: number; LATE: number }>(`
        SELECT WEEK, IFF(GROUPING(PLANT) = 1, 'All plants', PLANT) AS PLANT, AVG(po_days) AS KPI_VALUE, COUNT(*) AS N, COUNT_IF(po_days > ?) AS LATE
        FROM (
          SELECT
            PROCESS_ORDER_FG,
            DATE_TRUNC('${unit}', PO_FG_DONE_DATE::DATE) AS WEEK,
            PLANT,
            DATEDIFF('minute',
              ${LEAD_TIME_START_SQL},
              ${NDC_RECEIVED_AT_SQL}
            ) / 1440.0 AS po_days
          FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
          WHERE PO_FG_DONE_DATE::DATE BETWEEN ${dateRange}
            ${pf}
          GROUP BY PROCESS_ORDER_FG, WEEK, PLANT
          HAVING ${LEAD_TIME_START_SQL} IS NOT NULL
            AND ${NDC_RECEIVED_AT_SQL} IS NOT NULL
        ) sub
        GROUP BY GROUPING SETS ((WEEK, PLANT), (WEEK))
        ORDER BY WEEK
      `, [LEAD_TIME_TARGET_DAYS, startDate, endDate, ...plantBinds(plant)]);

    case "upstream":
      // Tableau LOD: {FIXED [Process Order Sfg]: MAX(Release_Bulk)/((SUM(Leadtime)/60)/SUM(Operators))} → AVG per week per plant
      return executeQuery<{ WEEK: string; PLANT: string; KPI_VALUE: number }>(`
        WITH activity_lvl AS (
          SELECT
            PROCESS_ORDER_SFG,
            PLANT,
            DATE_TRUNC('${unit}', OLAH_COMPLETED_AT::DATE) AS WEEK,
            POSITION,
            ACTIVITY,
            ACTIVITY_ID,
            MAX(CASE WHEN RELEASE_BULK IS NOT NULL THEN RELEASE_BULK END)       AS release_bulk_sfg,
            MAX(CASE WHEN RELEASE_BULK IS NOT NULL THEN LEADTIME_IN_MINUTE END) AS leadtime_per_act,
            MAX(CASE WHEN RELEASE_BULK IS NOT NULL THEN OPERATOR_COUNT END)     AS operator_per_act
          FROM MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH
          WHERE OLAH_COMPLETED_AT::DATE BETWEEN ${dateRange}
            ${pf}
          GROUP BY PROCESS_ORDER_SFG, PLANT, WEEK, POSITION, ACTIVITY, ACTIVITY_ID
        ),
        position_lvl AS (
          SELECT
            PROCESS_ORDER_SFG, PLANT, WEEK,
            MAX(release_bulk_sfg)      AS release_bulk_sfg,
            SUM(leadtime_per_act)      AS leadtime_sum,
            SUM(operator_per_act)      AS operator_per_position
          FROM activity_lvl
          GROUP BY PROCESS_ORDER_SFG, PLANT, WEEK, POSITION
        ),
        sfg_lvl AS (
          SELECT
            PROCESS_ORDER_SFG, PLANT, WEEK,
            MAX(release_bulk_sfg)      AS max_release_bulk,
            SUM(leadtime_sum)          AS total_leadtime_min,
            SUM(operator_per_position) AS total_operators
          FROM position_lvl
          GROUP BY PROCESS_ORDER_SFG, PLANT, WEEK
        )
        SELECT
          WEEK, PLANT,
          AVG(
            CASE WHEN total_leadtime_min > 0 AND total_operators > 0
            THEN max_release_bulk / (total_leadtime_min / 60.0) / total_operators
            END
          ) AS KPI_VALUE
        FROM sfg_lvl
        WHERE max_release_bulk > 0
        GROUP BY WEEK, PLANT
        ORDER BY WEEK
      `, [startDate, endDate, ...plantBinds(plant)]);

    case "downstream":
      // {FIXED [Process Order Fg]: SUM(QTY_FG_GOOD)/SUM(LT_HOURS)/MAX(OPERATORS)} → AVG per week
      return executeQuery<{ WEEK: string; PLANT: string; KPI_VALUE: number }>(`
        SELECT WEEK, PLANT, AVG(po_prod) AS KPI_VALUE
        FROM (
          SELECT
            PROCESS_ORDER_FG,
            DATE_TRUNC('${unit}', KEMAS_COMPLETED_AT::DATE) AS WEEK,
            PLANT,
            SUM(QTY_FG_GOOD)
              / NULLIF(SUM(LEADTIME_IN_MINUTE) / 60.0, 0)
              / NULLIF(MAX(OPERATOR_COUNT), 0) AS po_prod
          FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
          WHERE KEMAS_COMPLETED_AT::DATE BETWEEN ${dateRange}
            AND LEADTIME_IN_MINUTE > 0
            AND OPERATOR_COUNT > 0
            ${pf}
          GROUP BY PROCESS_ORDER_FG, WEEK, PLANT
        ) sub
        GROUP BY WEEK, PLANT
        ORDER BY WEEK
      `, [startDate, endDate, ...plantBinds(plant)]);

    case "e2e":
      // {FIXED [Process Order Fg]: AVG([E2E Productivity])} → AVG per week per plant
      return executeQuery<{ WEEK: string; PLANT: string; KPI_VALUE: number }>(`
        SELECT WEEK, PLANT, AVG(po_prod) AS KPI_VALUE
        FROM (
          SELECT
            PROCESS_ORDER_FG,
            DATE_TRUNC('${unit}', KEMAS_COMPLETED_AT::DATE) AS WEEK,
            PLANT,
            AVG(E2E_PRODUCTIVITY) AS po_prod
          FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
          WHERE KEMAS_COMPLETED_AT::DATE BETWEEN ${dateRange}
            ${pf}
          GROUP BY PROCESS_ORDER_FG, WEEK, PLANT
        ) sub
        GROUP BY WEEK, PLANT
        ORDER BY WEEK
      `, [startDate, endDate, ...plantBinds(plant)]);

    case "output":
      // SUM({FIXED [Process Order Fg]: SUM([Release Fg])}) → SUM per week per plant
      return executeQuery<{ WEEK: string; PLANT: string; KPI_VALUE: number }>(`
        SELECT WEEK, IFF(GROUPING(PLANT) = 1, 'All plants', PLANT) AS PLANT, SUM(po_fg) AS KPI_VALUE
        FROM (
          SELECT
            PROCESS_ORDER_FG,
            DATE_TRUNC('${unit}', PO_FG_DONE_DATE::DATE) AS WEEK,
            PLANT,
            SUM(RELEASE_FG) AS po_fg
          FROM MIGRATION.CONTROL_TOWER.CT_MANUF_TRENDS
          WHERE PO_FG_DONE_DATE::DATE BETWEEN ${dateRange}
            ${pf}
          GROUP BY PROCESS_ORDER_FG, WEEK, PLANT
        ) sub
        GROUP BY GROUPING SETS ((WEEK, PLANT), (WEEK))
        ORDER BY WEEK
      `, [startDate, endDate, ...plantBinds(plant)]);

    case "oee":
      return executeQuery<{ WEEK: string; PLANT: string; KPI_VALUE: number }>(`
        SELECT DATE_TRUNC('${unit}', KEMAS_COMPLETED_AT::DATE) AS WEEK, IFF(GROUPING(PLANT) = 1, 'All plants', PLANT) AS PLANT,
          AVG(
            (CASE WHEN QTY_TOTAL > 0 THEN QTY_FG_GOOD::FLOAT / QTY_TOTAL ELSE 0 END) *
            (CASE WHEN ACTIVITY_PRODUCTIVITY_STD > 0
              THEN LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0) ELSE 0 END)
          ) * 100 AS KPI_VALUE
        FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
        WHERE KEMAS_COMPLETED_AT::DATE BETWEEN ${dateRange}
          ${pf}
        GROUP BY GROUPING SETS ((WEEK, PLANT), (WEEK))
        ORDER BY WEEK
      `, [startDate, endDate, ...plantBinds(plant)]);

    case "rft":
      // N + LATE (here: activities without ADJUST) feed the Laney P′ chart, same as lead time
      return executeQuery<{ WEEK: string; PLANT: string; KPI_VALUE: number; N: number; LATE: number }>(`
        SELECT DATE_TRUNC('${unit}', PO_FG_DONE_DATE::DATE) AS WEEK, IFF(GROUPING(PLANT) = 1, 'All plants', PLANT) AS PLANT,
          COUNT(CASE WHEN ACTIVITY <> 'ADJUST' THEN 1 END) * 100.0
            / NULLIF(COUNT(*), 0) AS KPI_VALUE,
          COUNT(*) AS N,
          COUNT(CASE WHEN ACTIVITY <> 'ADJUST' THEN 1 END) AS LATE
        FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
        WHERE PO_FG_DONE_DATE::DATE BETWEEN ${dateRange}
          ${pf}
        GROUP BY GROUPING SETS ((WEEK, PLANT), (WEEK))
        ORDER BY WEEK
      `, [startDate, endDate, ...plantBinds(plant)]);

    case "productivity":
      // E2E productivity — same source and rule as the Overview card (getE2EProductivity): AVG(E2E_PRODUCTIVITY)
      return executeQuery<{ WEEK: string; PLANT: string; KPI_VALUE: number }>(`
        SELECT DATE_TRUNC('${unit}', KEMAS_COMPLETED_AT::DATE) AS WEEK, IFF(GROUPING(PLANT) = 1, 'All plants', PLANT) AS PLANT,
          AVG(E2E_PRODUCTIVITY) AS KPI_VALUE
        FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
        WHERE KEMAS_COMPLETED_AT::DATE BETWEEN ${dateRange}
          ${pf}
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
    FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
  `);
  return rows[0]?.LAST_ETL ?? null;
}

// Tactical Overview donut (Lead Time tab): avg days per ACTIVITY across completed POs in the period.
export async function getLeadTimeGroupProcess(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  return executeQuery<{ ACTIVITY: string; AVG_DAYS: number; PO_COUNT: number }>(`
    SELECT ACTIVITY, AVG(net_lt) AS AVG_DAYS, COUNT(*) AS PO_COUNT
    FROM (
      SELECT PROCESS_ORDER_FG, ACTIVITY,
             SUM(NET_LEADTIME) / 1440.0 AS net_lt
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
      WHERE ACTIVITY_TYPE = 'ACTUAL'
        AND PO_FG_DONE_DATE IS NOT NULL
        AND ACTIVITY <> 'ADJUST'
        AND ${datePred}
        ${plantWhere(filters.plant)}
      GROUP BY PROCESS_ORDER_FG, ACTIVITY
    ) sub
    GROUP BY ACTIVITY
    ORDER BY AVG_DAYS DESC
  `, [...dateBinds, ...plantBinds(filters.plant)]);
}

// Tactical Overview histogram (Lead Time tab): 2-day bins up to >38d, with mean/median/stddev/total.
export async function getLeadTimeDistributionBins(filters: QueryFilters) {
  const { sql: datePred, binds: dateBinds } = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  return executeQuery<{ BIN_START: number; CNT: number; MEAN_DAYS: number; MEDIAN_DAYS: number; STDDEV_DAYS: number; TOTAL_POS: number }>(`
    WITH per_po AS (
      SELECT PROCESS_ORDER_FG,
        DATEDIFF('minute',
          MIN(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_STOP END),
          MAX(CASE WHEN ACTIVITY_SEQUENCE = 45 THEN ACTIVITY_STOP END)
        ) / 1440.0 AS gross_lt_days
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
      WHERE PO_FG_DONE_DATE IS NOT NULL
        AND ACTIVITY_TYPE = 'ACTUAL'
        AND ${datePred}
        ${plantWhere(filters.plant)}
      GROUP BY PROCESS_ORDER_FG
      HAVING MIN(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_STOP END) IS NOT NULL
        AND  MAX(CASE WHEN ACTIVITY_SEQUENCE = 45 THEN ACTIVITY_STOP END) IS NOT NULL
        AND  DATEDIFF('minute',
               MIN(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_STOP END),
               MAX(CASE WHEN ACTIVITY_SEQUENCE = 45 THEN ACTIVITY_STOP END)
             ) >= 0
    ),
    stats AS (
      SELECT AVG(gross_lt_days)    AS mean_days,
             MEDIAN(gross_lt_days) AS median_days,
             STDDEV(gross_lt_days) AS stddev_days,
             COUNT(*)              AS total_pos
      FROM per_po
    ),
    bins AS (
      SELECT FLOOR(LEAST(gross_lt_days, 38) / 2) * 2 AS bin_start, COUNT(*) AS cnt
      FROM per_po
      GROUP BY FLOOR(LEAST(gross_lt_days, 38) / 2) * 2
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
  `, [...dateBinds, ...plantBinds(filters.plant)]);
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
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
      WHERE PO_FG_DONE_DATE IS NOT NULL
        AND ACTIVITY_TYPE = 'ACTUAL'
        AND ${datePred}
        ${plantWhere(filters.plant)}
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
  `, [...dateBinds, ...plantBinds(filters.plant)]);
  return rows[0] ?? { MAX_GROSS_DAYS: null, AVG_PO_STAGE_DAYS: null, PO_COUNT: 0, ON_TIME_COUNT: 0, AT_RISK_COUNT: 0, LATE_COUNT: 0 };
}
