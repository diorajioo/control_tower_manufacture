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

**Production day (since 2026-11-02, user definition):** a day runs **07:00 → 07:00 WIB** (shift 1 starts at 07:00), so a week starts **Monday 07:00** and a month at 07:00 on the 1st. Every date filter and every week / month bucket on a timestamp column uses `prodDate(col)` = `DATEADD('hour', -7, col)::DATE` (`lib/productionDay.ts`); "today" is `prodDate(CURRENT_TIMESTAMP())`, so before 07:00 the dashboard still shows the previous day. The Header presets (`prodDay()` / `prodToday()`) count the same way. Timestamp columns: `PO_FG_DONE_DATE`, `KEMAS_COMPLETED_AT`, `OLAH_COMPLETED_AT`. **Output cannot follow it:** `CORRECTION_DATE` in both Output datamarts is a DATE with no time, so Output days are whatever the datamart ETL assigns (to be checked with the data team). The Snowflake session runs in WIB; on ClickHouse `now()` uses the server time zone.

Filters persist to `localStorage` key `ct-filters`. All KPI cards and charts respond to the same filter state simultaneously.

**Output datamarts (since 2026-11-02):** `DATAMART_PRODUCTION_OUTPUT_FG` and `DATAMART_PRODUCTION_OUTPUT_OLAH` have no PLANT column, but each material form is made in one plant — YTD 2026 FG: LIQUID 100% J2, SEMISOLID 99% J4, POWDER 100% J1, form "J6" = J6. **Output's plant = the plant of the row's `MATERIAL_FORM_NAME`** (`OUTPUT_FORM_PLANT` / `OUTPUT_PLANT_SQL` in `lib/queries.ts`; a form not in the map → "(Not set)"). The plant filter, the Output per Plant donut, Metric Trend By plant and the AI plant drivers all use it, so they agree to the unit and add up to the card. The UI always says plant, never form (user decision 2026-11-02). Update the map if a form moves plant; replace it once the datamarts carry a plant. **Bulk Loss** still ignores the plant filter.

---

## KPI Definitions

### 1. Lead Time

**Definition:** Average calendar time (in days) from Production Order creation to receipt at NDC.

| Variant | Formula | Source |
|---|---|---|
| **Gross Lead Time** | `AVG(DATEDIFF('minute', PO activity start, RECEIVE NDC activity stop)) / 1440` | `CT_MANUF_LEADTIME`, date column: `PO_FG_DONE_DATE` |
| **Nett Lead Time** | per PO: first Weighing start → last Receive NDC stop, minus the WIP time in that window; `AVG / 1440` | Same table, every row type (`ltNettPerPoSql()` on `ltSplitSql()`; start = `NETT_START_AT_SQL`, `lib/leadTimeDefinition.ts`) |

- Gross = total clock time including waiting.
- Nett (user definition 2026-11-03) = first Weighing → last Receive NDC, **excluding all WIP**; WAITING inside production counts, PO (admin / release) is before the window. Processes: Weighing + Mixing + Filpac + Receive NDC. A PO without Weighing (~6% YTD) starts at its first activity that is neither PO nor WIP. Gross − Nett = PO + WIP (+ any time before Weighing).
- Until 2026-11-03 nett was `SUM(NET_LEADTIME)` of ACTUAL rows with a LINE_CATEGORY (network YTD 5.03 d; overlapping Receive NDC rows inflated it). Now 2.34 d.
- The process columns show the split of the metric picked in the Gross / Nett toggle and add up to that column. Per process, the nett split equals the gross split inside the nett window; PO and WIP are 0 on Nett.
- Both are averages across all Process Orders (`PROCESS_ORDER_FG`) in the period.
- A Process Order is only included if both the `PO` start and `RECEIVE NDC` stop are not null.

**Display:** KPI card shows Gross days with Nett as a sub-stat. Dashboard note: "PO → NDC receipt".

**Target:** ≤ 5 days (green), ≤ 15 days (amber), > 15 days (red).

