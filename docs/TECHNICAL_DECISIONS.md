# Technical Decisions — Control Tower Manufacturing

---

## Decision: Strategic/Tactical as Structural Pages, Not a Toggle

**Status: Active**

**Context:** Early design had a Strategic/Tactical view toggle on the `/dashboard` page. Strategic = executive view (Hero OEE, 2-col Equipment). Tactical = supervisor view (no Hero OEE, 3-col Equipment). This was controlled by a toggle in the Header component.

**Decision:** Remove the toggle from `/dashboard`. Dashboard always shows the Strategic layout. "Tactical" is now a structural concept: the `/lead-time` page has its own Strategic/Tactical/Operational views for lead time analysis.

**Reason:** The Strategic/Tactical distinction on the main dashboard caused confusion — a single page with two layouts is hard to explain, and both views were essentially the same data at different density. Cleaner architecture: `/dashboard` = strategic overview, specialized pages = tactical drill-down.

**Impact:**
- `views={[]}` passed to Header on `/dashboard` — toggle doesn't render when `resolvedViews.length < 2`.
- `/dashboard` always renders: AI Summary → Hero OEE → 4 KPI cards → Equipment 3-col (OEE + OPE + Productivity) → Charts.
- The `activeView` state was removed from `app/dashboard/page.tsx`.
- Sidebar nav item renamed from "Overview" to "Strategic".
- `/lead-time` retains its own Strategic/Tactical/Operational toggle (separate UX concern).

---

## Decision: OEE in Equipment Section (3-col)

**Status: Active**

**Context:** After removing the dashboard view toggle, the Equipment row needed to settle on one layout. Earlier docs described Strategic as "2-col (OPE, Productivity)" with OEE only in the Hero card, and Tactical as "3-col (OEE, OPE, Productivity)".

**Decision:** Dashboard always shows 3-col Equipment: OEE · OPE · Productivity. Hero OEE card is retained as the headline metric, but OEE also appears as a full KPICard with sparkline in the Equipment row.

**Reason:** User explicitly requested OEE be brought back into the Strategic layout alongside OPE and Productivity. The Hero OEE card focuses on the "is the plant on fire?" headline; the Equipment OEE card provides sparkline and component breakdown.

**Impact:** `lg:grid-cols-3` in the Equipment section of `app/dashboard/page.tsx`. `DESIGN.md`'s description of "Strategic = 2-col Equipment" is now obsolete.

---

## Decision: Dedicated `/monitor` Route (Not In-Place Fullscreen)

**Status: Active**

**Context:** Early implementation had an in-place Monitor Mode on `/dashboard` — a fullscreen overlay that replaced the normal dashboard layout, with auto-rotating sections and a TV Mode (auto-cycles every 20 seconds).

**Decision:** Remove all in-place monitor logic from page files. Create a dedicated `/monitor` route with bottom navigation to switch between strategic and lead time views.

**Reason:**
- Cleaner URLs — each monitor page has its own state in the URL.
- No shared state complexity between normal and monitor views.
- Makes cross-page navigation (Strategic ↔ Lead Time) natural without exiting fullscreen.
- Filters passed as URL params ensure the monitor shows exactly the same data the user was viewing.

**Impact:**
- Removed from `/dashboard`: `MonitorSubStat`, `MonitorStat`, `MonitorView` components; `isMonitorMode`, `isTVMode`, TV timer; fullscreenchange/clock effects; monitor overlay JSX.
- Removed from `/lead-time`: `isMonitorMode` state and all conditional renders.
- Created: `app/monitor/page.tsx`, `components/monitor/StrategicMonitor.tsx`, `components/monitor/LeadTimeMonitor.tsx`.
- Monitor button on pages now calls `router.push('/monitor?page=...&plant=...&...')`.

---

## Decision: Nivo for All Charts

**Status: Active**

**Context:** Multiple chart library options were evaluated.

**Decision:** All charts use Nivo (`@nivo/line`, `@nivo/bar`). No Recharts, D3, Chart.js, or other libraries.

**Reason:** Nivo provides consistent behavior across chart types, SSR-compatible, easy Tailwind integration via `fontFamily: "inherit"`, and good performance for the data volumes involved.

**Impact:** Do not replace or mix in other chart libraries. If a chart type needs to be added (e.g., heatmap), use `@nivo/heatmap`.

---

## Decision: Groq as Primary AI Provider

**Status: Active**

**Context:** Multiple AI providers considered (OpenAI direct, Anthropic, Azure OpenAI).

**Decision:** Groq API as primary AI provider (fastest inference, low cost). Anthropic SDK kept as a fallback provider (available in `lib/ai-provider.ts`).

