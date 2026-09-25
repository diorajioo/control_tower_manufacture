# Known Issues — Control Tower Manufacturing

---

## Critical

### Lead Time Page: Static Mock Data

**Status: Partially resolved (2026-09-25)**
**Severity: High**
**Area: `/lead-time` page, `components/monitor/LeadTimeMonitor.tsx`**

**Description:** The Lead Time page (`app/lead-time/page.tsx`) and Lead Time monitor (`components/monitor/LeadTimeMonitor.tsx`) use hardcoded static data. No Snowflake connection.

**Expected:** Stage breakdown, VA/NNVA/UNVA analysis, Top SKU table, and all charts should pull from `CT_MANUF_LEADTIME`.

**Actual:** Data is hardcoded in `STAGE_GROUP_DATA`, `ACTIVITY_DATA`, `TOP_SKUS` constants in each file.

**Progress:** Strategic KPI cards (Lead Time, Value-Added, NNVA, Waste, Potential Saving) now read from Snowflake via `/api/dashboard/kpi`.

**Workaround:** None for the remaining sections — still mock.

**What needs doing:** Wire `/api/dashboard/kpi` or a new `/api/lead-time/kpi` endpoint with a Lead Time position breakdown query (similar to Gross Lead Time in `lib/queries.ts`), then replace the hardcoded constants with fetched data.

---

## Documentation Conflicts

### PRODUCT.md Describes Removed Dashboard Features

**Status: Open (documentation drift)**
**Severity: Low**
**Area: `PRODUCT.md`**

**Description:** `PRODUCT.md` was written by the Impeccable skill and still references features that were removed from `/dashboard`:
- "Monitor Mode: Fullscreen display, auto-rotating sections (OKPIs → Equipment → Trends)"
- "TV Mode: Auto-cycles every 20 seconds"
- "Dashboard always shows Strategic layout" conflicts with its own description of a Strategic/Tactical toggle

**Resolution:** `PRODUCT.md` is an Impeccable skill artifact and should not be manually edited. Treat `docs/FEATURES.md` as the authoritative feature inventory.

---

### PRODUCT.md Lists Outdated AI Models

**Status: Open (documentation drift)**
**Severity: Low**
**Area: `PRODUCT.md`**

**Description:** `PRODUCT.md` states AI Summary is "powered by Groq (primary: `openai/gpt-4o` via Groq, fallback: `compound-beta` → `qwen/qwen3-8b`)". The current model registry in `lib/ai-models.ts` is:
- `openai/gpt-oss-120b` (primary/complex)
- `qwen/qwen3.6-27b` (default chat)
- `qwen/qwen3.8-27b` (mid-tier)
- `groq/compound` (long sessions)

**Resolution:** See `docs/ARCHITECTURE.md` for current model list. `lib/ai-models.ts` is the authoritative source.

---

### DESIGN.md Equipment Section Describes Obsolete Layout

**Status: Open (documentation drift)**
**Severity: Low**
**Area: `DESIGN.md` → Views section**

**Description:** `DESIGN.md` still describes:
- Strategic: Equipment & People = 2-col grid (OPE, Productivity)
- Tactical: Equipment & People = 3-col grid (OEE, OPE, Productivity)

**Current reality:** Dashboard always shows 3-col Equipment (OEE + OPE + Productivity). There is no Tactical view on `/dashboard`. The Strategic/Tactical distinction in `DESIGN.md` refers to a toggle that was removed.

**Resolution:** `DESIGN.md` is an Impeccable skill artifact. Treat `docs/UI_UX.md` and the actual `app/dashboard/page.tsx` as authoritative for the current layout.

---

## Technical Limitations

### Azure AD Plant-Level Access Control Not Implemented

**Status: Open (planned)**
**Severity: Medium**
**Area: Authentication, API routes**

**Description:** All authenticated users can query any plant. `docs/SECURITY.md §2` describes a future `allowedPlants` mechanism based on Azure AD group membership, but it has not been implemented.

**Expected:** Users in AD group `CT-PLANT-A` should only see data for Plant A.

**Actual:** Any authenticated user can pass any plant name in the filter.

**Workaround:** Only trusted Paracorp staff have Azure AD accounts.

---

### KPI Cache Not Shared Across Vercel Edge Nodes

**Status: Open (known limitation)**
**Severity: Low**
**Area: `/api/dashboard/kpi`, `/api/dashboard/trends`**

**Description:** `unstable_cache` stores data in-memory per server instance. On Vercel with multiple edge nodes, each node maintains its own cache. Two users on different nodes may get responses from different cache generations, causing minor data inconsistency within the 1-hour window.

**Workaround:** None without adding a Redis adapter for shared cache. Acceptable for this use case given the 1-hour cache TTL.

---

### Lato Font Has No Weight 500 or 600

**Status: Known constraint**
**Severity: Low**
**Area: Typography system-wide**

**Description:** Lato only provides weights 400 and 700. Tailwind classes `font-medium` (500) and `font-semibold` (600) will silently fall back to 400 or 700 depending on browser rendering. This may cause text to appear lighter than intended in some contexts.

**Resolution:** Always use `font-normal` (400) or `font-bold` (700) in this codebase. Never use `font-medium` or `font-semibold` on text meant to use Lato.

---

### Lead Time Monitor Uses Different Card Style Than Dashboard

**Status: Known (intentional difference)**
**Severity: Low**
**Area: `components/monitor/StrategicMonitor.tsx`, `components/monitor/LeadTimeMonitor.tsx`**

**Description:** Monitor components use `rounded-xl border-slate-200` while dashboard KPI cards use `rounded-lg border-[#EBEBEB]`. This is because monitor components were built with a slightly different styling to suit the denser, fullscreen monitor context.

**Resolution:** This is intentional — monitor is a different visual context than the dashboard. Not a bug.

---

## Placeholder Pages With Dead Nav Links

**Status: Open (planned)**
**Severity: Low**
**Area: Sidebar navigation**

**Description:** Sidebar nav contains links to `/dashboard/output`, `/dashboard/productivity`, `/dashboard/oee`, `/dashboard/energy`. None of these pages exist. Clicking them results in a Next.js 404.

**Resolution:** Pages need to be built. KPI data for most of these is available from existing Snowflake queries.