#### Lead Time basis — PO Created vs PO Released (`lib/leadTimeDefinition.ts`)

A PO has two phases: **PO Created → PO Released** (administration / release) and **PO Released → Receive NDC**
(manufacturing). Manufacturing measures lead time **from PO Released**, and the **13-day target
(`LEAD_TIME_TARGET_DAYS`) applies to Released → NDC**.

- **Current state (2026-09-30):** every query still measures **Created → NDC** (`LEAD_TIME_BASIS = "created"`), because the
  PO Released identifier is not confirmed yet. So the 13-day target is currently compared against Created → NDC.
- **Hypothesis:** the single `ACTIVITY = 'PO'` row per PO (POSITION `PO`, sequence 1, NNVA) has `ACTIVITY_START` = created and
  `ACTIVITY_STOP` = released. It is internally consistent: Created → Released + Released → NDC = Created → NDC exactly.
- All gross lead time SQL uses `LEAD_TIME_START_SQL` / `NDC_RECEIVED_AT_SQL` from that module (no inline copies).
  `getLeadTimePhases()` in `lib/queries.ts` returns both phases side by side (not wired to the UI yet).
- Measured with the hypothesis (All Plant):

| Period | Created → Released | Released → NDC | Created → NDC | POs > 13 d (Released basis) | POs > 13 d (Created basis) |
|---|---|---|---|---|---|
| Sep 2026 | 8.98 d | 7.97 d | 16.95 d | 13.5% | 53.4% |
| YTD 2026 | 6.55 d | 9.53 d | 16.08 d | 19.5% | 48.8% |

