"use client";

// Lead time distribution per PO: 2-day bins (48 h in hours), last bin "> 38", normal curve, mean and ±1σ lines,
// stats panel. Data: /api/lead-time/distribution (respects the Lead Time page filters via `filters.lt`).
// Used by the Overview Tactical view and the Lead Time page (Analysis tab), where a click on a bar selects that
// bin (`onBinClick`) to filter the PO table below; the selected bar stays navy, the others fade.

import { useEffect, useMemo, useState } from "react";
import { ResponsiveBar, type BarCustomLayerProps, type BarDatum } from "@nivo/bar";
import { Fade } from "@/components/ui/Fade";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { LineTooltip } from "@/components/charts/StandardLine";
import { dimsKey, dimsToParams, type LtDims } from "@/lib/leadTimeFilters";

type LtUnit = "days" | "hours";
type LtMeasure = "gross" | "nett";
const ltFactor = (u: LtUnit) => (u === "hours" ? 24 : 1);
const fmtLt = (days: number, u: LtUnit) => (days * ltFactor(u)).toFixed(u === "hours" ? 1 : 2);

/** Bin width and the start of the open-ended last bin, in days — same as the SQL (getLeadTimeDistributionBins). */
export const BIN_DAYS = 2;
export const LAST_BIN = 38;
/** Bin of a lead time in days (same rule as the SQL: FLOOR(LEAST(d, 38) / 2) * 2). */
export const binOf = (days: number) => Math.floor(Math.min(days, LAST_BIN) / BIN_DAYS) * BIN_DAYS;

export interface HistogramFilters {
  plant: string;
  startDate: string;
  endDate: string;
  period?: string;
  lt?: LtDims;
}

interface DistResponse {
  bins: { binStart: number; count: number }[];
  mean: number;
  median: number;
  stddev: number;
  total: number;
}

/** 2-day bin label in the chosen unit (48-hour bins in hours). */
export function binLabel(start: number, u: LtUnit = "days") {
  const f = ltFactor(u);
  if (start >= LAST_BIN) return `> ${LAST_BIN * f}`;
  return `${start * f}-${(start + BIN_DAYS) * f}`;
}

interface HistoRow extends BarDatum {
  bin: string;
  binStart: number;
  count: number;
}

const BAR = "rgba(30,64,118,0.72)";
const BAR_SELECTED = "#1E4076";
const BAR_FADED = "rgba(30,64,118,0.25)";

