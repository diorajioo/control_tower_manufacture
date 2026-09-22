# Lead Time Page — Design Overrides

Route: `/lead-time`
Implementation: `app/lead-time/page.tsx`

Inherits all rules from `DESIGN_OVERVIEW.md`. Only intentional deviations are listed here.

---

## View Toggle

This page has a Strategic / Tactical / Operational view toggle. Pass `views={LEAD_TIME_VIEWS}` to `Header`.

## Data Source

**Static mock data only** — not connected to Snowflake. Do not wire up live queries without explicit instruction.

## Chart Panel Titles

Older chart panels on this page use `text-[13px] font-bold text-slate-800` for titles — intentional deviation from the global `text-[10.5px] uppercase tracking-[0.08em]` style. Do not normalize these unless explicitly asked.

## Lead Time Color Coding

Charts use the fixed Lead Time domain palette (defined in `DESIGN_OVERVIEW.md`):
- VA (Value-Adding): `#215AA8`
- NNVA: `#d97706`
- UNVA: `#b91c1c`
