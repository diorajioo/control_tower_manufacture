"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Lock } from "lucide-react";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/ui/StatusDot";
import { LeadTimePlantTable, type PlantBreakdown } from "@/components/dashboard/LeadTimePlantTable";
import { LeadTimeStageStdChart, type StageStdPoint } from "@/components/dashboard/LeadTimeStageStdChart";
import { LEAD_TIME_TARGET_DAYS } from "@/lib/leadTimeDefinition";
import { ResponsiveBar, type BarCustomLayerProps, type BarDatum } from "@nivo/bar";
import { stageLabel } from "@/lib/leadTimeStages";

// ── Types ─────────────────────────────────────────────────────────────────────

interface KPI {
  leadTime: {
    grossDays: number; nettDays: number;
    grossTrend: number | null; nettTrend: number | null;
    sparkline: number[];
    composition?: {
      vaDays: number; nnvaDays: number; unvaDays: number; wipDays: number;
      vaPrev: number; nnvaPrev: number; unvaPrev: number; wipPrev: number;
      vaTrend: number | null; nnvaTrend: number | null;
      unvaTrend: number | null; wipTrend: number | null;
      vaMonthly: number[]; nnvaMonthly: number[];
      unvaMonthly: number[]; wipMonthly: number[];
      vaWeekly: number[]; nnvaWeekly: number[];
      unvaWeekly: number[]; wipWeekly: number[];
    };
    groupProcess?: { activity: string; avgDays: number; pct: number; poCount: number }[];
    maxGrossDays?: number;
    avgPoStageDays?: number;
    poCount?: number;
    onTimeCount?: number;
    atRiskCount?: number;
    lateCount?: number;
  };
  output: { fgQty: number; fgPrev?: number; bulkQty: number; bulkPrev?: number; fgTrend: number | null; bulkTrend: number | null; sparkline: number[]; bulkSparkline: number[] };
  productivity: {
    e2e: number; e2ePrev?: number; e2eTrend?: number | null; sparkline: number[];
    stages?: Record<"mixing" | "filpac", { value: number; prev?: number; trend: number | null; sparkline: number[] }>;
  };
  oee: { value: number; quality: number; performance: number; trend: number | null; sparkline: number[] };
  yield: { bulkLossPct: number; packLossPct: number; bulkLossTrend: number | null; packLossTrend: number | null };
}

interface TacticalFilters {
  plant: string;
  startDate: string;
  endDate: string;
  period?: string;
}

interface TacticalViewProps {
  kpi: KPI | null;
  loading: boolean;
  plantLT: { plants: PlantBreakdown[]; targetDays: number } | null;
  stageStd: StageStdPoint[];
  stageLoading: boolean;
  ltBasis: "created" | "released";
  tacticalFilters: TacticalFilters;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "leadtime",     label: "Lead Time"   },
  { id: "productivity", label: "Productivity" },
  { id: "output",       label: "Output"       },
  { id: "oee",          label: "OEE"          },
  { id: "energy",       label: "Energy",   locked: true },
  { id: "yield",        label: "Yield"        },
] as const;
type TabId = typeof TABS[number]["id"];

// ── Tone system ───────────────────────────────────────────────────────────────

const TONE_TREND = {
  on:      { color: "#067647", label: "Up"           },
  risk:    { color: "#b45309", label: "Declining"    },
  off:     { color: "#d92d20", label: "Down"         },
  neutral: { color: "#667085", label: "No Data"      },
} as const;

const TONE_LT = {
  on:      { color: "#067647", label: "On Track"     },
  risk:    { color: "#b45309", label: "At Risk"      },
  off:     { color: "#d92d20", label: "Above Target" },
  neutral: { color: "#667085", label: "No Data"      },
} as const;

type ToneKey = keyof typeof TONE_TREND;

function ltToneKey(days: number, target = LEAD_TIME_TARGET_DAYS): ToneKey {
  if (!days) return "neutral";
  if (days <= target) return "on";
  if (days <= target * 1.15) return "risk";
  return "off";
}

