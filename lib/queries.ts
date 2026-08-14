import { executeQuery } from "./snowflake";

interface QueryFilters {
  plant?: string;
  startDate?: string;
  endDate?: string;
  period?: string;       // "YTD" | "30D" | "90D" | "6M" | "Today" | "This Week" | "Last Week" | "This Month" | "Last Month" | "Custom"
  leadTimeType?: string; // "Gross Time" | "Nett Time"
  timeUnit?: string;     // "Daily" | "Hourly"
}

const plantWhere = (plant?: string, col = "PLANT") =>
  plant && plant !== "All Plant" ? `AND ${col} = '${plant}'` : "";

// Translates the Tableau Period calc filter to a Snowflake SQL WHERE predicate.
// Uses CURRENT_DATE() server-side to avoid JS timezone drift.
function periodDateWhere(col: string, period?: string, start?: string, end?: string): string {
  switch (period) {
    case "Today":
      return `${col}::DATE = CURRENT_DATE()`;
    case "This Week":
      return `DATEADD('day', 1-DAYOFWEEKISO(${col}::DATE), ${col}::DATE) = DATEADD('day', 1-DAYOFWEEKISO(CURRENT_DATE()), CURRENT_DATE())`;
    case "Last Week":
      return `DATEADD('day', 1-DAYOFWEEKISO(${col}::DATE), ${col}::DATE) = DATEADD('day', 1-DAYOFWEEKISO(DATEADD('week',-1,CURRENT_DATE())), DATEADD('week',-1,CURRENT_DATE()))`;
    case "This Month":
      return `DATE_TRUNC('month', ${col}::DATE) = DATE_TRUNC('month', CURRENT_DATE())`;
    case "Last Month":
      return `DATE_TRUNC('month', ${col}::DATE) = DATE_TRUNC('month', DATEADD('month',-1,CURRENT_DATE()))`;
    case "YTD":
      return `${col}::DATE BETWEEN DATE_TRUNC('year', CURRENT_DATE()) AND CURRENT_DATE()`;
    case "30D":
      return `${col}::DATE BETWEEN DATEADD('day',-30,CURRENT_DATE()) AND CURRENT_DATE()`;
    case "90D":
      return `${col}::DATE BETWEEN DATEADD('day',-90,CURRENT_DATE()) AND CURRENT_DATE()`;
    case "6M":
      return `${col}::DATE BETWEEN DATEADD('month',-6,CURRENT_DATE()) AND CURRENT_DATE()`;
    default:
      return `${col}::DATE BETWEEN '${start}' AND '${end}'`;
  }
}

// Lead Time → CT_MANUF_LEADTIME
// Gross: DATEDIFF from 'PO' activity start to 'RECEIVE NDC' activity stop per PO
// Nett:  SUM(NET_LEADTIME) for ACTUAL rows where LINE_CATEGORY IS NOT NULL per PO
export async function getLeadTimeKPI(filters: QueryFilters) {
  const datePred = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
  const plantFilter = plantWhere(filters.plant);

  const [grossRows, nettRows] = await Promise.all([
    executeQuery<{ AVG_GROSS: number }>(`
      SELECT AVG(gross_minutes) / 1440.0 AS AVG_GROSS
      FROM (
        SELECT
          PROCESS_ORDER_FG,
          DATEDIFF('minute',
            MIN(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_START END),
            MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' THEN ACTIVITY_STOP END)
          ) AS gross_minutes
        FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
        WHERE ${datePred}
          ${plantFilter}
        GROUP BY PROCESS_ORDER_FG
        HAVING MIN(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_START END) IS NOT NULL
          AND MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' THEN ACTIVITY_STOP END) IS NOT NULL
      ) sub
    `),
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
    `),
  ]);

  return {
    AVG_LEADTIME: grossRows[0]?.AVG_GROSS ?? 0,
    AVG_GROSS_LEADTIME: grossRows[0]?.AVG_GROSS ?? 0,
    AVG_NETT_LEADTIME: nettRows[0]?.AVG_NETT ?? 0,
  };
}

export async function getLeadTimeByPosition(filters: QueryFilters) {
  const datePred = periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate);
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
    `),
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
    `),
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
    WHERE PO_FG_DONE_DATE::DATE BETWEEN '${filters.startDate}' AND '${filters.endDate}'
      AND LINE_CATEGORY IS NOT NULL
    ${plantWhere(filters.plant)}
    GROUP BY WEEK, PLANT, PROCESS_ORDER_FG
    ORDER BY 1
  `);
}

