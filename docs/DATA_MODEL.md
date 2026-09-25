# Data Model — Control Tower Manufacturing

## Snowflake Connection

- **Account:** yb58945.ap-southeast-3.aws (Jakarta region)
- **Schema 1:** `MIGRATION.CONTROL_TOWER` — manufacturing process data
- **Schema 2:** `DATAMART.MANUFACTURE` — production output summaries

Connection managed via `lib/snowflake.ts` using the `snowflake-sdk`. All queries use parameterized bindings (`?` placeholders) — never string concatenation for user-supplied values.

---

## Tables

### `MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME`

Source for: Lead Time, Right First Time (RFT), Lead Time position breakdown.

| Column | Type | Description |
|---|---|---|
| `PROCESS_ORDER_FG` | string | Finished Goods process order ID (grouping key) |
| `ACTIVITY` | string | Activity type. `'PO'` = order start, `'RECEIVE NDC'` = endpoint, `'ADJUST'` = rework |
| `ACTIVITY_TYPE` | string | `'ACTUAL'` = real work, other values indicate planned/estimated |
| `ACTIVITY_START` | timestamp | When the activity started |
| `ACTIVITY_STOP` | timestamp | When the activity ended |
| `NET_LEADTIME` | number | Active lead time in minutes for this activity row |
| `LINE_CATEGORY` | string | Production line category. NULL = non-production activities |
| `POSITION` | string | Production position/stage name |
| `PO_FG_DONE_DATE` | date | **Date filter column** — completion date of the process order |
| `PLANT` | string | Plant identifier |

**Gross LT:** spans from `MIN(ACTIVITY_START where ACTIVITY='PO')` to `MAX(ACTIVITY_STOP where ACTIVITY='RECEIVE NDC')` per `PROCESS_ORDER_FG`.

**Nett LT:** `SUM(NET_LEADTIME)` where `ACTIVITY_TYPE = 'ACTUAL'` and `LINE_CATEGORY IS NOT NULL`.

**RFT:** `COUNT(ACTIVITY ≠ 'ADJUST') / COUNT(ACTIVITY)`.

---

### `MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS`

Source for: Pack Loss, OEE, Downstream Productivity, Sparklines, Manhours.

| Column | Type | Description |
|---|---|---|
| `PROCESS_ORDER_FG` | string | FG process order ID |
| `QTY_FG_GOOD` | number | Accepted good quantity |
| `QTY_FG_RETUR` | number | Rejected/returned quantity |
| `QTY_TOTAL` | number | Total processed quantity |
| `PRODUCTIVITY` | number | Actual productivity (pcs per hour per operator) |
| `ACTIVITY_PRODUCTIVITY_STD` | number | Standard/target productivity |
| `LEADTIME_IN_MINUTE` | number | Actual working time in minutes |
| `OPERATOR_COUNT` | number | Number of operators |
| `KEMAS_COMPLETED_AT` | timestamp | **Date filter column** |
| `PLANT` | string | Plant identifier |

**OEE per row:** `(QTY_FG_GOOD/QTY_TOTAL) × LEAST(PRODUCTIVITY/ACTIVITY_PRODUCTIVITY_STD, 1.0)`

**Pack Loss:** `SUM(QTY_FG_RETUR) / SUM(QTY_TOTAL) × 100`

**Downstream Productivity per PO:** `SUM(QTY_FG_GOOD) / (SUM(LEADTIME_IN_MINUTE)/60) / MAX(OPERATOR_COUNT)`

---

### `MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH`

Source for: Upstream Productivity.

| Column | Type | Description |
|---|---|---|
| `PROCESS_ORDER_SFG` | string | Semi-Finished Goods (Bulk) process order ID |
| `POSITION` | string | Production position/stage |
| `ACTIVITY` | string | Activity name |
| `ACTIVITY_ID` | string | Activity instance ID |
| `RELEASE_BULK` | number | Bulk quantity released (kg). NULL on non-release rows |
| `LEADTIME_IN_MINUTE` | number | Working time in minutes for this activity |
| `OPERATOR_COUNT` | number | Operator count |
| `OLAH_COMPLETED_AT` | timestamp | **Date filter column** |
| `PLANT` | string | Plant identifier |

Upstream productivity is computed via a 3-level LOD aggregate (activity → position → SFG). See `lib/queries.ts` for full SQL implementation.

---

### `MIGRATION.CONTROL_TOWER.CT_MANUF_E2E`

Source for: E2E Productivity, E2E Sparkline.

