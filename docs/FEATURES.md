# Features — Control Tower Manufacturing

## Dashboard — Strategic View (`/dashboard`)

**Status: Implemented (live data)**

### Current behavior
- Permanent Strategic layout — no view toggle. The dashboard always shows the Strategic view.
- Sidebar nav item label: "Overview".

### Layout (top to bottom)
1. **AI Summary strip** — white card with AILabel gradient chip, 3-sentence executive summary, auto-generated from current KPI state.
2. **Alert Panel** — shown only when there are active, undismissed alerts. Alert rows with dismiss (undo available 5 seconds).
3. **KPI row 1** — 3-column grid: Lead Time (`LeadTimeKPICard`) · Output (`OutputKPICard`) · Productivity (`RegularKPICard`, toggle E2E / Mixing / Filpac, all real data). Row 2 OEE card has an OEE / OEE SKU toggle (OEE SKU locked; OEE still no data).
4. **KPI row 2** — 3-column grid: OEE · Yield Loss · Energy (`RegularKPICard`, no data yet).
   All six use the KPI Card standard (label ⓘ · value · target line · status pill On Track / At Risk / Off Track · prior-period line · sparkline · AI one-liner · "Open page →" footer, `docs/UI_UX.md`) at `compact` size so three fit per row; no-data cards keep every row. Clicking a sparkline switches the trend chart to that KPI.
5. **Trend + AI Risks** — 2fr / 1fr grid: TrendChart (Standard Line Chart, SPC markers; header = Metric ▾ · Overall / By plant · Weekly / Monthly ▾) + AIRisksPanel.
   - **Planned:** Quarterly grain in the Weekly / Monthly dropdown (all trend charts).

### User interactions
- Header filter row: Period picker, Plant dropdown, Data Level selector. Changes trigger immediate re-fetch.
- Refresh button: force-reloads KPI data, flashes `#1E4076` overlay briefly.
- Bell icon: opens alert panel / Teams alert send.
- Monitor button: navigates to `/monitor?page=strategic&plant=...&period=...&...` (opens fullscreen mode).
- AI Summary: clickable numbers trigger `kpi-highlight` CustomEvent to highlight the relevant KPI card.
- AI Chat: floating button bottom-right opens AI Analyst chatbot.

---

## Lead Time Page (`/lead-time`)

**Status: Implemented — real data (rebuilt 2026-10-13)**

### Filters
- Header filter bar (Period · Start / End date · Plant · Resolution · Apply) — no view toggle on this page.
- **Lead Time filter card** (`components/leadtime/LeadTimeFilterCard.tsx`, applies at once): **Scope** PO Created / PO Released (start of gross lead time) · **Basis** Gross / Nett · **Unit** Days / Hours · **No. PO · Activity · Line category · Line · SKU group · SKU · Variant** (searchable dropdowns, lists from `/api/lead-time/options` for the period and plant) · "Clear n filters".
- Dimension filters select **whole POs**: a PO is kept when it has at least one row matching every set value (`lib/leadTimeFilters.ts`, `ltWhere()` in `lib/queries.ts`); Activity additionally limits the sunburst and the Pareto to that activity.

