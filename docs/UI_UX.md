# UI/UX — Control Tower Manufacturing

**Canonical design reference: `DESIGN.md`** — this file summarizes key decisions and patterns for quick reference. For full token specs and component contracts, read `DESIGN.md`.

---

## Design System

**Paradise Design System v2** — ParagonCorp CX Team internal design system.

Creative direction: "The Operations War Room." Dense but not cluttered. High-signal but not alarm-heavy. Color is signal, not decoration.

### Language
All UI copy is **English** on every page (changed 2026-09-26 at the user's request; previously Bahasa Indonesia with English exceptions for the Sidebar and Lead Time page). `lib/i18n.tsx` keeps the `id` dictionary in code, but `I18nProvider` is fixed to English and the Settings → Display language picker is hidden. Alert messages, AI Summary / AI Risks prompts and Teams/email notification templates are English too.

### Font

**Lato exclusively.** Loaded from Google Fonts (weights 400 and 700 only). Fallback: `ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`.

- Base size: `14px`
- Smoothing: `-webkit-font-smoothing: antialiased`
- **Lato has no weight 500 or 600.** Use 400 (regular) or 700 (bold) only.
- Set globally in `globals.css`. Never add `style={{ fontFamily: ... }}` inline.


### Colors

Two strict color domains — never mix:

**Domain 1: Shell (Paragon Blue ramp)**
| Token | Hex | Usage |
|---|---|---|
| `action-primary` | `#1E4076` | Header bg, sidebar active item, primary CTAs, flash overlay |
| `action-primary-hover` | `#16305C` | Hover state for all action-primary elements |
| `text-accent-strong` | `#16305C` | Active nav text, selected filter pill text |
| `surface-primary-subtle` | `#EEF4FB` | Active nav bg, selected pill bg, selected dropdown item |
| `border-accent` | `#C3CEE3` | Active dropdown border, hover bg in dropdowns |
| `text-primary` | `#2A3D4A` | Body text on white backgrounds |
| `border-subtle` | `#EBEBEB` | All card and panel borders |

**Domain 2: Data / Status**
| State | Background | Accent/Border | Text |
|---|---|---|---|
| Good/On-target | `bg-emerald-50` | `#22c55e` | `text-emerald-600` |
| Warning | `#FFFBE4` | `#D1A400` | `#342900` (never white on warning) |
| Critical/Error | `#FFEDEF` | `#E6001C` | `#8A0011` |
| Info | `#CCDDF5` | `#0056CC` | `#00347A` |

**No gradients in product UI.** The old AI gradient chip was removed (2026-09-29); AI labels are plain `#1E4076` bold uppercase text.

**Lead Time domain colors (fixed):**
- VA (Value-Adding): `#1E4076`
- NNVA: `#d97706`
- UNVA: `#b91c1c`

**Plant colors (positional, never shuffled):**
```
Plant 1 → #3b82f6   Plant 2 → #f59e0b   Plant 3 → #ef4444
Plant 4 → #10b981   Plant 5 → #8b5cf6   Plant 6 → #f97316
```

### Cards & Panels

| Property | Dashboard KPI cards | Monitor components |
|---|---|---|
| Shape | `rounded-lg` (8px) | `rounded-xl` (12px) |
| Border | `border border-[#EBEBEB]` | `border border-slate-200` |
| Shadow at rest | none | none |
| Shadow on hover | `hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)]` | — |
| KPI padding | `px-[18px] py-4` | `px-3.5 py-2.5` |
| Chart padding | `p-3` to `p-4` | `p-3` |


### Typography Reference

| Role | Size | Weight | Color | Extra |
|---|---|---|---|---|
| Card label | `text-[10.5px]` | 700 | `text-slate-400` | `uppercase tracking-[0.08em]` |
| KPI value | `text-[2rem]` (32px) | 700 | `text-slate-900` or status | `tabular-nums tracking-tight` |
| Hero value (OEE) | `text-[3.25rem]` (52px) | 700 | status color | `tabular-nums tracking-tight` |
| Sub-metric | `text-2xl` (24px) | 700 | status color | `tracking-tight` |
| Unit/suffix | `text-[13px]` | 400 | `text-slate-400` | — |
| Note/subtitle | `text-[12px]` | 400 | `text-slate-500` | `leading-snug` |
| Chart panel title | `text-[10.5px]` | 700 | `text-slate-400` | `uppercase tracking-[0.08em] leading-none` |
| Badge/pill | `text-[10.5px]` | 700 | semantic pair | — |

> Note: Dashboard chart titles use the same style as card labels — NOT the `text-[13px] font-bold text-slate-800` style that appears in some older chart panels on the Lead Time page.

### Spacing

| Token | Value | Tailwind | Usage |
|---|---|---|---|
| KPI card padding | 18px × 16px | `px-[18px] py-4` | KPICard body |
| Chart panel padding | 12px–16px | `p-3` or `p-4` | Chart wrapper |
| Content padding | 20px | `p-5` | Page content area |
| KPI grid gap | 14px | `gap-[14px]` | All KPI grids |
| Section gap | 20px | `mb-5` | Between sections |

---

## Page Structure

### Shell
```
┌──────────────────────────────────────────┐
│  Header (52px, bg #1E4076)               │
│  [logo + brand text | filters | controls]│
├─────────┬────────────────────────────────┤
│ Sidebar │  Content area                  │
│ (224px) │  (bg #F1F5F9, p-5)             │
│ white   │  overflow-y: auto              │
│         │                                │
└─────────┴────────────────────────────────┘
```

### Sidebar (`components/dashboard/Sidebar.tsx`)
- `w-56` (224px), white, `border-r border-slate-200`
- Logo: `public/paragon-corp-white.e705509b.png` (white) on a 52px Paragon Blue block, same height as the Header top bar so both read as one blue strip
- Labels in **English** (like all UI copy)
- Groups (divider between each): Overview · Alert Center | Lead Time · Output · Productivity · Yield · Energy · OEE · Root Cause Analysis | Reports · AI Fusion (BETA, purple)
- Footer: Settings · User Management · Guide · Sign Out
- Items without a page yet look and hover like normal items but do nothing on click (tooltip "Coming soon") — only Overview, Lead Time, Settings are links
- Alert Center badge: active alert count from `computeAlerts()` on `/api/dashboard/kpi` (user's `ct-filters`); hidden when 0
- Active state: `bg-[#E9EFF8] text-[#16305C]`, bold label; icons 15px, labels 13px
- Inactivity logout: 15-minute idle timer
- **Hide / show** (2026-10-13): button left of the logo. Only the menu collapses, **animated** (width 224 → 0, 200 ms `ease-out`; inner column stays 224 px so the menu slides instead of reflowing; stays mounted so the idle timer keeps running). The logo block (`SidebarBrand`, `components/dashboard/SidebarToggle.tsx`) is **one fixed element** top-left that never moves; the Sidebar keeps a 52 px navy spacer under it. State = `data-sidebar="collapsed"` on `<html>` (set before the first paint by an inline script in `app/layout.tsx`, switched by `setSidebarCollapsed()`, stored in localStorage `ct-sidebar-collapsed`). CSS in `globals.css`: `.ct-sidebar` width and `.ct-topbar-row` (Header top bar) left padding animate with the same duration and easing, so the top bar content stays still while the content below widens; `.ct-topbar-pad` gives Settings (no Header) 52 px of room under the logo; `.ct-icon-*` swaps the button icon. Reduced motion → no transition. Every page with `<Header>` must also render `<Sidebar>` (it owns the logo block).

### Header (`components/dashboard/Header.tsx`)
- **Live indicator** (top bar, right of the clock): two lines in a `bg-white/10` box with a green dot — **"Last sync"** (11.5px bold white) over the elapsed time "14m 32s ago" (9.5px `white/60`) — counts up every second from the last data load (`MAX(LOAD_TIMESTAMP)` of CT_MANUF_LEADTIME via `/api/dashboard/etl`, cached 5 min; `ETL_BATCH_TIMESTAMP` is date-only). Re-read after every refresh; hover shows the exact load time (WIB) and the hourly auto-refresh countdown. Words from i18n (`header_data_updated`, `header_ago`). No timestamp → old "Live mm:ss" countdown.
- Top bar: fixed 52px, `bg-[#1E4076]`; controls use white-on-blue (`text-white/85`, `border-white/25`, `hover:bg-white/10`)
- Left: brand text "MANUFACTURING CONTROL TOWER" (`text-[13px] font-medium text-white/70 uppercase tracking-[0.07em]`)
- Alert dropdown severity = colored dot (red / amber / blue), no emoji
- Right: clock · sync status · notification bell · Teams send button · avatar
- Row 2 — **Filter bar** (2026-10-13, Overview + Lead Time): labelled fields, label above each control (`9.5px bold uppercase tracking-[0.08em] text-slate-500`), controls `h-7` (28px — same height as the Strategic / Tactical toggle) `rounded-md border-slate-200 bg-white text-[11px] font-semibold`:
  **PERIOD** (dropdown) · **START DATE** · **END DATE** (date inputs — editable only for Custom Range; otherwise disabled `bg-slate-50 text-slate-400` showing the preset's dates) · **PLANT** (dropdown) · **Apply →** button. **RESOLUTION** (Daily / Weekly / Monthly) is hidden for now (`SHOW_RESOLUTION = false`, 2026-10-13). Menus: `rounded-lg`, selected item `bg-[#EEF4FB] text-[#16305C]` + check. View toggle (**VIEW** — Strategic / Tactical / …) and the optional basis toggle (**LEAD TIME FROM**, `ltBasis` prop — no page uses it since the Lead Time page moved Scope into its own filter card, 2026-10-13) stay right-aligned on the same row in the same field style: label above, 28px `rounded-md border-slate-200` box, selected option `bg-[#EEF4FB] text-[#16305C]`. Constants `FIELD*` / `SEG*` / `MENU*` in `Header.tsx`.
- **Apply** (since 2026-10-06): filter controls edit a draft; nothing reaches the page until **Apply** is clicked. Apply = Paragon Blue button with → when there are changes, outlined gray + disabled otherwise; **Discard** (text button, only while there are changes) reverts the draft; Custom range with start > end disables Apply and shows "Start date is after end date" in red. The top-bar period chip and Send to Teams use the applied filters. Pages pass `initialFilters` so the controls match what is shown (Overview restores them from localStorage).

The view toggle only renders when `views` prop has 2+ items. On `/dashboard`, Strategic / Tactical is shown. Tactical has a sticky **section tab bar** (2026-10-13, minimal): text tabs on the page background `#F7F8FA`, hairline `border-slate-200` below, 12px `text-slate-500`, active `text-slate-900 font-semibold` + 2px navy underline, locked = `text-slate-300` + tiny uppercase "Soon", no pill or icon. In Tactical, the Lead Time toggles sit **next to the "Lead Time" section title** (not in the Header, since 2026-10-13): **PO Created / PO Released** (gross figures: card, histogram, plant table Gross LT + On-time) · **Days / Hours** (every Lead Time visual: card, both donuts, histogram, Pareto, plant table) · **Gross / Nett** (card + histogram; Nett card shows value vs prior period only — no target tone, gauge or sparkline, because the 13-day target is defined on gross and there is no weekly nett series). Donuts and Pareto are activity time, so Gross / Nett does not apply to them; the plant table already shows both. On `/lead-time`, `views={LEAD_TIME_VIEWS}` shows Strategic/Tactical/Operational.

---

## Component Patterns

### KPI Card standard (2026-10-14)

**Every KPI card follows this anatomy.** Components: `RegularKPICard` (generic), `LeadTimeKPICard`, `OutputKPICard` (Overview Strategic + Strategic Monitor), all built from the shared blocks in `components/ui/KpiCardParts.tsx` (`KpiLabel`, `KpiTargetLine`, `StatusPill`, `KpiPriorLine`, `KpiSparkline`, `KpiFooter`). `LiteKPICard` / `LeadTimeCategoryCard` (Lead Time page) keep the older layout. When you add a KPI, use `RegularKPICard` unless the KPI needs its own toggles in the card. Layout changed 2026-10-14 at the user's request (reference card: Output).

```
┌──────────────────────────────────────────────────────────────┐
│ OUTPUT ⓘ                                [Finished Good][Bulk]│  ← label + info · toggles
│ 284.80 M pcs                                                 │  ← value + unit
│ −16.20 M pcs vs target 301.00 M pcs   (or "Target not defined")│ ← target line
│ [Off Track]                                     ╱╲╱‾╲  spark │  ← status pill · sparkline
│ ↑ 3.9% vs prior period                       15 weeks · pcs  │  ← prior-period line
│ ┌ AI  J4 short 7.1 M pcs, 44% of the total gap ─────────────┐ │  ← KpiOneLiner bar
│ └───────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│ Open page →                                 Target ≤ 13 days │  ← footer
└──────────────────────────────────────────────────────────────┘
```

| Part | Rule |
|---|---|
| Shell | white, `1px solid #EBEBEB` (alert: `#fbd5d1`), radius 8 (`rounded-lg`), no shadow at rest, no accent bar, no icon next to the label |
| Size | `compact` in the Overview 3-per-row grid: spacing, sparkline and toggles ×0.8 (`z()`), **font sizes never scale** |
| Label | `KpiLabel`: 11.5px bold uppercase `#64748b`, letter-spacing .06em, ellipsis, then an ⓘ `InfoTooltip` with the definition / basis / data source (this text used to sit in the footer) |
| Toggles | same row as the label, right; `SegmentedToggle` (or the inline compact copy in Lead Time / Output); a not-yet-available option is `locked` |
| Value | 30px bold `#101828`, tabular, line-height 1; unit 12px `#98a2b3`. Nothing else on this line. Output (FG and Bulk) is shown in millions with 2 decimals: "284.80 million pcs" / "16.81 million kg" — the word comes from i18n `unit_million` ("juta" in Indonesian), never abbreviated (exact value on hover of the unit) |
| Target line | `KpiTargetLine`, 11.5px `#98a2b3`, always shown: gap to target in bold tone color + "vs target …" (Lead Time gross), or gray "Target ≥ 65%" / "Target not defined" when the KPI has no target yet (Output, Productivity, Energy, Lead Time nett — target is on gross). Never remove the line when the target is missing |
| Status | `StatusPill`: 11px bold tone color on the tone bg + border, radius 4. Tones (`TONES` in each card), same labels on every card: on `#067647` **"On Track"**, risk `#b45309` **"At Risk"**, off `#d92d20` **"Off Track"**, neutral `#667085` "No Data"; value but no prior period → "No Prior Data". Rules: target KPIs from the target (Lead Time: ≤ target on, ≤ +15% risk, above off); trend KPIs: up on, down ≤ 5% risk, worse off (`inverse` when lower is better) |
| Prior-period line | `KpiPriorLine`, 11px: "↑ 3.9%" bold tone color + "vs prior period" (+ optional prior value, e.g. "(12.3)"); no comparison or no data → "No prior period data" (no-data cards keep the row) |
| Sparkline | `KpiSparkline`, right column, bottom-aligned with the status + prior rows, 150×42 (×0.8 compact), Nivo line only, 1.6px, Paragon Blue `#1E4076`, no area/points/axes; caption "{n} weeks · {unit}" 10px `#a3a8b5`; < 2 points → "no sparkline data". **Click = switch the trend chart to this KPI** (`onSparkClick`; Overview also scrolls the chart into view): Lead Time → `leadtime`, Output → `output` (FG; also from the Bulk view), Productivity → `productivity` (E2E; also from Mixing / Filpac). Hover `#EEF4FB` bg, focus ring navy, title "Show in trend chart" |
| AI one-liner | `<KpiOneLiner id={insightId}>` bar right below the prior-period row, full width, **always with the `AiTag`** — see KpiOneLiner below; only on cards with data (Lead Time, Output, Productivity E2E) |
| Secondary row | **Not shown.** A KPI card shows only its toggled value — never the other toggle value (Gross/Nett, FG/Bulk) or an extra metric; the user clicks the toggle to switch. A 12px spacer sits below the one-liner |
| Footer | `KpiFooter`, hairline top border: left "Open page →" (11.5px bold `#1E4076`, hover `#16305C` underline) when the KPI has a detail page (Lead Time → `/lead-time`), else muted "No detail page yet"; right 10px `#a3a8b5` (target or total, e.g. "Target ≤ 13.00 days", "12,345 mh") |
| No data | same rows as a data card: value "—" in `#d0d5dd`, target line, status "No Data", "No prior period data", "no sparkline data", footer; ⓘ says what is missing (e.g. "CT_MANUF_KEMAS not connected") |
| Wrapper | always inside `<KpiHighlightTarget id>` (see Interactions) |
| Loading | `SkeletonCard`, same height as the card |

Legacy, not rendered anywhere: `components/dashboard/KPICard.tsx` (5px accent bar, count-up animation, refresh flash) and the old inline "Hero OEE Card". Do not use them for new work.

### AISummary (`components/dashboard/AISummary.tsx`)
- Paragon Blue card (`bg-[#1E4076] rounded-lg`, since 2026-10-06 at the user's request) — the summary is not a KPI health signal, so the shell color is allowed here
- Label "AI SUMMARY" `10.5px` bold uppercase `text-white/70` (no chip, no shadow)
- Body text: `13px text-white leading-relaxed`; age `text-white/60`; Refresh `text-white/85`, hover `bg-white/15`
- Clickable KPI numbers: bold white with `decoration-white/50` underline, white focus ring
- Skeleton bars `bg-white/20`; "truncated" note `#FFE38A`; error text white with icon

### KpiOneLiner (`components/ui/KpiOneLiner.tsx`)
- One-line AI insight per data KPI card (Lead Time, Output, Productivity E2E), its own bar right below the prior-period row (above the footer), full card width
- `bg #EEF4FB`, radius 6, padding 5×8 (scaled in compact cards); "AI" tag 9px bold `#1E4076`; text 11px `#16305C`, one line with ellipsis, full text in `title`
- Comes from the same model call as the AI Summary (`[[CARDS]]` block); nothing is rendered while the summary loads, on error, or when the model gave no line for that KPI

### AlertPanel (`components/dashboard/AlertPanel.tsx`)
- Critical row: `bg-[#FFEDEF] border-l-4 border-l-[#E6001C]`
- Warning row: `bg-[#FFFBE4] border-l-4 border-l-[#D1A400]`
- Dismiss with undo (5s countdown)

### Standard Line Chart (`components/charts/StandardLine.tsx`) — the line chart standard

**Every line chart — trend charts and KPI-card sparklines — follows this spec** (same role as TONES for KPI cards). Code wins over this text if they ever differ; update this section with the code. Reference implementations: `components/dashboard/LeadTimeTrendChart.tsx` (cleanest full example), Overview `components/dashboard/TrendChart.tsx` (adds SPC).

#### 1. Building blocks (never re-implement)
| Piece | Module | Role |
|---|---|---|
| `LineChartCard` | `StandardLine.tsx` | Card shell: label, loading spinner, `actions` slot, unit pill, plot area, legend slot, empty state |
| `LINE_DEFAULTS` / `LINE_THEME` | `StandardLine.tsx` | Spread first into every `<ResponsiveLine>`; chart-specific props after |
| `seriesColor()` · `SERIES_TOTAL_COLOR` · `SERIES_OVERFLOW_COLOR` | `StandardLine.tsx`, `lib/chartConfig.ts` | Series colours |
| `isolatedColor()` · `makeActiveLineLayer()` | `StandardLine.tsx` | Legend-hover isolation |
| `makeActivePointsLayer()` | `StandardLine.tsx` | The single hover point |
| `LineTooltip` · `rowsAtX()` · `TOOLTIP_COLORS` | `StandardLine.tsx` | Tooltip — for every chart type |
| `LineLegend` | `StandardLine.tsx` | Legend below the plot |
| `GRAIN_OPTIONS` · `evenWeekTicks()` · `monthLabel()` | `StandardLine.tsx` | Weekly / Monthly axis |
| `LineDraw` | `components/charts/LineDraw.tsx` | Draw-in motion |
| SPC helpers (`laneyPLimits`, `xmrLimits`, `makePChartLayer`, `outOfLimitColor`, `LimitsSub`) | `StandardLine.tsx` | Control charts only |

#### 2. Look
| Aspect | Standard |
|---|---|
| Style | Minimal: no axis domain lines, no axis titles, no vertical grid; dashed horizontal hairline grid `#eef0f3` (`3 4`), 4 y-ticks |
| Line | `curve="linear"`, 2px, no resting points (`LINE_DEFAULTS`). Trend charts and sparklines both use linear |
| Ticks | `#a0a6b1` 10px tabular; y-ticks integers (compact, e.g. `8.29M`, for large values); point x-scale, auto y-scale (% metrics clamped 0–100) |
| Colours | `SERIES_COLORS` (`lib/chartConfig.ts`) in **fixed entity order, never by rank**: `#3b82f6` `#f59e0b` `#ef4444` `#10b981` `#8b5cf6` `#f97316` `#06b6d4` `#db2777`; 9th+ series → `SERIES_OVERFLOW_COLOR` `#98a2b3`; aggregate ("Total", "All plants") → Paragon Blue `#1E4076` (never black). `PLANT_COLORS` = first 6 |
| Weekly / Monthly | `ToggleSelect` dropdown with `GRAIN_OPTIONS` in the card header, left of the unit pill (every trend chart since 2026-10-14; Quarterly planned — add it to `GRAIN_OPTIONS` + `DATE_TRUNC('quarter')` later). **Overview / Monitor `TrendChart`**: metric and grain are `ToggleSelect` dropdowns (`components/ui/ToggleSelect.tsx` — filter field standard: same box and menu as the Header filter dropdowns (`FIELD` / `FIELD_ON` / `MENU*` in `FilterField.tsx`), no label above, 28px high) in one header row: Metric ▾ · Overall / By plant · Weekly ▾ · unit pill (unit only); the metric pill row is gone. Weekly axis = even ISO weeks (`evenWeekTicks()`: `W2, W4…`, every 4th when > 26); Monthly axis = every month (`Jan`, or `Jan 25` when the range spans years). Monthly is **re-queried** with `grain=month` (`DATE_TRUNC('month')` in SQL) — never averaged from weekly points |

#### 3. Card
`LineChartCard`: white `rounded-lg p-3 border-[#EBEBEB]`, hover shadow; label 11.5px bold uppercase `slate-500` + spinner while loading; header right = `actions` (toggles) then unit pill `bg-[#EEF4FB] text-[#16305C]` (e.g. "Lead Time · days"); plot 300px; legend row below; empty state "No data available" (or a specific sentence).

#### 4. Interaction
| Aspect | Standard |
|---|---|
| Hover | `useMesh` + x-crosshair hairline `#c4c9d2`. **One** solid 4px point (series colour, 2px white ring) at the hovered x, **on the line under the cursor only**. `makeActivePointsLayer` reads Nivo's `currentPoint` custom-layer prop (same render as the crosshair) — never a ref set in `onMouseMove` (that missed renders) |
| Tooltip | `LineTooltip`: translucent slate card (`TOOLTIP_COLORS`: bg `rgba(42,61,74,0.82)`, 4px blur, 8% white border, radius 8); title 11px bold white (weekly "Week of 24 Aug 2026", monthly "August 2026"); optional `subtitle` 9.5px; rows 11.5px = 6px dot · name `#cbd5e1` · value white bold tabular · unit 10.5px; optional sub-line 9.5px `nowrap`; optional `footer`. Lists **every series** at that x (`rowsAtX`). Used by line, bar, scatter and SVG charts alike |
| Legend | `LineLegend` **below the plot**, centred, 9.5px: 6px dot · name `slate-500` · last value bold. Hover isolates: other lines 12% (`isolatedColor`), other legend items 40%, the hovered line redrawn on top (`makeActiveLineLayer`) |
| Layers | `["grid", "markers", "axes", "lines", <SPC layer>, "crosshair", ActivePointsLayer, ActiveLineLayer, "mesh"]` — mesh last |

#### 5. Motion and loading
| Aspect | Standard |
|---|---|
| Draw-in | Wrap every `<ResponsiveLine>` in `<LineDraw drawKey>`: solid lines draw left → right (`stroke-dashoffset`, 800 ms, `cubic-bezier(0.22, 1, 0.36, 1)`; sparklines 600 ms); dashed limit lines fade in near the end so the dash pattern is kept; reduced motion → none |
| Replay | Only when `drawKey` changes — the data shown (each fetch: filters, metric, grain) or the view. Never on hover. Use a `useMemo(() => ({}), [data, view])` key or a value string for sparklines |
| No morph | `animate: false` (in `LINE_DEFAULTS`). Nivo's spring morph bent lines between data sets with different point counts (weekly ↔ monthly) |
| Refetch | Keep the current chart at **45% opacity** while the new data loads (spinner in the label); then the axes switch at once and the new lines draw in. Never unmount the chart to a blank box during a refetch |

#### 6. Sparklines (KPI cards)
150 × 42 px (scaled by `compact`), Paragon Blue `#1E4076`, 1.6px (1.4px in the Lead Time page category cards, which use their category colour), `curve="linear"`, no points, no grid, no axes, `isInteractive={false}`, `animate={false}`, wrapped in `<LineDraw duration={600}>`; caption below "N weeks · unit" 10px `#a3a8b5`.

#### 7. Control charts (SPC) — only where the calculation exists
Overview `TrendChart` only (all its metrics): **Laney P′** (`laneyPLimits()`) for count proportions — Lead Time (% PO > 13 days), RFT; **XmR** (`xmrLimits()`, mean ± 2.66 × average moving range, straight limits) for Output, Productivity, OEE, OPE, Yield Loss. `makePChartLayer()`: UCL / LCL step lines 1.5px dash `5 3` `#e07a70`, centre (p̄ or Mean) 1px dotted `#98a2b3`, 9.5px bold labels with a white halo at the right end (≥ 11px apart); no shaded band. View toggle Overall (default, one "All plants" line) / By plant; one band drawn — Overall = its limits, By plant = All plants limits, swapped to the plant's own on legend hover. On hover, a point outside its own limits is red `#d92d20` (`outOfLimitColor()`); tooltip sub-line `LimitsSub` (p̄ · UCL · LCL · late/n). Caption under the legend explains the chart type. Lead Time page trend has no SPC.

#### 8. Checklist — new line chart
1. `LineChartCard` with label, unit pill, `loading`, `empty`, legend slot; Weekly / Monthly toggle in `actions` when it is a trend.
2. `StandardSeries[]` with `seriesColor(fixedIndex)` per entity, aggregate `SERIES_TOTAL_COLOR`.
3. `<LineDraw drawKey={…}>` around `<ResponsiveLine {...LINE_DEFAULTS} data colors={isolatedColor(…)} layers={…} tooltip={LineTooltip…} />`.
4. `makeActivePointsLayer(series, getX)` + `makeActiveLineLayer(series, hovered)`; hover point comes from `currentPoint`.
5. Tooltip `LineTooltip` + `rowsAtX`; legend `LineLegend` below the plot.
6. Refetch keeps the old chart at 45% opacity; monthly data from SQL.
7. SPC only if the limits are actually calculated.

#### 9. Anti-patterns — do not repeat
- A local Nivo theme, tooltip or legend in a chart file; custom inline tooltip divs (SVG charts with `position: fixed` tooltips use `TOOLTIP_COLORS` tokens with the same structure).
- `curve="monotoneX"` or other smoothing; lines 2.5px+; resting points on every data point.
- Points on every series at the hovered x; hover state read from a ref set in `onMouseMove`.
- Nivo spring animation (`animate` true); blanking the chart during a refetch; replaying the draw-in on hover.
- Vertical grid, axis domain lines, axis titles; legend above / beside the plot or at 11px+; wrapping tooltip sub-lines.
- Black for a "Total" series; colours by rank or sort order; a 9th categorical hue (fold to `SERIES_OVERFLOW_COLOR`).
- Monthly values averaged from weekly points; SPC band shading; UCL/LCL without a control-limit calculation.

### Chart transitions — every change animates, simply (2026-10-13)

Any change of what a chart shows (toggle, drill-down, unit, new data) has a short, simple transition — never an instant swap, never bouncy:
| Chart | Transition |
|---|---|
| Line charts, sparklines | `LineDraw` draw-in (see Standard Line Chart → Motion) |
| Bar charts, histogram, tables, scatter | `Fade` (`components/ui/Fade.tsx`, `ui-fade-in` 220 ms: opacity + 3px rise). Its `depKey` must include every toggle that changes the content (view, unit, sort, basis) — e.g. Pareto `group|sort|unit|rows`, histogram `mean|total|unit`; `ChartCard` takes `fadeKey` for the same purpose |
| Sunburst (Lead Time, Group process and process) | Drill-down / back: slice angles tween 450 ms ease-in-out — the clicked group opens to the full circle, the others close up; new slices grow from zero width; legend and centre label fade in |
| Composition / progress bars | `width` transition 300 ms ease-out |
Reduced motion → no animation. Hover never triggers these.

### TrendChart + StackedBarChart
Both charts share a KPI selector — changing selection in one updates the other. This is a deliberate design decision (Tableau parity).

**TrendChart:** Line chart per plant, styled entirely by the Standard Line Chart module above (theme, tooltip, legend below the plot). X-axis: even ISO week numbers only (W2, W4...). SPC UCL/Mean/LCL as hairline markers + tooltip sub-line (no shaded band); Lead Time = Laney P′ chart of % PO > 13 days (see SPC row above). Legend hover isolates a plant even when the parent does not track hover.

**StackedBarChart** still uses its own Nivo bar theme (not covered by the line standard).

**StackedBarChart:** Bar per plant, status legend (In Control / Above UCL / Below LCL).

---

### Lead Time page — sunburst + Lead Time Distribution (2026-10-14)

- **Sunburst** (`components/leadtime/ProcessSunburst.tsx`): every slice shows its time inside the ring: value (`fmtLt`, 10px bold) with the unit spelled out below it ("days" / "hours", 8px regular), white on dark fills / navy `#16305C` on light ones; hidden when the slice arc is < 44px at mid-radius. Labels follow the drill-down tween.
- **Lead Time Distribution** (`components/leadtime/LeadTimeBoxPlot.tsx`, look matched to the user's reference):
  - Chart: box = IQR P25–P75, fill `#D9E0EA`, navy `#1E4076` 1.25px outline; median = short navy dash (2px); whisker Min → **P90** (1px `#A9B4C4`, cap at P90); log-like y axis (symlog, 1-2-5 ticks) with title "Lead time (days|hours)"; stage labels slanted −30°; hovered column = amber band `#FDF1DC`. Legend: Min to P90 · IQR (P25–P75) · Median (· Focus when not Median). Focus ≠ Median → dashed amber line on each box.
  - Controls: Focus ▾ (FilterField style; sorts Pareto, outlined in the tooltip) · Pareto / Process order toggle.
  - Table "Lead time statistics (unit)": navy header 9.5px, label column navy text; rows Minimum · Percentile 25 · **Median (bold)** · Mean · Percentile 75 · Maximum (red) · PO count (muted); values without unit, centred; **columns aligned with the boxes** (table `table-layout: fixed`, label column 104px = chart left margin, right padding 16px = chart right margin, one equal column per chart slot); hovering a column in the chart or table tints that column `#FEF6E7` and gives its header an amber underline. Focus row = amber dot next to the label.
  - Summary line in a `bg-slate-50` strip below the table.
  - **Tooltip exception to `LineTooltip`** (user request): dark card `#13213D`, title + "n PO", 2-column grid Mean/P25 · Min/Median · Max/P75 (label 9px `#A3B1C6`, value 12px bold white + unit); the Focus stat cell is outlined amber with an amber label. Only this chart uses it.

## Monitor Mode Layout

Monitor mode (`/monitor`) is a fullscreen page with a dark bottom navigation bar. No sidebar, no standard header.

**Bottom nav:**
```
[clock 00:00:00 WIB] [Plant · Period] [Strategic pill] [Lead Time pill] [×]
```
- Background: `bg-[#0f172a]/90 backdrop-blur-xl border border-white/10 rounded-2xl`
- Active page pill: `bg-[#1E4076] text-white`
- Inactive page: `text-white/50 hover:text-white/90`

**Content area rules (no-scroll):**
- Container: `h-screen w-screen overflow-hidden bg-[#F4F6F9] flex flex-col`
- Each section inside: either `shrink-0` (fixed height) or `flex-1 min-h-0` (fills remaining space)
- No section should force scroll

**StrategicMonitor cards** use `rounded-xl` and `border-slate-200` (slightly different from dashboard cards) for a denser monitor aesthetic.

---

## Interactions

| Interaction | Behavior |
|---|---|
| Filter change | Immediate re-fetch, KPI values animate count-up |
| Data refresh | Flash `#1E4076` overlay 0.9s, values re-animate |
| Alert dismiss | Row slides out, undo toast appears for 5s |
| KPI number in AI Summary / `[kpi:ID]` chip in chat | `highlightKpi(id)` → that card gets a thin outline (`1px rgba(30,64,118,.35)`) + soft shadow and scrolls into view; all other KPI cards fade to 35% opacity (200ms ease-out). Same click again, click elsewhere or Esc clears (`components/ui/KpiHighlight.tsx`) |
| Monitor button | `router.push('/monitor?page=...')` (fullscreen page) |
| Escape in fullscreen | `fullscreenchange` event → `router.back()` |
| 15min idle | Auto-logout → `/login` |

---

## Loading States

- KPI cards: `SkeletonCard` components (`animate-pulse`, same height as loaded card)
- Charts: spinner (`border border-[#1E4076] border-t-transparent`)
- AI Summary: skeleton bar animation
- Monitor mode cards: inline `animate-pulse` divs matching card dimensions

---

## Do's and Don'ts

| ❌ Don't | ✅ Do |
|---|---|
| Use Inter, Space Grotesk, or any font other than Lato | Use Lato (already global) |
| Use `rounded-xl` on dashboard KPI cards | Use `rounded-lg` |
| Use `border-slate-200` on dashboard cards | Use `border-[#EBEBEB]` |
| Use `#1E4076` (old navy) as shell color | Use `#1E4076` (Paragon Blue) |
| Use `#1E4076` to signal KPI health | Use green/amber/red |
| Use gradients in product UI | Plain colors only |
| Shuffle plant color order | Plant colors are positional and fixed |
| Put white text on warning yellow | Use `#342900` dark text on `#FFFBE4` |
| Use `border-gray-100` or `border-gray-200` | Use `border-[#EBEBEB]` |
| Add animation beyond `transition-all ease-out` | No `animate-bounce` |
| Add `animate-bounce` | Use `transition-all ease-out` |

## Segmented Toggle

Standard for every toggle: `components/ui/SegmentedToggle.tsx` — same style as the Overview KPI card toggles (Gross / Nett, Finished Goods / Bulk). Track `#f2f3f6`, radius 7, padding 3, gap 2; option 11px/600, padding 4×10, radius 5; active = white chip, text `#101828`, shadow `0 1px 2px rgba(16,24,40,.08)`; inactive = transparent, text `#667085`. Used by the Lead Time "Lead time per stage" card. An option can be `locked: true` (lock icon 9px, text `#c5cad8`, not clickable, title "Coming soon — data not connected yet") — e.g. OEE SKU on the Overview OEE card. `RegularKPICard` takes a `toggle` node shown above its sparkline (Productivity E2E / Mixing / Filpac, OEE / OEE SKU). (The KPI cards keep their inline copy because of the `compact` scaling.)
