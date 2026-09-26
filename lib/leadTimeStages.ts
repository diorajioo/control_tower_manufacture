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
