"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Standard line chart style — the single source for every Nivo line chart (same role as TONES for KPI cards).
// Spec, checklist and anti-patterns: docs/UI_UX.md → Standard Line Chart.
// Implementations: Overview TrendChart · Lead Time LeadTimeTrendChart (cleanest full example).
//
//   Style    minimal: no axis lines, dashed horizontal hairline grid only, muted 10px ticks
//   Colors   SERIES_COLORS in fixed entity order (lib/chartConfig.ts); aggregate = SERIES_TOTAL_COLOR
//   Lines    smooth (monotoneX), 2px, round caps, no resting points
//   Hover    hairline crosshair + solid 4px points with a white ring on every series at that x
//   Tooltip  light card: x label, then dot · series · value (right-aligned, tabular); sub-lines 9.5px, never wrap
//   Legend   below the plot, centered, 9.5px: dot · name · last value; hover isolates (other lines 12%, legend 40%)
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from "react";
import { line, curveMonotoneX } from "d3-shape";
import { SERIES_COLORS, SERIES_OVERFLOW_COLOR } from "@/lib/chartConfig";

export interface StandardSeries {
  id: string;
  color: string;
  data: { x: string; y: number | null }[];
}

export const LINE_THEME = {
  background: "transparent",
  text: { fontFamily: "inherit" },
  axis: {
    ticks: {
      line: { strokeWidth: 0 },
      text: { fill: "#a0a6b1", fontSize: 10, fontFamily: "inherit", fontVariantNumeric: "tabular-nums" },
    },
    domain: { line: { strokeWidth: 0 } },
  },
  grid: {
    line: { stroke: "#eef0f3", strokeWidth: 1, strokeDasharray: "3 4" },
  },
  crosshair: {
    line: { stroke: "#c4c9d2", strokeWidth: 1, strokeOpacity: 1, strokeDasharray: "0" },
  },
};

/** Shared ResponsiveLine props — spread first, then add chart-specific ones. */
export const LINE_DEFAULTS = {
  theme:         LINE_THEME,
  margin:        { top: 10, right: 8, bottom: 26, left: 36 },
  xScale:        { type: "point" as const },
  yScale:        { type: "linear" as const, min: "auto" as const, max: "auto" as const, stacked: false },
  curve:         "monotoneX" as const,
  lineWidth:     2,
  enablePoints:  false,
  enableGridX:   false,
  gridYValues:   4,
  useMesh:       true,
  crosshairType: "x" as const,
  axisLeft: {
    tickSize: 0,
    tickPadding: 10,
    tickValues: 4,
    format: (v: string | number | Date) => Number(v).toFixed(0),
  },
};

/** Series color by fixed slot; slots beyond the palette fold to neutral gray. */
export function seriesColor(index: number): string {
  return SERIES_COLORS[index] ?? SERIES_OVERFLOW_COLOR;
}

export function hexToRgba(hex: string, alpha: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Line color while a series is isolated: non-hovered series drop to 12% opacity. */
export function isolatedColor(color: string, id: string, hovered: string | null) {
  return hovered && id !== hovered ? hexToRgba(color, 0.12) : color;
}

// ── Layers ───────────────────────────────────────────────────────────────────

/** Solid points with a white ring on every series at the active x (set from onMouseMove). */
export function makeActivePointsLayer(series: StandardSeries[], getActiveX: () => string | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function ActivePointsLayer(props: any) {
    const x = getActiveX();
    if (!x || !props.xScale || !props.yScale) return null;
    return (
      <g style={{ pointerEvents: "none" }}>
        {series.map((serie) => {
          const pt = serie.data.find((d) => d.x === x);
          if (!pt || pt.y == null) return null;
          return (
            <circle
              key={serie.id}
              cx={props.xScale(x)}
              cy={props.yScale(pt.y)}
              r={4}
              fill={serie.color}
              stroke="#ffffff"
              strokeWidth={2}
            />
          );
        })}
      </g>
    );
  };
}

/** Redraws the isolated (legend-hovered) series on top of the dimmed ones. */
export function makeActiveLineLayer(series: StandardSeries[], hovered: string | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function ActiveLineLayer(props: any) {
    if (!hovered || !props.xScale || !props.yScale) return null;
    const serie = series.find((s) => s.id === hovered);
    if (!serie) return null;
    const points = serie.data.filter((d) => d.y != null);
    if (points.length < 2) return null;
    const pathD = line<{ x: string; y: number | null }>()
      .x((d) => props.xScale(d.x))
      .y((d) => props.yScale(d.y))
      .curve(curveMonotoneX)(points) ?? "";
    return (
      <path
        d={pathD}
        fill="none"
        stroke={serie.color}
        strokeWidth={2.25}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ pointerEvents: "none" }}
      />
    );
  };
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

