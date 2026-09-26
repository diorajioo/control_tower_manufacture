# Features — Control Tower Manufacturing

## Dashboard — Strategic View (`/dashboard`)

**Status: Implemented (live data)**

### Current behavior
- Permanent Strategic layout — no view toggle. The dashboard always shows the Strategic view.
- Sidebar nav item label: "Overview".

### Layout (top to bottom)
1. **AI Summary strip** — white card with AILabel gradient chip, 3-sentence executive summary, auto-generated from current KPI state.
2. **Alert Panel** — shown only when there are active, undismissed alerts. Alert rows with dismiss (undo available 5 seconds).
3. **KPI row 1** — 3-column grid: Lead Time (`LeadTimeKPICard`) · Output (`OutputKPICard`) · E2E Productivity (`RegularKPICard`).
4. **KPI row 2** — 3-column grid: OEE · Yield Loss · Energy (`RegularKPICard`, no data yet).
   All six use the regular card style (accent bar · value + trend · status pill · sparkline · secondary metric · footer) at `compact` size (padding, gaps and sparkline ≈80%, regular font sizes) so three fit per row.
5. **Trend + AI Risks** — 2fr / 1fr grid: TrendChart (Standard Line Chart, SPC markers) + AIRisksPanel.

### User interactions
- Header filter row: Period picker, Plant dropdown, Data Level selector. Changes trigger immediate re-fetch.
- Refresh button: force-reloads KPI data, flashes `#215AA8` overlay briefly.
- Bell icon: opens alert panel / Teams alert send.
- Monitor button: navigates to `/monitor?page=strategic&plant=...&period=...&...` (opens fullscreen mode).
- AI Summary: clickable numbers trigger `kpi-highlight` CustomEvent to highlight the relevant KPI card.
- AI Chat: floating button bottom-right opens AI Analyst chatbot.

---

## Lead Time Page (`/lead-time`)

**Status: Implemented — static mock data (not connected to Snowflake)**

### Three views (toggled via Header view pills)

#### Strategic View (default)
- 3 KPI hero cards: Gross Lead Time · UNVA % · Savings Potential
- Stage Group chart: VA/NNVA/UNVA breakdown by stage group (Nivo bar)
- Top 10 SKU by lead time — **real data** (`LeadTimeTopSkuChart`, toggle Composition / P10–P90 Range, SKUs with ≥5 POs)
- ~~Top 5 / Bottom 5 SKU tables, On-Time PO Trend, Lead Time Pareto per SKU~~ — mock, removed from Strategic 2026-09-26 (components kept in `app/lead-time/page.tsx` for reuse)

#### Tactical View
- 4 KPI cards: Gross LT · Nett LT · UNVA Days · UNVA %
- 20-stage breakdown bar chart (toggle: Gross / Nett / Pareto)
- Trend line chart by stage
- Color classification: VA = #215AA8, NNVA = #d97706, UNVA = #b91c1c

#### Operational View
- Batch exceptions panel (critical/warning batches, sorted by severity)
- 6×6 stage heatmap (by day × stage)
- Color: heat intensity based on delay severity

### User interactions
- View toggle: Strategic / Tactical / Operational pills in header
- Monitor button: navigates to `/monitor?page=lead-time`
- Stage breakdown chart toggle (Tactical): Gross / Nett / Pareto

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
| Lead Time | `lead-time` | `components/monitor/LeadTimeMonitor.tsx` | Static mock data |

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
- Clickable KPI numbers: `text-[#215AA8]` with underline — fires `kpi-highlight` CustomEvent → highlights matching KPI card.
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
- Alert content HTML-escaped (`escHtml()` in `lib/graph/teams.ts`) before embedding in Teams card body.
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
