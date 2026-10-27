-- ============================================================
-- MANUFACTURING CONTROL TOWER
-- FACT CHECK / QUERY REFERENCE
-- ============================================================
--
-- Purpose:
--   Collection of SQL queries for independently validating
--   dashboard numbers against Snowflake source data.
--
-- Source of truth:
--   lib/queries.ts        — actual query implementation
--   app/api/dashboard/kpi/route.ts — aggregation & trend logic
--   lib/alerts.ts         — alert threshold logic
--   docs/BUSINESS_LOGIC.md, docs/DATA_MODEL.md
--
-- IMPORTANT:
--   These queries replicate dashboard logic as-is.
--   Do not change formulas without first verifying the change
--   in lib/queries.ts and the API route.
--
-- Last verified against: lib/queries.ts (2026-09-16)
-- ============================================================


-- ============================================================
-- HOW TO USE
-- ============================================================
--
-- 1. Run the SET block below first (select all → Run).
-- 2. Copy any query to a new worksheet and run.
-- 3. Compare the result with the dashboard number.
--
-- If result differs from dashboard:
--   a. Check Section 16 (Reconciliation) for common causes.
--   b. Dashboard caches KPI data for 1 hour — verify cache.
--   c. Check whether the filter period matches exactly.
--
-- ============================================================
-- SET VARIABLES — edit these before running any query
-- ============================================================

-- Set your period range. Examples:
--   YTD:    SET START_DATE = DATE_TRUNC('year', CURRENT_DATE());  SET END_DATE = CURRENT_DATE();
--   30D:    SET START_DATE = DATEADD('day', -30, CURRENT_DATE()); SET END_DATE = CURRENT_DATE();
--   Today:  SET START_DATE = CURRENT_DATE(); SET END_DATE = CURRENT_DATE();

SET START_DATE = DATEADD('day', -30, CURRENT_DATE());
SET END_DATE   = CURRENT_DATE();

-- Set plant. Use NULL to include all plants (same as "All Plant" in dashboard).
SET PLANT = NULL;   -- or: SET PLANT = 'PLANT-A';


-- ============================================================
-- KNOWN LIMITATIONS (read before comparing with dashboard)
-- ============================================================
--
-- 1. OEE in dashboard = UNWEIGHTED AVERAGE of per-plant OEEs.
--    A plant with 1 record and a plant with 1,000 records are
--    weighted equally. See Section 4 for the correct replication.
--
-- 2. OPE = OEE × 0.8 — calculated in frontend, NO Snowflake query.
--    Fact check: take OEE result × 0.8.
--
-- 3. Availability = OEE / (Performance × Quality) × 100
--    Calculated in frontend. No dedicated Snowflake query.
--
-- 4. Bulk Loss and FG/Bulk Output: DATAMART_PRODUCTION_OUTPUT_OLAH
--    and DATAMART_PRODUCTION_OUTPUT_FG have NO PLANT column.
--    Dashboard cannot filter these by plant. Queries here follow
--    the same behavior — no plant filter applied.
--
-- 5. Trend % = same-duration rolling comparison.
--    Previous period ends the day before current period starts.
--    If current = Aug 17 – Sep 16 (30 days),
--    then previous = Jul 17 – Aug 16 (30 days).
--    This is NOT calendar Month-over-Month.
--    See Section 15 for the comparison query.
--
-- 6. Lead Time page uses STATIC MOCK DATA.
--    Queries in this file validate the Strategic dashboard only.
--    The Lead Time page (/lead-time) is not connected to Snowflake.
--
-- 7. KPI data is cached for 1 hour on the server.
--    If your Snowflake query returns a different number, the
--    dashboard may be showing stale cached data.
--
-- 8. Azure AD plant-level access control is NOT implemented.
--    All authenticated users can query any plant.


-- ============================================================
-- 1. QUICK REFERENCE
-- ============================================================
--
-- Table → KPI → Date column mapping (from docs/DATA_MODEL.md)
--
-- Table                                    KPI(s)                      Date column
-- -------                                  ------                      -----------
-- MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME  Lead Time, RFT           PO_FG_DONE_DATE
-- MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS     Pack Loss, OEE, Downstream Productivity, Manhours  KEMAS_COMPLETED_AT
-- MIGRATION.CONTROL_TOWER.CT_MANUF_E2E       E2E Productivity         KEMAS_COMPLETED_AT
-- MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH      Upstream Productivity    OLAH_COMPLETED_AT
-- DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH  Bulk Loss, Bulk Output  CORRECTION_DATE
-- DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_FG    FG Output              CORRECTION_DATE


-- ============================================================
-- 2. SOURCE DATA CHECKS
-- ============================================================
--
-- Run these first to verify data exists in the period you selected.
-- If a table returns 0 rows, the dashboard KPI will show 0 or null.

-- [CHECK] Row counts per table for the selected period
SELECT 'CT_MANUF_LEADTIME'                    AS tbl, COUNT(*) AS rows, MIN(PO_FG_DONE_DATE)      AS earliest, MAX(PO_FG_DONE_DATE)      AS latest FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME                    WHERE PO_FG_DONE_DATE::DATE      BETWEEN $START_DATE AND $END_DATE
UNION ALL
SELECT 'CT_MANUF_KEMAS',                               COUNT(*),        MIN(KEMAS_COMPLETED_AT),             MAX(KEMAS_COMPLETED_AT)             FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS                    WHERE KEMAS_COMPLETED_AT::DATE   BETWEEN $START_DATE AND $END_DATE
UNION ALL
SELECT 'CT_MANUF_E2E',                                 COUNT(*),        MIN(KEMAS_COMPLETED_AT),             MAX(KEMAS_COMPLETED_AT)             FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E                      WHERE KEMAS_COMPLETED_AT::DATE   BETWEEN $START_DATE AND $END_DATE
UNION ALL
SELECT 'CT_MANUF_OLAH',                                COUNT(*),        MIN(OLAH_COMPLETED_AT),              MAX(OLAH_COMPLETED_AT)              FROM MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH                     WHERE OLAH_COMPLETED_AT::DATE    BETWEEN $START_DATE AND $END_DATE
UNION ALL
SELECT 'OUTPUT_OLAH (no PLANT col)',                   COUNT(*),        MIN(CORRECTION_DATE),                MAX(CORRECTION_DATE)                FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH      WHERE CORRECTION_DATE::DATE      BETWEEN $START_DATE AND $END_DATE
UNION ALL
SELECT 'OUTPUT_FG (no PLANT col)',                     COUNT(*),        MIN(CORRECTION_DATE),                MAX(CORRECTION_DATE)                FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_FG        WHERE CORRECTION_DATE::DATE      BETWEEN $START_DATE AND $END_DATE;


-- [CHECK] Plants available in each table
SELECT 'CT_MANUF_LEADTIME' AS tbl, PLANT, COUNT(*) AS rows
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
WHERE PO_FG_DONE_DATE::DATE BETWEEN $START_DATE AND $END_DATE
GROUP BY PLANT ORDER BY tbl, PLANT;

SELECT 'CT_MANUF_KEMAS' AS tbl, PLANT, COUNT(*) AS rows
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
WHERE KEMAS_COMPLETED_AT::DATE BETWEEN $START_DATE AND $END_DATE
GROUP BY PLANT ORDER BY tbl, PLANT;

SELECT 'CT_MANUF_OLAH' AS tbl, PLANT, COUNT(*) AS rows
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH
WHERE OLAH_COMPLETED_AT::DATE BETWEEN $START_DATE AND $END_DATE
GROUP BY PLANT ORDER BY tbl, PLANT;


-- ============================================================
-- 3. DATE / PERIOD REFERENCE
-- ============================================================
--
-- The dashboard resolves periods to date ranges server-side.
-- These are the equivalent Snowflake predicates for each period.
-- Use them as replacements for BETWEEN $START_DATE AND $END_DATE
-- when fact-checking a specific period.

-- Today
--   col::DATE = CURRENT_DATE()

-- YTD (Year to Date)
--   col::DATE BETWEEN DATE_TRUNC('year', CURRENT_DATE()) AND CURRENT_DATE()

