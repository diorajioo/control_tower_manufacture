"use client";

import { useMemo } from "react";
import { ChartCard, EmptyState } from "@/components/dashboard/LeadTimeCharts";
import { STAGE_ORDER, stageLabel } from "@/lib/leadTimeStages";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Lead time breakdown per plant (Overview → Tactical view, below "Lead time per stage").
// Rows = network + each PLANT; columns = gross · days per PO per stage · nett · on-time.
// Stage columns follow the chart above: process sequence, WIP last.
// A plant's stage cell turns red when it is above the network value for that stage.
// Data: /api/lead-time/stages → plants.
// ─────────────────────────────────────────────────────────────────────────────

export interface PlantBreakdown {
  plant: string | null;   // null = network (all plants)
  poCount: number;
  gross: number | null;
  nett: number | null;
  onTimePct: number | null;
  stages: Record<string, number>;
}

const UPSTREAM = new Set(["PO", "TIMBANG", "OLAH", "CUCI OLAH"]);
const DOWNSTREAM = new Set(["KEMAS 1", "KEMAS 2", "CUCI KEMAS", "RECEIVE NDC"]);
// Same order as LeadTimeStageStdChart: STAGE_ORDER with WIP moved to the end
const COLUMN_ORDER = [...STAGE_ORDER.filter((s) => s !== "WIP"), "WIP"] as string[];

const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(2));

// Red tint scales with how far above the network the plant is; full strength at +30%.
function excessTint(value: number | undefined, network: number | undefined): string | undefined {
  if (value == null || !network || value <= network) return undefined;
  const strength = Math.min((value / network - 1) / 0.3, 1);
  return `rgba(217, 45, 32, ${(0.05 + strength * 0.15).toFixed(3)})`;
}

// Header: Paragon Blue group row, light-blue stage row (no red — red is reserved for the cell signal)
const TH = "px-3 py-2 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap";
const TH_TOP = "bg-[#1E4076] text-white";
const TH_SUB = "bg-[#EEF4FB] text-[#1E4076]";
const TH_DIV = "border-l border-white/25";
const TD = "px-3 py-2.5 text-[12px] text-slate-700 text-right tabular-nums whitespace-nowrap";

export function LeadTimePlantTable({ data, targetDays, loading, basis = "created" }: { data: PlantBreakdown[] | null; targetDays: number; loading: boolean; basis?: "created" | "released" }) {
  const basisLabel = basis === "released" ? "PO Released → Receive NDC" : "PO Created → Receive NDC";
  const network = data?.find((p) => p.plant == null);
  const plants = (data ?? []).filter((p) => p.plant != null);

  // Only stages that exist in the data (same set the chart above shows)
  const stages = useMemo(
    () => COLUMN_ORDER.filter((s) => (network?.stages[s] ?? 0) > 0.005),
    [network],
  );
  const up = stages.filter((s) => UPSTREAM.has(s));
  const down = stages.filter((s) => DOWNSTREAM.has(s));
  const rest = stages.filter((s) => !UPSTREAM.has(s) && !DOWNSTREAM.has(s));
  const ordered = [...up, ...down, ...rest];

  return (
    <ChartCard
      title="Lead time breakdown per plant"
      subtitle="Days per PO per stage. Red cell = above the network value for that stage (darker = further above)."
      info={`Stage values use the same basis as "Lead time per stage" above. Red compares each plant with the network row, not with a standard, because ACTIVITY_LEADTIME_STD is only usable for Weighing, Processing and Processing Cleaning. Gross LT and On-time follow the basis toggle in the header (now ${basisLabel}); stage columns do not change with it. On-time = share of POs with gross lead time ≤ ${targetDays} days (the Lead Time target); there is no due-date column yet.`}
    >
      {!network ? (
        <div style={{ height: 160 }}><EmptyState loading={loading} /></div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-3">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th rowSpan={2} className={cn(TH, TH_TOP, "text-left align-bottom")}>Plant</th>
                  <th rowSpan={2} className={cn(TH, TH_TOP, "text-right align-bottom")}>Gross LT</th>
                  {up.length > 0 && <th colSpan={up.length} className={cn(TH, TH_TOP, TH_DIV, "text-center")}>Upstream</th>}
                  {down.length > 0 && <th colSpan={down.length} className={cn(TH, TH_TOP, TH_DIV, "text-center")}>Downstream</th>}
                  {rest.length > 0 && <th colSpan={rest.length} rowSpan={1} className={cn(TH, TH_TOP, TH_DIV, "text-center")}>&nbsp;</th>}
                  <th rowSpan={2} className={cn(TH, TH_TOP, TH_DIV, "text-right align-bottom")}>Nett LT</th>
                  <th rowSpan={2} className={cn(TH, TH_TOP, "text-right align-bottom")}>On-time</th>
                </tr>
                <tr className="border-b border-[#EBEBEB]">
                  {ordered.map((s, i) => (
                    <th key={s} className={cn(TH, TH_SUB, "text-right", (i === 0 || s === down[0] || s === rest[0]) && "border-l border-[#C3CEE3]")}>
                      {stageLabel(s)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[network, ...plants].map((row) => {
                  const isNetwork = row.plant == null;
                  return (
                    <tr key={row.plant ?? "network"} className={cn(isNetwork && "bg-slate-50/70")}>
                      <td className={cn(TD, "text-left", isNetwork ? "font-bold text-slate-900" : "text-slate-700")}>
                        {isNetwork ? "Network (all plants)" : row.plant}
                      </td>
                      <td className={cn(TD, "font-bold text-slate-900")}>{fmt(row.gross)}</td>
                      {ordered.map((s, i) => (
                        <td key={s}
                          className={cn(TD, (i === 0 || s === down[0] || s === rest[0]) && "border-l border-[#f0f1f4]", isNetwork && "font-bold text-slate-900")}
                          style={isNetwork ? undefined : { background: excessTint(row.stages[s], network.stages[s]) }}>
                          {fmt(row.stages[s])}
                        </td>
                      ))}
                      <td className={cn(TD, "border-l border-[#f0f1f4]", isNetwork && "font-bold text-slate-900")}>{fmt(row.nett)}</td>
                      <td className={cn(TD, isNetwork && "font-bold text-slate-900")}>{row.onTimePct == null ? "—" : `${row.onTimePct.toFixed(1)}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 pt-3 border-t border-[#f0f1f4] text-[11px] text-slate-500">
            {plants.length} plants · {network.poCount.toLocaleString("en-US")} POs · Gross ({basisLabel}) and nett in days per PO · On-time = gross ≤ {targetDays} days
          </p>
        </>
      )}
    </ChartCard>
  );
}