export interface TooltipRow {
  label: string;
  /** Series dot; omit for rows without a series (e.g. a total) */
  color?: string;
  /** Number → formatted with `decimals`; string → shown as is */
  value: number | string | null;
  unit?: string;
  /** Optional muted second line (e.g. control limits) */
  sub?: ReactNode;
  /** Bold row (e.g. the hovered segment) */
  strong?: boolean;
}

/** Tooltip palette — standard for every chart tooltip: translucent slate card, light text. */
export const TOOLTIP_COLORS = {
  bg: "rgba(42,61,74,0.82)",
  border: "rgba(255,255,255,0.08)",
  title: "#ffffff",
  label: "#cbd5e1",
  value: "#ffffff",
  muted: "#94a3b8",
  divider: "rgba(255,255,255,0.12)",
} as const;

/**
 * Standard chart tooltip (all Nivo charts): title · rows (dot · name · value · unit) · optional footer.
 * `subtitle` = small muted line under the title (e.g. a product code).
 */
export function LineTooltip({ title, subtitle, rows, decimals = 2, footer, nowrap = false }: {
  title: ReactNode;
  subtitle?: ReactNode;
  rows: TooltipRow[];
  decimals?: number;
  footer?: { label: string; value: string };
  /** Keep the title on one line too (long names) — the tooltip widens instead of wrapping */
  nowrap?: boolean;
}) {
  const c = TOOLTIP_COLORS;
  return (
    <div style={{
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 8,
      padding: "8px 10px",
      fontSize: 11.5,
      minWidth: 180,
      maxWidth: nowrap ? "none" : 300,
      boxShadow: "0 6px 20px -6px rgba(16,24,40,0.28)",
      fontFamily: "inherit",
      backdropFilter: "blur(4px)",
      animation: "chart-tooltip-in 0.15s ease-out",
    }}>
      <p style={{ fontWeight: 700, margin: subtitle ? "0 0 1px 0" : "0 0 6px 0", color: c.title, fontSize: 11, lineHeight: 1.35, whiteSpace: nowrap ? "nowrap" : undefined }}>{title}</p>
      {subtitle && <p style={{ margin: "0 0 6px 0", color: c.muted, fontSize: 9.5 }}>{subtitle}</p>}
      {rows.map(({ label, color, value, unit, sub, strong }) => (
        <div key={label} style={{ padding: "2px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
            {color && <span style={{ width: 6, height: 6, borderRadius: 999, background: color, flexShrink: 0 }} />}
            <span style={{ color: c.label, flex: 1, fontWeight: strong ? 700 : 400 }}>{label}</span>
            <span style={{ color: c.value, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {value == null ? "—" : typeof value === "number" ? value.toFixed(decimals) : value}
            </span>
            {unit && <span style={{ color: c.muted, fontSize: 10.5 }}>{unit}</span>}
          </div>
          {sub && (
            <p style={{
              color: c.muted, margin: "1px 0 0 14px", fontSize: 9.5, lineHeight: 1.3,
              whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
            }}>
              {sub}
            </p>
          )}
        </div>
      ))}
      {footer && (
        <div style={{ borderTop: `1px solid ${c.divider}`, marginTop: 5, paddingTop: 5, display: "flex", justifyContent: "space-between", gap: 12, color: c.label, whiteSpace: "nowrap" }}>
          <span>{footer.label}</span>
          <span style={{ color: c.value, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{footer.value}</span>
        </div>
      )}
    </div>
  );
}

/** All series values at x, for the tooltip. */
export function rowsAtX(series: StandardSeries[], x: string, unit?: string): TooltipRow[] {
  return series.flatMap((serie) =>
    serie.data
      .filter((d) => String(d.x) === x)
      .map((d) => ({ label: serie.id, color: serie.color, value: d.y, unit })),
  );
}

// ── Legend ───────────────────────────────────────────────────────────────────

export function LineLegend({
  series,
  hovered,
  onHover,
}: {
  series: StandardSeries[];
  hovered: string | null;
  onHover?: (id: string | null) => void;
  /** @deprecated kept for call-site compatibility; the minimal legend has no hint */
  showHint?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5">
      {series.map((s) => {
        const isHovered = hovered === s.id;
        const isDimmed = hovered !== null && !isHovered;
        const last = [...s.data].reverse().find((d) => d.y != null)?.y;
        return (
          <button
            key={s.id}
            className="flex items-center gap-1.5 transition-opacity duration-150 cursor-default"
            style={{ opacity: isDimmed ? 0.4 : 1 }}
            onMouseEnter={() => onHover?.(s.id)}
            onMouseLeave={() => onHover?.(null)}
            onFocus={() => onHover?.(s.id)}
            onBlur={() => onHover?.(null)}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-[9.5px] text-slate-500">{s.id}</span>
            {last != null && <span className="text-[9.5px] font-bold text-slate-800 tabular-nums">{last.toFixed(1)}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Card shell ───────────────────────────────────────────────────────────────

/** Standard card around a line chart — same shell as the Overview TrendChart. */
export function LineChartCard({
  label,
  unitBadge,
  loading = false,
  legend,
  height = 300,
  empty = false,
  emptyText = "No data available",
  children,
}: {
  /** Uppercase card label, e.g. "Lead Time Trend" */
  label: string;
  /** Pill on the right, e.g. "Lead Time · days" */
  unitBadge?: string;
  loading?: boolean;
  legend?: ReactNode;
  height?: number;
  empty?: boolean;
  emptyText?: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg p-3 border border-[#EBEBEB] hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200 flex flex-col min-w-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] font-bold text-slate-500 uppercase tracking-[0.08em] leading-none">{label}</span>
          {loading && (
            <span className="w-3 h-3 border border-[#215AA8] border-t-transparent rounded-full animate-spin inline-block" />
          )}
        </div>
        {unitBadge && (
          <span className="text-[11px] bg-[#D3DEEE] text-[#143665] px-2.5 py-0.5 rounded-full font-semibold tracking-tight">
            {unitBadge}
          </span>
        )}
      </div>
      <div style={{ height }}>
        {empty ? (
          <div className="h-full flex items-center justify-center text-[11px] text-gray-300">
            {loading ? "Loading…" : emptyText}
          </div>
        ) : children}
      </div>
      {legend && <div className="mt-1.5">{legend}</div>}
    </div>
  );
}

/** Tick values for a weekly point axis: every even ISO week, thinned further when dense (Overview rule). */
export function evenWeekTicks(labels: string[]): string[] {
  const even = labels.filter((l) => Number(l.replace(/^W/, "")) % 2 === 0);
  const step = even.length > 26 ? 2 : 1;
  return even.filter((_, i) => i % step === 0);
}

// ── SPC control limits (mean ± 3σ) ───────────────────────────────────────────

export interface Limits { mean: number; stdev: number; ucl: number; lcl: number }

/** mean ± 3σ (sample stdev, n-1), LCL floored at 0 — same rule as computeControlLimits in lib/chartConfig.ts */
export function limitsOf(values: number[]): Limits {
  const v = values.filter((n) => typeof n === "number" && !isNaN(n));
  if (v.length < 2) return { mean: 0, stdev: 0, ucl: 0, lcl: 0 };
  const mean  = v.reduce((s, n) => s + n, 0) / v.length;
  const stdev = Math.sqrt(v.reduce((s, n) => s + (n - mean) ** 2, 0) / (v.length - 1));
  return {
    mean:  Number(mean.toFixed(2)),
    stdev: Number(stdev.toFixed(2)),
    ucl:   Number((mean + 3 * stdev).toFixed(2)),
    lcl:   Number(Math.max(0, mean - 3 * stdev).toFixed(2)),
  };
}

/** Per-series limits, keyed by series id (tooltip sub-line). */
export function seriesLimits(series: StandardSeries[]): Record<string, Limits> {
  const out: Record<string, Limits> = {};
  for (const s of series) out[s.id] = limitsOf(s.data.map((d) => d.y as number));
  return out;
}

/** Hairline UCL / Mean / LCL markers for ResponsiveLine `markers` (minimal: muted, small labels). */
export function controlMarkers({ mean, ucl, lcl }: Pick<Limits, "mean" | "ucl" | "lcl">) {
  const text = { fontSize: 9.5, fontFamily: "inherit", fontWeight: 700 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m: any[] = [];
  if (ucl > 0) m.push({
    axis: "y", value: ucl,
    lineStyle: { stroke: "#f3b4ae", strokeDasharray: "2 3", strokeWidth: 1 },
    legend: `UCL ${ucl.toFixed(1)}`, legendPosition: "top-right",
    legendOffsetX: 0, legendOffsetY: 4,
    textStyle: { ...text, fill: "#e07a70" },
  });
  if (mean > 0) m.push({
    axis: "y", value: mean,
    lineStyle: { stroke: "#d0d5dd", strokeDasharray: "2 3", strokeWidth: 1 },
    legend: `Mean ${mean.toFixed(1)}`, legendPosition: "top-right",
    legendOffsetX: 0, legendOffsetY: 4,
    textStyle: { ...text, fill: "#98a2b3" },
  });
  if (lcl > 0) m.push({
    axis: "y", value: lcl,
    lineStyle: { stroke: "#f3b4ae", strokeDasharray: "2 3", strokeWidth: 1 },
    legend: `LCL ${lcl.toFixed(1)}`, legendPosition: "bottom-right",
    legendOffsetX: 0, legendOffsetY: 4,
    textStyle: { ...text, fill: "#e07a70" },
  });
  return m;
}

/** Tooltip sub-line: "Mean x · UCL y · LCL z" */
export function LimitsSub({ lim }: { lim: Limits }) {
  return (
    <>
      Mean {lim.mean.toFixed(2)} · UCL{" "}
      <span style={{ color: "#f5a39a" }}>{lim.ucl.toFixed(2)}</span> · LCL{" "}
      <span style={{ color: "#f5a39a" }}>{lim.lcl.toFixed(2)}</span>
    </>
  );
}