-- 30D (last 30 days, rolling)
--   col::DATE BETWEEN DATEADD('day', -30, CURRENT_DATE()) AND CURRENT_DATE()

-- 90D
--   col::DATE BETWEEN DATEADD('day', -90, CURRENT_DATE()) AND CURRENT_DATE()

-- 6M (last 6 months, rolling, 180 days)
--   col::DATE BETWEEN DATEADD('month', -6, CURRENT_DATE()) AND CURRENT_DATE()

-- This Month
--   DATE_TRUNC('month', col::DATE) = DATE_TRUNC('month', CURRENT_DATE())

-- Last Month
--   DATE_TRUNC('month', col::DATE) = DATE_TRUNC('month', DATEADD('month', -1, CURRENT_DATE()))

-- This Week (ISO week, Monday-based)
--   DATEADD('day', 1-DAYOFWEEKISO(col::DATE), col::DATE)
--     = DATEADD('day', 1-DAYOFWEEKISO(CURRENT_DATE()), CURRENT_DATE())

-- Last Week
--   DATEADD('day', 1-DAYOFWEEKISO(col::DATE), col::DATE)
--     = DATEADD('day', 1-DAYOFWEEKISO(DATEADD('week',-1,CURRENT_DATE())), DATEADD('week',-1,CURRENT_DATE()))

-- Custom: col::DATE BETWEEN '2026-01-01'::DATE AND '2026-09-16'::DATE


-- ============================================================
-- 4. OEE — Overall Equipment Effectiveness
-- ============================================================
--
-- Business definition (from docs/BUSINESS_LOGIC.md):
--   Per row:
--     Quality     = QTY_FG_GOOD / QTY_TOTAL
--     Performance = LEAST(PRODUCTIVITY / ACTIVITY_PRODUCTIVITY_STD, 1.0)
--     OEE_row     = Quality × Performance
--   Per plant: AVG(OEE_row)
--   Overall: UNWEIGHTED average of per-plant OEEs
--
-- IMPORTANT: Dashboard does NOT compute a simple average across all rows.
--   It first averages rows within each plant, then averages across plants.
--   This means all plants contribute equally regardless of row count.
--   See [FACT CHECK] OEE OVERALL for the correct replication.
--
-- Source: MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
-- Date column: KEMAS_COMPLETED_AT
-- Related dashboard: Strategic Dashboard / Hero OEE card + Equipment section

-- ============================================================
-- [FACT CHECK] OEE SUMMARY — PER PLANT
-- ============================================================
--
-- Purpose:
--   Validate OEE, Quality, and Performance per plant.
--   This matches the byPlant array returned by the API.
--
-- How to use:
--   Each row here corresponds to one bar in the dashboard's
--   OEE breakdown. The overall OEE is the simple average of
--   all OEE values in this result (see next query).

SELECT
  PLANT,
  AVG(CASE WHEN QTY_TOTAL > 0
           THEN QTY_FG_GOOD::FLOAT / QTY_TOTAL
           ELSE 0 END) * 100                                             AS QUALITY_PCT,
  AVG(CASE WHEN ACTIVITY_PRODUCTIVITY_STD > 0
           THEN LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0)
           ELSE 0 END) * 100                                             AS PERFORMANCE_PCT,
  AVG(
    (CASE WHEN QTY_TOTAL > 0
          THEN QTY_FG_GOOD::FLOAT / QTY_TOTAL
          ELSE 0 END) *
    (CASE WHEN ACTIVITY_PRODUCTIVITY_STD > 0
          THEN LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0)
          ELSE 0 END)
  ) * 100                                                                AS OEE_PCT
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
WHERE KEMAS_COMPLETED_AT::DATE BETWEEN $START_DATE AND $END_DATE
  AND ($PLANT IS NULL OR PLANT = $PLANT)
GROUP BY PLANT
ORDER BY PLANT;


-- ============================================================
-- [FACT CHECK] OEE OVERALL (dashboard headline number)
-- ============================================================
--
-- Purpose:
--   Replicate the single OEE % shown in the Hero OEE card.
--
-- Logic (from app/api/dashboard/kpi/route.ts):
--   avg = sum(plant.OEE) / count(plants)
--   This is UNWEIGHTED — all plants contribute equally.
--
-- Expected result:
--   Single row. Compare with the Hero OEE card value.

SELECT
  COUNT(DISTINCT PLANT)                                                  AS plant_count,
  AVG(plant_oee)                                                         AS OEE_OVERALL_PCT,
  AVG(plant_quality)                                                     AS QUALITY_OVERALL_PCT,
  AVG(plant_performance)                                                 AS PERFORMANCE_OVERALL_PCT
FROM (
  SELECT
    PLANT,
    AVG(CASE WHEN QTY_TOTAL > 0
             THEN QTY_FG_GOOD::FLOAT / QTY_TOTAL
             ELSE 0 END) * 100                                           AS plant_quality,
    AVG(CASE WHEN ACTIVITY_PRODUCTIVITY_STD > 0
             THEN LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0)
             ELSE 0 END) * 100                                           AS plant_performance,
    AVG(
      (CASE WHEN QTY_TOTAL > 0
            THEN QTY_FG_GOOD::FLOAT / QTY_TOTAL
            ELSE 0 END) *
      (CASE WHEN ACTIVITY_PRODUCTIVITY_STD > 0
            THEN LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0)
            ELSE 0 END)
    ) * 100                                                              AS plant_oee
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
  WHERE KEMAS_COMPLETED_AT::DATE BETWEEN $START_DATE AND $END_DATE
    AND ($PLANT IS NULL OR PLANT = $PLANT)
  GROUP BY PLANT
) plant_summary;


-- ============================================================
-- [FACT CHECK] OEE DETAIL — RAW ROWS
-- ============================================================
--
-- Purpose:
--   Drill down to individual records that form OEE.
--   Use when the summary number differs from dashboard.
--
-- How to use:
--   Filter by plant, look for rows where QTY_TOTAL = 0
--   or ACTIVITY_PRODUCTIVITY_STD = 0 (these score as 0 in OEE).

SELECT
  PROCESS_ORDER_FG,
  PLANT,
  KEMAS_COMPLETED_AT::DATE                                               AS date,
  QTY_FG_GOOD,
  QTY_FG_RETUR,
  QTY_TOTAL,
  PRODUCTIVITY,
  ACTIVITY_PRODUCTIVITY_STD,
  CASE WHEN QTY_TOTAL > 0
       THEN ROUND(QTY_FG_GOOD::FLOAT / QTY_TOTAL * 100, 2)
       ELSE 0 END                                                        AS quality_pct,
  CASE WHEN ACTIVITY_PRODUCTIVITY_STD > 0
       THEN ROUND(LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0) * 100, 2)
       ELSE 0 END                                                        AS performance_pct,
  CASE WHEN QTY_TOTAL > 0 AND ACTIVITY_PRODUCTIVITY_STD > 0
       THEN ROUND(
         (QTY_FG_GOOD::FLOAT / QTY_TOTAL) *
         LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0) * 100, 2)
       ELSE 0 END                                                        AS oee_pct
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
WHERE KEMAS_COMPLETED_AT::DATE BETWEEN $START_DATE AND $END_DATE
  AND ($PLANT IS NULL OR PLANT = $PLANT)
ORDER BY KEMAS_COMPLETED_AT DESC;


-- ============================================================
-- 5. OPE — Overall Plant Effectiveness
-- ============================================================
--
-- OPE = OEE × 0.8
-- This is a DERIVED ESTIMATE computed in the frontend.
-- There is no Snowflake query for OPE.
-- The 0.8 factor approximates planned downtime and capacity
-- utilization not captured in equipment-level OEE.
--
-- To fact check OPE:
--   1. Run the OEE OVERALL query above to get OEE %.
--   2. Multiply by 0.8.
--   e.g., OEE = 72.4% → OPE = 72.4 × 0.8 = 57.9%