// Right First Time → CT_MANUF_LEADTIME: non-ADJUST activities / total activities
// Matches Tableau: SUM(IF ACTIVITY <> "ADJUST" THEN 1 ELSE 0 END) / COUNT(ACTIVITY)
export async function getRightFirstTime(filters: QueryFilters) {
  const rows = await executeQuery<{ RFT_PCT: number }>(`
    SELECT
      COUNT(CASE WHEN ACTIVITY <> 'ADJUST' THEN 1 END) * 100.0
        / NULLIF(COUNT(ACTIVITY), 0) AS RFT_PCT
    FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
    WHERE ${periodDateWhere("PO_FG_DONE_DATE", filters.period, filters.startDate, filters.endDate)}
    ${plantWhere(filters.plant)}
  `);
  return { rftPct: Number((rows[0]?.RFT_PCT ?? 0).toFixed(1)) };
}

// Yield (Pack Loss) → CT_MANUF_KEMAS: QTY_FG_RETUR / QTY_TOTAL
// Yield (Bulk Loss) → DATAMART_PRODUCTION_OUTPUT_OLAH: (THEORETICAL - REALIZATION) / THEORETICAL
export async function getYieldKPI(filters: QueryFilters) {
  const [packRows, bulkRows] = await Promise.all([
    executeQuery<{ TOTAL_GOOD: number; TOTAL_RETUR: number; TOTAL_QTY: number }>(`
      SELECT
        SUM(QTY_FG_GOOD)  AS TOTAL_GOOD,
        SUM(QTY_FG_RETUR) AS TOTAL_RETUR,
        SUM(QTY_TOTAL)    AS TOTAL_QTY
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
      WHERE ${periodDateWhere("KEMAS_COMPLETED_AT", filters.period, filters.startDate, filters.endDate)}
      ${plantWhere(filters.plant)}
    `),
    executeQuery<{ TOTAL_REALIZATION: number; TOTAL_THEORETICAL: number }>(`
      SELECT
        SUM(REALIZATION_QUANTITY) AS TOTAL_REALIZATION,
        SUM(THEORETICAL_QUANTITY) AS TOTAL_THEORETICAL
      FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
      WHERE ${periodDateWhere("CORRECTION_DATE", filters.period, filters.startDate, filters.endDate)}
    `),
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
  const [bulkRows, fgRows] = await Promise.all([
    executeQuery<{ TOTAL_BULK: number }>(`
      SELECT SUM(REALIZATION_QUANTITY) AS TOTAL_BULK
      FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
      WHERE ${periodDateWhere("CORRECTION_DATE", filters.period, filters.startDate, filters.endDate)}
    `),
    executeQuery<{ TOTAL_FG: number }>(`
      SELECT SUM(QUANTITY) AS TOTAL_FG
      FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_FG
      WHERE ${periodDateWhere("CORRECTION_DATE", filters.period, filters.startDate, filters.endDate)}
    `),
  ]);

  return {
    acceptedBulkKg: bulkRows[0]?.TOTAL_BULK ?? 0,
    releasedFgPcs: fgRows[0]?.TOTAL_FG ?? 0,
  };
}

// E2E Productivity → CT_MANUF_E2E.E2E_PRODUCTIVITY averaged per period
export async function getE2EProductivity(filters: QueryFilters) {
  const rows = await executeQuery<{ AVG_E2E_PROD: number }>(`
    SELECT AVG(E2E_PRODUCTIVITY) AS AVG_E2E_PROD
    FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
    WHERE ${periodDateWhere("KEMAS_COMPLETED_AT", filters.period, filters.startDate, filters.endDate)}
    ${plantWhere(filters.plant)}
  `);
  return { avgE2EProd: Number((rows[0]?.AVG_E2E_PROD ?? 0).toFixed(1)) };
}

// Upstream Productivity → CT_MANUF_OLAH
// Tableau LOD: {FIXED [Process Order Sfg]: MAX(Release_Bulk_per_SFG) / (SUM(Leadtime_per_ActivityID)/60) / SUM(Operator_per_Position)}
export async function getUpstreamProductivity(filters: QueryFilters) {
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
      WHERE ${periodDateWhere("OLAH_COMPLETED_AT", filters.period, filters.startDate, filters.endDate)}
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
  `);
  return { avgUpstreamProd: Number((rows[0]?.AVG_UPSTREAM_PROD ?? 0).toFixed(1)) };
}

// Downstream Productivity → CT_MANUF_KEMAS: QTY_FG_GOOD / (LEADTIME_IN_MINUTE/60) / OPERATOR_COUNT
// Matches Tableau LOD: {FIXED [PROCESS_ORDER_FG]: SUM/SUM/MAX}
export async function getDownstreamProductivity(filters: QueryFilters) {
  const rows = await executeQuery<{ AVG_DOWNSTREAM_PROD: number }>(`
    SELECT AVG(PO_PROD) AS AVG_DOWNSTREAM_PROD
    FROM (
      SELECT
        PROCESS_ORDER_FG,
        SUM(QTY_FG_GOOD)
          / NULLIF(SUM(LEADTIME_IN_MINUTE) / 60.0, 0)
          / NULLIF(MAX(OPERATOR_COUNT), 0) AS PO_PROD
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
      WHERE ${periodDateWhere("KEMAS_COMPLETED_AT", filters.period, filters.startDate, filters.endDate)}
        AND LEADTIME_IN_MINUTE > 0 AND OPERATOR_COUNT > 0
      ${plantWhere(filters.plant)}
      GROUP BY PROCESS_ORDER_FG
    ) sub
  `);
  return { avgDownstreamProd: Number((rows[0]?.AVG_DOWNSTREAM_PROD ?? 0).toFixed(1)) };
}

// OEE → CT_MANUF_KEMAS: Quality × Performance per plant + component breakdown
export async function getOEEByPlant(filters: QueryFilters) {
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
    WHERE ${periodDateWhere("KEMAS_COMPLETED_AT", filters.period, filters.startDate, filters.endDate)}
    ${plantWhere(filters.plant)}
    GROUP BY PLANT
  `);
}

// Productivity details → CT_MANUF_KEMAS: total manhours and avg operator count
export async function getProductivityDetails(filters: QueryFilters) {
  const rows = await executeQuery<{ TOTAL_MANHOURS: number; AVG_OPERATORS: number }>(`
    SELECT
      ROUND(SUM(LEADTIME_IN_MINUTE / 60.0 * OPERATOR_COUNT)) AS TOTAL_MANHOURS,
      ROUND(AVG(OPERATOR_COUNT))                              AS AVG_OPERATORS
    FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
    WHERE ${periodDateWhere("KEMAS_COMPLETED_AT", filters.period, filters.startDate, filters.endDate)}
      AND LEADTIME_IN_MINUTE > 0 AND OPERATOR_COUNT > 0
    ${plantWhere(filters.plant)}
  `);
  return {
    totalManhours: Math.round(rows[0]?.TOTAL_MANHOURS ?? 0),
    avgOperators:  Math.round(rows[0]?.AVG_OPERATORS  ?? 0),
  };
}

// OEE weekly series → used for sparklines in dashboard cards
export async function getOEEWeekly(filters: QueryFilters) {
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
    WHERE ${periodDateWhere("KEMAS_COMPLETED_AT", filters.period, filters.startDate, filters.endDate)}
    ${plantWhere(filters.plant)}
    GROUP BY 1
    ORDER BY 1
  `);
}

// E2E Productivity weekly series → used for sparklines in dashboard cards
export async function getE2EWeekly(filters: QueryFilters) {
  return executeQuery<{ WEEK: string; AVG_PROD: number }>(`
    SELECT
      DATE_TRUNC('week', KEMAS_COMPLETED_AT::DATE) AS WEEK,
      AVG(E2E_PRODUCTIVITY) AS AVG_PROD
    FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
    WHERE ${periodDateWhere("KEMAS_COMPLETED_AT", filters.period, filters.startDate, filters.endDate)}
    ${plantWhere(filters.plant)}
    GROUP BY 1
    ORDER BY 1
  `);
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
    WHERE PO_FG_DONE_DATE::DATE BETWEEN '${filters.startDate}' AND '${filters.endDate}'
    ${plantWhere(filters.plant)}
    GROUP BY 1, 2
    ORDER BY 1
  `);
}

