// Display names for CT_MANUF_LEADTIME.POSITION codes (UI is English; Snowflake keeps the Indonesian codes).
// Order = process flow, used wherever stages need a stable order.
export const STAGE_ORDER = ["PO", "TIMBANG", "OLAH", "CUCI OLAH", "KEMAS 1", "KEMAS 2", "CUCI KEMAS", "WIP", "RECEIVE NDC"] as const;

const STAGE_LABELS: Record<string, string> = {
  "PO":          "PO",
  "TIMBANG":     "Weighing",
  "OLAH":        "Processing",
  "CUCI OLAH":   "Processing Cleaning",
  "KEMAS 1":     "Packing 1",
  "KEMAS 2":     "Packing 2",
  "CUCI KEMAS":  "Packing Cleaning",
  "WIP":         "WIP",
  "RECEIVE NDC": "NDC Receiving",
};

export function stageLabel(code: string): string {
  return STAGE_LABELS[code] ?? code;
}

/**
 * Display name for a CT_MANUF_LEADTIME.ACTIVITY code: Title Case, acronyms kept ("CUCI BERSIH OLAH" → "Cuci Bersih Olah");
 * "WIP AFTER <activity>" → "WIP <Activity>".
 */
export function activityLabel(code: string): string {
  const keep = new Set(["PO", "NDC", "WIP"]);
  const title = (s: string) => s.split(/\s+/).filter(Boolean)
    .map((w) => (keep.has(w) || /\d/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase())).join(" ");
  const m = /^WIP AFTER (.+)$/.exec(code);
  return m ? `WIP ${title(m[1])}` : title(code);
}

/**
 * Group Process — six groups of POSITION codes, shared by the plant breakdown table and the Lead Time sunburst.
 * Mixing = Processing + Processing Cleaning; Filpac = Packing 1 + Packing 2 + Packing Cleaning; WIP = all waiting.
 */
export const PROCESS_GROUPS = [
  { id: "po",       label: "PO",          stages: ["PO"] },
  { id: "weighing", label: "Weighing",    stages: ["TIMBANG"] },
  { id: "mixing",   label: "Mixing",      stages: ["OLAH", "CUCI OLAH"] },
  { id: "filpac",   label: "Filpac",      stages: ["KEMAS 1", "KEMAS 2", "CUCI KEMAS"] },
  { id: "ndc",      label: "Receive NDC", stages: ["RECEIVE NDC"] },
  { id: "wip",      label: "WIP",         stages: ["WIP"] },
] as const;
export type ProcessGroupId = typeof PROCESS_GROUPS[number]["id"];
