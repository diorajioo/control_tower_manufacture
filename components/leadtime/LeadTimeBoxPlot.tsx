"use client";

// Lead Time page → Analysis tab: "Lead Time Distribution" box plot per process group + statistics table.
// Look agreed with the user (2026-10-14, reference screenshot): slate boxes with a navy outline, short navy median
// dash, thin whisker Min → P90, log-like y axis with a title, slanted stage labels, amber band on the hovered
// column (chart + table), dark tooltip with a 2-column stat grid where the Focus stat is outlined in amber.
// The tooltip is a documented exception to the LineTooltip standard (docs/UI_UX.md → Lead Time Distribution).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { ResponsiveBar, type BarCustomLayerProps, type BarDatum } from "@nivo/bar";
import { cn } from "@/lib/utils";
import { Fade } from "@/components/ui/Fade";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { LINE_THEME } from "@/components/charts/StandardLine";
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

const BOX_FILL       = "#D9E0EA";
const BOX_FILL_HOVER = "#CDD5E0";
const BOX_STROKE     = "#1E4076";
const WHISKER_COLOR  = "#A9B4C4";
const MEDIAN_COLOR   = "#1E4076";
const FOKUS_COLOR    = "#F59E0B";
const HOVER_BAND     = "#FDF1DC";   // hovered column, chart
const HOVER_CELL     = "#FEF6E7";   // hovered column, table
const TOOLTIP_BG     = "#13213D";

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

type RowTone = "plain" | "bold" | "red" | "muted";
const TABLE_ROWS: { key: keyof BoxRow; label: string; fokusKey?: FokusKey; tone: RowTone }[] = [
  { key: "min",     label: "Minimum",       tone: "plain" },
  { key: "p25",     label: "Percentile 25", tone: "plain", fokusKey: "p25" },
  { key: "median",  label: "Median",        tone: "bold",  fokusKey: "median" },
  { key: "mean",    label: "Mean",          tone: "plain", fokusKey: "mean" },
  { key: "p75",     label: "Percentile 75", tone: "plain", fokusKey: "p75" },
  { key: "max",     label: "Maximum",       tone: "red",   fokusKey: "max" },
  { key: "poCount", label: "PO count",      tone: "muted" },
];
const TONE_STYLE: Record<RowTone, React.CSSProperties> = {
  plain: { color: "#334155" },
  bold:  { color: "#101828", fontWeight: 700 },
  red:   { color: "#d92d20" },
  muted: { color: "#98a2b3" },
};

// ── Unit helpers ───────────────────────────────────────────────────────────────

const ltFactor = (u: LtUnit) => (u === "hours" ? 24 : 1);

function fmtVal(days: number, unit: LtUnit): string {
  return (days * ltFactor(unit)).toFixed(2);
}

