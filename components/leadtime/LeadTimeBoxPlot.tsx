"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { ResponsiveBar, type BarCustomLayerProps, type BarDatum } from "@nivo/bar";
import { cn } from "@/lib/utils";
import { Fade } from "@/components/ui/Fade";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { LINE_THEME, LineTooltip } from "@/components/charts/StandardLine";
import { FIELD, FIELD_ON, MENU, MENU_ITEM, MENU_ITEM_ON, MENU_ITEM_OFF } from "@/components/ui/FilterField";
import { PROCESS_GROUPS } from "@/lib/leadTimeStages";
import type { LtUnit } from "@/components/leadtime/LeadTimeFilterCard";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BoxPlotStage {
  stage: string;
  label: string;
  sequence: number;
  poCount: number;
  min: number;
  p25: number;
  median: number;
  mean: number;
  p75: number;
  p90: number;
  max: number;
}

type FokusKey = "median" | "mean" | "p25" | "p75" | "max";

const FOKUS_OPTIONS: { key: FokusKey; label: string }[] = [
  { key: "median", label: "Median" },
  { key: "mean",   label: "Mean"   },
  { key: "p25",    label: "P25"    },
  { key: "p75",    label: "P75"    },
  { key: "max",    label: "Max"    },
];

// ── Colors ─────────────────────────────────────────────────────────────────────

const BOX_FILL      = "#DBEAFE";
const BOX_STROKE    = "#93C5FD";
const WHISKER_COLOR = "#94a3b8";
const MEDIAN_COLOR  = "#1E4076";
const MEAN_COLOR    = "#475467";
const FOKUS_COLOR   = "#f59e0b";

// ── Nivo bar row type ──────────────────────────────────────────────────────────

interface BoxRow extends BarDatum {
  stage: string;
  label: string;
  _base: number;
  _box: number;
  min: number;
  p25: number;
  median: number;
  mean: number;
  p75: number;
  p90: number;
  max: number;
  poCount: number;
  sequence: number;
}

// ── Statistics table row spec ──────────────────────────────────────────────────

const TABLE_ROWS: { key: keyof BoxRow; label: string; fokusKey?: FokusKey }[] = [
  { key: "min",     label: "Minimum" },
  { key: "p25",     label: "P25",    fokusKey: "p25" },
  { key: "median",  label: "Median", fokusKey: "median" },
  { key: "mean",    label: "Mean",   fokusKey: "mean" },
  { key: "p75",     label: "P75",    fokusKey: "p75" },
  { key: "max",     label: "Maximum",fokusKey: "max" },
  { key: "poCount", label: "PO count" },
];

// ── Unit helpers ───────────────────────────────────────────────────────────────

const ltFactor = (u: LtUnit) => (u === "hours" ? 24 : 1);

function fmtVal(days: number, unit: LtUnit): string {
  const v = days * ltFactor(unit);
  return v.toFixed(2);
}

// ── Component ──────────────────────────────────────────────────────────────────

