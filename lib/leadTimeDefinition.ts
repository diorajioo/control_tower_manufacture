// Single source of truth for how gross lead time is measured.
//
// A PO has two phases:
//   1. PO Created  → PO Released   (administration / release; not what manufacturing is measured on)
//   2. PO Released → Receive NDC   (manufacturing lead time — the 13-day target applies to this phase)
//
// Status (2026-09-30): the dashboard still measures Created → NDC, because the PO Released timestamp is not
// confirmed yet. Working hypothesis from the data: CT_MANUF_LEADTIME has one ACTIVITY = 'PO' row per PO
// (POSITION 'PO', sequence 1, NNVA) whose ACTIVITY_START = created and ACTIVITY_STOP = released.
//
// To switch the whole app to Released → NDC once the identifier is confirmed:
//   1. Point PO_RELEASED_AT_SQL at the confirmed column / activity (if the hypothesis is wrong).
//   2. Set LEAD_TIME_BASIS = "released".
//   3. Update docs/BUSINESS_LOGIC.md and bump the lead-time cache keys.
//   (The 'PO' stage stays in per-stage breakdowns by decision — see docs/BUSINESS_LOGIC.md → Lead Time basis.)
//
// All values below are fixed SQL literals (never user input), so interpolating them into queries is safe.

export type LeadTimeBasis = "created" | "released";

/** Active start point of gross lead time for every KPI, chart, table and chat query. */
export const LEAD_TIME_BASIS = "created" as LeadTimeBasis;

/** Lead time target in days — defined by manufacturing on PO Released → Receive NDC. */
export const LEAD_TIME_TARGET_DAYS = 13;

// ── Per-PO timestamps (use inside a GROUP BY PROCESS_ORDER_FG) ───────────────
export const PO_CREATED_AT_SQL   = "MIN(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_START END)";
/** Hypothesis — to confirm with the data owner. */
export const PO_RELEASED_AT_SQL  = "MAX(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_STOP END)";
export const NDC_RECEIVED_AT_SQL = "MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' THEN ACTIVITY_STOP END)";

/** Start of gross lead time under the active basis. */
export const LEAD_TIME_START_SQL = LEAD_TIME_BASIS === "released" ? PO_RELEASED_AT_SQL : PO_CREATED_AT_SQL;

/** Human label of the active basis, e.g. for tooltips / AI context. */
export const LEAD_TIME_BASIS_LABEL = LEAD_TIME_BASIS === "released" ? "PO Released → NDC" : "PO Created → NDC";
