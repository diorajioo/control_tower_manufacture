// Lead Time page filters beyond date / plant (No. PO, Activity, Line category, Line, SKU group, SKU, Variant).
// Each one selects POs: a PO is kept when it has at least one row matching every set filter; all figures are
// then computed on those whole POs (decided 2026-10-13). Shared by the page (query string) and the API routes.

export interface LtDims {
  po?: string[];
  activity?: string[];
  lineCategory?: string[];
  line?: string[];
  skuGroup?: string[];
  sku?: string[];
  variant?: string[];
}

/** Filter key → CT_MANUF_LEADTIME column. Order = query-string order = bind order. */
export const LT_DIM_COLUMNS: { key: keyof LtDims; column: string; label: string }[] = [
  { key: "po",           column: "PROCESS_ORDER_FG", label: "No. PO" },
  { key: "activity",     column: "ACTIVITY",         label: "Activity" },
  { key: "lineCategory", column: "LINE_CATEGORY",    label: "Line category" },
  { key: "line",         column: "LINE_NAME",        label: "Line" },
  { key: "skuGroup",     column: "SKU_GROUP",        label: "SKU group" },
  { key: "sku",          column: "PRODUCT_CODE",     label: "SKU" },
  { key: "variant",      column: "PRODUCT_VARIANT",  label: "Variant" },
];

/** Active filters only (empty values dropped), in LT_DIM_COLUMNS order. */
export function activeDims(d?: LtDims): { column: string; values: string[] }[] {
  if (!d) return [];
  return LT_DIM_COLUMNS
    .map(({ key, column }) => {
      const raw = d[key as keyof LtDims];
      const values: string[] = raw === undefined ? []
        : Array.isArray(raw) ? raw.filter((v) => v.trim() && v.length <= 200)
        : [(raw as string)].filter((v) => v.trim() && v.length <= 200);
      return { column, values };
    })
    .filter((x) => x.values.length > 0);
}

export function dimsFromParams(sp: URLSearchParams): LtDims {
  const d: LtDims = {};
  for (const { key } of LT_DIM_COLUMNS) {
    const vals = sp.getAll(key).filter(Boolean);
    if (vals.length > 0) (d as Record<string, unknown>)[key] = vals;
  }
  return d;
}

export function dimsToParams(d: LtDims | undefined, into: URLSearchParams): URLSearchParams {
  for (const { key } of LT_DIM_COLUMNS) {
    const val = d?.[key as keyof LtDims];
    if (!val) continue;
    if (Array.isArray(val)) { for (const v of val) into.append(key, v); }
    else into.set(key, val as string);
  }
  return into;
}

/** Stable cache-key fragment. */
export const dimsKey = (d?: LtDims) =>
  JSON.stringify(activeDims(d).map(({ column, values }) => ({ column, values: [...values].sort() })));