-- ============================================================
-- 6. AVAILABILITY
-- ============================================================
--
-- Availability = OEE / (Performance × Quality) × 100
-- This is DERIVED in the frontend from the three OEE components.
-- There is no direct Snowflake query.
--
-- To fact check Availability:
--   1. Get OEE_OVERALL_PCT, QUALITY_OVERALL_PCT, PERFORMANCE_OVERALL_PCT
--      from the OEE OVERALL query.
--   2. Availability = OEE / (Performance/100 × Quality/100) × 100
--   e.g., OEE=72.4%, Performance=85.3%, Quality=89.2%
--         Availability = 72.4 / (0.853 × 0.892) × 100 = 95.1%


-- ============================================================
-- 7. LEAD TIME
-- ============================================================
--
-- Gross Lead Time:
--   Per PO: DATEDIFF('minute', PO activity start, RECEIVE NDC stop) / 1440
--   Result: AVG(gross_days) across all valid POs
--   A PO is only included if both PO start and RECEIVE NDC stop are not null.
--
-- Nett Lead Time:
--   Per PO: SUM(NET_LEADTIME in minutes) / 1440
--   Only rows where ACTIVITY_TYPE = 'ACTUAL' and LINE_CATEGORY IS NOT NULL
--
-- Source: MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
-- Date column: PO_FG_DONE_DATE
-- Related dashboard: Strategic Dashboard / Lead Time KPI card

-- ============================================================
-- [FACT CHECK] LEAD TIME SUMMARY
-- ============================================================
--
-- Purpose:
--   Validate Gross and Nett Lead Time shown on dashboard.
--
-- Expected result:
--   grossDays matches the main value on the Lead Time card.
--   nettDays matches the sub-stat.

SELECT
  AVG(gross_minutes) / 1440.0                                           AS AVG_GROSS_LEADTIME_DAYS,
  COUNT(*)                                                              AS po_count
FROM (
  SELECT
    PROCESS_ORDER_FG,
    DATEDIFF('minute',
      MIN(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_START END),
      MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' THEN ACTIVITY_STOP END)
    )                                                                   AS gross_minutes
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
  WHERE PO_FG_DONE_DATE::DATE BETWEEN $START_DATE AND $END_DATE
    AND ($PLANT IS NULL OR PLANT = $PLANT)
  GROUP BY PROCESS_ORDER_FG
  HAVING
    MIN(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_START END) IS NOT NULL
    AND MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' THEN ACTIVITY_STOP END) IS NOT NULL
) sub;


-- [FACT CHECK] NETT LEAD TIME
SELECT
  AVG(nett_minutes) / 1440.0                                           AS AVG_NETT_LEADTIME_DAYS,
  COUNT(*)                                                              AS po_count
FROM (
  SELECT PROCESS_ORDER_FG, SUM(NET_LEADTIME) AS nett_minutes
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
  WHERE PO_FG_DONE_DATE::DATE BETWEEN $START_DATE AND $END_DATE
    AND ACTIVITY_TYPE = 'ACTUAL'
    AND LINE_CATEGORY IS NOT NULL
    AND ($PLANT IS NULL OR PLANT = $PLANT)
  GROUP BY PROCESS_ORDER_FG
) sub;


-- ============================================================
-- [FACT CHECK] LEAD TIME DETAIL — PER PROCESS ORDER
-- ============================================================
--
-- Purpose:
--   See individual PO lead times when the average looks off.
--   Outlier POs (very long or short) disproportionately affect the average.

SELECT
  PROCESS_ORDER_FG,
  MIN(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_START END)               AS po_start,
  MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' THEN ACTIVITY_STOP END)       AS ndc_stop,
  DATEDIFF('minute',
    MIN(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_START END),
    MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' THEN ACTIVITY_STOP END)
  ) / 1440.0                                                           AS gross_days,
  SUM(CASE WHEN ACTIVITY_TYPE = 'ACTUAL' AND LINE_CATEGORY IS NOT NULL
           THEN NET_LEADTIME ELSE 0 END) / 1440.0                      AS nett_days,
  COUNT(DISTINCT ACTIVITY)                                             AS activity_count
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
WHERE PO_FG_DONE_DATE::DATE BETWEEN $START_DATE AND $END_DATE
  AND ($PLANT IS NULL OR PLANT = $PLANT)
GROUP BY PROCESS_ORDER_FG
HAVING MIN(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_START END) IS NOT NULL
  AND MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' THEN ACTIVITY_STOP END) IS NOT NULL
ORDER BY gross_days DESC;


-- ============================================================
-- [FACT CHECK] LEAD TIME BY STAGE (Position Breakdown)
-- ============================================================
--
-- Purpose:
--   See which stage contributes most to lead time.
--   Matches the position breakdown returned in the API response
--   (byPositionNett, byPositionGross).

-- Nett: which stage takes the most actual processing time?
SELECT POSITION, ROUND(AVG(pos_minutes) / 60.0, 2) AS AVG_HOURS_NETT
FROM (
  SELECT PROCESS_ORDER_FG, POSITION, SUM(NET_LEADTIME) AS pos_minutes
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
  WHERE PO_FG_DONE_DATE::DATE BETWEEN $START_DATE AND $END_DATE
    AND ACTIVITY_TYPE = 'ACTUAL'
    AND ($PLANT IS NULL OR PLANT = $PLANT)
  GROUP BY PROCESS_ORDER_FG, POSITION
) sub
GROUP BY POSITION
ORDER BY AVG_HOURS_NETT DESC
LIMIT 10;

-- Gross: which stage has the longest calendar span?
SELECT POSITION, ROUND(AVG(pos_minutes) / 60.0, 2) AS AVG_HOURS_GROSS
FROM (
  SELECT PROCESS_ORDER_FG, POSITION,
    DATEDIFF('minute', MIN(ACTIVITY_START), MAX(ACTIVITY_STOP)) AS pos_minutes
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
  WHERE PO_FG_DONE_DATE::DATE BETWEEN $START_DATE AND $END_DATE
    AND ($PLANT IS NULL OR PLANT = $PLANT)
  GROUP BY PROCESS_ORDER_FG, POSITION
) sub
GROUP BY POSITION
ORDER BY AVG_HOURS_GROSS DESC
LIMIT 10;


-- ============================================================
-- 8. RIGHT FIRST TIME (RFT)
-- ============================================================
--
-- Business definition:
--   RFT = COUNT(ACTIVITY ≠ 'ADJUST') / COUNT(ACTIVITY) × 100
--   ACTIVITY = 'ADJUST' marks a correction/rework record.
--
-- Source: MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
-- Date column: PO_FG_DONE_DATE
-- Related dashboard: Strategic Dashboard / RFT KPI card

-- ============================================================
-- [FACT CHECK] RFT SUMMARY
-- ============================================================
--
-- Expected result:
--   RFT_PCT should match the RFT card on the dashboard.

SELECT
  COUNT(CASE WHEN ACTIVITY <> 'ADJUST' THEN 1 END)                    AS first_time_count,
  COUNT(ACTIVITY)                                                      AS total_activity_count,
  COUNT(CASE WHEN ACTIVITY <> 'ADJUST' THEN 1 END) * 100.0
    / NULLIF(COUNT(ACTIVITY), 0)                                       AS RFT_PCT
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
WHERE PO_FG_DONE_DATE::DATE BETWEEN $START_DATE AND $END_DATE
  AND ($PLANT IS NULL OR PLANT = $PLANT);


-- ============================================================
-- [FACT CHECK] RFT DETAIL — ADJUST ACTIVITIES
-- ============================================================
--
-- Purpose:
--   Find the specific records flagged as ADJUST (rework).
--   If RFT is dropping, these records explain why.

SELECT
  PROCESS_ORDER_FG,
  ACTIVITY,
  ACTIVITY_TYPE,
  POSITION,
  PLANT,
  PO_FG_DONE_DATE,
  ACTIVITY_START,
  ACTIVITY_STOP
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
WHERE PO_FG_DONE_DATE::DATE BETWEEN $START_DATE AND $END_DATE
  AND ACTIVITY = 'ADJUST'
  AND ($PLANT IS NULL OR PLANT = $PLANT)
ORDER BY PO_FG_DONE_DATE DESC;


