# Strategic Page — Design Overrides

Route: `/dashboard`
Implementation: `app/dashboard/page.tsx`

Inherits all rules from `DESIGN_OVERVIEW.md`. Only intentional deviations are listed here.

---

## Layout

Fixed KPI structure — do not reorder without explicit instruction:

**Row 1:** Lead Time · Yield/Loss · Right First Time (RFT) · Output
**Row 2:** OEE (Hero, full-width) · OPE · Productivity

Hero OEE card is full-width and lives between rows 1 and 2.

## View Toggle

No view toggle on this page. Pass `views={[]}` to `Header` — the toggle does not render.

## Card Style

Uses global defaults: `rounded-lg` + `border-[#EBEBEB]`. No overrides.

## Data Source

All KPIs query Snowflake via `/api/dashboard/kpi` and `/api/dashboard/summary`. Not static data.

Note: `DATAMART_PRODUCTION_OUTPUT_OLAH` has no PLANT column — plant filter is not applied for Bulk Output/Bulk Loss.