// Log-style ticks (1-2-5 steps), kept inside the data range
const LOG_TICKS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
const fmtTick = (n: number) => (n < 0.1 ? n.toFixed(2) : n < 1 ? String(n) : n.toLocaleString("en-US"));

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
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridW, setGridW] = useState(0);

  // Width of the chart/table area — the table's outer padding is derived from it (see LABEL_COL below)
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setGridW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, data]);

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

  const PADDING = 0.45;
  // Chart and table share the same horizontal grid: chart left margin = table label column, chart right margin =
  // table right padding, and each table column = one chart slot, so every box sits right above its column.
  // Nivo's band scale also pads the outer edges (step = plot width / (n + padding)), so the table adds that same
  // half-padding on both sides of its value columns.
  const LABEL_COL = 104;
  const RIGHT_PAD = 16;
  const n = Math.max(rows.length, 1);
  const edge = gridW > 0 ? (PADDING * ((gridW - LABEL_COL - RIGHT_PAD) / (n + PADDING))) / 2 : 0;

  // ── Custom layers ────────────────────────────────────────────────────────────

  // Amber band behind the hovered column (full slot width, full plot height)
  const BandLayer = useCallback(({ bars, innerHeight }: BarCustomLayerProps<BoxRow>) => {
    const b = bars.find((x) => x.data.id === "_box" && x.data.data.stage === hoveredStage);
    if (!b) return null;
    const step = b.width / (1 - PADDING);
    return <rect x={b.x - (step - b.width) / 2} y={0} width={step} height={innerHeight} fill={HOVER_BAND} />;
  }, [hoveredStage]);

  const BoxLayer = useCallback(({ bars }: BarCustomLayerProps<BoxRow>) => (
    <g>
      {bars.map((b) => {
        if (b.data.id !== "_box") return null;
        const isHovered = hoveredStage === b.data.data.stage;
        return (
          <rect key={`box-${b.data.data.stage}`} x={b.x} y={b.y} width={b.width} height={Math.max(b.height, 1)}
            fill={isHovered ? BOX_FILL_HOVER : BOX_FILL} stroke={BOX_STROKE} strokeWidth={1.25} rx={1.5} />
        );
      })}
    </g>
  ), [hoveredStage]);

  // Whisker Min → P90 (cap at P90), short median dash, dashed amber line for a non-median Focus stat
  const WhiskerLayer = useCallback(({ bars, yScale }: BarCustomLayerProps<BoxRow>) => {
    const y = yScale as (v: number) => number;
    return (
      <g style={{ pointerEvents: "none" }}>
        {bars.filter((b) => b.data.id === "_box").map((b) => {
          const d = b.data.data;
          const cx = b.x + b.width / 2;
          const cap = 4;
          const dash = Math.max(b.width * 0.16, 8);
          const yMin = y(Math.max(d.min, 0));
          const yP90 = y(Math.max(d.p90, d.p75));
          const fokusY = y(d[fokus] as number);
          return (
            <g key={`w-${d.stage}`}>
              <line x1={cx} x2={cx} y1={y(d.p75)} y2={yP90} stroke={WHISKER_COLOR} strokeWidth={1} />
              <line x1={cx - cap} x2={cx + cap} y1={yP90} y2={yP90} stroke={WHISKER_COLOR} strokeWidth={1} />
              <line x1={cx} x2={cx} y1={y(d.p25)} y2={yMin} stroke={WHISKER_COLOR} strokeWidth={1} />
              <line x1={cx - dash} x2={cx + dash} y1={y(d.median)} y2={y(d.median)} stroke={MEDIAN_COLOR} strokeWidth={2} />
              {fokus !== "median" && (
                <line x1={b.x} x2={b.x + b.width} y1={fokusY} y2={fokusY} stroke={FOKUS_COLOR} strokeWidth={1.5} strokeDasharray="3 2" />
              )}
            </g>
          );
        })}
      </g>
    );
  }, [fokus]);

  // Invisible full-height hit areas per column
  const HitLayer = useCallback(({ bars, innerHeight }: BarCustomLayerProps<BoxRow>) => (
    <g>
      {bars.filter((b) => b.data.id === "_box").map((b) => {
        const step = b.width / (1 - PADDING);
        return (
          <rect key={`hit-${b.data.data.stage}`} x={b.x - (step - b.width) / 2} y={0} width={step} height={innerHeight}
            fill="transparent" onMouseEnter={() => setHoveredStage(b.data.data.stage)} />
        );
      })}
    </g>
  ), []);

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

  // Y ticks inside the data range (in the display unit); the scale itself stays in days
  const yTicks = useMemo(() => {
    const f = ltFactor(unit);
    const hi = Math.max(0.02, ...rows.map((r) => Math.max(r.p90, r.p75) * f));
    const lo = Math.min(...rows.map((r) => Math.max(r.min, 0) * f));
    const ticks = LOG_TICKS.filter((t) => t <= hi * 1.05 && t >= Math.min(lo, 0.02) * 0.99);
    return ticks.map((t) => t / f);
  }, [rows, unit]);
  const yMax = useMemo(() => Math.max(...rows.map((r) => Math.max(r.p90, r.p75))) * 1.08, [rows]);

  // ── Empty / loading ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="rounded-lg border border-[#EBEBEB] bg-white p-4">
        <div className="h-[300px] bg-gray-50 rounded animate-pulse" />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-[#EBEBEB] bg-white p-4">
        <div className="h-[300px] flex items-center justify-center text-[11px] text-slate-400">
          No data for selected period
        </div>
      </div>
    );
  }

  const unitLabel = unit === "hours" ? "hours" : "days";
  const fokusLabel = FOKUS_OPTIONS.find((f) => f.key === fokus)?.label;

  return (
    <div className="rounded-lg border border-[#EBEBEB] bg-white p-4">
      {/* Card header */}
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-slate-500">
          Lead Time Distribution
        </p>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Focus dropdown — sorts the Pareto order and is outlined in the tooltip */}
          <div className="relative" ref={fokusRef}>
            <button
              onClick={() => setFokusOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={fokusOpen}
              className={cn(FIELD, FIELD_ON, "justify-between gap-2 min-w-[80px]")}
            >
              <span>Focus: {fokusLabel}</span>
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
            options={[{ key: "pareto", label: "Pareto" }, { key: "sequence", label: "Process order" }]}
            value={sort}
            onChange={setSort}
            ariaLabel="Column order"
          />
        </div>
      </div>

      {/* Chart */}
      <Fade depKey={`${sort}|${fokus}|${unit}|${rows.length}|${rows[0]?.stage}`}>
        <div ref={gridRef} />
        <div
          style={{ height: 300, position: "relative" }}
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
            margin={{ top: 10, right: RIGHT_PAD, bottom: 52, left: LABEL_COL }}
            padding={PADDING}
            groupMode="stacked"
            valueScale={{ type: "symlog", constant: 0.02, max: yMax }}
            colors={({ id }) => id === "_base" ? "transparent" : BOX_FILL}
            enableLabel={false}
            enableGridX={false}
            gridYValues={yTicks}
            axisLeft={{
              tickSize: 0,
              tickPadding: 8,
              tickValues: yTicks,
              format: (v) => fmtTick(Number(v) * ltFactor(unit)),
              legend: `Lead time (${unitLabel})`,
              legendPosition: "middle",
              legendOffset: -58,
            }}
            axisBottom={{ tickSize: 0, tickPadding: 10, tickRotation: -30 }}
            layers={["grid", BandLayer, "axes", BoxLayer, WhiskerLayer, HitLayer]}
            tooltip={() => null}
            animate={false}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-1 mb-3">
          <span className="flex items-center gap-1.5 text-[9.5px] text-slate-500">
            <svg width={16} height={8} className="shrink-0"><line x1={0} x2={16} y1={4} y2={4} stroke={WHISKER_COLOR} strokeWidth={1.5} /></svg>
            Min to P90
          </span>
          <span className="flex items-center gap-1.5 text-[9.5px] text-slate-500">
            <span className="w-3 h-3 rounded-[2px] shrink-0 border" style={{ background: BOX_FILL, borderColor: BOX_STROKE }} />
            IQR (P25–P75)
          </span>
          <span className="flex items-center gap-1.5 text-[9.5px] text-slate-500">
            <svg width={16} height={8} className="shrink-0"><line x1={0} x2={16} y1={4} y2={4} stroke={MEDIAN_COLOR} strokeWidth={2} /></svg>
            Median
          </span>
          {fokus !== "median" && (
            <span className="flex items-center gap-1.5 text-[9.5px] text-slate-500">
              <svg width={16} height={8} className="shrink-0"><line x1={0} x2={16} y1={4} y2={4} stroke={FOKUS_COLOR} strokeWidth={1.5} strokeDasharray="3 2" /></svg>
              Focus: {fokusLabel}
            </span>
          )}
        </div>

        {/* Statistics table — hovered column (chart or table) gets the amber tint */}
        <div className="border-t border-[#EBEBEB] pt-3">
          <p className="mb-2 text-[13px] font-bold text-[#1E4076]">Lead time statistics <span className="text-[11px] font-normal text-slate-400">({unitLabel})</span></p>
          <div style={{ paddingRight: RIGHT_PAD + edge }}>
            <table className="w-full border-collapse text-[10.5px]" style={{ tableLayout: "fixed" }} onMouseLeave={() => setHoveredStage(null)}>
              <colgroup>
                <col style={{ width: LABEL_COL + edge }} />
                {rows.map((r) => <col key={r.stage} />)}
              </colgroup>
              <thead>
                <tr>
                  <th className="text-left px-2.5 py-1.5 font-bold text-white text-[9.5px] whitespace-nowrap bg-[#1E4076] rounded-tl-md">
                    Statistic
                  </th>
                  {rows.map((r) => {
                    const hov = hoveredStage === r.stage;
                    return (
                      <th key={r.stage} onMouseEnter={() => setHoveredStage(r.stage)}
                        className="text-center px-1 py-1.5 font-bold text-white text-[9.5px] truncate last:rounded-tr-md transition-colors"
                        style={{ background: hov ? "#2E5390" : "#1E4076", boxShadow: hov ? `inset 0 -2px 0 ${FOKUS_COLOR}` : undefined }}>
                        {r.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {TABLE_ROWS.map(({ key, label, fokusKey, tone }) => (
                  <tr key={key as string} className="border-b border-[#EEF0F3]">
                    <td className="px-2.5 py-1.5 whitespace-nowrap text-[#1E4076] font-semibold border-r border-[#EEF0F3]">
                      {label}
                      {fokusKey === fokus && (
                        <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full align-middle" style={{ background: FOKUS_COLOR }} title="Focus" />
                      )}
                    </td>
                    {rows.map((r) => {
                      const raw = r[key as keyof BoxRow] as number;
                      return (
                        <td key={r.stage} onMouseEnter={() => setHoveredStage(r.stage)}
                          className="px-1 py-1.5 tabular-nums text-center whitespace-nowrap transition-colors"
                          style={{ ...TONE_STYLE[tone], background: hoveredStage === r.stage ? HOVER_CELL : undefined }}>
                          {key === "poCount" ? raw.toLocaleString("en-US") : fmtVal(raw, unit)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary line */}
        {summaryText && (
          <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-[10.5px] text-slate-500 leading-relaxed">
            {summaryText}
          </p>
        )}
      </Fade>

      {/* Tooltip — dark card, 2-column stat grid, Focus stat outlined in amber */}
      {tooltip && (() => {
        const d = rows.find((r) => r.stage === tooltip.stage);
        if (!d) return null;
        const cells: { label: string; key: FokusKey | "min"; value: number }[] = [
          { label: "Mean",   key: "mean",   value: d.mean },
          { label: "P25",    key: "p25",    value: d.p25 },
          { label: "Min",    key: "min",    value: d.min },
          { label: "Median", key: "median", value: d.median },
          { label: "Max",    key: "max",    value: d.max },
          { label: "P75",    key: "p75",    value: d.p75 },
        ];
        return (
          <div style={{ position: "fixed", zIndex: 9999, pointerEvents: "none", left: tooltip.clientX + 14, top: tooltip.clientY - 8, transform: "translateY(-100%)" }}>
            <div className="rounded-lg px-3 py-2.5 shadow-[0_10px_28px_rgba(16,24,40,0.28)]" style={{ background: TOOLTIP_BG, fontFamily: "Lato, sans-serif", minWidth: 160 }}>
              <div className="text-[11.5px] font-bold text-white leading-tight">{d.label}</div>
              <div className="text-[9.5px] text-[#A3B1C6] mb-2">{d.poCount.toLocaleString("en-US")} PO</div>
              <div className="grid grid-cols-2 gap-x-1.5 gap-y-1">
                {cells.map((c) => {
                  const on = c.key === fokus;
                  return (
                    <div key={c.label} className="rounded px-1.5 py-1"
                      style={on ? { border: `1px solid ${FOKUS_COLOR}`, background: "rgba(245,158,11,0.12)" } : { border: "1px solid transparent" }}>
                      <div className="text-[9px] leading-tight" style={{ color: on ? FOKUS_COLOR : "#A3B1C6", fontWeight: on ? 700 : 400 }}>{c.label}</div>
                      <div className="text-[12px] font-bold text-white tabular-nums whitespace-nowrap leading-tight">
                        {fmtVal(c.value, unit)} <span className="text-[9px] font-normal text-[#A3B1C6]">{unitLabel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
