// AI features (Summary, AI Risks, Chat, alerts → Teams) only cover metrics whose data
// is shown on a page: Lead Time, Output (bulk + FG) and Productivity (E2E / upstream / downstream).
// Out of scope until their cards show data: OEE / OPE, Pack Loss, Energy (CT_MANUF_KEMAS not ready)
// and Bulk Loss / RFT (no card on any page).

/** `get_kpi_data` tool types the chat may query. */
export const AI_KPI_TYPES = [
  "lead_time", "lead_time_by_stage", "output_bulk", "output_fg",
  "productivity_e2e", "productivity_upstream", "productivity_downstream",
];

/** `get_weekly_trend` tool types the chat may query. */
export const AI_TREND_TYPES = ["leadtime", "upstream", "downstream", "e2e", "output"];

/** Alert `kpi` names that may be raised (and sent to Teams). */
export const ALERT_KPIS = new Set(["Lead Time"]);

export const OUT_OF_SCOPE_NOTE =
  "OEE, OPE, Yield Loss (bulk and pack), RFT and Energy are not available yet on the dashboard.";