export function LeadTimeBoxPlot({
  data,
  loading,
  unit = "days",
}: {
  data: { stage: string; poCount: number; min: number; p25: number; median: number; mean: number; p75: number; p90: number; max: number }[] | null;
  loading: boolean;
  unit: LtUnit;
}) {
  const [fokus, setFokus] = useState<FokusKey>("median");
  const [fokusOpen, setFokusOpen] = useState(false);
  const [sort, setSort] = useState<"pareto" | "sequence">("pareto");
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ clientX: number; clientY: number; stage: string } | null>(null);
  const fokusRef = useRef<HTMLDivElement>(null);

  // Close fokus dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (fokusRef.current && !fokusRef.current.contains(e.target as Node)) setFokusOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Build BoxPlotStage[] from raw API data, merging label + sequence from PROCESS_GROUPS
  const stages: BoxPlotStage[] = useMemo(() => {
    if (!data) return [];
    return data
      .map((r) => {
        const grp = PROCESS_GROUPS.find((g) => g.id === r.stage);
        return {
          stage:    r.stage,
          label:    grp?.label ?? r.stage,
          sequence: grp ? PROCESS_GROUPS.indexOf(grp) : 99,
          poCount:  r.poCount,
          min:      r.min,
          p25:      r.p25,
          median:   r.median,
          mean:     r.mean,
          p75:      r.p75,
          p90:      r.p90,
          max:      r.max,
        };
      })
      .filter((s) => s.p25 !== undefined);
  }, [data]);

  // Sort and build Nivo rows
  const rows: BoxRow[] = useMemo(() => {
    const sorted = [...stages].sort((a, b) =>
      sort === "pareto"
        ? (b[fokus] as number) - (a[fokus] as number)
        : a.sequence - b.sequence
    );
    return sorted.map((s) => ({
      stage:    s.stage,
      label:    s.label,
      _base:    s.p25,
      _box:     Math.max(0, s.p75 - s.p25),
      min:      s.min,
      p25:      s.p25,
      median:   s.median,
      mean:     s.mean,
      p75:      s.p75,
      p90:      s.p90,
      max:      s.max,
      poCount:  s.poCount,
      sequence: s.sequence,
    }));
  }, [stages, sort, fokus]);

  // ── Custom layers ────────────────────────────────────────────────────────────

  const BoxLayer = useCallback(({ bars }: BarCustomLayerProps<BoxRow>) => {
    return (
      <g>
        {bars.map((b) => {
          if (b.data.id !== "_box") return null;
          const isHovered = hoveredStage === b.data.data.stage;
          return (
            <rect
              key={`box-${b.data.data.stage}`}
              x={b.x}
              y={b.y}
              width={b.width}
              height={b.height}
              fill={isHovered ? "#BFDBFE" : BOX_FILL}
              stroke={BOX_STROKE}
              strokeWidth={1}
              rx={2}
            />
          );
        })}
      </g>
    );
  }, [hoveredStage]);

  const WhiskerLayer = useCallback(({ bars, yScale }: BarCustomLayerProps<BoxRow>) => {
    const y = yScale as (v: number) => number;
    const boxBars = bars.filter((b) => b.data.id === "_box");
    return (
      <g style={{ pointerEvents: "none" }}>
        {boxBars.map((b) => {
          const d = b.data.data;
          const cx = b.x + b.width / 2;
          const bx = b.x, bw = b.width;
          const cap = Math.max(bw * 0.25, 6);
          const isHovered = hoveredStage === d.stage;
          const sw = isHovered ? 2 : 1.5;
          const yMin  = y(Math.max(d.min, 0));
          const yMax  = y(d.max);
          const yP25  = y(d.p25);
          const yP75  = y(d.p75);
          const yMed  = y(d.median);
          const yMean = y(d.mean);
          const isFokus = fokus !== "median" && fokus !== "mean";
          const fokusVal = d[fokus as keyof BoxRow] as number;
          const fokusY = y(fokusVal);
          return (
            <g key={`w-${d.stage}`}>
              {/* Upper whisker P75 → max */}
              <line x1={cx} x2={cx} y1={yP75} y2={yMax} stroke={WHISKER_COLOR} strokeWidth={sw} />
              <line x1={cx - cap} x2={cx + cap} y1={yMax} y2={yMax} stroke={WHISKER_COLOR} strokeWidth={sw} />
              {/* Lower whisker min → P25 */}
              <line x1={cx} x2={cx} y1={yP25} y2={yMin} stroke={WHISKER_COLOR} strokeWidth={sw} />
              <line x1={cx - cap} x2={cx + cap} y1={yMin} y2={yMin} stroke={WHISKER_COLOR} strokeWidth={sw} />
              {/* Median line */}
              <line
                x1={bx + 2} x2={bx + bw - 2} y1={yMed} y2={yMed}
                stroke={fokus === "median" ? FOKUS_COLOR : MEDIAN_COLOR}
                strokeWidth={fokus === "median" ? 2.5 : 2}
              />
              {/* Mean dot */}
              <circle
                cx={cx} cy={yMean}
                r={isHovered ? 3.5 : 2.5}
                fill={fokus === "mean" ? FOKUS_COLOR : MEAN_COLOR}
              />
              {isFokus && (
                <line
                  x1={bx} x2={bx + bw} y1={fokusY} y2={fokusY}
                  stroke={FOKUS_COLOR} strokeWidth={2} strokeDasharray="3 2"
                />
              )}
            </g>
          );
        })}
      </g>
    );
  }, [rows, fokus, hoveredStage]);

  const HoverLayer = useCallback(({ bars, innerHeight }: BarCustomLayerProps<BoxRow>) => {
    const seenStages = new Set<string>();
    return (
      <g>
        {bars.filter((b) => b.data.id === "_base").map((b) => {
          if (seenStages.has(b.data.data.stage)) return null;
          seenStages.add(b.data.data.stage);
          return (
            <rect
              key={`hit-${b.data.data.stage}`}
              x={b.x}
              y={0}
              width={b.width}
              height={innerHeight}
              fill="transparent"
              onMouseEnter={() => setHoveredStage(b.data.data.stage)}
              onMouseLeave={() => setHoveredStage(null)}
            />
          );
        })}
      </g>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  // ── Summary stats ────────────────────────────────────────────────────────────

  const summaryText = useMemo(() => {
    if (rows.length === 0) return null;
    const highest = (key: keyof BoxRow) =>
      rows.reduce((best, r) => ((r[key] as number) > (best[key] as number) ? r : best), rows[0]);
    const hMed  = highest("median");
    const hIqr  = rows.reduce((best, r) => ((r.p75 - r.p25) > (best.p75 - best.p25) ? r : best), rows[0]);
    const hP75  = highest("p75");
    const f = ltFactor(unit);
    const u = unit === "hours" ? "hrs" : "days";
    return `Highest median: ${hMed.label} at ${(hMed.median * f).toFixed(2)} ${u}. Widest IQR: ${hIqr.label} (${((hIqr.p75 - hIqr.p25) * f).toFixed(2)} ${u}). Highest P75: ${hP75.label} (${(hP75.p75 * f).toFixed(2)} ${u}).`;
  }, [rows, unit]);

  // ── Max value per table row (for red highlight) ───────────────────────────────

  const rowMaxStage = useMemo(() => {
    const result: Partial<Record<keyof BoxRow, string>> = {};
    for (const { key } of TABLE_ROWS) {
      if (key === "poCount") {
        const best = rows.reduce<BoxRow | null>((b, r) => (!b || r.poCount > b.poCount ? r : b), null);
        if (best) result[key] = best.stage;
      } else {
        const best = rows.reduce<BoxRow | null>((b, r) => (!b || (r[key] as number) > (b[key] as number) ? r : b), null);
        if (best) result[key] = best.stage;
      }
    }
    return result;
  }, [rows]);

  // ── Chart height ──────────────────────────────────────────────────────────────

  const chartHeight = unit === "hours" ? 320 : 280;

  // ── Empty / loading ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="rounded-lg border border-[#EBEBEB] bg-white p-4">
        <div className="h-[280px] bg-gray-50 rounded animate-pulse" />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-[#EBEBEB] bg-white p-4">
        <div className="h-[280px] flex items-center justify-center text-[11px] text-slate-400">
          No data for selected period
        </div>
      </div>
    );
  }

  const unitLabel = unit === "hours" ? "hrs" : "days";

  return (
    <div className="rounded-lg border border-[#EBEBEB] bg-white p-4">
      {/* Card header */}
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-slate-500">
          Lead Time Distribution
        </p>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Fokus dropdown */}
          <div className="relative" ref={fokusRef}>
            <button
              onClick={() => setFokusOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={fokusOpen}
              className={cn(FIELD, FIELD_ON, "justify-between gap-2 min-w-[80px]")}
            >
              <span className="text-[10.5px]">Fokus: {FOKUS_OPTIONS.find((f) => f.key === fokus)?.label}</span>
              <ChevronDown size={11} className={cn("text-slate-400 shrink-0 transition-transform duration-150", fokusOpen && "rotate-180")} />
            </button>
            {fokusOpen && (
              <div className={cn(MENU, "w-[max(100%,120px)]")} role="listbox">
                {FOKUS_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    role="option"
                    aria-selected={fokus === o.key}
                    onClick={() => { setFokus(o.key); setFokusOpen(false); }}
                    className={cn(MENU_ITEM, fokus === o.key ? MENU_ITEM_ON : MENU_ITEM_OFF)}
                  >
                    <span>{o.label}</span>
                    {fokus === o.key && <Check size={10} className="text-[#1E4076] shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <SegmentedToggle<"pareto" | "sequence">
            options={[{ key: "pareto", label: "Par" }, { key: "sequence", label: "Seq" }]}
            value={sort}
            onChange={setSort}
          />
        </div>
      </div>

      {/* Chart */}
      <Fade depKey={`${sort}|${fokus}|${unit}|${rows.length}|${rows[0]?.stage}`}>
        <div
          style={{ height: chartHeight, position: "relative" }}
          onMouseLeave={() => { setHoveredStage(null); setTooltip(null); }}
          onMouseMove={(e) => {
            if (hoveredStage) setTooltip({ clientX: e.clientX, clientY: e.clientY, stage: hoveredStage });
          }}
        >
          <ResponsiveBar<BoxRow>
            data={rows}
            keys={["_base", "_box"]}
            indexBy="label"
            theme={LINE_THEME}
            margin={{ top: 12, right: 16, bottom: 44, left: 44 }}
            padding={0.38}
            groupMode="stacked"
            valueScale={{ type: "symlog", constant: 1 }}
            colors={({ id }) => id === "_base" ? "transparent" : BOX_FILL}
            borderRadius={2}
            enableLabel={false}
            enableGridX={false}
            axisLeft={{
              tickSize: 0,
              tickPadding: 8,
              format: (v) => {
                const n = Number(v) * ltFactor(unit);
                return n.toFixed(n < 1 ? 2 : 1);
              },
            }}
            axisBottom={{
              tickSize: 0,
              tickPadding: 8,
            }}
            layers={["grid", "axes", BoxLayer, WhiskerLayer, HoverLayer]}
            tooltip={() => null}
            animate={false}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-1 mb-2">
          <span className="flex items-center gap-1.5 text-[9.5px] text-slate-500">
            <svg width={20} height={10} className="shrink-0">
              <line x1={10} x2={10} y1={0} y2={10} stroke={WHISKER_COLOR} strokeWidth={1.5} />
              <line x1={6} x2={14} y1={0} y2={0} stroke={WHISKER_COLOR} strokeWidth={1.5} />
              <line x1={6} x2={14} y1={10} y2={10} stroke={WHISKER_COLOR} strokeWidth={1.5} />
            </svg>
            Whisker (min–max)
          </span>
          <span className="flex items-center gap-1.5 text-[9.5px] text-slate-500">
            <span className="w-4 h-3 rounded-sm shrink-0 border" style={{ background: BOX_FILL, borderColor: BOX_STROKE }} />
            IQR (P25–P75)
          </span>
          <span className="flex items-center gap-1.5 text-[9.5px] text-slate-500">
            <svg width={16} height={8} className="shrink-0">
              <line x1={0} x2={16} y1={4} y2={4} stroke={MEDIAN_COLOR} strokeWidth={2} />
            </svg>
            Median
          </span>
          <span className="flex items-center gap-1.5 text-[9.5px] text-slate-500">
            <svg width={10} height={10} className="shrink-0">
              <circle cx={5} cy={5} r={2.5} fill={MEAN_COLOR} />
            </svg>
            Mean
          </span>
        </div>

        {/* Statistics table */}
        <div className="border-t border-[#EBEBEB] pt-3 overflow-x-auto">
          <table className="w-full border-collapse text-[10.5px]" style={{ tableLayout: "auto" }}>
            <thead>
              <tr style={{ background: "#1E4076" }}>
                <th className="text-left px-3 py-1.5 font-bold text-white text-[10.5px] rounded-tl-md whitespace-nowrap">
                  Metric
                </th>
                {rows.map((r) => (
                  <th
                    key={r.stage}
                    className="text-right px-3 py-1.5 font-bold text-white text-[10.5px] whitespace-nowrap last:rounded-tr-md"
                    style={{ background: hoveredStage === r.stage ? "#16305C" : "#1E4076" }}
                  >
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TABLE_ROWS.map(({ key, label, fokusKey }, rowIdx) => {
                const isFokusRow = fokusKey !== undefined && fokusKey === fokus;
                return (
                  <tr
                    key={key as string}
                    style={{ background: isFokusRow ? "#FEF3C7" : rowIdx % 2 === 0 ? "white" : "#f8fafc" }}
                  >
                    <td className="px-3 py-1 font-semibold text-slate-600 bg-slate-50 whitespace-nowrap border-r border-[#EBEBEB]">
                      {label}
                      {isFokusRow && (
                        <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full align-middle" style={{ background: FOKUS_COLOR }} />
                      )}
                    </td>
                    {rows.map((r) => {
                      const isHovCol = hoveredStage === r.stage;
                      const rawVal = r[key as keyof BoxRow] as number;
                      const isMax = rowMaxStage[key as keyof BoxRow] === r.stage;
                      let display: string;
                      if (key === "poCount") {
                        display = rawVal.toLocaleString();
                      } else {
                        display = fmtVal(rawVal, unit);
                      }
                      return (
                        <td
                          key={r.stage}
                          className="px-3 py-1 tabular-nums text-right whitespace-nowrap"
                          style={{
                            background: isHovCol ? "#EEF4FB" : isFokusRow ? "#FEF3C7" : undefined,
                            color: isMax ? "#d92d20" : "#334155",
                            fontWeight: isMax ? 700 : 400,
                          }}
                        >
                          {key !== "poCount" ? `${display} ${unitLabel}` : display}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary line */}
        {summaryText && (
          <p className="mt-2 text-[10.5px] text-slate-500 leading-relaxed px-1">
            {summaryText}
          </p>
        )}
      </Fade>

      {/* Fixed tooltip */}
      {tooltip && (() => {
        const d = rows.find((r) => r.stage === tooltip.stage);
        if (!d) return null;
        return (
          <div style={{ position: "fixed", zIndex: 9999, pointerEvents: "none", left: tooltip.clientX + 14, top: tooltip.clientY - 8, transform: "translateY(-100%)" }}>
            <LineTooltip
              title={d.label}
              subtitle={`${d.poCount.toLocaleString()} PO`}
              rows={[
                { label: "Min",    value: fmtVal(d.min,    unit), unit: unitLabel, strong: false },
                { label: "P25",    value: fmtVal(d.p25,    unit), unit: unitLabel, strong: fokus === "p25" },
                { label: "Median", value: fmtVal(d.median, unit), unit: unitLabel, strong: fokus === "median" },
                { label: "Mean",   value: fmtVal(d.mean,   unit), unit: unitLabel, strong: fokus === "mean" },
                { label: "P75",    value: fmtVal(d.p75,    unit), unit: unitLabel, strong: fokus === "p75" },
                { label: "Max",    value: fmtVal(d.max,    unit), unit: unitLabel, strong: fokus === "max" },
              ]}
            />
          </div>
        );
      })()}
    </div>
  );
}
