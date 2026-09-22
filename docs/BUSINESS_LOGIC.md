# Business Logic — Control Tower Manufacturing

Formula implementations live in `lib/queries.ts`. This document defines rules, thresholds, and business context that aren't derivable from the implementation alone.

---

## Filters

All KPI queries accept these filters, applied identically across every metric:

| Filter | Options | Notes |
|---|---|---|
| **Period** | YTD, 30D, 90D, 6M, Today, This Month, Last Month, This Week, Last Week, Custom | Custom uses a date-range picker. Implemented in `lib/queries.ts → periodDateWhere()`. |
| **Plant** | All Plant / specific plant name | "All Plant" → no plant filter applied. Specific plant → `AND PLANT = 'xxx'`. |
| **Data Level** | Daily / Weekly / Monthly | Controls grouping on trend charts. Does not affect KPI card values. |

Filters persist to `localStorage` key `ct-filters`. All KPI cards and charts respond to the same filter state simultaneously.

**Important exception:** `DATAMART_PRODUCTION_OUTPUT_OLAH` has no PLANT column. The plant filter is silently not applied for Bulk Output and Bulk Loss queries.

---

## KPI Definitions

### 1. Lead Time

**Definition:** Average calendar time (in days) from Production Order creation to receipt at NDC.

| Variant | Formula | Source |
|---|---|---|
| **Gross Lead Time** | `AVG(DATEDIFF('minute', PO activity start, RECEIVE NDC activity stop)) / 1440` | `CT_MANUF_LEADTIME`, date column: `PO_FG_DONE_DATE` |
| **Nett Lead Time** | `AVG(SUM(NET_LEADTIME per PO)) / 1440` | Same table, `ACTIVITY_TYPE = 'ACTUAL'` and `LINE_CATEGORY IS NOT NULL` only |

- Gross = total clock time including waiting.
- Nett = active processing time only.
- Both are averages across all Process Orders (`PROCESS_ORDER_FG`) in the period.
- A Process Order is only included if both the `PO` start and `RECEIVE NDC` stop are not null.

**Display:** KPI card shows Gross days with Nett as a sub-stat. Dashboard note: "PO → NDC receipt".

**Target:** ≤ 5 days (green), ≤ 15 days (amber), > 15 days (red).

---

### 2. Yield / Loss

#### 2a. Pack Loss % (pengemasan)
**Table:** `CT_MANUF_KEMAS`, date column: `KEMAS_COMPLETED_AT`

```
pack_loss_pct = SUM(QTY_FG_RETUR) / SUM(QTY_TOTAL) × 100
```

`QTY_FG_RETUR` = rejected/returned quantity. `QTY_TOTAL` = total quantity processed.

**Target:** ≤ 1% (green), ≤ 2% (amber), > 2% (red/critical).

#### 2b. Bulk Loss % (pengolahan)
**Table:** `DATAMART_PRODUCTION_OUTPUT_OLAH`, date column: `CORRECTION_DATE`
⚠️ Plant filter NOT applied (table has no PLANT column).

```
bulk_loss_pct = ABS((theoretical - realization) / theoretical) × 100
bulk_loss_kg  = theoretical - realization  (only when theoretical > realization)
```

**Target:** ≤ 3% (green), ≤ 5% (amber), > 5% (red/critical).

---

### 3. Right First Time (RFT)

**Definition:** Percentage of activities that were completed without requiring correction/rework.

**Table:** `CT_MANUF_LEADTIME`, date column: `PO_FG_DONE_DATE`

```
rft_pct = COUNT(ACTIVITY ≠ 'ADJUST') / COUNT(ACTIVITY) × 100
```

`ACTIVITY = 'ADJUST'` marks a correction record. Non-ADJUST activities are first-time successes.

**Target:** ≥ 95% (green), ≥ 90% (amber), < 90% (red/critical).

---

### 4. Output

| Variant | Table | Formula | Unit |
|---|---|---|---|
| **FG Output** | `DATAMART_PRODUCTION_OUTPUT_FG` | `SUM(QUANTITY)` | pcs |
| **Bulk Output** | `DATAMART_PRODUCTION_OUTPUT_OLAH` | `SUM(REALIZATION_QUANTITY)` | kg |

Date columns: `CORRECTION_DATE` for both.
⚠️ Both tables have no PLANT column — plant filter not applied.

No threshold color coding — Output is informational.

---

### 5. OEE — Overall Equipment Effectiveness

**Table:** `CT_MANUF_KEMAS`, date column: `KEMAS_COMPLETED_AT`

```
Quality     = QTY_FG_GOOD / QTY_TOTAL                               (per row)
Performance = LEAST(PRODUCTIVITY / ACTIVITY_PRODUCTIVITY_STD, 1.0)  (capped at 100%)
OEE         = Quality × Performance                                  (per row, then AVG)
```

OEE is computed per row (per activity), then averaged across all rows and plants.
The dashboard card shows a single average OEE across all selected plants.
`byPlant` array provides per-plant breakdown for the Hero OEE card sub-metrics.