| Column | Type | Description |
|---|---|---|
| `E2E_PRODUCTIVITY` | number | Pre-computed end-to-end productivity (pcs/manhour) |
| `KEMAS_COMPLETED_AT` | timestamp | **Date filter column** |
| `PLANT` | string | Plant identifier |

`E2E_PRODUCTIVITY` is pre-computed in Snowflake — we simply `AVG()` it.

---

### `DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH`

Source for: Bulk Output (kg), Bulk Loss.

| Column | Type | Description |
|---|---|---|
| `REALIZATION_QUANTITY` | number | Actual bulk produced (kg) |
| `THEORETICAL_QUANTITY` | number | Expected/planned bulk quantity (kg) |
| `CORRECTION_DATE` | date | **Date filter column** |

⚠️ **This table has no PLANT column.** Plant filter is not applied here. Data covers all plants combined.

---

### `DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_FG`

Source for: FG Output (pcs).

| Column | Type | Description |
|---|---|---|
| `QUANTITY` | number | Finished Goods quantity produced (pcs) |
| `CORRECTION_DATE` | date | **Date filter column** |

⚠️ **This table has no PLANT column.** Plant filter is not applied here.

---

## Date Column Reference

| KPI | Table | Date Column |
|---|---|---|
| Lead Time, RFT | `CT_MANUF_LEADTIME` | `PO_FG_DONE_DATE` |
| Pack Loss, OEE, Downstream Prod, Manhours, OEE Sparkline | `CT_MANUF_KEMAS` | `KEMAS_COMPLETED_AT` |
| E2E Productivity, E2E Sparkline | `CT_MANUF_E2E` | `KEMAS_COMPLETED_AT` |
| Upstream Productivity | `CT_MANUF_OLAH` | `OLAH_COMPLETED_AT` |
| Bulk Loss, Bulk Output | `DATAMART_PRODUCTION_OUTPUT_OLAH` | `CORRECTION_DATE` |
| FG Output | `DATAMART_PRODUCTION_OUTPUT_FG` | `CORRECTION_DATE` |

---

## API Response Structure

The `/api/dashboard/kpi` endpoint returns a single JSON object:

```typescript
interface KPIResponse {
  leadTime: {
    grossDays: number;
    nettDays: number;
    grossTrend: number | null;   // % change vs previous period
    nettTrend: number | null;
  };
  yield: {
    bulkLossPct: number;
    packLossPct: number;
    bulkLossKg: number;
    bulkLossTrend: number | null;
    packLossTrend: number | null;
  };
  rightFirstTime: {
    value: number;               // percentage
    trend: number | null;
  };
  output: {
    bulkQty: number;             // kg
    fgQty: number;               // pcs
    fgTrend: number | null;
    bulkTrend: number | null;
  };
  oee: {
    value: number;               // percentage, overall avg
    quality: number;             // percentage
    performance: number;         // percentage
    byPlant: { PLANT: string; OEE: number }[];
    trend: number | null;
    sparkline: number[];         // weekly OEE values
  };
  productivity: {
    e2e: number;                 // pcs/mh
    upstream: number;            // kg/mh
    downstream: number;          // pcs/mh
    manhours: number;            // total hours
    avgOperators: number;
    e2eTrend?: number | null;
    sparkline: number[];         // weekly E2E values
  };
}
```

---

## Known Data Limitations

1. **No PLANT column in OLAH/FG output tables**: Bulk Output, FG Output, and Bulk Loss data cannot be filtered by plant. These always return all-plant totals.

2. **Lead Time page partially uses static mock data**: the Strategic KPI cards read `CT_MANUF_LEADTIME` (`getLeadTimeKPI`, `getLeadTimeComposition` — VA/NNVA/UNVA from `ACTIVITY_CATEGORY`). Charts, stage breakdown, Top SKU in `app/lead-time/page.tsx` and all of `components/monitor/LeadTimeMonitor.tsx` are still hardcoded.

3. **E2E_PRODUCTIVITY is pre-aggregated**: The `CT_MANUF_E2E` table provides pre-computed productivity. We do not know what exact LOD calculation produces it, unlike Upstream Productivity where we control the 3-level aggregate.

4. **Trend comparison requires two-period queries**: Trend % is computed by running each KPI query twice (current period + previous period). There is no dedicated "previous period" column in the source tables.

5. **Azure AD plant-level access control not implemented**: `docs/SECURITY.md §2` describes a future role mapping (`allowedPlants` from AD group membership), but it is not yet implemented. All authenticated users can query any plant.
