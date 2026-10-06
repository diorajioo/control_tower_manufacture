# Claude Code — Control Tower Manufacturing

## What Is This

Manufacturing KPI dashboard for PT Paracorp Group. Real-time data from Snowflake, authenticated via Azure AD. Plant Managers and Operations Managers use it daily to read production health and make decisions without waiting for manual reports.

Tech: Next.js 14 (App Router) · Snowflake · Azure AD via NextAuth.js · Groq AI · Tailwind CSS · Nivo charts.

## Source-of-Truth Hierarchy

Documentation tells you intent. Source code tells you implementation. When they conflict, trust the code.

| Layer | Authority |
|---|---|
| `docs/` directory | Single canonical documentation layer — always start here |
| Source files (`lib/`, `app/`, `components/`) | Implementation truth — always wins over docs |
| `PRODUCT.md`, `DESIGN.md`, `paradise.md` | Impeccable skill artifacts — do not edit manually; treat as background context only |

For any documentation question, the answer lives in `docs/`. Do not use root-level markdown files other than this one as reference — they are either Impeccable artifacts or historical.

For implementation details not covered by docs: read the source directly.
- Query behavior → `lib/queries.ts`
- Alert thresholds → `lib/alerts.ts`
- Exact design token values → `tailwind.config.ts`, `globals.css`, component source

## Documentation Map

| File | Contents |
|---|---|
| `docs/PROJECT_OVERVIEW.md` | Purpose, users, pages, routes, terminology |
| `docs/BUSINESS_LOGIC.md` | KPI definitions, formulas, thresholds, filter rules |
| `docs/ARCHITECTURE.md` | Tech stack, API routes, data flow, caching, AI routing |
| `docs/DATA_MODEL.md` | Snowflake tables, columns, date keys, known limitations |
| `docs/FEATURES.md` | Feature inventory — implemented / partial / planned |
| `docs/UI_UX.md` | Design system, page structure, components, Monitor layout |
| `docs/TECHNICAL_DECISIONS.md` | Architecture decisions and superseded choices |
| `docs/KNOWN_ISSUES.md` | Bugs, limitations, technical debt |
| `docs/SECURITY.md` | Auth rules, API security, secrets checklist, incident response |
| `docs/CHANGELOG.md` | Chronological project history |

## Critical Rules

### KPIs — do not modify without explicit instruction
- **KPI structure is fixed**: Lead Time · Yield/Loss · Right First Time (RFT) · Output (row 1) / OEE · OPE · Productivity (row 2)
- **Formulas documented in `docs/BUSINESS_LOGIC.md`**, implemented in `lib/queries.ts`. Change both if you change either.
- **Alert thresholds are in `lib/alerts.ts`** — documented in `docs/BUSINESS_LOGIC.md`.
- **OPE = OEE × 0.8** — derived estimate, not a Snowflake query.

### Layout — do not change without explicit instruction
- No layout changes unless user explicitly requests them.
- Dashboard (`/dashboard`) has a Strategic / Tactical toggle. Tactical = "Lead time per stage" actual vs standard chart (`LeadTimeStageStdChart`, real data via `/api/lead-time/stages`, "Open stage detail" → `/lead-time`), then "Lead time breakdown per plant" table (`LeadTimePlantTable`, same route; red = above network, on-time = gross ≤ 13 days). (The old Tactical KPI table was removed 2026-09-27.) The PO Created / PO Released basis toggle in the Header shows **only in Tactical** and drives the plant table's Gross LT + On-time (`basis` param on `/api/lead-time/stages`); the Overview Lead Time card is fixed to PO Created (since 2026-10-06).
- Header filters (Overview, Lead Time) only run after **Apply** (draft + Apply / Discard in `Header.tsx`); pass `initialFilters` when a page restores filters.
- Overview KPI cards: Productivity has an E2E / Mixing / Filpac toggle (real data, `getStageProductivity()`); OEE has an OEE / OEE SKU toggle where OEE SKU is locked (`locked: true` option in `SegmentedToggle`).
- Lead Time (`/lead-time`) has its own Strategic / Tactical / Operational view toggle. Tactical and Operational are **locked** (lock icon, not clickable — `locked: true` in `LEAD_TIME_VIEWS`) until they run on real data.
- Trend line charts (Overview `TrendChart`, `LeadTimeTrendChart`) have a Weekly / Monthly toggle (`GRAIN_OPTIONS` in `StandardLine.tsx`); the query groups per `DATE_TRUNC(week|month)` in Snowflake (`grain` param), never by re-averaging weekly points.