**Switching to Released → NDC** (after the identifier is confirmed): (1) point `PO_RELEASED_AT_SQL` at the confirmed field if the
hypothesis is wrong, (2) set `LEAD_TIME_BASIS = "released"`, (3) bump the lead-time cache keys, (4) update this section.
Then show Created → Released as its own metric on the Lead Time page.
**Decision (2026-09-30):** the `PO` stage stays in the per-stage breakdowns ("Lead time per stage", composition) — it is shown
as its own stage, so stage totals are Created-based even after the gross KPI switches to Released.

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
⚠️ Plant filter NOT applied to Bulk Loss (Output uses the PO's plant — see Filters).

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
Plant: the plant of the row's form (see Filters → Output datamarts).

**One source per variant (since 2026-11-02):** every FG visual — card, Metric Trend, Tactical total, SKU & PO, per plant, trend, per line, per brand / variant / SKU group, top SKU — reads `DATAMART_PRODUCTION_OUTPUT_FG` (`fgRows()`), so each breakdown adds up to the card. FG: PO = `SNFG_NAME`, SKU = `COITEM_CODE` / `FINISHED_GOOD_NAME`, line = `LINE_NAME` (filling / packing line), brand / variant = `PRODUCT_BRAND_NAME` / `VARIANT_NAME`, form = `MATERIAL_FORM_NAME`; SKU group is not in the datamart and comes from the PO's lead time rows. Rows without a line / brand show as "(Not set)". Before, the FG breakdowns read `RELEASE_QTY` per PO from the lead time data on `PO_FG_DONE_DATE` (brand / SKU off by 0.3–2% from the card) and the per-line chart counted a PO on every line of its route (weighing, mixing, filling) — LWO01 showed 224 M pcs YTD against a 349 M total.

**Tactical Output section, FG / Bulk toggle:** every visual (Total & Achievement, SKU & PO, per plant, trend, per line, per brand / variant, top SKU) follows the toggle, the Header filters and the section's click filter. Bulk reads only `DATAMART_PRODUCTION_OUTPUT_OLAH` (kg, `CORRECTION_DATE`): PO = `NOMO_NAME` (bulk process order), SKU = `COITEM_BULK_CODE`, form = `MATERIAL_FORM_NAME`, line = `LINE_NAME` (mixing line), brand / variant = `PRODUCT_BRAND_NAME` / `VARIANT_NAME`; no SKU group. Bulk achievement = realized ÷ theoretical kg (`THEORETICAL_QUANTITY`), gap = realized − theoretical; the trend draws theoretical kg as the dashed line. FG has no theoretical quantity yet.

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
| **E2E** | `CT_MANUF_E2E` | Per row `QTY_KEMAS / (UPSTREAM_LEADTIME_IN_HOUR × UPSTREAM_OPERATOR + DOWNSTREAM_LEADTIME_IN_HOUR × DOWNSTREAM_OPERATOR)`, then `AVG` over rows with qty > 0 and manhour > 0 (`E2E_ROW_SQL` / `E2E_VALID_SQL`; UNBOXING is outside the table's upstream / downstream) | pcs/mh |
| **Downstream** | `CT_MANUF_KEMAS` | Per PO: `SUM(QTY_FG_GOOD) / (SUM(LEADTIME_IN_MINUTE)/60) / MAX(OPERATOR_COUNT)`, then `AVG` across POs | pcs/mh |
| **Upstream** | `CT_MANUF_OLAH` | 3-level LOD aggregate (activity → position → SFG); see `lib/queries.ts` for full SQL | kg/mh |
| **Manhours** | `CT_MANUF_KEMAS` | `SUM(LEADTIME_IN_MINUTE / 60 × OPERATOR_COUNT)` | hours |
| **Avg Operators** | `CT_MANUF_KEMAS` | `ROUND(AVG(OPERATOR_COUNT))` | operators |

The dashboard card shows E2E productivity as the headline value, with Manhours and Avg Operators as sub-stats.

**Overview card toggle — E2E · Mixing · Filpac** (`getStageProductivity()` in `lib/queries.ts`; sub-stat Upstream · Downstream stays on every view):

| View | Table / filter | Formula | Unit | Date column |
|---|---|---|---|---|
| **E2E** | `CT_MANUF_E2E` | as above | pcs/mh | `KEMAS_COMPLETED_AT` |
| **Mixing** | `CT_MANUF_OLAH`, `ACTIVITY = 'MIXING'` | `Σ RELEASE_BULK / Σ MANHOUR` — RELEASE_BULK taken once per `PROCESS_ORDER_SFG` (it repeats on every row), MANHOUR summed (one row per operator) | kg/mh | `OLAH_COMPLETED_AT` |
| **Filpac** | `CT_MANUF_KEMAS`, `ACTIVITY = 'FILPAC'` | `Σ QTY_FG_GOOD / Σ (LEADTIME_IN_MINUTE/60 × OPERATOR_COUNT)` — taken once per `ACTIVITY_ID` | pcs/mh | `KEMAS_COMPLETED_AT` |

`CT_MANUF_KEMAS` has **one row per operator** (same qty, minutes and OPERATOR_COUNT on each), so Filpac must be deduplicated per `ACTIVITY_ID`; summing raw rows over-weights activities with many operators (Sep 2026: 172 vs 222 pcs/mh). Trend = % vs the prior period of equal length; sparkline = weekly.

**Metric Trend (Overview)** follows the card toggle (since 2026-11-06): the same three formulas per week / month (`getTrendKPIByPlant()`, kpiType `productivity` / `upstream` / `downstream`). By plant = each unit's (SFG / activity) plant; "All plants" = all units pooled (Σ / Σ), so its last point equals the card.

**E2E formula (since 2026-11-09):** recomputed from the `CT_MANUF_E2E` columns (row above) instead of the source's `E2E_PRODUCTIVITY`. Card, sparkline, Metric Trend, AI plant drivers and chat share `E2E_ROW_SQL` / `E2E_VALID_SQL` (`lib/queries.ts`). It stays a per-row average (a Σ qty / Σ manhour version was tried and reverted on 2026-11-09), so E2E is not volume-weighted like Mixing and Filpac.

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
| **VA** (Value-Adding) | `#1E4076` (Paragon Blue) | Activities that directly transform the product |
| **NNVA** (Non-Necessary Value-Adding) | `#d97706` (amber) | Required but non-transforming activities (QC, transport) |
| **UNVA** (Unnecessary Non-Value-Adding) | `#b91c1c` (red) | Pure waste: waiting, rework, approval queues |

Classification comes from `CT_MANUF_LEADTIME.ACTIVITY_CATEGORY` (values `VA` / `NNVA` / `UNVA`).

**Lead Time page — Strategic KPI cards** (`getLeadTimeComposition()` in `lib/queries.ts`, served via `leadTime.composition` in `/api/dashboard/kpi`):

| Card | Formula |
|---|---|
| Value-Added | `AVG(SUM(NET_LEADTIME) per PO WHERE ACTIVITY_CATEGORY = 'VA') / 1440` |
| Necessary Non-Value-Added | Same, `ACTIVITY_CATEGORY = 'NNVA'` |
| Waste | Same, `ACTIVITY_CATEGORY = 'UNVA'` |
| Potential Saving | Same, `ACTIVITY_CATEGORY = 'UNVA' AND ACTIVITY_TYPE = 'WIP'` (time saved if all WIP were removed) |

Date column `PO_FG_DONE_DATE`, plant filter applied. Trend = % change vs previous period.

**Card color is fixed, not rule-based** (`components/dashboard/LeadTimeCategoryCard.tsx`): Value-Added = green, NNVA = amber, Waste = red, Potential Saving = green. No status pill, no target; trend arrow follows the sign of the change vs previous period. "% dari total" = category / (VA + NNVA + Waste); Potential Saving shows WIP as % of Waste. Sparkline = monthly average per category (`getLeadTimeCompositionMonthly()`, month of `PO_FG_DONE_DATE`). Activities run in parallel, so VA + NNVA + Waste can exceed Gross Lead Time — values are raw durations, not shares of lead time.

**Lead Time page — Strategic charts** (`/api/lead-time/charts`, cached 1 h, tag `kpi`):

| Chart | Formula |
|---|---|
| Tren lead time — Total | `getLeadTimeWeekly()`: weekly AVG gross lead time per PO (same as the Lead Time card sparkline) |
| Tren lead time — per `POSITION` | `getLeadTimeWeeklyByPosition()`: per PO + POSITION `SUM(NET_LEADTIME)`, AVG across POs that have that position, per week of `PO_FG_DONE_DATE` |
| Lead time vs jumlah PO per SKU | `getLeadTimeBySku()`: per `PRODUCT_CODE`, X = `COUNT(DISTINCT PROCESS_ORDER_FG)`, Y = AVG gross lead time (days); only SKUs with fewer than 100 POs in the period (the former ≥10 lower bound was removed 2026-09-26) (info icon on the chart explains the limits) |
| Top 10 SKU by lead time | `getLeadTimeTopSku()`: per PO gross lead time (PO start → RECEIVE NDC stop) + SUM(NET_LEADTIME) per `ACTIVITY_CATEGORY`; per `PRODUCT_CODE` with **≥5 POs**: AVG / P10 / P90 (`PERCENTILE_CONT`) of gross days, AVG VA / NNVA / UNVA. Top 10 by AVG gross. Composition view splits the average gross proportionally by the VA / NNVA / UNVA share (category sums overlap because activities run in parallel, often exceeding gross). Range view = P10–P90 with average marker |

**Lead time per stage (Pareto)** — `getLeadTimeByStageCategory()`, component `components/dashboard/LeadTimeStageChart.tsx`:
- Per `POSITION` × `ACTIVITY_CATEGORY` (VA / NNVA / UNVA): `SUM(NET_LEADTIME) / COUNT(DISTINCT PROCESS_ORDER_FG in period) / 1440` = days per PO, so bars add up to the average total per PO (≈ VA + NNVA + Waste of the cards).
- WIP rows (`WIP AFTER <activity>`) are mapped to the stage of that activity. **Stage** view folds WIP into that stage (as UNVA); **Stage + WIP** view shows WIP as its own bar.
- Category filter (UNVA / NNVA / VA / All) keeps only that segment and re-sorts. Bars sorted descending; line = cumulative % of the shown total (right axis).
- Date `PO_FG_DONE_DATE`, plant filter applied. Stage display names: `lib/leadTimeStages.ts`.

The rest of the Lead Time page (Top/Bottom SKU tables, on-time trend, SKU Pareto, Tactical/Operational views) and `components/monitor/LeadTimeMonitor.tsx` still use static mock data.

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
UCL   = mean + 3 × stdev
LCL   = max(0, mean - 3 × stdev)
```

Per-plant limits are computed separately (`computePerPlantLimits` in `lib/chartConfig.ts`) and shown in the tooltip. Limits are hairline markers, no shaded band.

**All Overview trend metrics are control charts** (since 2026-10-06), each with an Overall view (the API's exact "All plants" row per period — `GROUPING SETS ((WEEK, PLANT), (WEEK))` in `getTrendKPIByPlant()`) and a By plant view:

| Metric | Chart | Plotted value | n per point |
|---|---|---|---|
| Lead Time | Laney P′ | % PO with gross > 13 days | POs |
| RFT | Laney P′ | % activities without ADJUST | activity rows |
| Output | XmR | Σ released FG pcs | — |
| OEE / OPE | XmR | OEE % (OPE = × 0.8) | — |
| Yield Loss | XmR | bulk loss % = ABS(Σ theoretical − Σ realization) / Σ theoretical | — (no PLANT → Overall only) |

XmR: center = mean of the plotted points, UCL/LCL = mean ± 2.66 × average moving range, clamped to 0 (and 100 for %). YTD to 27 Sep 2026 (All plants): Lead Time 1 / 38 weeks outside, Output 1, OEE 2, Yield Loss 1. RFT is 100% in every week (no ADJUST rows in the data), so its P′ limits are undefined and none are drawn.

**Lead Time = Laney P′ chart of % PO > 13 days** (since 2026-10-06, Overview TrendChart and Strategic Monitor). Each point i is the share of its nᵢ POs (done in that week/month, per plant) with gross lead time > `LEAD_TIME_TARGET_DAYS`:

```
pᵢ     = lateᵢ / nᵢ                    p̄ = Σ lateᵢ / Σ nᵢ          (per plant)
σpᵢ    = √( p̄(1 − p̄) / nᵢ )           zᵢ = (pᵢ − p̄) / σpᵢ
σz     = mean |zᵢ − zᵢ₋₁| / 1.128      (Laney: week-to-week variation the process normally has)
UCLᵢ   = min(100%, p̄ + 3 · σpᵢ · σz)  LCLᵢ = max(0, p̄ − 3 · σpᵢ · σz)
```

nᵢ / lateᵢ come from `getTrendKPIByPlant()` (`N`, `LATE`; `KPI_VALUE` stays avg days) → `/api/dashboard/trends` `pointStats` → `laneyPLimits()` in `components/charts/StandardLine.tsx`. Gross basis = `LEAD_TIME_START_SQL` (PO Created). Classic p limits (σz = 1) are far too narrow with 20–300 POs per week: YTD to 27 Sep 2026 they flag 71 of 148 plant-weeks on the Created basis; Laney flags 2. On the Released basis (where the 13-day target is defined) classic flags 34 and Laney 10.

Status legend in StackedBarChart: "In Control" (emerald), "Above UCL" (red), "Below LCL" (amber).

---

## Data Refresh & Caching

- KPI data cached for **1 hour** via `unstable_cache` from Next.js (`revalidate: 3600`). Cache key includes plant + date range.
- AI Summary cached for **5 hours** (server-side).
- Chart trend data: same 1-hour cache.
- Cache can be manually invalidated via `/api/cache/revalidate` (protected route).
- Dashboard auto-refreshes every 1 hour. Users can force refresh via the header refresh button.
- Inactivity auto-logout after 15 minutes (via `Sidebar.tsx` event listeners).


## Lead Time On-Time % (Overview Tactical)

Share of POs whose gross lead time (PO start → RECEIVE NDC stop) is ≤ 13 days, the Lead Time target used in the Tactical plant table. The start follows the Header basis toggle, which shows only in Tactical: PO Created (default) or PO Released (`basis` param on `/api/lead-time/stages`). The Overview Lead Time card is fixed to PO Created. Constant `LEAD_TIME_TARGET_DAYS` in `app/api/lead-time/stages/route.ts`; query `getLeadTimeByPlant()` in `lib/queries.ts`. Provisional: `CT_MANUF_LEADTIME` has no due-date column, so this is not a delivery on-time rate.


## Plant of a PO (lead time)

A PO belongs to its **last plant**: the `PLANT` of its `CT_MANUF_LEADTIME` row with the highest `ACTIVITY_SEQUENCE` (latest `ACTIVITY_STOP` on ties) — normally the plant that did RECEIVE NDC. Applies to every lead time figure per plant and to the plant filter (`LT_TABLE` in `lib/queries.ts`). Decided 2026-10-13; before that, ~145 POs made in one plant and packed in another dropped out of per-plant lead time.


## Lead Time page filters and the process sunburst (2026-10-13)

- **Dimension filters** (No. PO, Activity, Line category, Line, SKU group, SKU, Variant) select whole POs: a PO is kept when it has at least one `CT_MANUF_LEADTIME` row matching each set value; every figure is then computed on those POs with all their activities. Activity also limits the sunburst and the Pareto to that activity.
- **Lead Time card**: average per PO — gross = Scope start (PO Created or Released) → RECEIVE NDC; nett = first Weighing → Receive NDC minus WIP. Median and P25–P75 over the same POs. Status: gross vs 13-day target (on track / ≤ +15% at risk / above); nett has no target → change vs prior period.
- **Sunburst** (time per group process and process): the lead time split below, so the slices add up to the Lead Time card (gross or nett per PO). Groups = `PROCESS_GROUPS`; the PO group is left out for Scope = PO Released. Each slice wide enough for the text shows its value (back 2026-11-03); the centre shows no total.

## Lead time split per process (since 2026-11-02)

One rule for the plant table ("Lead time breakdown per plant", Group Process and Process), the PO table, the sunburst, the Pareto, the box plot, the VA / NNVA / UNVA composition (Lead Time page card + Tactical donut) and the Top SKU split — `ltSplitSql()` in `lib/queries.ts`. Each follows Scope (PO Created / Released) and Basis (gross / nett):

- **Gross** — every minute of a PO's gross window (Scope start → RECEIVE NDC) belongs to exactly one activity row: the row that started last. Rows that run in parallel (UNBOX and FILPAC, many RECEIVE NDC pallets) hand the time over when the next one starts. All row types count (ACTUAL, WAITING, WIP). The process columns of a PO, a plant or the network add up to its gross lead time exactly.
- **Nett** — the same hand-over rule inside the nett window (first Weighing → Receive NDC), PO and WIP rows left out (`NETT_MIN`). Nett per PO = the sum of its `NETT_MIN` (`ltNettPerPoSql()` / `ltNettJoin()`), so the columns add up to nett by construction. Every query that shows nett uses it — card, plant table, PO table, histogram, sunburst, Pareto, box plot, composition, Top SKU, scatter, line bubble, AI context and chat.
- Per plant / network: minutes ÷ POs with a gross (or nett) value — the same POs as the Gross LT / Nett LT columns.
- The plant table follows the section's Gross / Nett toggle (Tactical) or Basis (Lead Time page).

Before 2026-11-02 the columns summed NET_LEADTIME of every row (incl. WAITING / WIP) and overlapping rows counted twice, e.g. J2 YTD: groups 24.93 d vs gross 15.75 d. Checked YTD: every plant, the network, the sunburst and all 21,913 POs add up exactly.

- **Lead Time card note**: written by code (median, P25–P75, target, gap). An AI draft replaces it when available: the AI gets only the variables shown on the page (+ largest group process) and its text is accepted only if every number in it is one of those variables (`lib/leadTimeNote.ts`).