### Tabs
- **Analysis** — Lead Time card (average gross or nett per PO, change vs prior period, status vs the 13-day target for gross / vs prior period for nett, weekly sparkline, position bar 0 → max with Target and Current, median and P25–P75 note, PO count) · Lead time composition (VA / NNVA / UNVA (WIP), share of their sum) · **Group process and process** sunburst (inner ring 6 groups, outer ring processes; click a group to zoom, centre / "All groups" to go back; slices < 1.5% merge into "Others"; legend lists every process when zoomed; each slice shows its time inside the ring when wide enough; follows Scope, Basis, Unit; no PO group for PO Released) · **Lead Time Distribution** box plot per process group (IQR box, median, whisker Min → P90, Focus ▾ + Pareto / Process order) with the Lead time statistics table · **Lead Time Distribution per PO** histogram (same as Tactical: 2-day bins, normal curve, mean ±1σ, stats; follows Scope, Basis, Unit and the page filters) + **Lead Time per PO** table (No. PO · SKU · Gross · Nett · PO · Weighing · Mixing · Filpac · Receive NDC · WIP; all POs by default, sortable, gross desc; **click a histogram bar → table shows only that bin's POs**, click again or ✕ on the chip → all POs) · **Lead time per plant** table (same `LeadTimePlantTable` as the Pareto tab) · **Lead Time per Line** bubble chart (Activity ▾ Mixing = OLAH / Filling Packing = KEMAS 1–2; y = average process time at the line per PO, x = PO count, size = volume Σ RELEASE_QTY pcs; quadrants at the mean of the lines shown; lines with ≥ 10 POs) + **Lead Time SKU per Line** table (SKU · Line · PO · Avg · Volume, sortable, Line ▾); click a bubble → table shows that line, click again → all lines · Lead time trend (weekly / monthly).
- **Pareto** — Pareto lead time (Group Process / Process, Par / Seq by `ACTIVITY_SEQUENCE`) · Lead time breakdown per plant (Group Process / Process views).
- **Ranking** — Top 10 SKU by lead time (Composition / P10–P90) · Lead time vs PO count scatter (Brand / Variant / SKU group / SKU).
- APIs: `/api/lead-time/analysis` (stats, weekly, composition, time per activity), `/api/lead-time/charts`, `/api/lead-time/stages`, `/api/lead-time/scatter`, `/api/lead-time/trend`, `/api/lead-time/options` — all take the dimension filters.
- The old Strategic / Tactical / Operational views (Tactical and Operational were mock) were removed.

### User interactions
- Monitor button: navigates to `/monitor?page=lead-time` (Lead Time Monitor unchanged)

---

## Monitor Mode (`/monitor`)

**Status: Implemented**

### Current behavior
- Dedicated route `/monitor` — not an in-place overlay on other pages.
- On mount: requests fullscreen (`document.documentElement.requestFullscreen()`).
- On fullscreen exit (Escape key): fires `fullscreenchange` event → `router.back()`.
- Bottom navigation bar: clock (WIB, live second-tick) · filter context label · page pills · exit (×).
- Exit button: exits fullscreen, navigates to `currentPage.exitHref`.

### Pages in Monitor
| Page | Key | Source | Data |
|---|---|---|---|
| Strategic | `strategic` | `components/monitor/StrategicMonitor.tsx` | Live Snowflake via `/api/dashboard/kpi` |
| Lead Time | `lead-time` | `components/monitor/LeadTimeMonitor.tsx` | Live Snowflake via `/api/dashboard/kpi` + `/api/lead-time/charts` (KPI cards + 4 Strategic charts) |

### StrategicMonitor layout (no-scroll, fills viewport)
1. AI Summary (shrink-0)
2. Alert Panel (shrink-0, only if alerts)
3. Hero OEE card (shrink-0)
4. 4 KPI cards grid (shrink-0)
5. Equipment: OPE + Productivity (shrink-0, 2-col)
6. Charts: TrendChart + StackedBarChart (flex-1, fills remaining height)

### LeadTimeMonitor layout (no-scroll, fills viewport)
1. 3 KPI hero cards: Gross LT · UNVA % · Savings Potential (shrink-0)
2. VA/NNVA/UNVA breakdown stat cards (shrink-0, 3-col)
3. Stage chart (Group/Activity toggle) + Top 5 SKU table (flex-1, 2-col)

---

## AI Summary

**Status: Implemented**

- White card with AILabel gradient chip (`linear-gradient(90deg, #725DA3, #864A9C)`).
- Auto-fetches on first dashboard load from `/api/dashboard/summary`.
- Cached 5 hours server-side.
- Refresh button force-fetches (ignores cache).
- Text: 3 sentences, executive summary of current KPI state.
- Clickable KPI numbers: `text-[#1E4076]` with underline — fires `kpi-highlight` CustomEvent → highlights matching KPI card.
- Powered by Groq (same model registry as chat, see `docs/ARCHITECTURE.md`).

---

## AI Analyst Chat

**Status: Implemented**

- Floating chat button, bottom-right of dashboard.
- Opens a draggable chat panel.
- Sends live KPI snapshot + active alerts + active filters as system context before every request.
- Two Snowflake tools: `get_kpi_data` (7 types) + `get_weekly_trend` (8 types).
- Tool results injected into the AI response as structured data.
- Conversation memory: 10 last messages sent with each request.
- Diagnostic framework: OBSERVE → HYPOTHESIZE → ASK ONE → NARROW → RECOMMEND.
- Follow-up suggestion chips after each AI response.
- "New Session" button clears history.
- Model routing: complex root-cause questions → `openai/gpt-oss-120b`; simple lookups → `qwen/qwen3.6-27b`.
- `kpi-highlight` tags in AI responses trigger dashboard card highlights.

---

## Alert System

**Status: Implemented**

- Auto-generates alerts on KPI data load (client-side, `lib/alerts.ts`).
- Shown in `AlertPanel` component when there are active undismissed alerts.
- Dismiss with undo (5-second timeout).
- Same alert not re-sent to Teams in the same session.

| KPI | Warning threshold | Critical threshold |
|---|---|---|
| Lead Time (trend) | > +5% increase | > +15% increase |
| Bulk Loss | > 3% | > 5% |
| Pack Loss | > 1% | > 2% |
| RFT | < 95% | < 90% |
| OEE | < 65% | < 55% |

Only **critical** alerts are auto-sent to Teams via Graph API.

---

## Microsoft Teams Notifications

**Status: Implemented**

- **Primary**: Microsoft Teams DM via Graph API (delegated auth, no admin consent needed). Uses `Chat.Create + ChatMessage.Send` scopes.
- **Fallback**: Power Automate webhook (`TEAMS_WEBHOOK_URL` env var), used if `TEAMS_RECIPIENTS` is not configured.
- Recipients configured in Settings page and persisted server-side.
- **Message format (2026-10-06): Adaptive Card + AI narrative**, the same card on every path (`buildAlertCard()` in `lib/alerts/teams.ts`; Graph sends it as a chat attachment, `summary` = push preview line):
  - Header (severity-colored container): `CRITICAL · LEAD TIME`, the alert message, plant · period · time WIB.
  - Facts: gross lead time + basis, target and days over, **Main driver** (largest stage + share of gross, `cardCause()` in `lib/kpiNarrative.ts`). The % change is only in the header.
  - **Why and what to do**: 2 AI sentences (≤ 45 words) — cause + one action this week (`generateAlertNarrative()`, shares `buildKpiContext` / `KPI_RELATIONSHIPS` with AI Summary). Omitted if the AI call fails.
  - Button: Open dashboard (`NEXTAUTH_URL/dashboard`).
  - The route reads the KPI snapshot server-side (`getKpiSnapshot()` in `lib/kpiData.ts`, same cache as `/api/dashboard/kpi`); senders pass plant, period, startDate, endDate. No snapshot → header-only card.
- Card text is JSON (Adaptive Card TextBlocks), not HTML — nothing is embedded as markup.
- **Scheduled summaries (2026-10-06)** — friendly ChatGPT-style story, not the alert layout: ☀️ (daily) / 👋 (weekly) greeting · 2–3 sentence story without numbers (how the KPIs connect) · 3 bullets `⏱️ / 📦 / ⚙️ **verdict** — sentence` · `👉 **Focus this week:**` · subtle footer (cadence · plant · range · time) · Open dashboard. Facts are computed in code (`summaryFacts()` in `lib/alerts/teams.ts`); the AI returns JSON (`generateSummaryStory()`), the card adds emojis and bold. A **single-plant recipient** gets their plant vs the network (lead time faster/slower, FG pcs + share of network FG from `CT_MANUF_TRENDS`, E2E above/below); **All Plant** names the plant behind each change and flags a data check when a plant with < 5% of POs drives ≥ 40% of the E2E change (`check:` line of `cardCauses`). No AI → same bullets from a template, without story and focus. Emojis here are a deliberate exception to the antislop no-emoji rule (user request, Teams messages only). Alert cards keep their layout.
- Recipient input takes the **username only**; `@paracorpgroup.com` is fixed (a pasted full address on that domain is accepted, other domains are rejected).
- Settings **autosave** 0.8 s after each edit (status: Unsaved changes / Saving… / Not saved — click Save to retry); Save saves at once; leaving the tab flushes a pending save.
- **Per-recipient settings**: plant · alerts Off / As they happen / Daily digest (time) · summary Off / Daily / Weekly (weekday, time, range Last 7 days / Last 30 days / Year to date). Alerts go only to recipients of the plant they fired for.
- **Sender**: Settings → Sender → "Use my account" stores the signed-in account as the sender of every Teams message (now the user's own account; later a service account does the same). Without a sender, scheduled sends do not run; dashboard alerts use the session of whoever triggers them.
- **Runner**: `/api/cron/notifications` — once a day 07:00 WIB on Vercel Hobby, every 15 min on Kubernetes. Details: `docs/ARCHITECTURE.md` → Scheduled notifications.
- Test buttons: "Send test alert" (sample card) and "Send test summary" (each recipient's real summary now).
- Settings page: add/remove recipients, test send button, toggle on/off per recipient.

---

## Email Notifications

**Status: Implemented (secondary channel)**

- Via Resend API (`lib/email.ts`).
- Not prominently surfaced in UI — backend capability available if needed.

---

## Settings Page (`/dashboard/settings`)

**Status: Implemented**

- Teams notification recipients: add, remove, toggle.
- Alert threshold display (read-only — thresholds are hardcoded in `lib/alerts.ts`, not editable via UI).
- Settings persist server-side via `/api/settings/teams`.

---

## Security Overlay

**Status: Implemented**

- `components/dashboard/SecurityOverlay.tsx`.
- Screen-lock overlay that appears on inactivity (separate from the 15-minute logout).
- Requires re-authentication or PIN to dismiss.

---

## Inactivity Auto-Logout

**Status: Implemented**

- 15-minute idle timer in `Sidebar.tsx` via `setTimeout` + window event listeners.
- On trigger: redirects to `/login`.

---

## Placeholder Pages

**Status: Not built**

These Sidebar items are shown and hoverable but do nothing on click ("Coming soon" tooltip) until their pages exist:

Alert Center · Output · Productivity · Yield · Energy · OEE · Root Cause Analysis · Reports · AI Fusion · User Management · Guide

To enable one, add its `href` in `NAV_GROUPS` / `FOOTER_ITEMS` in `components/dashboard/Sidebar.tsx`.
