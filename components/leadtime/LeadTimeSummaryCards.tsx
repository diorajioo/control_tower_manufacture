"use client";

// Lead Time page → Analysis tab: Lead Time card and Lead time composition card.
// Data: /api/lead-time/analysis (gross / nett stats per PO, weekly series, composition). Values arrive in days.

import { ResponsiveLine } from "@nivo/line";
import { StatusDot } from "@/components/ui/StatusDot";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { LeadTimeGaugeBar } from "@/components/ui/LeadTimeGaugeBar";
import type { LtBasis, LtScope, LtUnit } from "@/components/leadtime/LeadTimeFilterCard";

export interface LtStats {
  avg: number | null; median: number | null; p25: number | null; p75: number | null; max: number | null;
  poCount: number; prevAvg: number | null; trend: number | null;
  /** Gross only: POs on time (≤ target), at risk (≤ +15%), late */
  onTimeCount?: number; atRiskCount?: number; lateCount?: number;
}

const factor = (u: LtUnit) => (u === "hours" ? 24 : 1);
export const fmtLt = (days: number | null | undefined, u: LtUnit) =>
  days == null ? "—" : (days * factor(u)).toFixed(u === "hours" ? 1 : 2);

// Same status rule as the Overview Lead Time card: ≤ target on track, ≤ +15% at risk, above that above target
const TONES = {
  on:      { color: "#067647", label: "On Track" },
  risk:    { color: "#b45309", label: "At Risk" },
  off:     { color: "#d92d20", label: "Above Target" },
  up:      { color: "#d92d20", label: "Up vs prior period" },
  down:    { color: "#067647", label: "Down vs prior period" },
  neutral: { color: "#667085", label: "No Data" },
};

const CARD = "rounded-lg border border-[#EBEBEB] bg-white flex flex-col";
const TITLE = "text-[11.5px] font-bold uppercase tracking-[0.06em] text-slate-500";

