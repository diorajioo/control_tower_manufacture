# Changelog — Control Tower Manufacturing

Derived from git log and conversation history. Most recent changes first.

---

## 2026-10-06

### Changed
- **Teams summary → friendly story format** (user request): greeting · 2–3 sentence story · 3 emoji KPI bullets · focus line, AI returns JSON from facts computed in code, template fallback. Single-plant recipients get their plant vs the network (FG per plant from `CT_MANUF_TRENDS`). New `check:` cause (tiny-share plant driving most of the E2E change → data check). Settings: username-only recipient input (`@paracorpgroup.com` fixed), autosave with Unsaved changes status.
- **Teams alerts: Adaptive Card + AI narrative** instead of an HTML bullet list — header (severity · KPI, message, plant · period · time), facts (value vs target, main driver stage), "Why and what to do" (2 AI sentences from the KPI snapshot), Open dashboard button. Same card for the Graph DM and the legacy webhook. Fixed: AI recommendation was never sent on the Graph path; lead-time increase was colored green; % change shown twice. KPI query + cache moved to `lib/kpiData.ts` (`getKpiSnapshot()`), so the Teams route reads the same snapshot. `withRecommendation` removed; senders pass startDate/endDate.
- **Overview KPI cards show only the toggled value** — secondary row removed from all 6 cards (Lead Time Gross/Nett, Output FG/Bulk + footer "Bulk:/FG:", Productivity Upstream · Downstream, OEE OPE, Yield Loss Bulk · Pack, Energy prior period). Now the KPI card standard: `showSecondary` on `LeadTimeKPICard` / `OutputKPICard` defaults to `false`; Strategic Monitor follows it too.
- **KPI card AI one-liners state a cause, not the card's numbers** — `cardCauses()` (`lib/kpiNarrative.ts`) computes one cause per card: Lead Time = largest stage + share of gross lead time; Output / Productivity = plant driving the Released FG / E2E change (new `getPlantDrivers()`, All Plant only; FG per plant from `CT_MANUF_TRENDS` — shares only, its total runs ~10% above the card; falls back to level share when the prior period has no CT data, e.g. YTD). KPI cache `kpi-by-*-v10`, AI Summary cache `ai_summary_*_v6`.
- **Overview trend tabs follow the KPI cards**: Lead Time · Output · Productivity (new E2E trend query, XmR) · OEE · Yield Loss · Energy (locked). OPE and RFT tabs removed (code kept). `TREND_KPI_OPTIONS`; trend cache `v5`. Stale trend responses are ignored when the tab changes.
- **Control charts: out-of-limit points are red only on hover** (no resting red dots); Lead Time card stage bars and dashboard loading spinner moved to navy `#1E4076`.
- **Overview trend: every metric is a control chart with Overall / By plant** — Laney P′ for Lead Time and RFT, XmR for Output, OEE, OPE, Yield Loss; same red out-of-limit dots / labeled limits as Lead Time; other points only on hover. Trend cache `trends-by-*-v4`. Trend SQL returns an exact "All plants" row (GROUPING SETS); RFT also returns N + count. Yield Loss By plant locked. Output Y axis compact (8.29M).
- **Fixed: Yield Loss trend + sparkline queries** used a non-existent column `BULK_LOSS_QUANTITY` (Snowflake error); now the documented formula `ABS(Σ theoretical − Σ realization) / Σ theoretical × 100`.
- **KPI Card standard rewritten** in `docs/UI_UX.md` to match the current cards (anatomy diagram + rules); `KPICard.tsx` marked legacy.
- **Brand blue → navy `#1E4076`** (ParagonCorp design reference) — every use of `#215AA8` and its tints across app, charts, Tailwind `brand-*` scale and docs: `#215AA8`→`#1E4076`, hovers `#1A4886`/`#1B4B8C` and dark text `#143665`→`#16305C`, tints `#D3DEEE`/`#E9EFF6`/`#EAF0F8`/`#EEF3FA`→`#EEF4FB`, tint borders `#A6BDDC`/`#D5E0EF`→`#C3CEE3`, highlight outline rgba(33,90,168)→rgba(30,64,118). Only the blue changed; status colors unchanged.
- **AI Summary on Paragon Blue** — `#215AA8` background, white text and white underlined KPI numbers (Overview + Strategic Monitor).
- **Overview: PO Created / PO Released toggle moved to Tactical** — the Header basis toggle now shows only in the Tactical view and drives Gross LT + On-time in "Lead time breakdown per plant" (`getLeadTimeByPlant(…, basis)`, `basis` param on `/api/lead-time/stages`, cache `lead-time-stages-v3`). The Strategic Lead Time card is fixed to PO Created.
- **Overview TrendChart, Lead Time: Laney P′ chart of % PO > 13 days** — point on every period, UCL/LCL per point from its PO count (Laney σz), view toggle Overall (default, one line, limits always shown) / By plant (one All plants band; legend hover shows that plant's own limits), red dot outside limits. Trend query returns `N` + `LATE`; cache `trends-by-*-v3`. Legend hover now isolates on the Overview too.

### Added
- **Scheduled Teams summaries + per-recipient schedules** — Settings → Microsoft Teams: per recipient plant, alerts (Off / As they happen / Daily digest + time), summary (Off / Daily / Weekly + weekday, time, Last 7 days / Last 30 days / Year to date); Sender card ("Use my account", framework for a service account); test alert / test summary buttons. Summary card = alert card shape (KPI facts + active alerts, main drivers, 3-sentence AI "What it means"). New: `lib/notifications/` (store on Vercel Blob or file, WIB schedule math, delivery), `/api/cron/notifications` (Bearer `CRON_SECRET`; `vercel.json` cron 07:00 WIB daily), `/api/settings/teams/sender`, `alertsFromKpi()`. Alerts now go only to recipients of the plant they fired for and are deduped per recipient. `@vercel/blob` added; the store is detected by `BLOB_STORE_ID` (Vercel OIDC) or `BLOB_READ_WRITE_TOKEN`.
- **AI one-liner on KPI cards** — Lead Time, Output and Productivity (E2E view) cards show a one-line AI insight as their own bar below the status row (`KpiOneLiner`). Generated in the same AI Summary call (`[[CARDS]]` block after the paragraph, ≤ 12 words each), cache `ai_summary_*_v5`; also on the Strategic Monitor.
- **Apply button for filters (all pages with the Header filter bar: Overview, Lead Time)** — period / plant / date range / data level are a draft until Apply; Discard reverts; invalid custom range blocks Apply. Header takes `initialFilters`, fixing the Overview header showing YTD · All Plant while restored filters were active.
- **Productivity card toggle E2E / Mixing / Filpac (real data)** — `getStageProductivity()`: Mixing kg/mh from `CT_MANUF_OLAH` (RELEASE_BULK once per SFG / Σ MANHOUR), Filpac pcs/mh from `CT_MANUF_KEMAS` deduplicated per `ACTIVITY_ID` (KEMAS has one row per operator). Value, prior-period trend and weekly sparkline per view; KPI cache `kpi-by-*-v9`.
- **OEE card toggle OEE / OEE SKU** — OEE SKU is locked (`locked` option on `SegmentedToggle`); OEE still has no data.

---

## 2026-09-27

### Added
- **Overview Tactical: "Lead time per stage" actual vs standard (real data)** — new `LeadTimeStageStdChart.tsx` above the KPI table. Horizontal bars = days per PO per `POSITION` (single color), tick = standard from `ACTIVITY_LEADTIME_STD` (minutes per row; only TIMBANG / OLAH / CUCI OLAH have usable values), sorted by process sequence (`STAGE_ORDER`), with WIP always last in this chart. "Open stage detail" goes to `/lead-time`. New query `getLeadTimeStageVsStd()` + route `/api/lead-time/stages` (cache `lead-time-stages-v1`), fetched only while Tactical is open.
- **Overview Tactical: "Lead time breakdown per plant" table (real data)** — new `LeadTimePlantTable.tsx` below the stage chart. Rows = Network (ROLLUP) + each `PLANT`; columns = Gross LT · days per PO per stage (same columns/order as the chart, grouped Upstream / Downstream, WIP last) · Nett LT · On-time. Red cell = plant above the network value for that stage (tint up to +30%), explained in the info icon. On-time = % of POs with gross ≤ 13 days (the Lead Time target — no due-date column exists). New query `getLeadTimeByPlant()`; `plants` + `targetDays` added to `/api/lead-time/stages` (cache `lead-time-stages-v2`). Waterfall toggle from the mockup not built yet.
- **Overview Tactical: old KPI table removed** — the Tactical view is now the stage chart + plant breakdown table only. Plant table header: Paragon Blue group row, light-blue stage row.

---

## 2026-09-26

### Security
- **SQL injection fix in `lib/queries.ts`** — `plantWhere()` interpolated the plant string into SQL; it now emits `AND PLANT = ?` with values from `plantBinds()`, appended after the date binds. The raw `startDate`/`endDate` interpolation in `getLeadTimeTrend`, `getTrendsData` and `getTrendKPIByPlant` is now `BETWEEN ?::DATE AND ?::DATE`. Results unchanged.

### Changed
- **Fix (production): Overview trend chart squashed + AI Risks shorter than local** — Row 3 grid now `shrink-0` (taller KPI rows made the flex column squash the 420px row). `/api/ai-risks` and `/api/chat` get `maxDuration = 60` (Vercel default limit cut the streamed answer short); AI Risks caches only complete answers and ignores incomplete cached ones.
- **Lead Time Strategic: mock charts removed** — Top 5 / Bottom 5 SKU by volume tables, On-Time PO Trend and Lead Time Pareto per SKU (static mock) are no longer rendered; components kept for reuse. The page now ends with "Top 10 SKU by lead time".
- **Lead Time page: "Top 10 SKU by lead time" chart (real data)** — below "Lead time per stage". New `LeadTimeTopSkuChart.tsx` + query `getLeadTimeTopSku()` (SKUs with ≥5 POs, info icon explains). Toggle Composition (stacked VA/NNVA/UNVA share of average gross) / Range (P10–P90 + average). `topSkus` added to `/api/lead-time/charts`, cache key `v6`.
- **SKU scatter: lower bound removed** — `getLeadTimeBySku()` now keeps SKUs with fewer than 100 POs (was 10–99); subtitle and info icon updated, `/api/lead-time/charts` cache key `v5`.
- **Lead Time page: "Lead time per stage" Pareto on real data** — replaces the mock "Lead Time per Stage" chart. Stacked VA/NNVA/UNVA bars per `POSITION` (days per PO), sorted descending, cumulative-% line, category filter and Stage / Stage + WIP toggle, auto insight line. New query `getLeadTimeByStageCategory()`, `stages` added to `/api/lead-time/charts` (cache key `v4`), new `components/dashboard/LeadTimeStageChart.tsx` and `lib/leadTimeStages.ts` (English stage names, also used by the trend legend). Mock `StageGroupChart` code kept, not rendered.
- **Number format** — `formatThousands` now uses `en-US` (1,234,567) to match the English UI.
- **Overview KPI cards: 3 per row** — rows 1 and 2 now `grid-cols-3` (was 2 + 4). Row 1: Lead Time · Output · E2E Productivity; row 2: OEE · Yield Loss · Energy. All six use the regular card style: `LeadTimeKPICard` / `OutputKPICard` gained a `compact` prop (padding, gaps and sparkline × 0.8; fonts stay regular; style unchanged) and the other four moved from `LiteKPICard` to the new `components/dashboard/RegularKPICard.tsx` (same style as `OutputKPICard`). No calculation changes. `LeadTimeKPICard` gained `showBreakdown` (default `true`); Overview passes `false` so all six cards share one height — the breakdown code stays for reuse on other pages.
- **Line chart standard locked** — the minimal-modern style in `components/charts/StandardLine.tsx` is now the official line-chart standard (like TONES for KPI cards): rules in `CLAUDE.md`, full spec + build checklist + anti-patterns in `docs/UI_UX.md` → Standard Line Chart. Tooltip sub-lines (Mean · UCL · LCL) 9.5px, no wrap. Outdated dark-tooltip theme notes removed.
- **All UI copy switched to English** (user request) — every page, Settings, alert messages (`lib/alerts.ts`), AI chat labels/quick actions, AI model picker, email + Teams notification templates, notification API errors, print-block message. AI Summary prompt now asks for English (cache key bumped to `ai_summary_text_en`); AI Risks and Teams AI recommendation prompts ask for English; chat defaults to English but replies in the user's language if they write in another one. `lib/i18n.tsx` keeps the `id` dictionary but `I18nProvider` is fixed to `"en"` and the Settings → Display language picker is hidden. Notification timestamps use `en-GB`. Chat follow-up parsing now also matches the English "Want to explore further?" header.

---

## 2026-09-25

### Changed
- **Line charts redesigned (minimal-modern)** — Overview `TrendChart` and Lead Time trend share the new look via `components/charts/StandardLine.tsx`: smooth 2px lines, dashed hairline grid, light tooltip card, dot legend, solid hover points; Overview SPC shaded band removed, UCL/Mean/LCL kept as hairline markers. Calculations and chart sizes unchanged. `d3-shape` added as a direct dependency. Legend moved below the plot (9.5px); Lead Time "Total" series now Paragon Blue.
- **Standard line chart** — `components/charts/StandardLine.tsx` (`LINE_THEME`, `LINE_DEFAULTS`, `LineTooltip`, `LineLegend`, active point/line layers) extracted from the Overview `TrendChart`; `SERIES_COLORS` (8, validated) + overflow/total colors added to `lib/chartConfig.ts`. Overview `TrendChart` refactored onto it (no visual change). Lead Time trend rebuilt from scratch on it as `components/dashboard/LeadTimeTrendChart.tsx`; `LineChartCard` shell + `evenWeekTicks()` + SPC helpers (control zone, UCL/Mean/LCL markers, tooltip limits) added to the standard; used by Overview only — Lead Time trend has no UCL/LCL.
- **Sidebar redesign** (`components/dashboard/Sidebar.tsx`)
  - English labels, grouped nav: Overview · Alert Center | Lead Time · Output · Productivity · Yield · Energy · OEE · Root Cause Analysis | Reports · AI Fusion (BETA); footer Settings · User Management · Guide · Sign Out.
  - Items without a page look normal and respond to hover but do nothing on click (previously Output/Productivity/OEE/Energy linked to 404s).
  - Alert Center badge shows the live alert count (`computeAlerts()`).
- **Lead Time page: Strategic KPI cards on real data**
  - Replaced the 3 mock Strategic cards with 5 `LiteKPICard`s: Lead Time · Value-Added · Necessary Non-Value-Added · Waste · Potential Saving.
  - New query `getLeadTimeComposition()` in `lib/queries.ts` — per-PO `SUM(NET_LEADTIME)` by `ACTIVITY_CATEGORY` (VA/NNVA/UNVA) plus UNVA-WIP, averaged across POs.
  - `/api/dashboard/kpi` now returns `leadTime.composition` (current, previous, trend); cache keys bumped to `v3`.
  - New Strategic charts below the cards: **Tren lead time** (weekly, Total + per `POSITION`, click legend to toggle) and **Lead time dan jumlah PO per SKU** (scatter, canvas). New API `/api/lead-time/charts`, queries `getLeadTimeWeeklyByPosition()` + `getLeadTimeBySku()`, new dependency `@nivo/scatterplot`.
  - Lead time trend: plain lines, points only on the hovered week. SKU scatter limited to SKUs with 10–99 POs (info icon explains). Trend chart restyled to match the Overview TrendChart (hover-to-isolate legend, dark tooltip). All Lead Time page copy switched to English.
  - Filters come from the Lead Time page's own Header filter row (period, custom dates, plant); plant list loaded from `/api/dashboard/plants` (previously hardcoded "Plant 1 / Plant 2 / NDC", and filter changes were ignored).
  - VA / NNVA / Waste / Potential Saving moved to a dedicated `components/dashboard/LeadTimeCategoryCard.tsx`: fixed green / amber / red / green, "% dari total" context line, description, info tooltip, monthly-average sparkline (`getLeadTimeCompositionMonthly()`); cache keys bumped to `v5`. Lead Time card stays `LiteKPICard`.

---

## 2026-09-16

### Changed
- **Monitor: fix layout density for Strategic and Lead Time views** (`e065582`)
  - Strategic: removed `max-h-[260px]` cap from charts row — charts now fill all remaining viewport height.
  - Lead Time: restructured to mirror Strategic layout density — VA/NNVA/UNVA breakdown moved to a compact `shrink-0` stat row; stage chart and Top 5 SKU table share remaining `flex-1` space.

---

## 2026-09-14–16

### Added
- **Monitor Mode: dedicated `/monitor` route** (`31370f7`)
  - New page: `app/monitor/page.tsx` — fullscreen page with bottom navigation bar.
  - New component: `components/monitor/StrategicMonitor.tsx` — self-fetching Strategic layout for Monitor.
  - New component: `components/monitor/LeadTimeMonitor.tsx` — static mock Lead Time layout for Monitor.
  - Fullscreen API: `requestFullscreen()` on mount, `router.back()` on Escape.
  - Bottom nav: live WIB clock · filter context · Strategic/Lead Time page pills · exit button.
  - Filters passed as URL params from each page's monitor button.
  - Cross-page navigation without exiting fullscreen.

### Changed
- **Removed in-place Monitor Mode from `/dashboard`** (`cd29ee5`, `31370f7`)
  - Removed: `MonitorSubStat`, `MonitorStat`, `MonitorView` components from dashboard page.
  - Removed: `isMonitorMode`, `isTVMode` state, TV auto-rotate timer, fullscreenchange effects.
  - Monitor button now calls `router.push('/monitor?page=strategic&...')`.

- **Removed Monitor Mode from `/lead-time`** (`cd29ee5`, `31370f7`)
  - Removed: `isMonitorMode` state and all conditional renders based on it.
  - Monitor button now calls `router.push('/monitor?page=lead-time')`.

---

## 2026-09-14

### Changed
- **Strategic/Tactical restructure** (`cd29ee5`)
  - Dashboard nav item renamed: "Overview" → "Strategic".
  - Strategic/Tactical toggle removed from `/dashboard`. Dashboard always shows Strategic layout.
  - `views={[]}` passed to Header — toggle hidden when `resolvedViews.length < 2`.
  - `activeView` state removed from `app/dashboard/page.tsx`.
  - OEE KPI card added back to Equipment section → 3-col grid (OEE · OPE · Productivity) always.
  - `/lead-time` retains its own Strategic/Tactical/Operational view toggle.

### Fixed
- **Syntax error: orphaned `)` in Hero OEE block** (`52097bf`)
  - Cause: After removing `{activeView === "strategic" && (`, the closing `)}` became orphaned.
  - Fix: Changed `)}` → `}` at end of Hero OEE JSX block.

---

## 2026-09-13

### Changed
- **PRODUCT.md: updated pages map, Header universalization, Lead Time structure, brand tokens** (`ba1da21`)
  - Lead Time views documented (Strategic / Tactical / Operational).
  - Brand token descriptions corrected to Paradise v2 values.

---

## 2026-09-11–12

### Changed
- **Lead Time: Pareto runtime crash fix + consistent filter bars** (`936df43`)
- **Lead Time: replace all SVG charts with Nivo** (`f9c0a6d`)
  - Consistent proportions across chart types.
- **Lead Time: apply Paradise v2, restructure Strategic view** (`42eff53`)
  - Paragon Blue accent, card tokens, font Lato.
- **Lead Time: remove per-view filter bars** (`7c25f59`)
  - Filters now handled by universal Header.
- **Header: universalize view toggle + apply to Lead Time page** (`2d92f2b`)
  - View toggle now driven by `views` prop. Lead Time uses `LEAD_TIME_VIEWS` array.
  - Header hidden-toggle behavior: only shows when `resolvedViews.length >= 2`.
- **Lead Time: remove view title/breadcrumb headers** (`4f04d67`)
  - Pages start directly with cards.
- **Lead Time: complete Header feature parity** (`d738672`)
  - Monitor mode button, countdown timer, notification bell added to Lead Time header.

---

## 2026-09-09–10

### Added
- **Charts: Paradise tokens, compact layout, consistent title style** (`2877670`)
  - TrendChart and StackedBarChart updated to match `text-[10.5px]` card label style.
  - Shared KPI selector — both charts sync KPI selection.
  - 2W (even ISO week) tick filter for X-axis.
- **Dashboard: Monitor Mode, Lead Time page, AI chat, Security Overlay** (`6eed6e2`)
  - Initial implementation of all major features.
  - Lead Time page: first version with mock data.
  - AI Analyst floating chat.
  - Security overlay component.

---

## 2026-09-07–08

### Added
- **Design: apply Paradise Design System v2** (`6ceef49`)
  - Font changed from Inter to Lato.
  - Shell color: navy `#1E4076` → Paragon Blue `#215AA8`.
  - Card radius: `rounded-xl` → `rounded-lg`.
  - Border: `border-slate-200` → `border-[#EBEBEB]`.
  - Warning color: `#f59e0b` → `#D1A400`.
  - AI Summary: navy gradient → white card with AILabel gradient chip.

### Added
- **Public assets: Paragon Corp logo** (`3463089`)

---

## Earlier (August–September 2026)

### Added
- **Teams: server-side dedup + unified recipient resolution** (`72f682b`)
- **Teams settings: server-side sync across devices** (`6ffe1ec`)
- **Teams: enforce enabled flag as master switch** (`db50730`)

### Fixed
- **Teams: various fixes — GUID lookup, UPN format, OAuth scopes** (`d142c58`, `5c27f48`, `047267d`, `234fcb2`, `bb8bf98`, `fc87e34`)

### Changed
- **Login page: full redesign** (`97d53fa`, `7530116`, `0312de6`, `dde6348`)
  - Typewriter animation, floating KPI icon cards, Microsoft SSO button.

---

## Earlier (Initial Build)

### Added
- Initial Next.js 14 App Router setup
- Snowflake SDK integration
- Azure AD auth via NextAuth.js
- KPI dashboard: Lead Time, Yield, RFT, Output, OEE, OPE, Productivity
- Nivo charts: TrendChart (line + SPC), StackedBarChart (bar by plant)
- Alert system with threshold detection
- Microsoft Teams notifications via Graph API
- Groq AI Summary and AI Analyst chat
- Security headers, rate limiting middleware
- `QUERIES.md` KPI query documentation
- `DESIGN.md` Paradise v2 design system documentation
- `data_security.md` security framework
