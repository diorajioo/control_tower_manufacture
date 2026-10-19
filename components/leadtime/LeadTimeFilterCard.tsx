"use client";

// Lead Time page filters below the global filter bar: Scope · Basis · Unit, then PO-level filters
// (No. PO · Activity · Line category · Line · SKU group · SKU · Variant — lib/leadTimeFilters.ts).
// Changes apply at once (the global period / plant still go through Apply in the Header).

import { useEffect, useState } from "react";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { FIELD_LABEL, SelectField, MultiSelectField, type FieldOption } from "@/components/ui/FilterField";
import { LT_DIM_COLUMNS, type LtDims } from "@/lib/leadTimeFilters";
import { useT } from "@/lib/i18n";

// Indonesian overrides for the dimension column labels (from LT_DIM_COLUMNS).
const DIM_LABEL_ID: Record<string, string> = {
  "Activity":      "Aktivitas",
  "Line category": "Kategori Line",
  "Line":          "Line",
  "SKU group":     "SKU Group",
  "SKU":           "SKU",
  "Variant":       "Varian",
  "PO":            "PO",
  "PO No.":        "No. PO",
};

export type LtScope = "created" | "released";
export type LtBasis = "gross" | "nett";
export type LtUnit = "days" | "hours";

type Options = Record<keyof LtDims, FieldOption[]>;

const ALL_LABEL: Record<keyof LtDims, string> = {
  po: "All POs", activity: "All activities", lineCategory: "All line categories", line: "All lines",
  skuGroup: "All SKU groups", sku: "All SKUs", variant: "All variants",
};
const WIDTH: Record<keyof LtDims, number> = { po: 128, activity: 150, lineCategory: 150, line: 150, skuGroup: 160, sku: 170, variant: 150 };

export function LeadTimeFilterCard({ base, scope, onScope, basis, onBasis, unit, onUnit, dims, onDims }: {
  /** period / plant from the Header — the dropdown lists follow them */
  base: { plant: string; startDate: string; endDate: string; period?: string };
  scope: LtScope; onScope: (v: LtScope) => void;
  basis: LtBasis; onBasis: (v: LtBasis) => void;
  unit: LtUnit; onUnit: (v: LtUnit) => void;
  dims: LtDims; onDims: (d: LtDims) => void;
}) {
  const { t, lang } = useT();
  const [options, setOptions] = useState<Options | null>(null);
  useEffect(() => {
    let cancelled = false;
    setOptions(null);
    const params = new URLSearchParams({ plant: base.plant, startDate: base.startDate, endDate: base.endDate });
    if (base.period) params.set("period", base.period);
    fetch(`/api/lead-time/options?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d && !d.error) setOptions(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [base.plant, base.startDate, base.endDate, base.period]);

  const active = LT_DIM_COLUMNS.filter(({ key }) => {
    const v = dims[key as keyof LtDims];
    return Array.isArray(v) ? v.length > 0 : !!v;
  }).length;

  return (
    <div className="rounded-lg border border-[#EBEBEB] bg-white px-3 py-2.5 flex items-end gap-2.5 flex-wrap">
      <div className="shrink-0">
        <span className={FIELD_LABEL}>{t("filter_scope")}</span>
        <SegmentedToggle<LtScope> ariaLabel="Lead time start"
          options={[{ key: "created", label: t("toggle_po_created") }, { key: "released", label: t("toggle_po_released") }]}
          value={scope} onChange={onScope} />
      </div>
      <div className="shrink-0">
        <span className={FIELD_LABEL}>{t("filter_basis")}</span>
        <SegmentedToggle<LtBasis> ariaLabel="Gross or nett"
          options={[{ key: "gross", label: t("toggle_gross") }, { key: "nett", label: t("toggle_nett") }]}
          value={basis} onChange={onBasis} />
      </div>
      <SelectField label={t("filter_unit")} value={unit} width={84}
        options={[{ value: "days", label: t("toggle_days") }, { value: "hours", label: t("toggle_hours") }]}
        onChange={(v) => onUnit(v as LtUnit)} />

      <div className="w-px self-stretch bg-slate-100 mx-0.5" />

      <SelectField label={t("filter_po_no")} value={dims.po ?? ""} width={WIDTH.po}
        options={options?.po ?? []} loading={!options} allLabel={ALL_LABEL.po}
        onChange={(v) => onDims({ ...dims, po: v || undefined })} />
      {(["activity", "lineCategory", "line", "skuGroup", "sku", "variant"] as const).map((key) => {
        const col = LT_DIM_COLUMNS.find((c) => c.key === key)!;
        const label = lang === "id" ? (DIM_LABEL_ID[col.label] ?? col.label) : col.label;
        return (
          <MultiSelectField key={key} label={label} value={dims[key] ?? []} width={WIDTH[key]}
            options={options?.[key] ?? []} loading={!options} allLabel={ALL_LABEL[key]}
            onChange={(v) => onDims({ ...dims, [key]: v.length ? v : undefined })} />
        );
      })}

      {active > 0 && (
        <button onClick={() => onDims({})}
          className="h-7 px-2 rounded-md text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4076]/40">
          {t("action_clear_selection")} ({active})
        </button>
      )}
    </div>
  );
}