export function LeadTimeHistogram({ filters, basis, metric, unit, detailHref = "/lead-time", selectedBin = null, onBinClick }: {
  filters: HistogramFilters;
  basis: "created" | "released";
  metric: LtMeasure;
  unit: LtUnit;
  /** "Open detail →" link top right; null hides it (Lead Time page) */
  detailHref?: string | null;
  /** Selected bin start (days); null = none */
  selectedBin?: number | null;
  /** Click on a bar → bin start in days (click the selected bar again to clear: the parent decides) */
  onBinClick?: (binStart: number) => void;
}) {
  const [data, setData] = useState<DistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const lt = dimsKey(filters.lt);

  useEffect(() => {
    const params = dimsToParams(filters.lt, new URLSearchParams());
    params.set("plant", filters.plant);
    params.set("startDate", filters.startDate);
    params.set("endDate", filters.endDate);
    params.set("basis", basis);
    params.set("metric", metric);
    if (filters.period) params.set("period", filters.period);
    setLoading(true);
    fetch(`/api/lead-time/distribution?${params.toString()}`)
      .then((r) => r.json())
      .then((d: DistResponse) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.plant, filters.startDate, filters.endDate, filters.period, lt, basis, metric]);

  const { rows, cumByBin, maxBin, maxBinCount } = useMemo(() => {
    if (!data || data.bins.length === 0) {
      return { rows: [] as HistoRow[], cumByBin: new Map<number, number>(), maxBin: 0, maxBinCount: 0 };
    }
    const total = data.total || data.bins.reduce((s, b) => s + b.count, 0);
    let cum = 0;
    const cumMap = new Map<number, number>();
    const sorted = [...data.bins].sort((a, b) => a.binStart - b.binStart);
    const rr: HistoRow[] = sorted.map((b) => {
      cum += b.count;
      cumMap.set(b.binStart, total > 0 ? (cum / total) * 100 : 0);
      return { bin: binLabel(b.binStart, unit), binStart: b.binStart, count: b.count };
    });
    let maxB = sorted[0]?.binStart ?? 0;
    let maxC = 0;
    for (const b of sorted) {
      if (b.count > maxC) { maxC = b.count; maxB = b.binStart; }
    }
    return { rows: rr, cumByBin: cumMap, maxBin: maxB, maxBinCount: maxC };
  }, [data, unit]);
  const suffix = unit === "hours" ? "h" : "d";

  const mean = data?.mean ?? 0;
  const stddev = data?.stddev ?? 0;
  const median = data?.median ?? 0;
  const total = data?.total ?? 0;

  // KDE/normal curve + vertical mean/±1σ lines + shaded ±1σ band
  const Overlay = ({ bars, yScale, innerHeight }: BarCustomLayerProps<HistoRow>) => {
    if (!data || stddev <= 0 || bars.length === 0) return null;

    // Ground all x-coordinates in actual nivo pixel positions to avoid outer-padding drift.
    const firstBar = bars[0];
    const lastBar = bars[bars.length - 1];
    const pixelLeft = firstBar.x;
    const pixelRight = lastBar.x + lastBar.width;
    const dayLeft = (firstBar.data.data as HistoRow).binStart ?? 0;
    const dayRight = ((lastBar.data.data as HistoRow).binStart ?? LAST_BIN) + BIN_DAYS;
    const dayRange = dayRight - dayLeft || 1;
    const pixelRange = pixelRight - pixelLeft || 1;

    const xForDay = (d: number) => pixelLeft + ((d - dayLeft) / dayRange) * pixelRange;
    const clampX = (x: number) => Math.max(pixelLeft, Math.min(pixelRight, x));

    const totalRows = total || rows.reduce((s, r) => s + r.count, 0);
    const scale = totalRows * BIN_DAYS;
    const yForDensity = (density: number) => (yScale as (v: number) => number)(density * scale);
    const pdf = (d: number) => {
      const z = (d - mean) / stddev;
      return Math.exp(-0.5 * z * z) / (stddev * Math.sqrt(2 * Math.PI));
    };

    // Build curve path across real bar pixel span
    const stepsPx = 2;
    const pts: string[] = [];
    for (let px = pixelLeft; px <= pixelRight; px += stepsPx) {
      const d = dayLeft + ((px - pixelLeft) / pixelRange) * dayRange;
      pts.push(`${px.toFixed(1)},${yForDensity(pdf(d)).toFixed(1)}`);
    }
    const curvePath = `M ${pts.join(" L ")}`;

    const xMean = clampX(xForDay(mean));
    const xLow  = clampX(xForDay(mean - stddev));
    const xHigh = clampX(xForDay(mean + stddev));

    const labelStyle: React.CSSProperties = {
      fontSize: 9.5, fontFamily: "Lato, sans-serif", fontWeight: 700,
      fill: "#d92d20", dominantBaseline: "hanging",
    };

    return (
      <g style={{ pointerEvents: "none" }}>
        <rect x={xLow} y={0} width={Math.max(0, xHigh - xLow)} height={innerHeight} fill="#fecaca" opacity={0.22} />

        {/* −1σ */}
        <text x={xLow} y={2} textAnchor="middle" style={labelStyle}>−1σ</text>
        <line x1={xLow} x2={xLow} y1={14} y2={innerHeight} stroke="#d92d20" strokeWidth={1} strokeDasharray="4 3" />

        {/* +1σ */}
        <text x={xHigh} y={2} textAnchor="middle" style={labelStyle}>+1σ</text>
        <line x1={xHigh} x2={xHigh} y1={14} y2={innerHeight} stroke="#d92d20" strokeWidth={1} strokeDasharray="4 3" />

        {/* Mean */}
        <text x={xMean} y={2} textAnchor="middle" style={labelStyle}>x̄ {(mean * ltFactor(unit)).toFixed(1)}</text>
        <line x1={xMean} x2={xMean} y1={14} y2={innerHeight} stroke="#d92d20" strokeWidth={1.5} />

        <path d={curvePath} fill="none" stroke="#1E4076" strokeWidth={1.5} opacity={0.85} />
      </g>
    );
  };

  return (
    <div className="rounded-lg border border-[#EBEBEB] bg-white p-4">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Lead Time Distribution per PO</p>
          <InfoTooltip
            text={(metric === "nett"
              ? "Only POs completed within the selected period. Nett = time in active production activities per PO; it does not depend on PO Created / Released."
              : "Only POs completed within the selected period (PO FG Done Date is not null). Gross = start (PO Created or Released) to RECEIVE NDC.")
              + (onBinClick ? " Click a bar to list its POs in the table below; click it again to show all POs." : "")}
            size={13}
            width={240}
          />
        </div>
        {detailHref && (
          <a href={detailHref} className="text-[11px] text-[#1E4076] font-semibold hover:underline shrink-0">
            Open detail →
          </a>
        )}
      </div>

      {loading ? (
        <div className="h-[280px] bg-gray-50 rounded animate-pulse" />
      ) : rows.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center text-[11px] text-gray-400">No data for selected period</div>
      ) : (
        <Fade depKey={`${data?.mean}|${data?.total}|${unit}`}>
        {/* Fades on new data and on a Days / Hours switch */}
        <div className="grid grid-cols-[1fr_180px] gap-4">
          <div style={{ height: 280 }}>
            <ResponsiveBar<HistoRow>
              data={rows}
              keys={["count"]}
              indexBy="bin"
              margin={{ top: 16, right: 12, bottom: 40, left: 44 }}
              padding={0.12}
              colors={({ data: d }) => selectedBin == null ? BAR : d.binStart === selectedBin ? BAR_SELECTED : BAR_FADED}
              enableLabel={false}
              borderRadius={2}
              onClick={onBinClick ? (bar) => onBinClick((bar.data as HistoRow).binStart) : undefined}
              onMouseEnter={onBinClick ? (_d, e) => { (e.currentTarget as SVGElement).style.cursor = "pointer"; } : undefined}
              axisLeft={{
                tickSize: 0, tickPadding: 6,
                legend: "PO count", legendPosition: "middle", legendOffset: -36,
                format: (v) => String(v),
              }}
              axisBottom={{
                tickSize: 0, tickPadding: 6,
                legend: `End-to-end ${metric} lead time (${unit})`, legendPosition: "middle", legendOffset: 32,
              }}
              gridYValues={5}
              theme={{
                grid: { line: { stroke: "#eef0f3", strokeDasharray: "3 3" } },
                axis: {
                  ticks: { text: { fontSize: 10, fill: "#667085", fontFamily: "Lato, sans-serif" } },
                  legend: { text: { fontSize: 10.5, fill: "#667085", fontFamily: "Lato, sans-serif", fontWeight: 700 } },
                },
              }}
              layers={["grid", "axes", "bars", Overlay, "markers", "legends"]}
              tooltip={({ data: d }) => {
                const cum = cumByBin.get(d.binStart) ?? 0;
                const pct = total > 0 ? (d.count / total) * 100 : 0;
                const f = ltFactor(unit);
                const label = d.binStart >= LAST_BIN ? `> ${LAST_BIN * f} ${unit}` : `${d.binStart * f}–${(d.binStart + BIN_DAYS) * f} ${unit}`;
                return (
                  <LineTooltip
                    title={label}
                    rows={[
                      { label: "PO count", value: d.count.toLocaleString() },
                      { label: "Share", value: `${pct.toFixed(1)}%` },
                    ]}
                    footer={onBinClick
                      ? { label: selectedBin === d.binStart ? "Click to show all POs" : "Click to list these POs", value: `${cum.toFixed(1)}% cum.` }
                      : { label: "Cumulative", value: `${cum.toFixed(1)}%` }}
                  />
                );
              }}
              animate={false}
            />
          </div>
          <div className="flex flex-col gap-2 border-l border-[#EBEBEB] pl-4 text-[11px]">
            <StatRow label="PO count" value={total.toLocaleString()} />
            <StatRow label="Mean (x̄)" value={`${fmtLt(mean, unit)}${suffix}`} />
            <StatRow label="Median" value={`${fmtLt(median, unit)}${suffix}`} />
            <StatRow label="Std dev (σ)" value={`${fmtLt(stddev, unit)}${suffix}`} />
            <div className="border-t border-[#EBEBEB] my-1" />
            <StatRow label="Peak bin" value={binLabel(maxBin, unit)} />
            <StatRow label="PO in peak" value={maxBinCount.toLocaleString()} />
            <div className="border-t border-[#EBEBEB] my-1" />
            <div className="flex items-center gap-2 text-[10.5px] text-slate-500">
              <span style={{ width: 10, height: 2, background: "#d92d20" }} /> Mean
              <span className="ml-auto font-bold text-slate-900 tabular-nums">{fmtLt(mean, unit)}{suffix}</span>
            </div>
            <div className="flex items-center gap-2 text-[10.5px] text-slate-500">
              <span style={{ width: 10, height: 0, borderTop: "1px dashed #d92d20" }} /> Mean ±1σ
              <span className="ml-auto font-bold text-slate-900 tabular-nums whitespace-nowrap">
                {fmtLt(Math.max(0, mean - stddev), unit)}–{fmtLt(mean + stddev, unit)}{suffix}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10.5px] text-slate-500">
              <span style={{ width: 10, height: 2, background: "#1E4076" }} /> Normal curve
            </div>
          </div>
        </div>
        </Fade>
      )}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900 font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}
