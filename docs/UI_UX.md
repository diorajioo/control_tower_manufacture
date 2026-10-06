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

### Header (`components/dashboard/Header.tsx`)
- Top bar: fixed 52px, `bg-[#1E4076]`; controls use white-on-blue (`text-white/85`, `border-white/25`, `hover:bg-white/10`)
- Left: brand text "MANUFACTURING CONTROL TOWER" (`text-[13px] font-medium text-white/70 uppercase tracking-[0.07em]`)
- Alert dropdown severity = colored dot (red / amber / blue), no emoji
- Right: clock · sync status · notification bell · Teams send button · avatar
- Row 2 (filter row): view toggle (if `views.length >= 2`) · period pills · date picker · plant dropdown · data level pills · monitor button
- **Apply** (since 2026-10-06): filter controls edit a draft; nothing reaches the page until **Apply** is clicked. Apply = Paragon Blue pill when there are changes, gray + disabled otherwise; **Discard** (text button, only while there are changes) reverts the draft; Custom range with start > end disables Apply and shows "Start date is after end date" in red. The top-bar period chip and Send to Teams use the applied filters. Pages pass `initialFilters` so the controls match what is shown (Overview restores them from localStorage).

The view toggle only renders when `views` prop has 2+ items. On `/dashboard`, Strategic / Tactical is shown (Tactical = "Lead time per stage" actual vs standard chart + "Lead time breakdown per plant" table). On `/lead-time`, `views={LEAD_TIME_VIEWS}` shows Strategic/Tactical/Operational.

---

## Component Patterns

### KPI Card standard (2026-10-06)

**Every KPI card follows this anatomy.** Components: `RegularKPICard` (generic), `LeadTimeKPICard`, `OutputKPICard` (Overview + Strategic Monitor), `LiteKPICard` / `LeadTimeCategoryCard` (Lead Time page, same rules without toggle / one-liner). When you add a KPI, use `RegularKPICard` unless the KPI needs its own toggles in the card.

```
┌──────────────────────────────────────────────────────────────┐
│ LABEL (11.5 bold UPPER #64748b)              [Toggle] [Toggle]│  ← header row
│ 16.95 days  ↗ +3.95 days  (30 bold · 12 unit · 11.5 delta)   │     right column:
│ vs target 13.00 days (+30.4%)        (11 #98a2b3)  ╱╲╱‾ spark │     toggles, sparkline
│ ● Above Target   (StatusDot 11.5 bold, tone color)  15 weeks │     150×42, caption 10px
│ ┌ AI  WIP stage averages 9.19 days, 57% of gross lead time ─┐ │  ← KpiOneLiner bar
│ └───────────────────────────────────────────────────────────┘ │
│                                                   (12px gap) │  ← no secondary row
├──────────────────────────────────────────────────────────────┤
│ PO Created → Receive NDC (11 #667085)    Target ≤ 13.00 days  │  ← footer
└──────────────────────────────────────────────────────────────┘
```