-- [FACT CHECK] RFT BY PLANT
SELECT
  PLANT,
  COUNT(CASE WHEN ACTIVITY <> 'ADJUST' THEN 1 END)                    AS first_time_count,
  COUNT(ACTIVITY)                                                      AS total_count,
  ROUND(COUNT(CASE WHEN ACTIVITY <> 'ADJUST' THEN 1 END) * 100.0
    / NULLIF(COUNT(ACTIVITY), 0), 1)                                   AS RFT_PCT
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
WHERE PO_FG_DONE_DATE::DATE BETWEEN $START_DATE AND $END_DATE
  AND ($PLANT IS NULL OR PLANT = $PLANT)
GROUP BY PLANT
ORDER BY RFT_PCT;


-- ============================================================
-- 9. BULK LOSS
-- ============================================================
--
-- Business definition:
--   Bulk Loss % = ABS((THEORETICAL - REALIZATION) / THEORETICAL) × 100
--   Bulk Loss kg = MAX(0, THEORETICAL - REALIZATION)
--
-- ⚠️ IMPORTANT LIMITATION:
--   DATAMART_PRODUCTION_OUTPUT_OLAH has NO PLANT column.
--   Dashboard CANNOT filter Bulk Loss by plant.
--   The PLANT filter in the dashboard header has NO EFFECT on this KPI.
--   This query always returns all-plant totals regardless of $PLANT.
--
-- Source: DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
-- Date column: CORRECTION_DATE
-- Related dashboard: Strategic Dashboard / Yield Loss KPI card (Bulk Loss sub-stat)

-- ============================================================
-- [FACT CHECK] BULK LOSS SUMMARY
-- ============================================================
--
-- Expected result:
--   BULK_LOSS_PCT matches the Bulk Loss % in the Yield card.
--   BULK_LOSS_KG matches the kg sub-stat.
--
-- Note: No plant filter — always all-plant.

SELECT
  SUM(REALIZATION_QUANTITY)                                            AS total_realization_kg,
  SUM(THEORETICAL_QUANTITY)                                            AS total_theoretical_kg,
  ABS(
    (SUM(THEORETICAL_QUANTITY) - SUM(REALIZATION_QUANTITY))
    / NULLIF(SUM(THEORETICAL_QUANTITY), 0)
  ) * 100                                                              AS BULK_LOSS_PCT,
  GREATEST(SUM(THEORETICAL_QUANTITY) - SUM(REALIZATION_QUANTITY), 0)  AS BULK_LOSS_KG
FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
WHERE CORRECTION_DATE::DATE BETWEEN $START_DATE AND $END_DATE;


-- ============================================================
-- [FACT CHECK] BULK LOSS DETAIL
-- ============================================================
--
-- Purpose:
--   See individual records behind Bulk Loss.
--   Identify specific dates or batches with high loss.

SELECT
  CORRECTION_DATE,
  REALIZATION_QUANTITY,
  THEORETICAL_QUANTITY,
  THEORETICAL_QUANTITY - REALIZATION_QUANTITY                          AS raw_loss_kg,
  ABS(THEORETICAL_QUANTITY - REALIZATION_QUANTITY)
    / NULLIF(THEORETICAL_QUANTITY, 0) * 100                           AS loss_pct
FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
WHERE CORRECTION_DATE::DATE BETWEEN $START_DATE AND $END_DATE
ORDER BY CORRECTION_DATE DESC;


-- ============================================================
-- 10. PACK LOSS
-- ============================================================
--
-- Business definition:
--   Pack Loss % = SUM(QTY_FG_RETUR) / SUM(QTY_TOTAL) × 100
--
-- Source: MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
-- Date column: KEMAS_COMPLETED_AT
-- Related dashboard: Strategic Dashboard / Yield Loss KPI card (Pack Loss sub-stat)

-- ============================================================
-- [FACT CHECK] PACK LOSS SUMMARY
-- ============================================================
--
-- Expected result:
--   PACK_LOSS_PCT matches the Pack Loss % in the Yield card.

SELECT
  SUM(QTY_FG_GOOD)                                                    AS total_good_pcs,
  SUM(QTY_FG_RETUR)                                                   AS total_returned_pcs,
  SUM(QTY_TOTAL)                                                      AS total_qty_pcs,
  SUM(QTY_FG_RETUR) * 100.0 / NULLIF(SUM(QTY_TOTAL), 0)             AS PACK_LOSS_PCT
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
WHERE KEMAS_COMPLETED_AT::DATE BETWEEN $START_DATE AND $END_DATE
  AND ($PLANT IS NULL OR PLANT = $PLANT);


-- ============================================================
-- [FACT CHECK] PACK LOSS DETAIL — HIGH RETURN RECORDS
-- ============================================================
--
-- Purpose:
--   Find POs with the highest return rate.
--   Use when Pack Loss is unexpectedly high.

SELECT
  PROCESS_ORDER_FG,
  PLANT,
  KEMAS_COMPLETED_AT::DATE                                            AS date,
  QTY_FG_GOOD,
  QTY_FG_RETUR,
  QTY_TOTAL,
  ROUND(QTY_FG_RETUR * 100.0 / NULLIF(QTY_TOTAL, 0), 2)             AS loss_pct_this_row
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
WHERE KEMAS_COMPLETED_AT::DATE BETWEEN $START_DATE AND $END_DATE
  AND ($PLANT IS NULL OR PLANT = $PLANT)
  AND QTY_TOTAL > 0
ORDER BY loss_pct_this_row DESC;


-- ============================================================
-- 11. OUTPUT / PRODUCTION
-- ============================================================
--
-- ⚠️ IMPORTANT LIMITATION:
--   Both output tables have NO PLANT column.
--   Plant filter has NO EFFECT on Output KPIs.
--   Always returns all-plant totals.
--
-- Related dashboard: Strategic Dashboard / Output KPI card

-- ============================================================
-- [FACT CHECK] BULK OUTPUT (kg)
-- ============================================================
--
-- Source: DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
-- Expected result: TOTAL_BULK_KG matches Bulk Output in the Output card.

SELECT
  COUNT(*)                                                            AS row_count,
  SUM(REALIZATION_QUANTITY)                                          AS TOTAL_BULK_KG
FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
WHERE CORRECTION_DATE::DATE BETWEEN $START_DATE AND $END_DATE;


-- ============================================================
-- [FACT CHECK] FG OUTPUT (pcs)
-- ============================================================
--
-- Source: DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_FG
-- Expected result: TOTAL_FG_PCS matches FG Output in the Output card.

SELECT
  COUNT(*)                                                            AS row_count,
  SUM(QUANTITY)                                                      AS TOTAL_FG_PCS
FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_FG
WHERE CORRECTION_DATE::DATE BETWEEN $START_DATE AND $END_DATE;


-- ============================================================
-- 12. PRODUCTIVITY
-- ============================================================
--
-- The dashboard shows three variants:
--   E2E Productivity  — pcs/manhour, pre-computed in CT_MANUF_E2E
--   Downstream Prod   — pcs/manhour, from CT_MANUF_KEMAS
--   Upstream Prod     — kg/manhour, from CT_MANUF_OLAH (3-level LOD)
--
-- The headline card value = E2E Productivity.
-- Manhours and Avg Operators are sub-stats (from CT_MANUF_KEMAS).

-- ============================================================
-- [FACT CHECK] E2E PRODUCTIVITY
-- ============================================================
--
-- Source: MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
-- Date column: KEMAS_COMPLETED_AT
--
-- NOTE: E2E_PRODUCTIVITY is pre-computed in the source table.
--   We cannot independently verify its calculation formula.
--   See docs/DATA_MODEL.md Known Limitations §3.
--
-- Expected result: AVG_E2E_PROD matches the E2E pcs/mh headline.

SELECT
  COUNT(*)                                                            AS row_count,
  ROUND(AVG(E2E_PRODUCTIVITY), 1)                                    AS AVG_E2E_PROD
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
WHERE KEMAS_COMPLETED_AT::DATE BETWEEN $START_DATE AND $END_DATE
  AND ($PLANT IS NULL OR PLANT = $PLANT);