**Derived Availability** (shown in Hero card):
```
Availability = OEE / (Performance × Quality) × 100
```
This is derived from the three measured components — not a separate Snowflake query.

**Target:** ≥ 65% (green/on-target), < 65% (red/below-target).

---

### 6. OPE — Overall Plant Effectiveness

**Definition:** An estimate of whole-plant effectiveness.

```
OPE = OEE × 0.8
```

This is a **derived estimate** — there is no separate Snowflake query. The 0.8 factor approximates capacity utilization and planned downtime losses not captured in equipment-level OEE.

**Target:** ≥ 60% (green), < 60% (amber).

---

### 7. Productivity

Three variants, all computed server-side:

| Variant | Table | Formula | Unit |
|---|---|---|---|
| **E2E** | `CT_MANUF_E2E` | `AVG(E2E_PRODUCTIVITY)` — pre-computed in source | pcs/mh |
| **Downstream** | `CT_MANUF_KEMAS` | Per PO: `SUM(QTY_FG_GOOD) / (SUM(LEADTIME_IN_MINUTE)/60) / MAX(OPERATOR_COUNT)`, then `AVG` across POs | pcs/mh |
| **Upstream** | `CT_MANUF_OLAH` | 3-level LOD aggregate (activity → position → SFG); see `lib/queries.ts` for full SQL | kg/mh |
| **Manhours** | `CT_MANUF_KEMAS` | `SUM(LEADTIME_IN_MINUTE / 60 × OPERATOR_COUNT)` | hours |
| **Avg Operators** | `CT_MANUF_KEMAS` | `ROUND(AVG(OPERATOR_COUNT))` | operators |

The dashboard card shows E2E productivity as the headline value, with Manhours and Avg Operators as sub-stats.

---

## Alert Thresholds

Defined in `lib/alerts.ts → THRESHOLDS`. Alerts auto-generate on data load; critical alerts are auto-sent to Microsoft Teams.

| KPI | Warning | Critical | Direction |
|---|---|---|---|
| **Lead Time (trend)** | > +5% increase | > +15% increase | Higher is worse |
| **Bulk Loss** | > 3% | > 5% | Higher is worse |
| **Pack Loss** | > 1% | > 2% | Higher is worse |
| **RFT** | < 95% | < 90% | Lower is worse |
| **OEE** | < 65% | < 55% | Lower is worse |

Alert rules:
- Each alert has a unique `id`. The same alert is not re-sent in a single session.
- Alerts can be dismissed in the UI (undo available for 5 seconds).
- Only `critical` severity alerts are auto-sent to Teams. Warning alerts show in the UI only.
- Lead Time alerts are trend-based (% change). Yield and RFT/OEE alerts are absolute-value-based.
- Lead Time comparison period: **not explicitly defined** — requires verification against `lib/alerts.ts` and `app/api/dashboard/kpi/route.ts` to confirm what the "previous period" is.

---

## Lead Time Classification (VA / NNVA / UNVA)

Used in the Lead Time page stage breakdown:

| Class | Color | Meaning |
|---|---|---|
| **VA** (Value-Adding) | `#215AA8` (Paragon Blue) | Activities that directly transform the product |
| **NNVA** (Non-Necessary Value-Adding) | `#d97706` (amber) | Required but non-transforming activities (QC, transport) |
| **UNVA** (Unnecessary Non-Value-Adding) | `#b91c1c` (red) | Pure waste: waiting, rework, approval queues |

Lead Time page uses static mock data — VA/NNVA/UNVA classification is hardcoded in `components/monitor/LeadTimeMonitor.tsx` and `app/lead-time/page.tsx`.

---

## Trend Calculations

Trend = `(current_period - previous_period) / previous_period × 100` (% change).

A positive trend for Lead Time means it got longer (worse). The alert logic inverts this: `leadTimeTrendWorse = -kpi.leadTime.trend` before threshold comparison.

Trend values are computed in the API route (`app/api/dashboard/kpi/route.ts`) by comparing two consecutive periods using the same query.

---

## SPC Control Limits (Charts)

Statistical Process Control limits are shown on the Trend Chart as UCL / Mean / LCL bands.

```
mean  = average of all values
stdev = standard deviation
UCL   = mean + 2 × stdev
LCL   = mean - 2 × stdev
```

Per-plant limits are computed separately (`computePerPlantLimits` in `lib/chartConfig.ts`). The control zone between UCL and LCL is rendered as a filled band in `#E9EFF6` (brand-50).

Status legend in StackedBarChart: "In Control" (emerald), "Above UCL" (red), "Below LCL" (amber).

---

## Data Refresh & Caching

- KPI data cached for **1 hour** via `unstable_cache` from Next.js (`revalidate: 3600`). Cache key includes plant + date range.
- AI Summary cached for **5 hours** (server-side).
- Chart trend data: same 1-hour cache.
- Cache can be manually invalidated via `/api/cache/revalidate` (protected route).
- Dashboard auto-refreshes every 1 hour. Users can force refresh via the header refresh button.
- Inactivity auto-logout after 15 minutes (via `Sidebar.tsx` event listeners).
