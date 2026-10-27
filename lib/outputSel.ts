// Output cross-filter params (Tactical → Output, CLAUDE.md → Chart cross-filter). Parsed by the Output
// API routes; applied in SQL by outputSelWhere() in lib/queries.ts.

export type OutputSelDim = "brand" | "variant" | "su_group" | "line" | "form";
export interface OutputSel { dim: OutputSelDim; value: string }

const DIMS: OutputSelDim[] = ["brand", "variant", "su_group", "line", "form"];

/** Reads `fdim` / `fval` query params into an OutputSel (null when absent or unknown). */
export function parseOutputSel(sp: URLSearchParams): OutputSel | null {
  const dim = sp.get("fdim") as OutputSelDim | null;
  const value = sp.get("fval");
  return dim && value && DIMS.includes(dim) ? { dim, value } : null;
}