**Reason:** Groq provides the fastest TTFB for chat use cases. The diagnostic chatbot requires low latency to feel responsive. Model selection within Groq is dynamic via the registry in `lib/ai-models.ts`.

**Current model registry:**
- `openai/gpt-oss-120b` — strongest, for complex root-cause analysis
- `qwen/qwen3.6-27b` — fast, default chat model
- `qwen/qwen3.8-27b` — mid-tier
- `groq/compound` — compound model, unlimited context

**Fallback behavior:** If a model returns `model_not_found` or `model_decommissioned`, the next model in the ordered list is tried. Session never hard-fails due to a single model being unavailable.

---

## Decision: Teams via Graph API (No Admin Consent)

**Status: Active**

**Context:** Teams notifications could be sent via webhooks (simple) or Graph API (requires auth setup).

**Decision:** Microsoft Teams DM via Graph API using delegated auth. Power Automate webhook kept as a legacy fallback.

**Reason:** Graph API enables personalized DMs to named recipients rather than broadcasting to a channel. Delegated auth (`Chat.Create + ChatMessage.Send` scopes) avoids the need for an admin to grant application-level consent.

**Impact:** Teams notifications require a valid `TEAMS_REFRESH_TOKEN` configured via the Azure AD app. The token refresh endpoint is at `/api/auth/teams/token`. If Teams Graph API fails, the system falls back to the Power Automate webhook.

---

## Decision: No Backend Separation (Next.js Full-Stack)

**Status: Active**

**Context:** Traditional architecture would separate a React frontend from a Node.js/Python backend.

**Decision:** Next.js serves as both frontend and backend. API Routes handle all data fetching and external service calls. No separate backend process.

**Reason:** Simpler deployment (single Vercel project), no CORS concerns, session available server-side without extra infrastructure.

**Constraint:** Snowflake SDK and Groq API keys never reach the client. All sensitive operations are in API routes (server-side only).

---

## Decision: Paradise Design System v2 (Lato, Paragon Blue)

**Status: Active**

**Context:** Early UI used Inter font and a navy-blue shell color `#1E4076`. A design system update was applied.

**Decision:** Adopt Paradise Design System v2. Font: Lato (not Inter). Shell color: Paragon Blue `#215AA8` (not navy `#1E4076`). Full token spec in `DESIGN.md`.

**Reason:** Company-wide design system alignment. Paradise v2 is the CX Team's internal standard for analytics dashboards.

**Impact:**
- `globals.css` now imports Lato from Google Fonts.
- `tailwind.config.ts` sets `fontFamily.sans` to Lato.
- All shell references to `#1E4076` replaced with `#215AA8`.
- Card radius: `rounded-xl` → `rounded-lg` on dashboard cards.
- Border: `border-slate-200` → `border-[#EBEBEB]` on dashboard cards.
- Warning color: `#f59e0b` (amber) → `#D1A400` (Paradise accent-warning).

---

## Decision: Static Mock Data on Lead Time Page

**Status: Active (known debt)**

**Context:** Lead Time page UI was built ahead of the Snowflake query integration.

**Decision:** Use hardcoded mock data in `app/lead-time/page.tsx` and `components/monitor/LeadTimeMonitor.tsx` until Snowflake connection is wired.

**Reason:** Enables UI development and stakeholder review without blocking on data pipeline work.

**Impact:** Lead Time page shows static numbers. The Snowflake queries for Lead Time breakdown need to be implemented in `lib/queries.ts` and wired to the Lead Time page UI. This is the most significant known gap in the product.

---

## Superseded: Strategic/Tactical Toggle on Dashboard

**Status: Superseded** (replaced by "Strategic/Tactical as Structural Pages" above)

The dashboard once had an in-header toggle that switched between Strategic and Tactical layouts. This toggle has been removed. The toggle code still exists in `Header.tsx` (`resolvedViews` / `activeView` / `onViewChange`) but is dormant when `views={[]}` is passed.

---

## Superseded: In-Place Monitor Mode on Dashboard

**Status: Superseded** (replaced by "Dedicated /monitor Route" above)

Early implementation: Monitor Mode was triggered by a button on `/dashboard`, replaced the layout with a fullscreen overlay, and included TV Mode auto-rotation (20s cycle). All of this was removed in commit `cd29ee5` / `31370f7`. The `/monitor` route replaced it.

---

## Superseded: Navy Shell Color (#1E4076)

**Status: Superseded** (replaced by Paragon Blue `#215AA8`)

The original shell color was `#1E4076`. It was replaced with `#215AA8` when Paradise Design System v2 was applied. Any occurrence of `#1E4076` or `#16305C` in the codebase is a remnant that should be updated to `#215AA8` / `#1A4886`.
