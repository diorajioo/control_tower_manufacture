"use client";

// Lead Time page → Analysis tab: horizontal stat chips row.
// Shows Total POs, Median, P25, P75, P90, Maximum for the current basis + unit.

import type { LtUnit } from "@/components/leadtime/LeadTimeFilterCard";
import type { LtStats } from "@/components/leadtime/LeadTimeSummaryCards";
import { fmtLt } from "@/components/leadtime/LeadTimeSummaryCards";
import { useT, type TranslationKey } from "@/lib/i18n";

const CHIPS: { labelKey: TranslationKey; key: keyof LtStats; unit?: true }[] = [
  { labelKey: "sc_total_pos", key: "poCount" },
  { labelKey: "sc_median",    key: "median",  unit: true },
  { labelKey: "sc_p25",       key: "p25",     unit: true },
  { labelKey: "sc_p75",       key: "p75",     unit: true },
  { labelKey: "sc_p90",       key: "p90",     unit: true },
  { labelKey: "sc_max",       key: "max",     unit: true },
];

export function LeadTimeScorecardBar({ stats, unit, loading }: {
  stats: LtStats | null;
  unit: LtUnit;
  loading: boolean;
}) {
  const { t } = useT();
  return (
    <div className="rounded-lg border border-[#EBEBEB] bg-white grid grid-cols-6 divide-x divide-[#EBEBEB] overflow-hidden shrink-0">
      {CHIPS.map(({ labelKey, key, unit: hasUnit }) => {
        const label = t(labelKey);
        const raw = stats?.[key];
        let display: string;
        if (loading) {
          display = "…";
        } else if (raw == null) {
          display = "—";
        } else if (key === "poCount") {
          display = Number(raw).toLocaleString("en-US");
        } else {
          display = fmtLt(raw as number, unit);
        }

        return (
          <div key={key} className="flex flex-col gap-0.5 px-4 py-3">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">
              {label}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-[18px] font-bold tabular-nums text-slate-900 leading-tight">
                {display}
              </span>
              {hasUnit && !loading && raw != null && (
                <span className="text-[11px] text-slate-400">{unit}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