### Design system
- **Font: Lato only** — weights 400 and 700. No Inter, no Space Grotesk. `globals.css` imports Lato from Google Fonts.
- **Shell color: Paragon Blue `#1E4076` (navy)** — header bg, sidebar active item, primary CTAs, AI Summary, aggregate "Total" lines, sparklines. Hover / text on tint `#16305C`, tint bg `#EEF4FB`, tint border `#C3CEE3`; Tailwind `brand-*` scale centers on it (500). Changed from `#215AA8` on 2026-10-06 to match the ParagonCorp design reference. Never used for KPI health signals.
- **Card border: `border-[#EBEBEB]`** on dashboard cards — not `border-slate-200`.
- **Card shape: `rounded-lg`** on dashboard KPI cards; `rounded-xl` on Monitor components.
- **KPI cards: standard anatomy in `docs/UI_UX.md` → KPI Card standard** — label (no icon) · 30px value + change · sub-label · `StatusDot` · optional `KpiOneLiner` bar · secondary row · footer; toggles + navy sparkline in the right column; `compact` scales spacing only, never fonts. New KPI → `RegularKPICard`. `KPICard.tsx` is legacy.
- **Charts: Nivo only** (`@nivo/line`, `@nivo/bar`, `@nivo/scatterplot`) — do not switch to Recharts or any other library.
- **Line charts: the standard is `components/charts/StandardLine.tsx`** — same role as TONES for KPI cards. Every Nivo line chart must use it; never define a local theme, tooltip or legend. Spec + rules: `docs/UI_UX.md` → Standard Line Chart.
  - Minimal-modern: smooth `monotoneX` 2px lines, no resting points, dashed horizontal hairline grid only, no axis lines/titles.
  - Colors: `SERIES_COLORS` (`lib/chartConfig.ts`) by fixed entity order, never by rank; 9th+ series → gray `#98a2b3`; aggregate "Total" → Paragon Blue `#1E4076` (never black).
  - Hover: hairline crosshair + solid 4px points with white ring; tooltip = `LineTooltip`; sub-lines (e.g. Mean · UCL · LCL) 9.5px, never wrap.
  - Legend (`LineLegend`): below the plot, centered, 9.5px, dot · name · last value, hover isolates.
  - SPC UCL/Mean/LCL only where the calculation exists (Overview TrendChart) — no shaded band. **Every Overview trend metric is a control chart with the same look and the same Overall / By plant toggle** (API returns an exact "All plants" row via GROUPING SETS): **Laney P′** for count proportions — Lead Time (% PO > 13 days) and RFT (% activities without ADJUST) — and **XmR** (`xmrLimits()`, mean ± 2.66 × avg moving range, straight limits) for Output, Productivity (E2E), OEE, OPE, Yield Loss. Trend tabs = `TREND_KPI_OPTIONS` (`lib/chartConfig.ts`): Lead Time · Output · Productivity · OEE · Yield Loss · Energy (locked); OPE/RFT code kept but not offered. Yield Loss By plant is locked (no PLANT column). Lead Time details: **Laney P′ chart of % PO > 13 days** (limits per point from its PO count, widened by σz; `laneyPLimits()` + `makePChartLayer()` in `StandardLine.tsx`): no resting points; on hover, points outside limits show red (`outOfLimitColor()`). View toggle **Overall** (default — one Paragon Blue "All plants" line, n/late summed over plants, UCL · p̄ · LCL step lines + labels always shown) / **By plant** (one line per plant; the chart still shows one band — the All plants limits — and hovering a plant in the legend swaps it to that plant's own limits + values; red hover points use each plant's own limits). Limit lines: UCL/LCL 1.5px dash 5 3, p̄ 1px dotted. Other KPIs keep fixed mean ± 3σ.
- **Tooltips: `LineTooltip` is the standard for every chart** (line, bar, scatter) — translucent slate card (`TOOLTIP_COLORS` in `StandardLine.tsx`), rows never wrap, optional `subtitle` / `footer` / `nowrap`. Never define a local tooltip.
- **KPI highlight: `components/ui/KpiHighlight.tsx`** — rule: clicking one metric (AI Summary number or chat `[kpi:ID]` chip) gives that card a thin translucent blue outline + soft lift and **drops every other KPI card to 35% opacity**; same click again, a click elsewhere or Esc clears it. Senders call `highlightKpi(id)` and spread `KPI_TRIGGER_ATTR`. **Every** KPI card sits inside `<KpiHighlightTarget id>` — data cards use `leadtime | output | productivity` (`KPI_HIGHLIGHT_IDS`, the only clickable IDs; AI Summary gets them from `[kpi:ID]` tags the model writes), no-data cards (OEE, Yield, Energy, VA/NNVA/Waste/Saving) use their own ID so they dim too. When you add, replace or move a KPI card, keep the wrapper; when a KPI gets data, add its ID to `KPI_HIGHLIGHT_IDS`. In dev a console warning shows IDs with no target.
- **KPI card one-liner: `components/ui/KpiOneLiner.tsx`** — the AI Summary call also returns a `[[CARDS]]` block (`leadtime: … / output: … / productivity: …`, ≤ 12 words, at most one number from the data). AISummary hides that block from the paragraph and publishes it with `setKpiOneLiners()`; cards render `<KpiOneLiner>` via the `insightId` prop as their own light-blue bar (`#EEF4FB`, "AI" tag) below the status row. Hidden while loading / on error. Productivity shows it on the E2E view only. Cache `ai_summary_*_v5`.
- **Toggles: `components/ui/SegmentedToggle.tsx`** is the standard (same style as the Overview KPI card toggles). Chart card titles: 11.5px bold uppercase `text-slate-500`.
- Full design system spec: `docs/UI_UX.md`.