-- ============================================================
-- [FACT CHECK] DOWNSTREAM PRODUCTIVITY
-- ============================================================
--
-- Formula:
--   Per PO: SUM(QTY_FG_GOOD) / (SUM(LEADTIME_IN_MINUTE)/60) / MAX(OPERATOR_COUNT)
--   Result: AVG of per-PO values
--
-- Source: MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
-- Only rows where LEADTIME_IN_MINUTE > 0 AND OPERATOR_COUNT > 0.

SELECT
  COUNT(DISTINCT PROCESS_ORDER_FG)                                   AS po_count,
  ROUND(AVG(po_prod), 1)                                             AS AVG_DOWNSTREAM_PROD
FROM (
  SELECT
    PROCESS_ORDER_FG,
    SUM(QTY_FG_GOOD)
      / NULLIF(SUM(LEADTIME_IN_MINUTE) / 60.0, 0)
      / NULLIF(MAX(OPERATOR_COUNT), 0)                               AS po_prod
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
  WHERE KEMAS_COMPLETED_AT::DATE BETWEEN $START_DATE AND $END_DATE
    AND LEADTIME_IN_MINUTE > 0
    AND OPERATOR_COUNT > 0
    AND ($PLANT IS NULL OR PLANT = $PLANT)
  GROUP BY PROCESS_ORDER_FG
) sub;


-- ============================================================
-- [FACT CHECK] UPSTREAM PRODUCTIVITY
-- ============================================================
--
-- Formula (3-level LOD, from lib/queries.ts):
--   Level 1 (activity): MAX(RELEASE_BULK), MAX(LEADTIME), MAX(OPERATOR) per activity
--   Level 2 (position): aggregate to per-PO-per-position
--   Level 3 (SFG):      aggregate to per-PROCESS_ORDER_SFG
--   Result: AVG(release_bulk / (total_leadtime_min/60) / total_operators)
--
-- Source: MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH
-- Date column: OLAH_COMPLETED_AT
-- Only POs where RELEASE_BULK > 0.

WITH activity_lvl AS (
  SELECT
    PROCESS_ORDER_SFG,
    POSITION,
    ACTIVITY,
    ACTIVITY_ID,
    MAX(CASE WHEN RELEASE_BULK IS NOT NULL THEN RELEASE_BULK END)    AS release_bulk_sfg,
    MAX(CASE WHEN RELEASE_BULK IS NOT NULL THEN LEADTIME_IN_MINUTE END) AS leadtime_per_act,
    MAX(CASE WHEN RELEASE_BULK IS NOT NULL THEN OPERATOR_COUNT END)  AS operator_per_act
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH
  WHERE OLAH_COMPLETED_AT::DATE BETWEEN $START_DATE AND $END_DATE
    AND ($PLANT IS NULL OR PLANT = $PLANT)
  GROUP BY PROCESS_ORDER_SFG, POSITION, ACTIVITY, ACTIVITY_ID
),
position_lvl AS (
  SELECT
    PROCESS_ORDER_SFG,
    MAX(release_bulk_sfg)                                            AS release_bulk_sfg,
    SUM(leadtime_per_act)                                           AS leadtime_sum,
    SUM(operator_per_act)                                           AS operator_per_position
  FROM activity_lvl
  GROUP BY PROCESS_ORDER_SFG, POSITION
),
sfg_lvl AS (
  SELECT
    PROCESS_ORDER_SFG,
    MAX(release_bulk_sfg)                                           AS max_release_bulk,
    SUM(leadtime_sum)                                               AS total_leadtime_min,
    SUM(operator_per_position)                                      AS total_operators
  FROM position_lvl
  GROUP BY PROCESS_ORDER_SFG
)
SELECT
  COUNT(*)                                                           AS sfg_count,
  ROUND(AVG(
    CASE WHEN total_leadtime_min > 0 AND total_operators > 0
    THEN max_release_bulk / (total_leadtime_min / 60.0) / total_operators
    END
  ), 1)                                                             AS AVG_UPSTREAM_PROD
FROM sfg_lvl
WHERE max_release_bulk > 0;


-- ============================================================
-- [FACT CHECK] MANHOURS & AVG OPERATORS
-- ============================================================
--
-- Source: MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
-- TOTAL_MANHOURS matches the Manhours sub-stat in the Productivity card.
-- AVG_OPERATORS matches the Avg Operators sub-stat.

SELECT
  ROUND(SUM(LEADTIME_IN_MINUTE / 60.0 * OPERATOR_COUNT))            AS TOTAL_MANHOURS,
  ROUND(AVG(OPERATOR_COUNT))                                         AS AVG_OPERATORS
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
WHERE KEMAS_COMPLETED_AT::DATE BETWEEN $START_DATE AND $END_DATE
  AND LEADTIME_IN_MINUTE > 0
  AND OPERATOR_COUNT > 0
  AND ($PLANT IS NULL OR PLANT = $PLANT);


-- ============================================================
-- 13. FILTER VALIDATION
-- ============================================================
--
-- Dashboard has two filters that are relevant for data validation:
--   1. Plant filter — filters CT_MANUF_* tables
--   2. Period filter — filters by date column per table
--
-- The following queries show the impact of the plant filter
-- to verify it is working correctly.
--
-- Note: Period filter can be validated using Section 3 (Date Reference).

-- ============================================================
-- [FILTER CHECK] PLANT FILTER IMPACT ON OEE
-- ============================================================
--
-- Compare OEE with and without plant filter.
-- If the numbers are the same, the plant filter may not be working,
-- or there is only one plant in the data.

-- Without plant filter (all plants)
SELECT 'ALL PLANTS' AS scope, ROUND(AVG(plant_oee), 1) AS OEE_PCT, COUNT(*) AS plant_count
FROM (
  SELECT PLANT, AVG(
    (CASE WHEN QTY_TOTAL > 0 THEN QTY_FG_GOOD::FLOAT / QTY_TOTAL ELSE 0 END) *
    (CASE WHEN ACTIVITY_PRODUCTIVITY_STD > 0
          THEN LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0)
          ELSE 0 END)
  ) * 100 AS plant_oee
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
  WHERE KEMAS_COMPLETED_AT::DATE BETWEEN $START_DATE AND $END_DATE
  GROUP BY PLANT
) s;

-- With $PLANT filter (set $PLANT above to a specific plant to see the difference)
SELECT 'FILTERED: ' || COALESCE($PLANT, 'ALL') AS scope, ROUND(AVG(plant_oee), 1) AS OEE_PCT, COUNT(*) AS plant_count
FROM (
  SELECT PLANT, AVG(
    (CASE WHEN QTY_TOTAL > 0 THEN QTY_FG_GOOD::FLOAT / QTY_TOTAL ELSE 0 END) *
    (CASE WHEN ACTIVITY_PRODUCTIVITY_STD > 0
          THEN LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0)
          ELSE 0 END)
  ) * 100 AS plant_oee
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
  WHERE KEMAS_COMPLETED_AT::DATE BETWEEN $START_DATE AND $END_DATE
    AND ($PLANT IS NULL OR PLANT = $PLANT)
  GROUP BY PLANT
) s;


-- ============================================================
-- [FILTER CHECK] VERIFY BULK LOSS IS UNAFFECTED BY PLANT FILTER
-- ============================================================
--
-- Expected: Both queries return the SAME number.
-- If they differ, something unexpected is happening.

SELECT 'ALL PLANTS (no plant col)' AS scope, SUM(REALIZATION_QUANTITY) AS bulk_kg,
  ABS((SUM(THEORETICAL_QUANTITY) - SUM(REALIZATION_QUANTITY)) / NULLIF(SUM(THEORETICAL_QUANTITY), 0)) * 100 AS bulk_loss_pct
FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
WHERE CORRECTION_DATE::DATE BETWEEN $START_DATE AND $END_DATE;

-- This should return identical numbers regardless of $PLANT value:
SELECT 'WITH $PLANT (ignored)' AS scope, SUM(REALIZATION_QUANTITY) AS bulk_kg,
  ABS((SUM(THEORETICAL_QUANTITY) - SUM(REALIZATION_QUANTITY)) / NULLIF(SUM(THEORETICAL_QUANTITY), 0)) * 100 AS bulk_loss_pct
FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
WHERE CORRECTION_DATE::DATE BETWEEN $START_DATE AND $END_DATE;
-- Note: The above two queries ARE identical — there is no plant column to filter on.


-- ============================================================
-- 14. ALERT VALIDATION
-- ============================================================
--
-- Alert thresholds (from lib/alerts.ts):
--
--   Lead Time (trend-based):
--     Warning:  lead time trend > +5%  (vs previous period)
--     Critical: lead time trend > +15% (vs previous period)
--
--   Bulk Loss (absolute value):
--     Warning:  Bulk Loss % > 3%
--     Critical: Bulk Loss % > 5%
--
--   Pack Loss (absolute value):
--     Warning:  Pack Loss % > 1%
--     Critical: Pack Loss % > 2%
--
--   RFT (absolute value):
--     Warning:  RFT % < 95%
--     Critical: RFT % < 90%
--
--   OEE (absolute value):
--     Warning:  OEE % < 65%
--     Critical: OEE % < 55%
--
-- NOTE: Only CRITICAL alerts are auto-sent to Teams.
--   WARNING alerts appear in the UI only.
--
-- NOTE: Bulk Loss has a trendWarning = 10 defined in code
--   but it is NOT used in computeAlerts(). Bulk Loss alerts
--   are absolute-value only.

-- ============================================================
-- [ALERT CHECK] CURRENT KPI ALERT STATUS
-- ============================================================
--
-- Purpose:
--   See which KPIs are in warning or critical state for the current period.
--   Validates whether the dashboard alert panel is correct.

WITH kpi AS (
  -- OEE (unweighted avg of plant OEEs)
  SELECT ROUND(AVG(plant_oee), 1) AS oee_pct
  FROM (
    SELECT PLANT,
      AVG((CASE WHEN QTY_TOTAL > 0 THEN QTY_FG_GOOD::FLOAT / QTY_TOTAL ELSE 0 END) *
          (CASE WHEN ACTIVITY_PRODUCTIVITY_STD > 0
               THEN LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0)
               ELSE 0 END)) * 100 AS plant_oee
    FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
    WHERE KEMAS_COMPLETED_AT::DATE BETWEEN $START_DATE AND $END_DATE
      AND ($PLANT IS NULL OR PLANT = $PLANT)
    GROUP BY PLANT
  ) p
),
pack AS (
  SELECT ROUND(SUM(QTY_FG_RETUR) * 100.0 / NULLIF(SUM(QTY_TOTAL), 0), 1) AS pack_loss_pct
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
  WHERE KEMAS_COMPLETED_AT::DATE BETWEEN $START_DATE AND $END_DATE
    AND ($PLANT IS NULL OR PLANT = $PLANT)
),
bulk AS (
  SELECT ROUND(ABS((SUM(THEORETICAL_QUANTITY) - SUM(REALIZATION_QUANTITY))
    / NULLIF(SUM(THEORETICAL_QUANTITY), 0)) * 100, 1) AS bulk_loss_pct
  FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
  WHERE CORRECTION_DATE::DATE BETWEEN $START_DATE AND $END_DATE
),
rft AS (
  SELECT ROUND(COUNT(CASE WHEN ACTIVITY <> 'ADJUST' THEN 1 END) * 100.0
    / NULLIF(COUNT(ACTIVITY), 0), 1) AS rft_pct
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
  WHERE PO_FG_DONE_DATE::DATE BETWEEN $START_DATE AND $END_DATE
    AND ($PLANT IS NULL OR PLANT = $PLANT)
)
SELECT
  kpi.oee_pct,
  CASE WHEN kpi.oee_pct < 55 THEN 'CRITICAL'
       WHEN kpi.oee_pct < 65 THEN 'WARNING'
       ELSE 'OK' END                                                   AS oee_alert,
  pack.pack_loss_pct,
  CASE WHEN pack.pack_loss_pct > 2 THEN 'CRITICAL'
       WHEN pack.pack_loss_pct > 1 THEN 'WARNING'
       ELSE 'OK' END                                                   AS pack_loss_alert,
  bulk.bulk_loss_pct,
  CASE WHEN bulk.bulk_loss_pct > 5 THEN 'CRITICAL'
       WHEN bulk.bulk_loss_pct > 3 THEN 'WARNING'
       ELSE 'OK' END                                                   AS bulk_loss_alert,
  rft.rft_pct,
  CASE WHEN rft.rft_pct < 90 THEN 'CRITICAL'
       WHEN rft.rft_pct < 95 THEN 'WARNING'
       ELSE 'OK' END                                                   AS rft_alert
FROM kpi, pack, bulk, rft;


-- ============================================================
-- 15. TREND COMPARISON (How dashboard calculates trend %)
-- ============================================================
--
-- Trend % = (current - previous) / |previous| × 100
--
-- Previous period logic (from app/api/dashboard/kpi/route.ts prevPeriod()):
--   prevEnd   = $START_DATE - 1 day
--   prevStart = prevEnd - same_duration_as_current_period
--
-- Example: if current = Aug 17 – Sep 16 (30 days)
--   prevEnd   = Aug 16
--   prevStart = Jul 17
--   Previous  = Jul 17 – Aug 16
--
-- This is a ROLLING same-duration comparison, NOT calendar MoM.
--
-- For preset periods (YTD, 30D, 90D, 6M, Today), the API resolves
-- actual dates server-side first, then applies the same prevPeriod() logic.

-- ============================================================
-- [TREND CHECK] LEAD TIME TREND
-- ============================================================
--
-- Purpose:
--   Verify the lead time trend % that triggers alerts.
--   If trend > +5%  → warning alert fires.
--   If trend > +15% → critical alert fires.
--
-- CHANGE DATES BELOW to match the current and previous periods.
-- These are literal dates — use the period calculation above to find
-- your previous period dates.