// SPC Trend Chart — per-plant weekly KPI matching Tableau LOD expressions:
//   Lead Time:   AVG({FIXED [Process Order Fg]: AVG([Leadtime In Day])})
//   Upstream:    AVG({FIXED [Process Order Fg]: avg([Upstream Productivity])})
//   Downstream:  AVG({FIXED [Process Order Fg]: avg([Downstream Productivity])})
//   E2E:         AVG({FIXED [Process Order Fg]: avg([E2E Productivity])})
//   Output:      SUM({FIXED [Process Order Fg]: sum([Release Fg])})
//   Batch:       SUM({FIXED [Process Order Fg]: MAX([Release Bulk])})
export async function getTrendKPIByPlant(
  filters: QueryFilters & { kpiType?: string }
) {
  const { startDate, endDate, plant, kpiType = "leadtime" } = filters;
  const dateRange = `'${startDate}' AND '${endDate}'`;
  const pf = plantWhere(plant);

  switch (kpiType) {
    case "leadtime":
      // {FIXED [Process Order Fg]: AVG([Leadtime In Day])} — gross lead time
      // Same DATEDIFF logic as getLeadTimeKPI: ACTIVITY='PO' start → ACTIVITY='RECEIVE NDC' stop
      return executeQuery<{ WEEK: string; PLANT: string; KPI_VALUE: number }>(`
        SELECT WEEK, PLANT, AVG(po_days) AS KPI_VALUE
        FROM (
          SELECT
            PROCESS_ORDER_FG,
            DATE_TRUNC('week', PO_FG_DONE_DATE::DATE) AS WEEK,
            PLANT,
            DATEDIFF('minute',
              MIN(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_START END),
              MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' THEN ACTIVITY_STOP END)
            ) / 1440.0 AS po_days
          FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
          WHERE PO_FG_DONE_DATE::DATE BETWEEN ${dateRange}
            ${pf}
          GROUP BY PROCESS_ORDER_FG, WEEK, PLANT
          HAVING MIN(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_START END) IS NOT NULL
            AND MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' THEN ACTIVITY_STOP END) IS NOT NULL
        ) sub
        GROUP BY WEEK, PLANT
        ORDER BY WEEK
      `);

    case "upstream":
      // Tableau LOD: {FIXED [Process Order Sfg]: MAX(Release_Bulk)/((SUM(Leadtime)/60)/SUM(Operators))} → AVG per week per plant
      return executeQuery<{ WEEK: string; PLANT: string; KPI_VALUE: number }>(`
        WITH activity_lvl AS (
          SELECT
            PROCESS_ORDER_SFG,
            PLANT,
            DATE_TRUNC('week', OLAH_COMPLETED_AT::DATE) AS WEEK,
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
      `);

    case "downstream":
      // {FIXED [Process Order Fg]: SUM(QTY_FG_GOOD)/SUM(LT_HOURS)/MAX(OPERATORS)} → AVG per week
      return executeQuery<{ WEEK: string; PLANT: string; KPI_VALUE: number }>(`
        SELECT WEEK, PLANT, AVG(po_prod) AS KPI_VALUE
        FROM (
          SELECT
            PROCESS_ORDER_FG,
            DATE_TRUNC('week', KEMAS_COMPLETED_AT::DATE) AS WEEK,
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
      `);

    case "e2e":
      // {FIXED [Process Order Fg]: AVG([E2E Productivity])} → AVG per week per plant
      return executeQuery<{ WEEK: string; PLANT: string; KPI_VALUE: number }>(`
        SELECT WEEK, PLANT, AVG(po_prod) AS KPI_VALUE
        FROM (
          SELECT
            PROCESS_ORDER_FG,
            DATE_TRUNC('week', KEMAS_COMPLETED_AT::DATE) AS WEEK,
            PLANT,
            AVG(E2E_PRODUCTIVITY) AS po_prod
          FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
          WHERE KEMAS_COMPLETED_AT::DATE BETWEEN ${dateRange}
            ${pf}
          GROUP BY PROCESS_ORDER_FG, WEEK, PLANT
        ) sub
        GROUP BY WEEK, PLANT
        ORDER BY WEEK
      `);

    case "output":
      // SUM({FIXED [Process Order Fg]: SUM([Release Fg])}) → SUM per week per plant
      return executeQuery<{ WEEK: string; PLANT: string; KPI_VALUE: number }>(`
        SELECT WEEK, PLANT, SUM(po_fg) AS KPI_VALUE
        FROM (
          SELECT
            PROCESS_ORDER_FG,
            DATE_TRUNC('week', PO_FG_DONE_DATE::DATE) AS WEEK,
            PLANT,
            SUM(RELEASE_FG) AS po_fg
          FROM MIGRATION.CONTROL_TOWER.CT_MANUF_TRENDS
          WHERE PO_FG_DONE_DATE::DATE BETWEEN ${dateRange}
            ${pf}
          GROUP BY PROCESS_ORDER_FG, WEEK, PLANT
        ) sub
        GROUP BY WEEK, PLANT
        ORDER BY WEEK
      `);

    case "batch":
      // SUM({FIXED [NOMO]: MAX([BESAR_BATCH])}) → SUM per week per plant
      return executeQuery<{ WEEK: string; PLANT: string; KPI_VALUE: number }>(`
        SELECT WEEK, PLANT, SUM(nomo_batch) AS KPI_VALUE
        FROM (
          SELECT
            NOMO,
            DATE_TRUNC('week', OLAH_COMPLETED_AT::DATE) AS WEEK,
            PLANT,
            MAX(BESAR_BATCH) AS nomo_batch
          FROM MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH
          WHERE OLAH_COMPLETED_AT::DATE BETWEEN ${dateRange}
            ${pf}
          GROUP BY NOMO, WEEK, PLANT
        ) sub
        GROUP BY WEEK, PLANT
        ORDER BY WEEK
      `);

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