| Part | Rule |
|---|---|
| Shell | white, `1px solid #EBEBEB` (alert: `#fbd5d1`), radius 8 (`rounded-lg`), no shadow at rest, **no accent bar, no icon** next to the label |
| Size | `compact` in the Overview 3-per-row grid: spacing, sparkline and toggles ×0.8 (`z()`), **font sizes never scale** |
| Label | 11.5px bold uppercase `#64748b`, letter-spacing .06em, one line with ellipsis; changes with the card toggle (e.g. "Mixing Productivity") |
| Value | 30px bold `#101828`, tabular, line-height 1; unit 12px `#98a2b3`; then the change (11.5px bold, tone color, ↗ / ↘ / →) — vs target when the KPI has one, else % vs prior period |
| Sub-label | 11px `#98a2b3`: "vs target …" or "vs prior period {value}" |
| Status | `StatusDot` (6px dot + 11.5px bold label in tone color). Tones (`TONES` in each card): on `#067647`, risk `#b45309`, off `#d92d20`, neutral `#667085` "No Data"; value but no prior period → "No Prior Data". Rules: target KPIs from the target (Lead Time: ≤ target on, ≤ +15% risk, above off); trend KPIs: up on, down ≤ 5% risk, worse off (`inverse` when lower is better) |
| Toggles | top of the right column, `SegmentedToggle` (or the inline compact copy in Lead Time / Output); a not-yet-available option is `locked` (lock icon, not clickable) |
| Sparkline | right column, 150×42 (×0.8 compact), Nivo line only, 1.6px, Paragon Blue `#1E4076`, no area/points/axes, not interactive; caption "{n} weeks · {unit}" 10px `#a3a8b5`; < 2 points → "no sparkline data" |
| AI one-liner | `<KpiOneLiner id={insightId}>` bar right below the status row, full width — see KpiOneLiner below; only on cards with data (Lead Time, Output, Productivity E2E) |
| Secondary row | hairline top border `#eceef2`; value 20px bold, unit 11px, label 10.5px `#a3a8b5`; optional trend as colored text (no pill). **Standard since 2026-10-06: not shown.** A KPI card shows only its toggled value — never the other toggle value (Gross/Nett, FG/Bulk) or an extra metric below; the user clicks the toggle to switch. `showSecondary` on `LeadTimeKPICard` / `OutputKPICard` defaults to `false` (also hides Output's footer "Bulk: / FG:"); don't pass `secondary` to `RegularKPICard`. A 12px spacer replaces the row. Applies to the Overview and the Strategic Monitor. |
| Footer | white, hairline top border, 11px `#667085` left (definition / basis / data source), 10px `#a3a8b5` right (target or total) |
| No data | value "—" in `#d0d5dd`, status "No Data", no sparkline, footer says what is missing (e.g. "CT_MANUF_KEMAS not connected yet") |
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
- One-line AI insight per data KPI card (Lead Time, Output, Productivity E2E), its own bar right below the status row (above the footer), full card width
- `bg #EEF4FB`, radius 6, padding 5×8 (scaled in compact cards); "AI" tag 9px bold `#1E4076`; text 11px `#16305C`, one line with ellipsis, full text in `title`
- Comes from the same model call as the AI Summary (`[[CARDS]]` block); nothing is rendered while the summary loads, on error, or when the model gave no line for that KPI

### AlertPanel (`components/dashboard/AlertPanel.tsx`)
- Critical row: `bg-[#FFEDEF] border-l-4 border-l-[#E6001C]`
- Warning row: `bg-[#FFFBE4] border-l-4 border-l-[#D1A400]`
- Dismiss with undo (5s countdown)

### Standard Line Chart (`components/charts/StandardLine.tsx`)

**Every Nivo line chart uses this module** — same role as the TONES object for KPI cards. Reference implementation: Overview `TrendChart`. Cleanest full example: `components/dashboard/LeadTimeTrendChart.tsx` (Lead Time page).

| Aspect | Standard |
|---|---|
| Granularity | Trend charts have a Weekly / Monthly `SegmentedToggle` (`GRAIN_OPTIONS`) in the card header, left of the unit pill (`LineChartCard` `actions` slot). Weekly axis = even ISO weeks (`W2, W4…`); Monthly axis = every month (`Jan`, or `Jan 25` when the range spans years). Data is re-queried with `grain=month` (`/api/dashboard/trends`, `/api/lead-time/trend`) |
| Series colors | `SERIES_COLORS` (`lib/chartConfig.ts`) in fixed entity order, never by rank: `#3b82f6` `#f59e0b` `#ef4444` `#10b981` `#8b5cf6` `#f97316` `#06b6d4` `#db2777` (validated for CVD + normal-vision separation). 9th+ series → `SERIES_OVERFLOW_COLOR` `#98a2b3`. Aggregate series ("Total") → `SERIES_TOTAL_COLOR` Paragon Blue `#1E4076` (validated against every slot). `PLANT_COLORS` = first 6. |
| Look | Minimal-modern: no axis lines, dashed horizontal hairline grid only (`#eef0f3`, 3 4), no vertical grid |
| Line | `curve="monotoneX"`, 2px, round caps, no resting points (`LINE_DEFAULTS`) |
| Theme | `LINE_THEME`: tick text `#a0a6b1` 10px tabular, 4 y-ticks as integers, crosshair hairline `#c4c9d2` |
| Axes | point x-scale, auto y-scale, no axis titles |
| Hover | mesh + x-crosshair; `makeActivePointsLayer` draws solid 4px points in the series color with a 2px white ring on every series at the hovered x |
| Tooltip | `LineTooltip` — **standard for every chart tooltip** (line, bar, scatter): translucent slate card (`TOOLTIP_COLORS`: bg `rgba(42,61,74,0.82)` + 4px backdrop blur, 8% white border, radius 8), title 11px bold white, optional `subtitle` 9.5px `#94a3b8`, rows 11.5px = 6px dot (optional) · name `#cbd5e1` · value white bold tabular · unit 10.5px `#94a3b8`; optional sub-line 9.5px `#94a3b8`, `white-space: nowrap`; optional `footer` row above a hairline divider. UCL/LCL accents `#f5a39a`. Never define a local tooltip |
| Legend | `LineLegend`: **below the plot**, centered, 9.5px — 6px dot · name `slate-500` · last value bold; hover isolates (other lines 12%, legend items 40%; hovered line redrawn on top, same curve) |
| Card shell | `LineChartCard`: white `rounded-lg p-3 border-[#EBEBEB]`, hover shadow, uppercase 11.5px `slate-400` label + loading spinner, unit pill `bg-[#EEF4FB] text-[#16305C]` on the right, 300px plot, legend row below the plot, "No data available" empty state |
| Week axis | `evenWeekTicks()`: even ISO weeks only, every 4th when > 26 even weeks |
| SPC | `limitsOf()` mean ± 3σ (LCL ≥ 0); `controlMarkers()` hairline dashed UCL/LCL `#f3b4ae` + Mean `#d0d5dd` with small labels at the right; tooltip sub-line `LimitsSub`. No shaded band. **Optional — Overview TrendChart only**; Lead Time trend has no SPC. **All Overview TrendChart metrics are control charts** with this same rendering and the Overall / By plant toggle: Laney P′ (`laneyPLimits()`) for Lead Time (% PO > 13 d) and RFT (% RFT), XmR (`xmrLimits()`, center label "Mean", straight limits, % metrics clamped 0–100, Output labels compact e.g. 8.29M) for Output, OEE, OPE, Yield Loss; Yield Loss By plant is `locked`. Overview Lead Time is a **Laney P′ chart** of % PO > 13 days: `laneyPLimits()` (see `docs/BUSINESS_LOGIC.md` → SPC) and `makePChartLayer()`: no resting points; on hover (`makeActivePointsLayer` + `outOfLimitColor()`) points outside their own limits are red `#d92d20` instead of the series color, view toggle Overall (default, one `#1E4076` "All plants" line) / By plant; step lines UCL/LCL 1.5px dash `5 3` + p̄ 1px dotted with 9.5px bold labels (white halo, pushed ≥ 11px apart) at the right end — UCL/LCL `#e07a70`, p̄ `#98a2b3`. Only one band is drawn: Overall view = its own limits; By plant = the All plants limits (label prefix "All plants"), swapped to the hovered plant's limits (prefix = plant) on legend hover; red hover points always use each plant's own limits; tooltip sub-line `p̄ · UCL · LCL · late/n POs`; unit pill `% PO > 13 d`; caption below the legend. |

**Building a new line chart — checklist**
1. Wrap it in `LineChartCard` (label, unit pill, loading, empty state, legend slot).
2. Build `StandardSeries[]`; colors via `seriesColor(fixedIndex)` per entity (never by rank), aggregate via `SERIES_TOTAL_COLOR`.
3. `<ResponsiveLine {...LINE_DEFAULTS} … />`, `colors` via `isolatedColor()`, `onMouseMove`/`onMouseLeave` setting an active-x ref.
4. Layers: `["grid", "markers", "axes", "lines", "crosshair", ActivePointsLayer, ActiveLineLayer, "mesh"]` with `makeActivePointsLayer` / `makeActiveLineLayer`.
5. Tooltip: `<LineTooltip title rows={rowsAtX(series, x, unit)} />` — bar and scatter charts use `LineTooltip` too.
6. Legend: `<LineLegend series hovered onHover />` below the plot.
7. Weekly axis: `evenWeekTicks()`.

**Anti-patterns — do not repeat**
- Local Nivo theme, tooltip or legend in a chart file (use the module).
- Dark tooltip panel, thick (2.5px+) straight lines, resting points on every data point.
- Vertical grid lines, axis domain lines, axis titles.
- Black (`#101828`) for a "Total" series; colors assigned by rank/sort order.
- Legend above/beside the plot or at 11px+; wrapping tooltip sub-lines.
- SPC shaded band; UCL/LCL on charts that have no control-limit calculation.
- A 9th categorical hue — fold to `SERIES_OVERFLOW_COLOR`.

### TrendChart + StackedBarChart
Both charts share a KPI selector — changing selection in one updates the other. This is a deliberate design decision (Tableau parity).

**TrendChart:** Line chart per plant, styled entirely by the Standard Line Chart module above (theme, tooltip, legend below the plot). X-axis: even ISO week numbers only (W2, W4...). SPC UCL/Mean/LCL as hairline markers + tooltip sub-line (no shaded band); Lead Time = Laney P′ chart of % PO > 13 days (see SPC row above). Legend hover isolates a plant even when the parent does not track hover.

**StackedBarChart** still uses its own Nivo bar theme (not covered by the line standard).

**StackedBarChart:** Bar per plant, status legend (In Control / Above UCL / Below LCL).

---

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