function Spark({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  return (
    <div style={{ width: 150, height: 42 }}>
      <ResponsiveLine
        data={[{ id: "lt", data: data.map((y, i) => ({ x: i, y })) }]}
        margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
        xScale={{ type: "point" }} yScale={{ type: "linear", min: "auto", max: "auto" }}
        colors={["#1E4076"]} lineWidth={1.6} enablePoints={false} enableGridX={false} enableGridY={false}
        axisLeft={null} axisBottom={null} isInteractive={false} animate={false} curve="monotoneX"
      />
    </div>
  );
}

export function LeadTimeSummaryCard({ stats, weekly, basis, scope, unit, targetDays, loading, poStageDays }: {
  stats: LtStats | null; weekly: number[]; basis: LtBasis; scope: LtScope; unit: LtUnit; targetDays: number; loading: boolean;
  /** Nett time of the PO stage per PO (PO & approval) — shown under the gauge for Scope = PO Created */
  poStageDays?: number | null;
}) {
  const avg = stats?.avg ?? null;
  const gross = basis === "gross";
  const toneKey = avg == null ? "neutral"
    : gross ? (avg <= targetDays ? "on" : avg <= targetDays * 1.15 ? "risk" : "off")
    : stats?.trend == null ? "neutral" : stats.trend > 0 ? "up" : "down";
  const tone = TONES[toneKey];
  const trend = stats?.trend ?? null;
  const gap = gross && avg != null ? avg - targetDays : null;
  const start = scope === "released" ? "PO Released" : "PO Created";

  return (
    <div className={CARD}>
      <div className="px-4 pt-3.5 pb-3 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={TITLE}>Lead Time</span>
              <InfoTooltip size={12} width={260}
                text={gross
                  ? `Average gross lead time per PO: ${start} → Receive NDC, POs completed in the period. Status vs the ${targetDays}-day target (at risk up to +15%).`
                  : "Average nett lead time per PO: time in active production activities. Nett has no target; status compares with the prior period."} />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[30px] font-bold leading-none tabular-nums" style={{ color: avg == null ? "#d0d5dd" : "#101828" }}>
                {loading ? "…" : fmtLt(avg, unit)}
              </span>
              <span className="text-[12px] text-slate-400">{unit}</span>
              {trend != null && (
                <span className="text-[11.5px] font-bold tabular-nums" style={{ color: trend > 0 ? "#d92d20" : "#067647" }}>
                  {trend > 0 ? "↗ +" : "↘ "}{trend.toFixed(1)}%
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400">vs prior period{stats?.prevAvg != null ? ` ${fmtLt(stats.prevAvg, unit)} ${unit}` : ""}</span>
            <StatusDot color={tone.color} label={tone.label} />
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <Spark data={weekly.map((v) => v * factor(unit))} />
            {weekly.length >= 2 && <span className="text-[10px] text-slate-400">{weekly.length} weeks · {unit}</span>}
          </div>
        </div>

        {/* Same gauge as the Overview Tactical Lead Time card: PO count on time / at risk / late vs the target (gross only) */}
        {gross && stats && stats.poCount > 0 && (
          <div className="mt-3 mb-3">
            <LeadTimeGaugeBar counts={{ onTime: stats.onTimeCount ?? 0, atRisk: stats.atRiskCount ?? 0, late: stats.lateCount ?? 0 }} />
            <div className="mt-2 flex flex-col gap-0.5 text-[10.5px] text-slate-500 tabular-nums">
              <span>{stats.poCount.toLocaleString("en-US")} PO completed in period</span>
              {scope === "created" && poStageDays != null && poStageDays > 0 && avg != null && avg > 0 && (
                <span>PO &amp; approval {fmtLt(poStageDays, unit)} {unit} · {((poStageDays / avg) * 100).toFixed(0)}% of gross</span>
              )}
            </div>
          </div>
        )}

        {stats?.median != null && (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-[11px] text-slate-500 leading-relaxed">
            Median of all POs <b className="text-slate-700">{fmtLt(stats.median, unit)} {unit}</b>, half of them between{" "}
            <b className="text-slate-700">{fmtLt(stats.p25, unit)}</b> and <b className="text-slate-700">{fmtLt(stats.p75, unit)} {unit}</b>.
            {gap != null && <> Target <b className="text-slate-700">{fmtLt(targetDays, unit)} {unit}</b>, gap <b className={gap > 0 ? "text-[#d92d20]" : "text-[#067647]"}>{gap > 0 ? "+" : "−"}{fmtLt(Math.abs(gap), unit)}</b>.</>}
          </p>
        )}
      </div>
      <div className="border-t border-[#eceef2] px-4 py-1.5 text-[11px] text-slate-500 flex justify-between gap-3">
        <span className="truncate">{gross ? `Gross · ${start} → Receive NDC` : "Nett · active production time"}</span>
        <span className="tabular-nums shrink-0">{stats ? `${stats.poCount.toLocaleString("en-US")} POs` : ""}</span>
      </div>
    </div>
  );
}

const COMP = [
  { key: "va",   label: "VA",          color: "#067647", info: "Value-added activity time" },
  { key: "nnva", label: "NNVA",        color: "#f59e0b", info: "Necessary non-value-added: PO, cleaning, unboxing, NDC receiving" },
  { key: "unva", label: "UNVA (WIP)",  color: "#d92d20", info: "Waste: WIP and waiting" },
] as const;

export function LeadTimeCompositionCard({ comp, unit, loading }: {
  comp: { va: number; nnva: number; unva: number } | null; unit: LtUnit; loading: boolean;
}) {
  const total = comp ? comp.va + comp.nnva + comp.unva : 0;
  return (
    <div className={CARD}>
      <div className="px-4 pt-3.5 pb-2 flex items-center gap-1.5">
        <span className={TITLE}>Lead time composition</span>
        <InfoTooltip size={12} width={260}
          text="Average per PO: SUM(NET_LEADTIME) by ACTIVITY_CATEGORY. Activities can run in parallel, so the total is not the gross lead time." />
      </div>
      <div className="px-4 pb-3.5 flex flex-col">
        {COMP.map((c, i) => {
          const v = comp?.[c.key] ?? 0;
          const share = total > 0 ? (v / total) * 100 : 0;
          return (
            <div key={c.key} className={`flex items-center gap-3 py-2.5 ${i > 0 ? "border-t border-slate-100" : ""}`} title={c.info}>
              <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: c.color }} />
              <span className="w-[72px] text-[11.5px] font-bold text-slate-700 shrink-0">{c.label}</span>
              <div className="flex-1 h-[6px] rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${loading ? 0 : share}%`, background: c.color, transition: "width 300ms ease-out" }} />
              </div>
              <span className="w-[86px] text-right text-[12px] font-bold text-slate-900 tabular-nums shrink-0">
                {comp ? fmtLt(v, unit) : "—"} <span className="text-[10.5px] font-normal text-slate-400">{unit}</span>
              </span>
              <span className="w-[34px] text-right text-[10.5px] text-slate-400 tabular-nums shrink-0">{comp ? `${share.toFixed(0)}%` : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
