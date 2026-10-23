// Output cross-filter state (Tactical → Output). One click on an Output chart = one pick; every other
// Output chart reloads with it, the chart that made the pick keeps all its items and highlights the pick
// (CLAUDE.md → Chart cross-filter). Header filters stay global; a pick never leaves the Output section.
//   plant  → overrides the plant param          (Output by plant donut)
//   bucket → overrides the date range (∩ header) (Output trend bar: one month / week)
//   others → fdim / fval, PO-level filter in SQL (lib/queries.ts → outputSelWhere)

export type OutputPickDim = "brand" | "variant" | "su_group" | "line" | "form" | "plant" | "bucket";

export interface OutputPick {
  dim: OutputPickDim;
  value: string;
  /** Shown in the filter chip */
  label: string;
  /** bucket only: inclusive date range of the clicked bar */
  start?: string;
  end?: string;
}

export interface OutputBaseFilters { plant: string; startDate: string; endDate: string; period?: string }

/** Query params for an Output chart: header filters + the pick, unless the pick came from this chart. */
export function outputParams(f: OutputBaseFilters, pick: OutputPick | null, own: OutputPickDim | OutputPickDim[]): URLSearchParams {
  const owns = Array.isArray(own) ? own : [own];
  const p = new URLSearchParams({ plant: f.plant, startDate: f.startDate, endDate: f.endDate });
  if (f.period) p.set("period", f.period);
  if (!pick || owns.includes(pick.dim)) return p;
  if (pick.dim === "plant") p.set("plant", pick.value);
  else if (pick.dim === "bucket" && pick.start && pick.end) {
    p.set("startDate", pick.start > f.startDate ? pick.start : f.startDate);
    p.set("endDate", pick.end < f.endDate ? pick.end : f.endDate);
    p.set("period", "Custom");
  } else {
    p.set("fdim", pick.dim);
    p.set("fval", pick.value);
  }
  return p;
}

/** Same pick again = clear it. */
export function togglePick(current: OutputPick | null, next: OutputPick): OutputPick | null {
  return current && current.dim === next.dim && current.value === next.value ? null : next;
}

/** Opacity for an item of the chart that owns the pick: picked = 1, others dimmed, no pick = 1. */
export function pickOpacity(pick: OutputPick | null, own: OutputPickDim | OutputPickDim[], value: string): number {
  const owns = Array.isArray(own) ? own : [own];
  if (!pick || !owns.includes(pick.dim)) return 1;
  return pick.value === value ? 1 : 0.35;
}
