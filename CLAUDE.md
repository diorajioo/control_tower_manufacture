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
- Dashboard (`/dashboard`) always shows the Strategic layout — no view toggle.
- Lead Time (`/lead-time`) has its own Strategic / Tactical / Operational view toggle.

### Design system
- **Font: Lato only** — weights 400 and 700. No Inter, no Space Grotesk. `globals.css` imports Lato from Google Fonts.
- **Shell color: Paragon Blue `#215AA8`** — header bg, sidebar active item, primary CTAs. Never used for KPI health signals.
- **Card border: `border-[#EBEBEB]`** on dashboard cards — not `border-slate-200`.
- **Card shape: `rounded-lg`** on dashboard KPI cards; `rounded-xl` on Monitor components.
- **Charts: Nivo only** (`@nivo/line`, `@nivo/bar`, `@nivo/scatterplot`) — do not switch to Recharts or any other library.
- **Line charts: the standard is `components/charts/StandardLine.tsx`** — same role as TONES for KPI cards. Every Nivo line chart must use it; never define a local theme, tooltip or legend. Spec + rules: `docs/UI_UX.md` → Standard Line Chart.
  - Minimal-modern: smooth `monotoneX` 2px lines, no resting points, dashed horizontal hairline grid only, no axis lines/titles.
  - Colors: `SERIES_COLORS` (`lib/chartConfig.ts`) by fixed entity order, never by rank; 9th+ series → gray `#98a2b3`; aggregate "Total" → Paragon Blue `#215AA8` (never black).
  - Hover: hairline crosshair + solid 4px points with white ring; tooltip = `LineTooltip`; sub-lines (e.g. Mean · UCL · LCL) 9.5px, never wrap.
  - Legend (`LineLegend`): below the plot, centered, 9.5px, dot · name · last value, hover isolates.
  - SPC UCL/Mean/LCL only where the calculation exists (Overview TrendChart) — hairline markers, no shaded band.
- **Tooltips: `LineTooltip` is the standard for every chart** (line, bar, scatter) — translucent slate card (`TOOLTIP_COLORS` in `StandardLine.tsx`), rows never wrap, optional `subtitle` / `footer` / `nowrap`. Never define a local tooltip.
- **Toggles: `components/ui/SegmentedToggle.tsx`** is the standard (same style as the Overview KPI card toggles). Chart card titles: 11.5px bold uppercase `text-slate-500`.
- Full design system spec: `docs/UI_UX.md`.

### Data
- Lead Time page: **Strategic KPI cards use real data** (Lead Time = `LiteKPICard`; Value-Added / NNVA / Waste / Potential Saving = `LeadTimeCategoryCard` with fixed colors, no status rules — all from `/api/dashboard/kpi`, driven by the page's own Header filters). The "Lead time trend" (weekly, overall + per `POSITION`), "Lead time and PO count per SKU" scatter, and "Lead time per stage" Pareto (VA/NNVA/UNVA per `POSITION`, cumulative %) and "Top 10 SKU by lead time" (Composition / P10–P90 Range, SKUs with ≥5 POs) charts are also real (`/api/lead-time/charts`). The mock Top/Bottom SKU by volume tables, On-Time PO Trend and SKU Pareto are no longer rendered in Strategic (code kept for reuse). Everything else on the page (Tactical/Operational views) and the Lead Time Monitor are still **static mock data**. POSITION codes are shown with English names from `lib/leadTimeStages.ts`.
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