-- Current period lead time
WITH current_lt AS (
  SELECT AVG(gross_minutes) / 1440.0 AS avg_days
  FROM (
    SELECT PROCESS_ORDER_FG,
      DATEDIFF('minute',
        MIN(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_START END),
        MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' THEN ACTIVITY_STOP END)) AS gross_minutes
    FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
    WHERE PO_FG_DONE_DATE::DATE BETWEEN $START_DATE AND $END_DATE
      AND ($PLANT IS NULL OR PLANT = $PLANT)
    GROUP BY PROCESS_ORDER_FG
    HAVING MIN(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_START END) IS NOT NULL
      AND MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' THEN ACTIVITY_STOP END) IS NOT NULL
  ) s
),
-- Previous period: same duration, ending the day before current start
-- Change DATEADD values to match your actual previous period
prev_lt AS (
  SELECT AVG(gross_minutes) / 1440.0 AS avg_days
  FROM (
    SELECT PROCESS_ORDER_FG,
      DATEDIFF('minute',
        MIN(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_START END),
        MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' THEN ACTIVITY_STOP END)) AS gross_minutes
    FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
    -- Previous period = same duration, ending 1 day before $START_DATE
    WHERE PO_FG_DONE_DATE::DATE
      BETWEEN DATEADD('day', -1 - DATEDIFF('day', $START_DATE, $END_DATE), $START_DATE)
          AND DATEADD('day', -1, $START_DATE)
      AND ($PLANT IS NULL OR PLANT = $PLANT)
    GROUP BY PROCESS_ORDER_FG
    HAVING MIN(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_START END) IS NOT NULL
      AND MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' THEN ACTIVITY_STOP END) IS NOT NULL
  ) s
)
SELECT
  ROUND(c.avg_days, 2)                                               AS current_avg_days,
  ROUND(p.avg_days, 2)                                               AS prev_avg_days,
  ROUND((c.avg_days - p.avg_days) / NULLIF(ABS(p.avg_days), 0) * 100, 1) AS trend_pct,
  -- Alert evaluation (positive trend = lead time increased = worse)
  CASE
    WHEN (c.avg_days - p.avg_days) / NULLIF(ABS(p.avg_days), 0) * 100 > 15 THEN 'CRITICAL'
    WHEN (c.avg_days - p.avg_days) / NULLIF(ABS(p.avg_days), 0) * 100 > 5  THEN 'WARNING'
    ELSE 'OK'
  END                                                                AS lead_time_alert
FROM current_lt c, prev_lt p;


-- ============================================================
-- 16. DATA QUALITY
-- ============================================================
--
-- Run these to detect data problems that could cause
-- unexpected dashboard values.

-- ============================================================
-- [DATA QUALITY] CT_MANUF_KEMAS — NULL / ZERO checks
-- ============================================================

SELECT
  COUNT(*)                                                            AS total_rows,
  COUNT(CASE WHEN QTY_TOTAL IS NULL OR QTY_TOTAL = 0 THEN 1 END)    AS zero_or_null_qty_total,
  COUNT(CASE WHEN QTY_FG_GOOD IS NULL THEN 1 END)                    AS null_qty_good,
  COUNT(CASE WHEN QTY_FG_RETUR IS NULL THEN 1 END)                   AS null_qty_retur,
  COUNT(CASE WHEN ACTIVITY_PRODUCTIVITY_STD IS NULL
                  OR ACTIVITY_PRODUCTIVITY_STD = 0 THEN 1 END)       AS zero_or_null_std_prod,
  COUNT(CASE WHEN PRODUCTIVITY IS NULL THEN 1 END)                   AS null_productivity,
  COUNT(CASE WHEN LEADTIME_IN_MINUTE IS NULL
                  OR LEADTIME_IN_MINUTE <= 0 THEN 1 END)              AS invalid_leadtime,
  COUNT(CASE WHEN OPERATOR_COUNT IS NULL
                  OR OPERATOR_COUNT <= 0 THEN 1 END)                  AS invalid_operator_count,
  COUNT(CASE WHEN PLANT IS NULL THEN 1 END)                          AS null_plant
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
WHERE KEMAS_COMPLETED_AT::DATE BETWEEN $START_DATE AND $END_DATE;


-- ============================================================
-- [DATA QUALITY] CT_MANUF_LEADTIME — PO completeness
-- ============================================================
--
-- POs without a PO start or RECEIVE NDC stop are EXCLUDED from
-- Gross Lead Time. This query shows how many are excluded.

SELECT
  COUNT(DISTINCT PROCESS_ORDER_FG)                                   AS total_distinct_pos,
  COUNT(DISTINCT CASE WHEN has_po_start AND has_ndc_stop
    THEN PROCESS_ORDER_FG END)                                        AS pos_included_in_gross_lt,
  COUNT(DISTINCT CASE WHEN NOT has_po_start THEN PROCESS_ORDER_FG END) AS pos_missing_po_start,
  COUNT(DISTINCT CASE WHEN NOT has_ndc_stop THEN PROCESS_ORDER_FG END) AS pos_missing_ndc_stop
FROM (
  SELECT
    PROCESS_ORDER_FG,
    MAX(CASE WHEN ACTIVITY = 'PO' AND ACTIVITY_START IS NOT NULL
             THEN TRUE ELSE FALSE END)                               AS has_po_start,
    MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' AND ACTIVITY_STOP IS NOT NULL
             THEN TRUE ELSE FALSE END)                               AS has_ndc_stop
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
  WHERE PO_FG_DONE_DATE::DATE BETWEEN $START_DATE AND $END_DATE
    AND ($PLANT IS NULL OR PLANT = $PLANT)
  GROUP BY PROCESS_ORDER_FG
) s;


-- ============================================================
-- [DATA QUALITY] CT_MANUF_LEADTIME — NULL / missing checks
-- ============================================================

SELECT
  COUNT(*)                                                            AS total_rows,
  COUNT(CASE WHEN ACTIVITY IS NULL THEN 1 END)                      AS null_activity,
  COUNT(CASE WHEN ACTIVITY_TYPE IS NULL THEN 1 END)                  AS null_activity_type,
  COUNT(CASE WHEN ACTIVITY_START IS NULL THEN 1 END)                AS null_activity_start,
  COUNT(CASE WHEN ACTIVITY_STOP IS NULL THEN 1 END)                 AS null_activity_stop,
  COUNT(CASE WHEN NET_LEADTIME IS NULL OR NET_LEADTIME < 0 THEN 1 END) AS invalid_net_leadtime,
  COUNT(CASE WHEN PLANT IS NULL THEN 1 END)                          AS null_plant,
  COUNT(CASE WHEN PO_FG_DONE_DATE IS NULL THEN 1 END)               AS null_date
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
WHERE PO_FG_DONE_DATE::DATE BETWEEN $START_DATE AND $END_DATE
  AND ($PLANT IS NULL OR PLANT = $PLANT);


-- ============================================================
-- [DATA QUALITY] DATAMART_PRODUCTION_OUTPUT_OLAH — negatives
-- ============================================================
--
-- Negative THEORETICAL or REALIZATION values would cause incorrect
-- Bulk Loss calculations.

SELECT
  COUNT(*)                                                           AS total_rows,
  COUNT(CASE WHEN THEORETICAL_QUANTITY <= 0 THEN 1 END)            AS zero_or_negative_theoretical,
  COUNT(CASE WHEN REALIZATION_QUANTITY < 0 THEN 1 END)             AS negative_realization,
  COUNT(CASE WHEN REALIZATION_QUANTITY > THEORETICAL_QUANTITY
             THEN 1 END)                                            AS realization_exceeds_theoretical
FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
WHERE CORRECTION_DATE::DATE BETWEEN $START_DATE AND $END_DATE;


-- ============================================================
-- 17. DASHBOARD RECONCILIATION
-- ============================================================
--
-- Use these queries when dashboard numbers differ from Snowflake
-- fact-check results.
--
-- Common causes of discrepancy:
--   a. Cache: dashboard caches KPI for 1 hour. Snowflake is real-time.
--   b. Period boundary: verify your date range matches exactly.
--   c. OEE averaging: dashboard averages per-plant OEEs (unweighted).
--      A simple COUNT(*) average gives a different number.
--   d. Plant filter on no-PLANT tables: Bulk Loss and Output are
--      always all-plant, regardless of the plant filter.
--   e. Excluded POs: Lead Time excludes POs without PO start or
--      RECEIVE NDC stop. These are invisible in the dashboard.
--   f. Zero-value rows: OEE counts rows where QTY_TOTAL = 0 as OEE = 0,
--      pulling the average down.

-- ============================================================
-- [RECONCILIATION] SIMPLE vs DASHBOARD-MATCHED OEE
-- ============================================================
--
-- Demonstrates why a naive average gives a different OEE than dashboard.

-- WRONG (naive row-level average — NOT what dashboard shows):
SELECT
  'NAIVE avg across all rows (wrong)' AS method,
  ROUND(AVG(
    (CASE WHEN QTY_TOTAL > 0 THEN QTY_FG_GOOD::FLOAT / QTY_TOTAL ELSE 0 END) *
    (CASE WHEN ACTIVITY_PRODUCTIVITY_STD > 0
          THEN LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0)
          ELSE 0 END)
  ) * 100, 1)                                                        AS oee_pct
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
WHERE KEMAS_COMPLETED_AT::DATE BETWEEN $START_DATE AND $END_DATE
  AND ($PLANT IS NULL OR PLANT = $PLANT)

UNION ALL

-- CORRECT (unweighted average of per-plant OEEs — matches dashboard):
SELECT
  'Unweighted avg of plant OEEs (correct)' AS method,
  ROUND(AVG(plant_oee), 1)                                           AS oee_pct
FROM (
  SELECT PLANT,
    AVG((CASE WHEN QTY_TOTAL > 0 THEN QTY_FG_GOOD::FLOAT / QTY_TOTAL ELSE 0 END) *
        (CASE WHEN ACTIVITY_PRODUCTIVITY_STD > 0
              THEN LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0)
              ELSE 0 END)) * 100                                     AS plant_oee
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
  WHERE KEMAS_COMPLETED_AT::DATE BETWEEN $START_DATE AND $END_DATE
    AND ($PLANT IS NULL OR PLANT = $PLANT)
  GROUP BY PLANT
) p;