### Data
- Lead Time page: **Strategic KPI cards use real data** (Lead Time = `LiteKPICard`; Value-Added / NNVA / Waste / Potential Saving = `LeadTimeCategoryCard` with fixed colors, no status rules — all from `/api/dashboard/kpi`, driven by the page's own Header filters). The "Lead time trend" (weekly, overall + per `POSITION`), "Lead time and PO count per SKU" scatter, and "Lead time per stage" Pareto (VA/NNVA/UNVA per `POSITION`, cumulative %) and "Top 10 SKU by lead time" (Composition / P10–P90 Range, SKUs with ≥5 POs) charts are also real (`/api/lead-time/charts`). The mock Top/Bottom SKU by volume tables, On-Time PO Trend and SKU Pareto are no longer rendered in Strategic (code kept for reuse). The Lead Time Monitor (`components/monitor/LeadTimeMonitor.tsx`) also uses real data (KPI cards + the 4 Strategic charts, same APIs, follows filters). Everything else on the page (Tactical/Operational views) is still **static mock data**. POSITION codes are shown with English names from `lib/leadTimeStages.ts`.
- **AI scope**: AI Summary, AI Risks, Chat and alerts (incl. Teams) only cover metrics with data on a page — Lead Time, Output, Productivity. OEE / OPE, Yield Loss (bulk + pack), RFT and Energy are excluded until their cards show data; the lists live in `lib/aiScope.ts`.
- **AI narrative (`lib/kpiNarrative.ts`)**: Summary, AI Risks and Chat explain how one KPI drives another, not just read numbers. All three share `KPI_RELATIONSHIPS` (domain map), `NARRATIVE_RULES` and `buildKpiContext(kpi)` — which also adds lead time composition, top stages, upstream vs downstream and **Signals**: direction facts computed in code (e.g. "lead time and FG both rose") so the model cannot invert a link. Change the narrative there, not per prompt.
- **Lead time basis: `lib/leadTimeDefinition.ts`** is the only place that defines where gross lead time starts (`LEAD_TIME_START_SQL`, now PO Created) and ends (`NDC_RECEIVED_AT_SQL`), plus `LEAD_TIME_TARGET_DAYS` (13, defined on PO Released → NDC). Never inline `ACTIVITY = 'PO'` start/stop SQL or the number 13 again. Switch to Released only after the identifier is confirmed — checklist in `docs/BUSINESS_LOGIC.md` → Lead Time basis.
- **Data source: `lib/db.ts`** — import `executeQuery` from `@/lib/db`, never from `lib/snowflake` directly. `DATA_SOURCE=snowflake|clickhouse`; SQL stays in Snowflake syntax and is translated for ClickHouse (`lib/sql/clickhouseDialect.ts`). After adding or changing a query, run `npx tsx scripts/check-clickhouse-sql.ts`; if it fails, extend the translator.
- All Snowflake queries use parameterized bindings (`?` placeholders) — no string interpolation for user input.
- `DATAMART_PRODUCTION_OUTPUT_OLAH` has **no PLANT column** — plant filter is not applied for Bulk Output/Bulk Loss.

### Language
- All UI copy is in **English** on every page (changed 2026-09-26 at the user's request) — including alert messages, AI Summary / AI Risks output, Teams/email notifications, and the chat default reply language (chat still replies in the user's language if they write in another one).
- `lib/i18n.tsx` keeps the `id` dictionary in code, but `I18nProvider` is fixed to `"en"` (a stored `"id"` preference is ignored, `setLang` is a no-op) and the Settings → Display language picker is hidden (`SHOW_LANGUAGE_PICKER = false`).

### Deployment
- Production: Vercel from branch `main`.

## Development Behavior

Before modifying code:
1. Read the relevant `docs/` document for the area you're touching.
2. Inspect the current implementation in the affected file.
3. Check whether the change conflicts with any documented rule above.
4. Make the smallest change that solves the problem — do not refactor surrounding code.
5. After a significant architectural decision, update the relevant `docs/` file.
6. Never rely on this conversation's history when the docs provide current information.

## Anti-Slop Rules

For all UI/design work in this project, read and follow:
- Core rules: `.claude/skills/antislop/antislop.md`
- UI depth: `.claude/skills/antislop/antislop-ui.md`
- Copywriting: `.claude/skills/antislop/antislop-copywriting.md`

Before starting any UI work:
1. Read the core antislop.md rules.
2. Ask the user: should antislop apply DURING or AFTER the work?
3. Do not start until the user answers.