function trendToneKey(trend: number | null, inverse = false): ToneKey {
  if (trend === null) return "neutral";
  const t = inverse ? -trend : trend;
  if (t > 0) return "on";
  if (t >= -5) return "risk";
  return "off";
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Spark({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const W = 60, H = 22;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`).join(" ");
  return (
    <svg width={W} height={H} className="shrink-0 opacity-60">
      <polyline fill="none" stroke="#1E4076" strokeWidth={1.5} strokeLinejoin="round" points={pts} />
    </svg>
  );
}

// ── Tactical KPI Card — compact, works in 4–5 column grids ───────────────────

interface TKpiCardProps {
  label: string;
  value: string | null;
  unit?: string;
  trend?: number | null;
  /** Lower is better: flips trend direction for tone + arrow color */
  inverse?: boolean;
  sparkline?: number[];
  /** Label shown below sparkline e.g. "weeks" or "months" */
  sparkUnit?: string;
  /** Pass grossDays to use lead-time target-based tone ("On Track"/"At Risk"/"Above Target") */
  ltDays?: number;
  /** Absolute delta vs prior period — shown instead of trend % when provided */
  deltaAbsValue?: number | null;
  /** Unit shown alongside deltaAbsValue e.g. "days", "pcs/mh" */
  deltaUnit?: string;
  /** Override the sub-label below the value row (default: "vs prior period" / "vs target") */
  subLabel?: string;
  footerLeft?: string;
  noData?: boolean;
  /** Stacked PO-count gauge: on-time / at-risk / late vs 13-day target. */
  gaugeCounts?: { onTime: number; atRisk: number; late: number } | null;
  gaugePoCount?: number;
  gaugePoStageLabel?: string;
}

function TKpiCard({
  label, value, unit, trend = null, inverse = false,
  sparkline, sparkUnit, ltDays, deltaAbsValue, deltaUnit, subLabel, footerLeft, noData = false,
  gaugeCounts, gaugePoCount, gaugePoStageLabel,
}: TKpiCardProps) {
  const resolvedKey: ToneKey =
    noData || value === null ? "neutral" :
    ltDays !== undefined ? ltToneKey(ltDays) :
    trendToneKey(trend, inverse);

  const toneDict = ltDays !== undefined ? TONE_LT : TONE_TREND;
  const tone = toneDict[resolvedKey];
  const statusLabel = noData || value === null
    ? "No Data"
    : trend === null && ltDays === undefined
      ? "No Prior Data"
      : tone.label;

  const isUp = trend != null && trend > 0;
  const trendGood = inverse ? !isUp : isUp;
  const hasSpark = !noData && sparkline != null && sparkline.length >= 2;

  return (
    <div style={{
      background: "white",
      border: "1px solid #EBEBEB",
      borderRadius: 8,
      display: "flex",
      flexDirection: "column",
      overflow: "visible",
      fontFamily: "Lato, sans-serif",
      height: "100%",
    }}>
      <div style={{ flex: 1, padding: "11px 13px 0", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
          {/* Left column */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{
              fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em",
              color: "#64748b", textTransform: "uppercase",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {label}
            </span>

            <div style={{ display: "flex", alignItems: "baseline", gap: 5, flexWrap: "wrap" }}>
              <span style={{
                fontSize: 30, fontWeight: 700, letterSpacing: "-0.015em",
                color: noData || value === null ? "#d0d5dd" : "#101828",
                fontVariantNumeric: "tabular-nums", lineHeight: 1,
              }}>
                {noData || value === null ? "—" : value}
              </span>
              {unit && <span style={{ fontSize: 12, color: "#98a2b3" }}>{unit}</span>}
              {!noData && ltDays !== undefined ? (() => {
                const d = ltDays - LEAD_TIME_TARGET_DAYS;
                const over = d > 0;
                return (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: over ? "#d92d20" : "#067647", fontVariantNumeric: "tabular-nums" }}>
                    {over ? "↗ +" : "↘ −"}{Math.abs(d).toFixed(2)} days
                  </span>
                );
              })() : !noData && deltaAbsValue != null ? (() => {
                const over = inverse ? deltaAbsValue < 0 : deltaAbsValue > 0;
                return (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: over ? "#067647" : "#d92d20", fontVariantNumeric: "tabular-nums" }}>
                    {deltaAbsValue > 0 ? "↗ +" : "↘ "}{deltaAbsValue > 0 ? deltaAbsValue.toFixed(2) : Math.abs(deltaAbsValue).toFixed(2)} {deltaUnit ?? ""}
                  </span>
                );
              })() : !noData && trend !== null && (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: trendGood ? "#067647" : "#d92d20", fontVariantNumeric: "tabular-nums" }}>
                  {isUp ? "↗" : "↘"} {(trend > 0 ? "+" : "") + trend.toFixed(1)}%
                </span>
              )}
            </div>

            <div style={{ fontSize: 11, color: "#98a2b3" }}>
              {subLabel ?? (ltDays !== undefined
                ? `vs ${LEAD_TIME_TARGET_DAYS}-day target`
                : deltaAbsValue != null || trend !== null ? "vs prior period" : "")}
            </div>

            <StatusDot color={tone.color} label={statusLabel} />
          </div>

          {/* Sparkline + period label */}
          {hasSpark && (
            <div style={{ paddingTop: 4, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
              <Spark data={sparkline!} />
              {sparkUnit && (
                <span style={{ fontSize: 10, color: "#a3a8b5" }}>
                  {sparkline!.length} {sparkUnit}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {gaugeCounts != null && !noData && (
        <div style={{ padding: "4px 13px 10px" }}>
          <LeadTimeGauge counts={gaugeCounts} />
          {(gaugePoCount != null || gaugePoStageLabel) && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
              {gaugePoCount != null && (
                <span style={{ fontSize: 10.5, color: "#667085", fontVariantNumeric: "tabular-nums" }}>
                  {gaugePoCount.toLocaleString()} PO completed in period
                </span>
              )}
              {gaugePoStageLabel && (
                <span style={{ fontSize: 10.5, color: "#667085", fontVariantNumeric: "tabular-nums" }}>
                  {gaugePoStageLabel}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {!(gaugeCounts != null && !noData) && (
        <div style={{ height: 10 }} />
      )}

      <div style={{
        borderTop: "1px solid #eceef2", padding: "6px 13px",
        fontSize: 11, color: "#667085",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {footerLeft ?? ""}
      </div>
    </div>
  );
}

// Stacked PO-count gauge: shows how many completed POs are on-time / at-risk / late vs 13-day target.
function LeadTimeGauge({ counts }: { counts: { onTime: number; atRisk: number; late: number } }) {
  const [hoveredKey, setHoveredKey] = useState<"onTime" | "atRisk" | "late" | null>(null);
  const total = counts.onTime + counts.atRisk + counts.late;
  if (total === 0) return null;

  const segments = [
    { key: "onTime" as const, color: "#067647", label: "On-time",  detail: `≤ ${LEAD_TIME_TARGET_DAYS}d`,                               count: counts.onTime  },
    { key: "atRisk" as const, color: "#f59e0b", label: "At risk",  detail: `${LEAD_TIME_TARGET_DAYS}–${(LEAD_TIME_TARGET_DAYS * 1.15).toFixed(1)}d`, count: counts.atRisk  },
    { key: "late"   as const, color: "#d92d20", label: "Late",     detail: `> ${(LEAD_TIME_TARGET_DAYS * 1.15).toFixed(1)}d`,            count: counts.late    },
  ];

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 5, position: "relative" }}
      onMouseLeave={() => setHoveredKey(null)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 9.5, color: "#98a2b3", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          PO count vs {LEAD_TIME_TARGET_DAYS}-day target
        </span>
        <InfoTooltip
          text={`Completed POs only (PO FG Done Date is set) within the selected period, categorised by actual gross lead time vs the ${LEAD_TIME_TARGET_DAYS}-day target — not the predictive risk score shown in the alerts bar.`}
          size={11}
          width={240}
        />
      </div>

      {/* Stacked bar */}
      <div style={{ height: 12, borderRadius: 6, overflow: "hidden", display: "flex", cursor: "default" }}>
        {segments.map(seg => {
          const pct = (seg.count / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={seg.key}
              style={{ height: "100%", width: `${pct}%`, background: seg.color, transition: "opacity 0.12s", opacity: hoveredKey && hoveredKey !== seg.key ? 0.35 : 1 }}
              onMouseEnter={() => setHoveredKey(seg.key)}
            />
          );
        })}
      </div>

      {/* Floating tooltip */}
      {hoveredKey && (() => {
        const seg = segments.find(s => s.key === hoveredKey)!;
        const pct = (seg.count / total) * 100;
        return (
          <div style={{
            position: "absolute", top: 32, left: 0, right: 0, zIndex: 30,
            background: "#1e293b", color: "white",
            borderRadius: 5, padding: "4px 8px",
            fontSize: 10.5, lineHeight: 1.35,
            fontVariantNumeric: "tabular-nums",
            display: "flex", alignItems: "center", gap: 5,
            pointerEvents: "none",
          }}>
            <span style={{ color: seg.color, fontSize: 9 }}>●</span>
            <span style={{ fontWeight: 700 }}>{seg.label}</span>
            <span style={{ color: "#94a3b8", fontSize: 10 }}>{seg.detail}</span>
            <span style={{ marginLeft: "auto", fontWeight: 700 }}>
              {seg.count.toLocaleString()} PO · {pct.toFixed(1)}%
            </span>
          </div>
        );
      })()}

      {/* Legend — PO count */}
      <div style={{ display: "flex", gap: 8, fontSize: 10.5, flexWrap: "wrap" }}>
        {segments.map(seg => (
          <span key={seg.key} style={{ display: "flex", alignItems: "center", gap: 3, transition: "opacity 0.12s", opacity: hoveredKey && hoveredKey !== seg.key ? 0.35 : 1 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#101828" }}>{seg.count.toLocaleString()}</span>
            <span style={{ color: "#667085" }}>{seg.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Donut chart (SVG, no @nivo/pie) ───────────────────────────────────────────

interface DonutSegment { color: string; value: number; label: string; sub?: string }

function DonutChart({ segments, size = 120 }: { segments: DonutSegment[]; size?: number }) {
  const r = 42;
  const cx = 50, cy = 50;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
  if (total <= 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef0f3" strokeWidth={14} />
      </svg>
    );
  }
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef0f3" strokeWidth={14} />
      {segments.map((seg, i) => {
        const frac = Math.max(0, seg.value) / total;
        const dash = frac * circ;
        const el = (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none" stroke={seg.color} strokeWidth={14}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset}
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

function DonutCard({
  title, segments, footer, loading,
}: { title: string; segments: DonutSegment[]; footer?: string; loading?: boolean }) {
  const total = segments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
  return (
    <div style={{
      background: "white", border: "1px solid #EBEBEB", borderRadius: 8,
      padding: "11px 13px", display: "flex", flexDirection: "column",
      height: "100%", fontFamily: "Lato, sans-serif",
    }}>
      <span style={{
        fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em",
        color: "#64748b", textTransform: "uppercase",
      }}>
        {title}
      </span>
      {loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 120, height: 120, borderRadius: "50%", background: "#f3f4f6" }} />
        </div>
      ) : total <= 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#98a2b3", fontSize: 11 }}>
          No data
        </div>
      ) : (
        <div style={{ marginTop: 8, display: "flex", gap: 14, alignItems: "center", flex: 1 }}>
          <div style={{ flexShrink: 0 }}>
            <DonutChart segments={segments} size={120} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
            {segments.map((seg, i) => {
              const pct = (Math.max(0, seg.value) / total * 100);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
                  <span style={{ color: "#334155", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {seg.label}
                  </span>
                  <span style={{ color: "#101828", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    {seg.value.toFixed(2)}d
                  </span>
                  <span style={{ color: "#98a2b3", fontVariantNumeric: "tabular-nums", width: 40, textAlign: "right" }}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {footer && (
        <div style={{
          borderTop: "1px solid #eceef2", marginTop: 10, paddingTop: 6,
          fontSize: 11, color: "#667085",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {footer}
        </div>
      )}
    </div>
  );
}

// ── Histogram with normal curve + control lines ────────────────────────────────

interface DistResponse {
  bins: { binStart: number; count: number }[];
  mean: number;
  median: number;
  stddev: number;
  total: number;
}

function binLabel(start: number) {
  if (start >= 38) return "> 38";
  return `${start}-${start + 2}`;
}

interface HistoRow extends BarDatum {
  bin: string;
  binStart: number;
  count: number;
}

function LeadTimeHistogram({ filters }: { filters: TacticalFilters }) {
  const [data, setData] = useState<DistResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("plant", filters.plant);
    params.set("startDate", filters.startDate);
    params.set("endDate", filters.endDate);
    if (filters.period) params.set("period", filters.period);
    setLoading(true);
    fetch(`/api/lead-time/distribution?${params.toString()}`)
      .then((r) => r.json())
      .then((d: DistResponse) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [filters.plant, filters.startDate, filters.endDate, filters.period]);

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
      return { bin: binLabel(b.binStart), binStart: b.binStart, count: b.count };
    });
    let maxB = sorted[0]?.binStart ?? 0;
    let maxC = 0;
    for (const b of sorted) {
      if (b.count > maxC) { maxC = b.count; maxB = b.binStart; }
    }
    return { rows: rr, cumByBin: cumMap, maxBin: maxB, maxBinCount: maxC };
  }, [data]);

  const mean = data?.mean ?? 0;
  const stddev = data?.stddev ?? 0;
  const median = data?.median ?? 0;
  const total = data?.total ?? 0;

  // KDE/normal curve + vertical mean/±1σ lines + shaded ±1σ band
  const Overlay = ({ bars, xScale, yScale, innerWidth, innerHeight }: BarCustomLayerProps<HistoRow>) => {
    if (!data || stddev <= 0 || bars.length === 0) return null;
    const firstBar = bars[0];
    const barW = firstBar.width;
    const xForDays = (d: number) => {
      // Each bin covers 2 days, bar center = binStart + 1 day; interpolate across bars.
      // Use first bar as origin, each subsequent bar is +barW to the right in bandwidth terms.
      const firstStart = (firstBar.data.data as HistoRow).binStart;
      const unitsFromFirst = (d - (firstStart + 1)) / 2;
      return firstBar.x + barW / 2 + unitsFromFirst * barW;
    };
    const clampX = (x: number) => Math.max(0, Math.min(innerWidth, x));
    const totalRows = total || rows.reduce((s, r) => s + r.count, 0);
    const binWidthDays = 2;
    const scale = totalRows * binWidthDays;
    const yForDensity = (density: number) => {
      // expected count at this point ≈ density * scale
      const expected = density * scale;
      return (yScale as (v: number) => number)(expected);
    };
    const pdf = (x: number) => {
      const z = (x - mean) / stddev;
      return Math.exp(-0.5 * z * z) / (stddev * Math.sqrt(2 * Math.PI));
    };
    // Build path across the full x range
    const firstStart = (firstBar.data.data as HistoRow).binStart;
    const lastStart = (bars[bars.length - 1].data.data as HistoRow).binStart;
    const xStartDays = firstStart;
    const xEndDays = lastStart + 2;
    const stepsPx = 2;
    const pts: string[] = [];
    for (let x = 0; x <= innerWidth; x += stepsPx) {
      const daysPerPx = (xEndDays - xStartDays) / Math.max(1, innerWidth);
      const d = xStartDays + x * daysPerPx;
      const y = yForDensity(pdf(d));
      pts.push(`${x},${y}`);
    }
    const curvePath = `M ${pts.join(" L ")}`;
    const xMean = clampX(xForDays(mean));
    const xLow = clampX(xForDays(mean - stddev));
    const xHigh = clampX(xForDays(mean + stddev));
    return (
      <g style={{ pointerEvents: "none" }}>
        <rect x={xLow} y={0} width={Math.max(0, xHigh - xLow)} height={innerHeight} fill="#fecaca" opacity={0.22} />
        <line x1={xLow}  x2={xLow}  y1={0} y2={innerHeight} stroke="#d92d20" strokeWidth={1} strokeDasharray="4 3" />
        <line x1={xHigh} x2={xHigh} y1={0} y2={innerHeight} stroke="#d92d20" strokeWidth={1} strokeDasharray="4 3" />
        <line x1={xMean} x2={xMean} y1={0} y2={innerHeight} stroke="#d92d20" strokeWidth={1.5} />
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
            text="Only POs completed within the selected period (PO FG Done Date is not null)."
            size={13}
            width={240}
          />
        </div>
        <a href="/lead-time" className="text-[11px] text-[#1E4076] font-semibold hover:underline shrink-0">
          Open detail →
        </a>
      </div>

      {loading ? (
        <div className="h-[280px] bg-gray-50 rounded animate-pulse" />
      ) : rows.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center text-[11px] text-gray-400">No data for selected period</div>
      ) : (
        <div className="grid grid-cols-[1fr_180px] gap-4">
          <div style={{ height: 280 }}>
            <ResponsiveBar<HistoRow>
              data={rows}
              keys={["count"]}
              indexBy="bin"
              margin={{ top: 16, right: 12, bottom: 40, left: 44 }}
              padding={0.12}
              colors={() => "rgba(30,64,118,0.72)"}
              enableLabel={false}
              borderRadius={2}
              axisLeft={{
                tickSize: 0, tickPadding: 6,
                legend: "PO count", legendPosition: "middle", legendOffset: -36,
                format: (v) => String(v),
              }}
              axisBottom={{
                tickSize: 0, tickPadding: 6,
                legend: "End-to-end gross lead time (days)", legendPosition: "middle", legendOffset: 32,
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
                return (
                  <div style={{
                    background: "rgba(15,23,42,0.95)", color: "white",
                    padding: "6px 9px", borderRadius: 6, fontSize: 11,
                    fontFamily: "Lato, sans-serif", lineHeight: 1.45,
                  }}>
                    <div style={{ fontWeight: 700 }}>{d.binStart >= 38 ? "> 38 days" : `${d.binStart}-${d.binStart + 2} days`}</div>
                    <div style={{ fontVariantNumeric: "tabular-nums" }}>{d.count} PO ({pct.toFixed(1)}%)</div>
                    <div style={{ fontVariantNumeric: "tabular-nums", opacity: 0.8 }}>Cumulative: {cum.toFixed(1)}%</div>
                  </div>
                );
              }}
              animate={false}
            />
          </div>
          <div className="flex flex-col gap-2 border-l border-[#EBEBEB] pl-4 text-[11px]">
            <StatRow label="PO count" value={total.toLocaleString()} />
            <StatRow label="Mean (x̄)" value={`${mean.toFixed(2)}d`} />
            <StatRow label="Median" value={`${median.toFixed(2)}d`} />
            <StatRow label="Std dev (σ)" value={`${stddev.toFixed(2)}d`} />
            <div className="border-t border-[#EBEBEB] my-1" />
            <StatRow label="Peak bin" value={binLabel(maxBin)} />
            <StatRow label="PO in peak" value={maxBinCount.toLocaleString()} />
            <div className="border-t border-[#EBEBEB] my-1" />
            <div className="flex items-center gap-2 text-[10.5px] text-slate-500">
              <span style={{ width: 10, height: 2, background: "#d92d20" }} /> Mean
            </div>
            <div className="flex items-center gap-2 text-[10.5px] text-slate-500">
              <span style={{ width: 10, height: 0, borderTop: "1px dashed #d92d20" }} /> Mean ±1σ
            </div>
            <div className="flex items-center gap-2 text-[10.5px] text-slate-500">
              <span style={{ width: 10, height: 2, background: "#1E4076" }} /> Normal curve
            </div>
          </div>
        </div>
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

// ── Shared chart/section primitives ───────────────────────────────────────────

function ChartPlaceholder({ title, subtitle, height = 220 }: { title: string; subtitle?: string; height?: number }) {
  return (
    <div className="rounded-lg border border-[#EBEBEB] bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-0.5">{title}</p>
      {subtitle && <p className="text-[10px] text-gray-400 mb-3">{subtitle}</p>}
      <div className="rounded-lg bg-gray-50 flex items-center justify-center" style={{ height }}>
        <p className="text-[11px] text-gray-300 font-medium">Coming soon</p>
      </div>
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return <h2 className="text-[17px] font-bold text-gray-800">{title}</h2>;
}

function SkeletonCard() {
  return <div className="rounded-lg border border-[#EBEBEB] bg-white p-4 h-[140px] animate-pulse bg-gray-50" />;
}

// ── Sections ──────────────────────────────────────────────────────────────────

function momDelta(monthly: number[] | undefined): { abs: number | null; trend: number | null } {
  if (!monthly || monthly.length < 2) return { abs: null, trend: null };
  const cur = monthly[monthly.length - 1];
  const prev = monthly[monthly.length - 2];
  const abs = Number((cur - prev).toFixed(2));
  const trend = prev !== 0 ? Number(((cur - prev) / prev * 100).toFixed(1)) : null;
  return { abs, trend };
}

// Fixed palette for the Group Process donut. Largest = Paragon Blue, remaining = varied hues.
const GROUP_PROCESS_PALETTE = [
  "#1E4076", "#4A6BA3", "#7A94C4", "#2d9a66", "#b45309",
  "#8b5cf6", "#ec4899", "#64748b",
];

function LeadTimeSection({ kpi, loading, plantLT, stageStd, stageLoading, ltBasis, tacticalFilters }: TacticalViewProps) {
  const c = kpi?.leadTime.composition;
  const gross = kpi?.leadTime.grossDays;
  const maxGross = kpi?.leadTime.maxGrossDays ?? 0;
  const poCount = kpi?.leadTime.poCount ?? 0;
  const avgPoStage = kpi?.leadTime.avgPoStageDays ?? 0;
  const poStagePct = gross && gross > 0 ? (avgPoStage / gross) * 100 : 0;
  const groupProcess = kpi?.leadTime.groupProcess ?? [];

  const vanaSegments: DonutSegment[] = c ? [
    { color: "#067647", label: "VA",   value: c.vaDays },
    { color: "#f59e0b", label: "NNVA", value: c.nnvaDays },
    { color: "#d92d20", label: "UNVA", value: c.unvaDays },
  ] : [];
  const vanaTotal = vanaSegments.reduce((s, seg) => s + seg.value, 0);
  const vaPct = vanaTotal > 0 && c ? (c.vaDays   / vanaTotal) * 100 : 0;
  const nnPct = vanaTotal > 0 && c ? (c.nnvaDays / vanaTotal) * 100 : 0;
  const unPct = vanaTotal > 0 && c ? (c.unvaDays / vanaTotal) * 100 : 0;

  const groupTop = useMemo(() => {
    const items = [...groupProcess].sort((a, b) => b.avgDays - a.avgDays);
    const head = items.slice(0, 7);
    const tail = items.slice(7);
    if (tail.length === 0) return head;
    const otherDays = tail.reduce((s, r) => s + r.avgDays, 0);
    return [...head, { activity: "Other", avgDays: otherDays, pct: 0, poCount: 0 }];
  }, [groupProcess]);
  const groupSegments: DonutSegment[] = groupTop.map((g, i) => ({
    color: GROUP_PROCESS_PALETTE[i] ?? "#98a2b3",
    label: g.activity === "Other" ? "Other" : stageLabel(g.activity),
    value: g.avgDays,
  }));
  const groupTotal = groupSegments.reduce((s, seg) => s + seg.value, 0);
  const groupLargest = groupSegments[0];
  const groupLargestPct = groupLargest && groupTotal > 0 ? (groupLargest.value / groupTotal) * 100 : 0;

  const nnvaFooter = c
    ? `Largest NNVA: ${nnPct.toFixed(0)}%; UNVA ${unPct.toFixed(0)}%, VA ${vaPct.toFixed(0)}%`
    : "";
  const groupFooter = groupLargest
    ? `${groupLargest.label} largest: ${groupLargest.value.toFixed(2)} days (${groupLargestPct.toFixed(0)}%)`
    : "";

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading title="Lead Time" />

      <div className="grid grid-cols-3 gap-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <TKpiCard
              label="Lead Time"
              value={kpi ? kpi.leadTime.grossDays.toFixed(2) : null}
              unit="days"
              trend={kpi?.leadTime.grossTrend ?? null}
              inverse
              sparkline={kpi?.leadTime.sparkline}
              sparkUnit="weeks"
              ltDays={kpi?.leadTime.grossDays}
              footerLeft="End-to-end gross"
              noData={!kpi}
              gaugeCounts={kpi && poCount > 0 ? { onTime: kpi.leadTime.onTimeCount ?? 0, atRisk: kpi.leadTime.atRiskCount ?? 0, late: kpi.leadTime.lateCount ?? 0 } : null}
              gaugePoCount={poCount}
              gaugePoStageLabel={avgPoStage > 0
                ? `PO & approval ${avgPoStage.toFixed(2)} days · ${poStagePct.toFixed(0)}% of gross`
                : undefined}
            />
            <DonutCard
              title="VA · NNVA · UNVA"
              segments={vanaSegments}
              footer={nnvaFooter}
              loading={!kpi}
            />
            <DonutCard
              title="Group Process"
              segments={groupSegments}
              footer={groupFooter}
              loading={!kpi}
            />
          </>
        )}
      </div>

      <LeadTimeHistogram filters={tacticalFilters} />

      <div className="rounded-lg border border-[#EBEBEB] bg-white p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-3">Pareto Lead Time</p>
        <LeadTimeStageStdChart data={stageStd} loading={stageLoading} />
      </div>

      <div className="rounded-lg border border-[#EBEBEB] bg-white overflow-hidden">
        <div className="px-4 pt-3 pb-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Lead Time by Plant</p>
        </div>
        <LeadTimePlantTable
          data={plantLT?.plants ?? null}
          targetDays={plantLT?.targetDays ?? 13}
          loading={stageLoading}
          basis={ltBasis}
        />
      </div>
    </div>
  );
}

function ProductivitySection({ kpi, loading }: Pick<TacticalViewProps, "kpi" | "loading">) {
  const mixing = kpi?.productivity.stages?.mixing;
  const filpac = kpi?.productivity.stages?.filpac;
  return (
    <div className="flex flex-col gap-4">
      <SectionHeading title="Productivity" />

      <div className="grid grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <TKpiCard
              label="Productivity Mixing"
              value={mixing ? mixing.value.toFixed(2) : null}
              unit="kg/manhour"
              trend={mixing?.trend ?? null}
              deltaAbsValue={mixing?.prev != null ? mixing.value - mixing.prev : null}
              deltaUnit="kg/mh"
              sparkline={mixing?.sparkline}
              sparkUnit="weeks"
              footerLeft="Mixing stage"
              noData={!kpi || !mixing}
            />
            <TKpiCard
              label="Productivity Filpac"
              value={filpac ? filpac.value.toFixed(2) : null}
              unit="pcs/manhour"
              trend={filpac?.trend ?? null}
              deltaAbsValue={filpac?.prev != null ? filpac.value - filpac.prev : null}
              deltaUnit="pcs/mh"
              sparkline={filpac?.sparkline}
              sparkUnit="weeks"
              footerLeft="Filling & packing"
              noData={!kpi || !filpac}
            />
            <TKpiCard
              label="Productivity E2E"
              value={kpi ? kpi.productivity.e2e.toFixed(2) : null}
              unit="pcs/manhour"
              trend={kpi?.productivity.e2eTrend ?? null}
              deltaAbsValue={kpi?.productivity.e2ePrev != null ? kpi.productivity.e2e - kpi.productivity.e2ePrev : null}
              deltaUnit="pcs/mh"
              sparkline={kpi?.productivity.sparkline}
              sparkUnit="weeks"
              footerLeft="End-to-end"
              noData={!kpi}
            />
            <TKpiCard
              label="Normal Working Hours"
              value={null}
              unit="hours"
              footerLeft="Basis manhour not yet decided"
              noData
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ChartPlaceholder title="Volume Kemas" subtitle="Qty kemas per month, million pcs" />
        <ChartPlaceholder title="Productivity Kemas" subtitle="Pcs per manhour, per month" />
      </div>
      <ChartPlaceholder title="E2E & Normal Working Hour Trend" subtitle="Pcs/manhour per month" height={180} />
    </div>
  );
}

function OutputSection({ kpi, loading }: Pick<TacticalViewProps, "kpi" | "loading">) {
  return (
    <div className="flex flex-col gap-4">
      <SectionHeading title="Output" />

      <div className="grid grid-cols-2 gap-3">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <TKpiCard
              label="FG Output"
              value={kpi ? (kpi.output.fgQty / 1_000_000).toFixed(2) : null}
              unit="million pcs"
              trend={kpi?.output.fgTrend ?? null}
              deltaAbsValue={kpi?.output.fgPrev != null ? (kpi.output.fgQty - kpi.output.fgPrev) / 1_000_000 : null}
              deltaUnit="M pcs"
              sparkline={kpi?.output.sparkline}
              sparkUnit="weeks"
              footerLeft="Finished goods"
              noData={!kpi}
            />
            <TKpiCard
              label="Bulk Output"
              value={kpi ? (kpi.output.bulkQty / 1_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null}
              unit="thousand kg"
              trend={kpi?.output.bulkTrend ?? null}
              deltaAbsValue={kpi?.output.bulkPrev != null ? (kpi.output.bulkQty - kpi.output.bulkPrev) / 1_000 : null}
              deltaUnit="K kg"
              sparkline={kpi?.output.bulkSparkline}
              sparkUnit="weeks"
              footerLeft="Bulk production"
              noData={!kpi}
            />
          </>
        )}
      </div>

      <ChartPlaceholder title="Pareto Output" subtitle="Contribution per plant vs target, sorted descending" />
      <ChartPlaceholder title="Output Trend (Actual vs Plan)" subtitle="Finished goods, million pcs per month" />
      <ChartPlaceholder title="Top SKU by Output" subtitle="Actual qty vs plan qty, gap %" height={240} />
    </div>
  );
}

function OEESection() {
  return (
    <div className="flex flex-col gap-4">
      <SectionHeading title="OEE" />
      <div className="grid grid-cols-2 gap-4">
        <ChartPlaceholder title="OEE Composition (Availability · Performance · Quality)" height={260} />
        <ChartPlaceholder title="OEE Trend" subtitle="%, monthly" height={260} />
      </div>
    </div>
  );
}

function YieldSection() {
  return (
    <div className="flex flex-col gap-4">
      <SectionHeading title="Yield" />
      <div className="grid grid-cols-2 gap-3">
        <ChartPlaceholder title="Bulk Loss" height={120} />
        <ChartPlaceholder title="Pack Loss" height={120} />
      </div>
      <ChartPlaceholder title="Loss Trend" subtitle="Bulk loss %, per month" height={180} />
    </div>
  );
}

// ── Main TacticalView ─────────────────────────────────────────────────────────

export function TacticalView(props: TacticalViewProps) {
  const { kpi, loading, plantLT, stageStd, stageLoading, ltBasis } = props;
  const [activeTab, setActiveTab] = useState<TabId>("leadtime");

  const sectionRefs = useRef<Record<TabId, HTMLElement | null>>({
    leadtime: null, productivity: null, output: null,
    oee: null, energy: null, yield: null,
  });

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const entries = new Map<TabId, boolean>();

    TABS.forEach(({ id }) => {
      const el = sectionRefs.current[id];
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          entries.set(id, entry.isIntersecting);
          const first = TABS.find(({ id: tid }) => entries.get(tid));
          if (first) setActiveTab(first.id);
        },
        { threshold: 0.15, rootMargin: "-64px 0px 0px 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const scrollTo = useCallback((id: TabId) => {
    const el = sectionRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveTab(id);
  }, []);

  const setRef = useCallback((id: TabId) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ── Sticky tab bar ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center px-5 overflow-x-auto">
          {TABS.map((tab) => { const locked = "locked" in tab && tab.locked; return (
            <button
              key={tab.id}
              onClick={() => { if (!locked) scrollTo(tab.id); }}
              disabled={!!locked}
              className={cn(
                "relative flex items-center gap-1.5 px-4 py-3 text-[12px] font-semibold whitespace-nowrap transition-colors shrink-0",
                locked
                  ? "text-gray-300 cursor-not-allowed"
                  : activeTab === tab.id
                    ? "text-[#1E4076]"
                    : "text-gray-500 hover:text-gray-700"
              )}
            >
              {locked && <Lock size={9} strokeWidth={2} />}
              {tab.label}
              {locked && (
                <span className="text-[9px] font-bold bg-gray-100 text-gray-300 px-1 py-0.5 rounded uppercase tracking-wide">
                  Soon
                </span>
              )}
              {!locked && activeTab === tab.id && (
                <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-[#1E4076] rounded-t" />
              )}
            </button>
          );})}
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-8 px-5 py-5">
          <section ref={setRef("leadtime")}>
            <LeadTimeSection {...props} />
          </section>
          <section ref={setRef("productivity")}>
            <ProductivitySection kpi={kpi} loading={loading} />
          </section>
          <section ref={setRef("output")}>
            <OutputSection kpi={kpi} loading={loading} />
          </section>
          <section ref={setRef("oee")}>
            <OEESection />
          </section>
          <section ref={setRef("energy")}>
            <div className="flex flex-col gap-4">
              <SectionHeading title="Energy" />
              <div className="rounded-lg border border-[#EBEBEB] bg-gray-50 p-8 flex items-center justify-center">
                <p className="text-[12px] text-gray-300 font-semibold">Energy data coming soon</p>
              </div>
            </div>
          </section>
          <section ref={setRef("yield")}>
            <YieldSection />
          </section>
        </div>
      </div>
    </div>
  );
}