-- ============================================================
-- [RECONCILIATION] ALL KPIs IN ONE VIEW
-- ============================================================
--
-- Run this to get all current-period KPI values in one place
-- for side-by-side comparison with the dashboard.

WITH oee_by_plant AS (
  SELECT PLANT, AVG(
    (CASE WHEN QTY_TOTAL > 0 THEN QTY_FG_GOOD::FLOAT / QTY_TOTAL ELSE 0 END) *
    (CASE WHEN ACTIVITY_PRODUCTIVITY_STD > 0
          THEN LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0)
          ELSE 0 END)) * 100 AS oee
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
  WHERE KEMAS_COMPLETED_AT::DATE BETWEEN $START_DATE AND $END_DATE
    AND ($PLANT IS NULL OR PLANT = $PLANT)
  GROUP BY PLANT
),
gross_lt AS (
  SELECT AVG(gross_minutes) / 1440.0 AS avg_days
  FROM (
    SELECT PROCESS_ORDER_FG,
      DATEDIFF('minute',
        MIN(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_START END),
        MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' THEN ACTIVITY_STOP END)) AS gross_minutes
    FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
    WHERE PO_FG_DONE_DATE::DATE BETWEEN $START_DATE AND $END_DATE
      AND ($PLANT IS NULL OR PLANT = $PLANT)
    GROUP BY PROCESS_ORDER_FG
    HAVING MIN(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_START END) IS NOT NULL
      AND MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' THEN ACTIVITY_STOP END) IS NOT NULL
  ) s
)
SELECT
  ROUND(AVG(oee_by_plant.oee), 1)                                   AS oee_pct,
  ROUND(AVG(oee_by_plant.oee) * 0.8, 1)                             AS ope_pct_derived,
  ROUND((SELECT avg_days FROM gross_lt), 2)                          AS gross_lt_days,
  (SELECT ROUND(SUM(QTY_FG_RETUR) * 100.0 / NULLIF(SUM(QTY_TOTAL), 0), 1)
   FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
   WHERE KEMAS_COMPLETED_AT::DATE BETWEEN $START_DATE AND $END_DATE
     AND ($PLANT IS NULL OR PLANT = $PLANT))                         AS pack_loss_pct,
  (SELECT ROUND(ABS((SUM(THEORETICAL_QUANTITY) - SUM(REALIZATION_QUANTITY))
   / NULLIF(SUM(THEORETICAL_QUANTITY), 0)) * 100, 1)
   FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
   WHERE CORRECTION_DATE::DATE BETWEEN $START_DATE AND $END_DATE)   AS bulk_loss_pct,
  (SELECT ROUND(COUNT(CASE WHEN ACTIVITY <> 'ADJUST' THEN 1 END) * 100.0
   / NULLIF(COUNT(ACTIVITY), 0), 1)
   FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
   WHERE PO_FG_DONE_DATE::DATE BETWEEN $START_DATE AND $END_DATE
     AND ($PLANT IS NULL OR PLANT = $PLANT))                         AS rft_pct,
  (SELECT ROUND(AVG(E2E_PRODUCTIVITY), 1)
   FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
   WHERE KEMAS_COMPLETED_AT::DATE BETWEEN $START_DATE AND $END_DATE
     AND ($PLANT IS NULL OR PLANT = $PLANT))                         AS e2e_prod
FROM oee_by_plant;


-- ============================================================
-- 18. TROUBLESHOOTING
-- ============================================================

-- [TROUBLESHOOT] Why is OEE 0 or unexpectedly low?
-- Find records that contribute 0 to OEE (zero qty or no std)
SELECT
  PLANT,
  COUNT(CASE WHEN QTY_TOTAL = 0 OR QTY_TOTAL IS NULL THEN 1 END)   AS zero_qty_total,
  COUNT(CASE WHEN ACTIVITY_PRODUCTIVITY_STD = 0
                  OR ACTIVITY_PRODUCTIVITY_STD IS NULL THEN 1 END)  AS zero_std_productivity,
  COUNT(*)                                                           AS total_rows,
  ROUND(COUNT(CASE WHEN QTY_TOTAL = 0 OR QTY_TOTAL IS NULL THEN 1 END) * 100.0
    / NULLIF(COUNT(*), 0), 1)                                       AS pct_zero_qty
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
WHERE KEMAS_COMPLETED_AT::DATE BETWEEN $START_DATE AND $END_DATE
  AND ($PLANT IS NULL OR PLANT = $PLANT)
GROUP BY PLANT;


-- [TROUBLESHOOT] Why are there no Lead Time results?
-- Check if PO and RECEIVE NDC activities exist in the period
SELECT
  ACTIVITY,
  COUNT(*)                                                           AS row_count,
  MIN(ACTIVITY_START)                                               AS earliest_start,
  MAX(ACTIVITY_STOP)                                                AS latest_stop
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
WHERE PO_FG_DONE_DATE::DATE BETWEEN $START_DATE AND $END_DATE
  AND ($PLANT IS NULL OR PLANT = $PLANT)
GROUP BY ACTIVITY
ORDER BY row_count DESC;


-- [TROUBLESHOOT] What plants and date ranges actually exist in source tables?
-- Use when dashboard shows "no data" for a selected period/plant

SELECT
  'CT_MANUF_KEMAS' AS tbl,
  MIN(KEMAS_COMPLETED_AT::DATE) AS min_date,
  MAX(KEMAS_COMPLETED_AT::DATE) AS max_date,
  COUNT(DISTINCT PLANT) AS distinct_plants,
  LISTAGG(DISTINCT PLANT, ', ') WITHIN GROUP (ORDER BY PLANT) AS plants
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
UNION ALL
SELECT 'CT_MANUF_LEADTIME', MIN(PO_FG_DONE_DATE::DATE), MAX(PO_FG_DONE_DATE::DATE),
  COUNT(DISTINCT PLANT), LISTAGG(DISTINCT PLANT, ', ') WITHIN GROUP (ORDER BY PLANT)
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
UNION ALL
SELECT 'CT_MANUF_OLAH', MIN(OLAH_COMPLETED_AT::DATE), MAX(OLAH_COMPLETED_AT::DATE),
  COUNT(DISTINCT PLANT), LISTAGG(DISTINCT PLANT, ', ') WITHIN GROUP (ORDER BY PLANT)
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH
UNION ALL
SELECT 'CT_MANUF_E2E', MIN(KEMAS_COMPLETED_AT::DATE), MAX(KEMAS_COMPLETED_AT::DATE),
  COUNT(DISTINCT PLANT), LISTAGG(DISTINCT PLANT, ', ') WITHIN GROUP (ORDER BY PLANT)
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E;


-- ============================================================
-- 19. UNVERIFIED / NOT INCLUDED
-- ============================================================
--
-- The following are intentionally not included in this file.
--
-- a. Lead Time page KPIs (VA/NNVA/UNVA breakdown, stage chart,
--    Top SKU table, Pareto): The /lead-time page uses STATIC MOCK
--    DATA. There are no Snowflake queries to fact-check against.
--    See docs/KNOWN_ISSUES.md for the open issue.
--
-- b. OEE Sparkline and E2E Sparkline: These are weekly trend series
--    used for in-card charts. They are not KPI values to compare.
--    Covered by Section 4 and Section 12 summary queries above.
--
-- c. CT_MANUF_TRENDS table: Used in chart trend data queries
--    (getTrendKPIByPlant for 'output' and 'batch' cases, and
--    getLeadTimeTrend). This table is NOT documented in
--    docs/DATA_MODEL.md. Columns cannot be independently verified.
--    Use with caution.
--
-- d. E2E_PRODUCTIVITY column origin: CT_MANUF_E2E.E2E_PRODUCTIVITY
--    is pre-computed in Snowflake by an upstream process. The exact
--    LOD formula that produces it is not known at the application
--    level. We cannot do a raw-data recomputation.
--
-- e. PROCESS_ORDER_FG column in CT_MANUF_E2E: Present in the code
--    (used in getTrendKPIByPlant for 'e2e') but not documented in
--    docs/DATA_MODEL.md. Existence confirmed by working code.
