"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { ChevronDown, Check } from "lucide-react";
import { Fade } from "@/components/ui/Fade";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/ui/StatusDot";
import { LeadTimePlantTable, type PlantBreakdown, type PlantActivity } from "@/components/dashboard/LeadTimePlantTable";
import type { StageStdPoint } from "@/components/dashboard/LeadTimeStageStdChart";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { LINE_THEME, LineTooltip, TOOLTIP_COLORS } from "@/components/charts/StandardLine";
import { PLANT_COLORS, SERIES_COLORS } from "@/lib/chartConfig";
import { LEAD_TIME_TARGET_DAYS } from "@/lib/leadTimeDefinition";
import { LeadTimeGaugeBar } from "@/components/ui/LeadTimeGaugeBar";
import { ResponsiveBar, type BarCustomLayerProps, type BarDatum } from "@nivo/bar";
import { STAGE_ORDER, stageLabel, PROCESS_GROUPS } from "@/lib/leadTimeStages";
import { useT } from "@/lib/i18n";
import { dimsKey, dimsToParams, type LtDims } from "@/lib/leadTimeFilters";
import { FIELD, FIELD_ON, MENU, MENU_ITEM, MENU_ITEM_ON, MENU_ITEM_OFF } from "@/components/ui/FilterField";
import { LeadTimeHistogram } from "@/components/leadtime/LeadTimeHistogram";

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
  output: {
    fgQty: number; fgPrev?: number; bulkQty: number; bulkPrev?: number;
    fgTrend: number | null; bulkTrend: number | null;
    sparkline: number[]; bulkSparkline: number[];
    skuCount?: number; poCount?: number;
    byForm?: { form: string; qty: number }[];
    plantDrivers?: { plant: string; fg: number; fgPrev?: number | null }[];
  };
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
  /** Lead Time page filters (lib/leadTimeFilters.ts) — the Lead Time page reuses TacticalParetoChart */
  lt?: LtDims;
}

interface TacticalViewProps {
  kpi: KPI | null;
  loading: boolean;
  plantLT: { plants: PlantBreakdown[]; targetDays: number; activities: PlantActivity[] } | null;
  stageStd: StageStdPoint[];
  stageLoading: boolean;
  ltBasis: "created" | "released";
  onLtBasisChange: (b: "created" | "released") => void;
  tacticalFilters: TacticalFilters;
}

// Lead Time section toggles (next to the section title): unit and gross / nett.
type LtUnit = "days" | "hours";
type LtMeasure = "gross" | "nett";
const ltFactor = (u: LtUnit) => (u === "hours" ? 24 : 1);
/** Value in the chosen unit: days with 2 decimals, hours with 1. */
const fmtLt = (days: number, u: LtUnit) => (days * ltFactor(u)).toFixed(u === "hours" ? 1 : 2);

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "leadtime",     label: "Lead Time"   },
  { id: "output",       label: "Output"       },
  { id: "productivity", label: "Productivity" },
  { id: "yield",        label: "Yield"        },
  { id: "oee",          label: "OEE"          },
  { id: "energy",       label: "Energy",   locked: true },
] as const;
type TabId = typeof TABS[number]["id"];

// ── Tone system ───────────────────────────────────────────────────────────────

const TONE_TREND = {
  on:      { color: "#067647", label: "On Track"     },
  risk:    { color: "#b45309", label: "At Risk"      },
  off:     { color: "#d92d20", label: "Off Track"    },
  neutral: { color: "#667085", label: "No Data"      },
} as const;

const TONE_LT = {
  on:      { color: "#067647", label: "On Track"     },
  risk:    { color: "#b45309", label: "At Risk"      },
  off:     { color: "#d92d20", label: "Off Track"    },
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
  /** Pass grossDays to use lead-time target-based tone ("On Track"/"At Risk"/"Off Track") */
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
  /** Unit of the target delta / sub-label when ltDays is set */
  ltUnit?: LtUnit;
}

function TKpiCard({
  label, value, unit, trend = null, inverse = false,
  sparkline, sparkUnit, ltDays, deltaAbsValue, deltaUnit, subLabel, footerLeft, noData = false,
  gaugeCounts, gaugePoCount, gaugePoStageLabel, ltUnit = "days",
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
                    {over ? "↗ +" : "↘ −"}{fmtLt(Math.abs(d), ltUnit)} {ltUnit}
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
                ? `vs ${LEAD_TIME_TARGET_DAYS * ltFactor(ltUnit)}-${ltUnit === "hours" ? "hour" : "day"} target`
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
          <LeadTimeGaugeBar counts={gaugeCounts} />
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
// ── Donut chart (SVG, no @nivo/pie) ───────────────────────────────────────────

interface DonutSegment { color: string; value: number; label: string; sub?: string }

function PieChart({ segments, size = 120, unit = "days", fmt }: {
  segments: DonutSegment[]; size?: number;
  unit?: string;
  fmt?: (v: number) => string;
}) {
  const cx = 50, cy = 50, r = 46;
  const total = segments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);

  if (total <= 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx={cx} cy={cy} r={r} fill="#eef0f3" />
      </svg>
    );
  }

  const slices: React.ReactNode[] = [];
  let startAngle = -Math.PI / 2;
  segments.forEach((seg, i) => {
    const frac = Math.max(0, seg.value) / total;
    const sweep = frac * 2 * Math.PI;
    const endAngle = startAngle + sweep;
    const midAngle = startAngle + sweep / 2;
    const hovered = hoveredIdx === i;
    // Hovered slice pops out slightly along its midpoint direction
    const ox = hovered ? Math.cos(midAngle) * 4 : 0;
    const oy = hovered ? Math.sin(midAngle) * 4 : 0;
    const rx = cx + ox, ry = cy + oy;
    const x1 = rx + r * Math.cos(startAngle);
    const y1 = ry + r * Math.sin(startAngle);
    const x2 = rx + r * Math.cos(endAngle);
    const y2 = ry + r * Math.sin(endAngle);
    const large = sweep > Math.PI ? 1 : 0;
    const d = `M ${rx} ${ry} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    slices.push(
      <path
        key={i}
        d={d}
        fill={seg.color}
        stroke="white"
        strokeWidth={1.2}
        style={{ cursor: "pointer", transition: "d 0.12s ease" }}
        onMouseEnter={(e) => { setHoveredIdx(i); setTooltip({ x: e.clientX, y: e.clientY }); }}
        onMouseMove={(e) => setTooltip({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => { setHoveredIdx(null); setTooltip(null); }}
      />
    );
    startAngle = endAngle;
  });

  const hovSeg = hoveredIdx !== null ? segments[hoveredIdx] : null;
  const hovPct = hovSeg ? (Math.max(0, hovSeg.value) / total * 100) : 0;

  return (
    <>
      <svg width={size} height={size} viewBox="0 0 100 100">{slices}</svg>
      {tooltip && hovSeg && (
        <div style={{
          position: "fixed",
          left: tooltip.x + 12,
          top: tooltip.y - 8,
          zIndex: 9999,
          background: TOOLTIP_COLORS.bg,
          border: `1px solid ${TOOLTIP_COLORS.border}`,
          backdropFilter: "blur(4px)",
          borderRadius: 8,
          padding: "8px 10px",
          pointerEvents: "none",
          minWidth: 140,
          boxShadow: "0 6px 20px -6px rgba(16,24,40,0.28)",
          fontFamily: "Lato, sans-serif",
          animation: "chart-tooltip-in 0.15s ease-out",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: hovSeg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: TOOLTIP_COLORS.title, flex: 1 }}>
              {hovSeg.label}{hovSeg.sub ? <span style={{ fontWeight: 400, color: TOOLTIP_COLORS.muted, fontSize: 10.5 }}> · {hovSeg.sub}</span> : null}
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: TOOLTIP_COLORS.value, fontVariantNumeric: "tabular-nums" }}>
              {fmt ? fmt(hovSeg.value) : hovSeg.value.toFixed(2)}
            </span>
            {unit && <span style={{ fontSize: 10.5, color: TOOLTIP_COLORS.muted }}>{unit}</span>}
          </div>
          <p style={{ margin: "2px 0 0 14px", fontSize: 9.5, color: TOOLTIP_COLORS.muted, fontVariantNumeric: "tabular-nums" }}>
            {hovPct.toFixed(1)}% of total
          </p>
        </div>
      )}
    </>
  );
}

function DonutCard({
  title, segments, footer, loading, unitSuffix = "d",
}: { title: string; segments: DonutSegment[]; footer?: string; loading?: boolean; unitSuffix?: string }) {
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
            <PieChart segments={segments} size={120} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
            {segments.map((seg, i) => {
              const pct = (Math.max(0, seg.value) / total * 100);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                    <span style={{ color: "#334155", fontWeight: 700, display: "block" }}>{seg.label}</span>
                    {seg.sub && <span style={{ color: "#98a2b3", fontSize: 9.5, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{seg.sub}</span>}
                  </span>
                  <span style={{ color: "#101828", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    {seg.value.toFixed(unitSuffix === "h" ? 1 : 2)}{unitSuffix}
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


// ── Pareto Lead Time chart (Tactical) ─────────────────────────────────────────
// Replaces LeadTimeStageStdChart. Fetches /api/lead-time/charts (stages key).
// Toggle 1: Group Process (POSITION/attached) vs Process (individual activity/stage).
// Toggle 2: Pareto (desc by total) vs Sequence (STAGE_ORDER).

type ParetoStageData = { stage: string; activity: string; activityId: number; sequence: number | null; attached: string; category: "VA" | "NNVA" | "UNVA"; days: number };

interface ParetoRow extends BarDatum {
  stage: string;
  label: string;
  VA: number; NNVA: number; UNVA: number;
  total: number;
  cumPct: number;
}

const PARETO_CAT_COLORS = { VA: "#067647", NNVA: "#f59e0b", UNVA: "#d92d20" } as const;
const PARETO_CUMUL_COLOR = "#16305C";
const PARETO_STD_COLOR = "#101828";
const PARETO_MARGIN = { top: 10, right: 48, bottom: 40, left: 40 };
// Process mode has ~40 bars: names are rotated −35° so every one shows (extra bottom / left room for the slant)
const PARETO_MARGIN_PROCESS = { top: 10, right: 48, bottom: 96, left: 56 };
const PARETO_TICK_FILL = "#667085";

const paretoSeq = (stage: string) => {
  if (stage === "WIP") return STAGE_ORDER.length + 1;
  const i = (STAGE_ORDER as readonly string[]).indexOf(stage);
  return i === -1 ? STAGE_ORDER.length : i;
};

export function TacticalParetoChart({
  filters, stageStd, stageLoading, unit = "days", onlyActivity, detailHref = "/lead-time?tab=pareto",
  showExtendedFilters = false,
}: {
  filters: TacticalFilters; stageStd: StageStdPoint[]; stageLoading: boolean; unit?: LtUnit;
  /** Show only this ACTIVITY (Lead Time page Activity filter) */
  onlyActivity?: string;
  /** "Open detail →" link; null hides it (already on the detail page) */
  detailHref?: string | null;
  /** Show extra category + WIP toggles (Lead Time Analysis tab) */
  showExtendedFilters?: boolean;
}) {
  const [rawStages, setRawStages] = useState<ParetoStageData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const sort = "pareto" as const;
  const [group, setGroup] = useState<"group" | "process">("group");
  const [wip, setWip] = useState<"tahap" | "with-wip">("with-wip");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "VA" | "NNVA" | "UNVA">("all");
  const [catOpen, setCatOpen] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);
  const [cumHover, setCumHover] = useState<{ row: ParetoRow; clientX: number; clientY: number } | null>(null);

  useEffect(() => {
    if (!catOpen) return;
    const h = (e: MouseEvent) => { if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [catOpen]);

  useEffect(() => {
    const params = new URLSearchParams({ plant: filters.plant, startDate: filters.startDate, endDate: filters.endDate });
    if (filters.period) params.set("period", filters.period);
    dimsToParams(filters.lt, params);
    setLoading(true);
    fetch(`/api/lead-time/charts?${params}`)
      .then(r => r.json())
      .then(d => setRawStages(d.stages ?? null))
      .catch(() => setRawStages(null))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.plant, filters.startDate, filters.endDate, filters.period, dimsKey(filters.lt)]);

  const f = ltFactor(unit);
  const stdMap = useMemo(() => new Map(stageStd.map(s => [s.stage, s.std * f])), [stageStd, f]);

  const stageToProcessGroup = (stage: string): string => {
    const grp = PROCESS_GROUPS.find((g) => (g.stages as readonly string[]).includes(stage));
    return grp ? grp.label : stage;
  };

  const rows = useMemo((): ParetoRow[] => {
    const src = (rawStages ?? []).filter((r) => {
      if (onlyActivity && r.activity !== onlyActivity) return false;
      // "Tahap" = exclude WIP rows; "Tahap dan WIP" = include (default)
      if (showExtendedFilters && wip === "tahap" && r.stage === "WIP") return false;
      // Category filter: only rows of the selected category
      if (showExtendedFilters && categoryFilter !== "all" && r.category !== categoryFilter) return false;
      return true;
    });

    // In group mode with "with-wip": WIP rows use their own stage key so WIP appears as a separate bar.
    // In group mode with "stages": WIP rows were already filtered out above.
    // In process mode: always key by activity.
    const groupKey = (r: ParetoStageData) => {
      if (group !== "group") return r.activity;
      if (showExtendedFilters && wip === "with-wip" && r.stage === "WIP") return r.stage;
      return stageToProcessGroup(r.attached);
    };

    // Seq = process flow: lowest ACTIVITY_SEQUENCE per bar.
    const seqOf = new Map<string, number>();
    for (const r of src) {
      const key = groupKey(r);
      const seq = r.sequence ?? Infinity;
      if (seq < (seqOf.get(key) ?? Infinity)) seqOf.set(key, seq);
    }

    const byKey = new Map<string, Record<"VA" | "NNVA" | "UNVA", number>>();
    for (const r of src) {
      const key = groupKey(r);
      if (!byKey.has(key)) byKey.set(key, { VA: 0, NNVA: 0, UNVA: 0 });
      byKey.get(key)![r.category] += r.days;
    }
    const list: ParetoRow[] = Array.from(byKey.entries())
      .map(([stage, v]) => ({
        stage,
        label: group === "group" ? stage : stageLabel(stage),
        VA: v.VA * f, NNVA: v.NNVA * f, UNVA: v.UNVA * f,
        total: (v.VA + v.NNVA + v.UNVA) * f, cumPct: 0,
      }))
      .filter(r => r.total > 0.005 * f);

    list.sort(sort === "pareto"
      ? (a, b) => b.total - a.total
      // Fallback for rows without ACTIVITY_SEQUENCE: STAGE_ORDER (group) / end of the axis (process)
      : (a, b) => (seqOf.get(a.stage) ?? (group === "group" ? 1000 + paretoSeq(a.stage) : 9999))
                - (seqOf.get(b.stage) ?? (group === "group" ? 1000 + paretoSeq(b.stage) : 9999)));

    const grand = list.reduce((s, r) => s + r.total, 0);
    let run = 0;
    for (const r of list) { run += r.total; r.cumPct = grand > 0 ? (run / grand) * 100 : 0; }
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawStages, group, sort, f, onlyActivity, wip, categoryFilter, showExtendedFilters]);

  const CumulativeLayer = useCallback(({ bars, innerWidth, innerHeight }: BarCustomLayerProps<ParetoRow>) => {
    const centers = new Map<string, number>();
    for (const b of bars) centers.set(String(b.data.indexValue), b.x + b.width / 2);
    const pts = rows
      .map(r => ({ row: r, x: centers.get(r.label), y: innerHeight * (1 - r.cumPct / 100) }))
      .filter((p): p is { row: ParetoRow; x: number; y: number } => p.x !== undefined);
    return (
      <g style={{ pointerEvents: "none" }}>
        {[0, 25, 50, 75, 100].map(t => (
          <text key={t} x={innerWidth + 8} y={innerHeight * (1 - t / 100)} dominantBaseline="middle"
            style={{ fontSize: 10, fill: "#a0a6b1", fontFamily: "inherit" }}>{t}%</text>
        ))}
        {pts.length > 1 && (
          <polyline points={pts.map(p => `${p.x},${p.y}`).join(" ")}
            fill="none" stroke={PARETO_CUMUL_COLOR} strokeWidth={1.75} strokeLinejoin="round" />
        )}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y}
            r={cumHover?.row.label === p.row.label ? 4.5 : 3.5}
            fill="white" stroke={PARETO_CUMUL_COLOR} strokeWidth={1.75} />
        ))}
        {pts.map((p, i) => (
          <circle key={`h${i}`} cx={p.x} cy={p.y} r={9} fill="transparent"
            style={{ pointerEvents: "all", cursor: "default" }}
            onMouseEnter={(e: React.MouseEvent<SVGCircleElement>) => setCumHover({ row: p.row, clientX: e.clientX, clientY: e.clientY })}
            onMouseLeave={() => setCumHover(null)} />
        ))}
      </g>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cumHover]);

  const StdLayer = useCallback(({ bars, yScale }: BarCustomLayerProps<ParetoRow>) => {
    const y = yScale as (v: number) => number;
    const firstByStage = new Map<string, typeof bars[0]>();
    for (const b of bars) { if (!firstByStage.has(b.data.data.stage)) firstByStage.set(b.data.data.stage, b); }
    return (
      <g style={{ pointerEvents: "none" }}>
        {Array.from(firstByStage.values()).map(b => {
          const std = stdMap.get(b.data.data.stage) ?? 0;
          if (std <= 0) return null;
          return (
            <circle key={b.data.data.stage} cx={b.x + b.width / 2} cy={y(std)} r={3.5}
              fill={PARETO_STD_COLOR} stroke="white" strokeWidth={1} />
          );
        })}
      </g>
    );
  }, [stdMap]);

  const isLoading = loading || stageLoading;
  const margin = group === "process" ? PARETO_MARGIN_PROCESS : PARETO_MARGIN;
  const maxTotal = rows.reduce((m, r) => Math.max(m, r.total), 0);
  const yTicks = [0, 0.5, 1, 2, 5, 10, 20, 50, 100].filter(t => t <= maxTotal * 1.1);
  const hasStd = stageStd.some(s => s.std > 0);

  return (
    <div className="rounded-lg border border-[#EBEBEB] bg-white p-4">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Pareto Lead Time</p>
            <InfoTooltip text="Net time per PO per process, summed over POs completed in the period. Bars represent average days (or hours); the standard line is the engineering estimate. Group Process merges related activities into 6 groups." size={13} width={260} />
            {detailHref && <a href={detailHref} className="text-[11px] text-[#1E4076] font-semibold hover:underline shrink-0">Open detail →</a>}
          </div>
          <SegmentedToggle<"group" | "process">
            options={[{ key: "group", label: "Group Process" }, { key: "process", label: "Process" }]}
            value={group}
            onChange={setGroup}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {showExtendedFilters && (
            <div className="relative" ref={catRef}>
              <button
                onClick={() => setCatOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={catOpen}
                className={cn(FIELD, FIELD_ON, "justify-between gap-2 min-w-[80px]")}
              >
                <span>{categoryFilter === "all" ? "Semua" : categoryFilter}</span>
                <ChevronDown size={11} className={cn("text-slate-400 shrink-0 transition-transform duration-150", catOpen && "rotate-180")} />
              </button>
              {catOpen && (
                <div className={cn(MENU, "w-[max(100%,100px)]")} role="listbox">
                  {(["all", "VA", "NNVA", "UNVA"] as const).map((v) => (
                    <button key={v} role="option" aria-selected={categoryFilter === v}
                      onClick={() => { setCategoryFilter(v); setCatOpen(false); }}
                      className={cn(MENU_ITEM, categoryFilter === v ? MENU_ITEM_ON : MENU_ITEM_OFF)}>
                      <span>{v === "all" ? "Semua" : v === "VA" ? "VA – Value Added" : v === "NNVA" ? "NNVA – Non-Value Added" : "UNVA – Waste"}</span>
                      {categoryFilter === v && <Check size={10} className="text-[#1E4076] shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {showExtendedFilters && (
            <SegmentedToggle<"tahap" | "with-wip">
              options={[{ key: "tahap", label: "Stages" }, { key: "with-wip", label: "Stages + WIP" }]}
              value={wip}
              onChange={setWip}
            />
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="h-[280px] bg-gray-50 rounded animate-pulse" />
      ) : rows.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center text-[11px] text-gray-400">No data for selected period</div>
      ) : (
        <Fade depKey={`${group}|${sort}|${unit}|${wip}|${categoryFilter}|${rows.length}|${rows[0]?.stage}`}>
        {/* Fades on Group Process / Process, Par / Seq, WIP, category, unit and new data */}
        <div style={{ height: group === "process" ? 336 : 280, position: "relative" }} onMouseLeave={() => setCumHover(null)}>
          <ResponsiveBar<ParetoRow>
            data={rows}
            keys={["VA", "NNVA", "UNVA"]}
            indexBy="label"
            theme={LINE_THEME}
            margin={margin}
            padding={0.32}
            groupMode="stacked"
            colors={({ id }) => PARETO_CAT_COLORS[id as keyof typeof PARETO_CAT_COLORS]}
            borderRadius={2}
            enableLabel={false}
            enableGridX={false}
            valueScale={{ type: "symlog", constant: 1 }}
            gridYValues={yTicks}
            axisLeft={{ tickSize: 0, tickPadding: 8, tickValues: yTicks, format: (v) => Number(v).toFixed(1) }}
            axisBottom={{
              tickSize: 0,
              renderTick: (t) => group === "process" ? (
                <g transform={`translate(${t.x},${t.y + 8})`}>
                  <text textAnchor="end" dominantBaseline="middle" transform="rotate(-35)"
                    style={{ fontSize: 9.5, fill: PARETO_TICK_FILL, fontFamily: "inherit" }}>
                    {String(t.value)}
                  </text>
                </g>
              ) : (
                <g transform={`translate(${t.x},${t.y + 14})`}>
                  <text textAnchor="middle" dominantBaseline="middle"
                    style={{ fontSize: 10.5, fill: PARETO_TICK_FILL, fontFamily: "inherit" }}>
                    {String(t.value)}
                  </text>
                </g>
              ),
            }}
            layers={["grid", "axes", "bars", StdLayer, CumulativeLayer]}
            tooltip={({ id, data: d }) => {
              const std = stdMap.get(d.stage) ?? 0;
              const catRows = ([
                { label: "VA",   color: PARETO_CAT_COLORS.VA,   value: Number(d.VA).toFixed(2),   unit, strong: id === "VA"   },
                { label: "NNVA", color: PARETO_CAT_COLORS.NNVA, value: Number(d.NNVA).toFixed(2), unit, strong: id === "NNVA" },
                { label: "UNVA", color: PARETO_CAT_COLORS.UNVA, value: Number(d.UNVA).toFixed(2), unit, strong: id === "UNVA" },
              ] as const).filter(r => categoryFilter === "all" || r.label === categoryFilter);
              return (
                <LineTooltip
                  title={d.label}
                  subtitle={d.stage}
                  rows={[
                    ...catRows,
                    ...(std > 0 ? [{ label: "Standard", color: PARETO_STD_COLOR, value: std.toFixed(2), unit }] : []),
                  ]}
                  footer={{ label: "Total · cumulative", value: `${d.total.toFixed(2)} ${unit} · ${Math.round(d.cumPct)}%` }}
                />
              );
            }}
            animate={false}
            role="img"
            ariaLabel="Pareto lead time per stage, stacked by VA, NNVA and UNVA"
          />
        </div>
        {cumHover && (
          <div style={{
            position: "fixed", pointerEvents: "none", zIndex: 9999,
            left: cumHover.clientX,
            top: cumHover.clientY,
            transform: "translate(-50%, calc(-100% - 12px))",
          }}>
            <LineTooltip
              title={stageLabel(cumHover.row.stage)}
              subtitle={cumHover.row.stage}
              rows={[
                { label: "Cumulative", color: PARETO_CUMUL_COLOR, value: `${Math.round(cumHover.row.cumPct)}%` },
                { label: "Total", value: cumHover.row.total.toFixed(2), unit },
              ]}
            />
          </div>
        )}
        </Fade>
      )}

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 mt-2">
          <span className="flex items-center gap-1.5 text-[9.5px] text-slate-500">
            <span className="w-2.5 h-2.5 rounded-full border-[1.75px] bg-white" style={{ borderColor: PARETO_CUMUL_COLOR }} />
            Cumulative
          </span>
          {(["VA", "NNVA", "UNVA"] as const).map(k => (
            <span key={k} className="flex items-center gap-1.5 text-[9.5px] text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: PARETO_CAT_COLORS[k] }} />
              {k}
            </span>
          ))}
          {hasStd && (
            <span className="flex items-center gap-1.5 text-[9.5px] text-slate-500">
              <span className="w-2 h-2 rounded-full" style={{ background: PARETO_STD_COLOR }} />
              Standard
            </span>
          )}
        </div>
      )}
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

function SectionHeading({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <h2 className="text-[17px] font-bold text-gray-800">{title}</h2>
      {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
    </div>
  );
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

function LeadTimeSection({ kpi, loading, plantLT, stageStd, stageLoading, ltBasis, onLtBasisChange, tacticalFilters }: TacticalViewProps) {
  // Toggles next to the title — they apply to this section only (unit everywhere, gross/nett on the card and histogram)
  const [unit, setUnit] = useState<LtUnit>("days");
  const [measure, setMeasure] = useState<LtMeasure>("gross");
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null);
  // Reset plant selection when global filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filtersKey = `${tacticalFilters.plant}|${tacticalFilters.startDate}|${tacticalFilters.endDate}`;
  useEffect(() => { setSelectedPlant(null); }, [filtersKey]);
  const plantFilters = { ...tacticalFilters, plant: selectedPlant ?? tacticalFilters.plant };
  const f = ltFactor(unit);
  const sfx = unit === "hours" ? "h" : "d";

  const c = kpi?.leadTime.composition;
  // Network values from plantLT (getLeadTimeByPlant, per PO, gross follows ltBasis); nett does not depend on the basis
  const networkRow = plantLT?.plants.find((p) => p.plant === null);
  const gross = networkRow?.gross ?? kpi?.leadTime.grossDays;
  const nett = networkRow?.nett ?? kpi?.leadTime.nettDays;
  const maxGross = kpi?.leadTime.maxGrossDays ?? 0;
  const poCount = kpi?.leadTime.poCount ?? 0;
  const avgPoStage = kpi?.leadTime.avgPoStageDays ?? 0;
  const poStagePct = gross && gross > 0 ? (avgPoStage / gross) * 100 : 0;
  const groupProcess = kpi?.leadTime.groupProcess ?? [];

  const vanaSegments: DonutSegment[] = c ? [
    { color: "#067647", label: "VA",   sub: "Value Added",                 value: c.vaDays * f },
    { color: "#f59e0b", label: "NNVA", sub: "Necessary Non-Value Added",   value: c.nnvaDays * f },
    { color: "#d92d20", label: "UNVA", sub: "Unnecessary Non-Value Added", value: c.unvaDays * f },
  ] : [];
  const vanaTotal = vanaSegments.reduce((s, seg) => s + seg.value, 0);
  const vaPct = vanaTotal > 0 && c ? (c.vaDays   / vanaTotal) * 100 : 0;
  const nnPct = vanaTotal > 0 && c ? (c.nnvaDays / vanaTotal) * 100 : 0;
  const unPct = vanaTotal > 0 && c ? (c.unvaDays / vanaTotal) * 100 : 0;

  const groupByProcess = useMemo(() => {
    return PROCESS_GROUPS
      .map((grp) => {
        const matched = groupProcess.filter((g) => (grp.stages as readonly string[]).includes(g.activity));
        const avgDays = matched.reduce((s, r) => s + r.avgDays, 0);
        return { label: grp.label, avgDays, color: "" };
      })
      .filter((g) => g.avgDays > 0)
      .sort((a, b) => b.avgDays - a.avgDays);
  }, [groupProcess]);

  const groupSegments: DonutSegment[] = groupByProcess.map((g, i) => ({
    color: GROUP_PROCESS_PALETTE[i] ?? "#98a2b3",
    label: g.label,
    value: g.avgDays * f,
  }));
  const groupTotal = groupSegments.reduce((s, seg) => s + seg.value, 0);
  const groupLargest = groupSegments[0];
  const groupLargestPct = groupLargest && groupTotal > 0 ? (groupLargest.value / groupTotal) * 100 : 0;

  const nnvaFooter = c
    ? `Largest NNVA: ${nnPct.toFixed(0)}%; UNVA ${unPct.toFixed(0)}%, VA ${vaPct.toFixed(0)}%`
    : "";
  const groupFooter = groupLargest
    ? `${groupLargest.label} largest: ${groupLargest.value.toFixed(unit === "hours" ? 1 : 2)} ${unit} (${groupLargestPct.toFixed(0)}%)`
    : "";

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="Lead Time"
        right={<>
          <SegmentedToggle<"created" | "released">
            ariaLabel="Lead time start"
            options={[{ key: "created", label: "PO Created" }, { key: "released", label: "PO Released" }]}
            value={ltBasis}
            onChange={onLtBasisChange}
          />
          <SegmentedToggle<LtUnit>
            ariaLabel="Lead time unit"
            options={[{ key: "days", label: "Days" }, { key: "hours", label: "Hours" }]}
            value={unit}
            onChange={setUnit}
          />
          <SegmentedToggle<LtMeasure>
            ariaLabel="Gross or nett lead time"
            options={[{ key: "gross", label: "Gross" }, { key: "nett", label: "Nett" }]}
            value={measure}
            onChange={setMeasure}
          />
        </>}
      />

      <div className="grid grid-cols-3 gap-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            {measure === "gross" ? (
              <TKpiCard
                label="Lead Time"
                value={gross != null ? fmtLt(gross, unit) : null}
                unit={unit}
                ltUnit={unit}
                trend={kpi?.leadTime.grossTrend ?? null}
                inverse
                sparkline={kpi?.leadTime.sparkline?.map((v) => v * f)}
                sparkUnit="weeks"
                ltDays={gross ?? undefined}
                footerLeft={`End-to-end gross · ${ltBasis === "released" ? "PO Released" : "PO Created"} → Receive NDC`}
                noData={!kpi}
                // Gauge follows the PO Created / Released toggle (network row of /api/lead-time/stages); KPI snapshot is Released-only
                gaugeCounts={networkRow?.gauge ?? (kpi && poCount > 0 ? { onTime: kpi.leadTime.onTimeCount ?? 0, atRisk: kpi.leadTime.atRiskCount ?? 0, late: kpi.leadTime.lateCount ?? 0 } : null)}
                gaugePoCount={poCount}
                gaugePoStageLabel={avgPoStage > 0
                  ? `PO & approval ${fmtLt(avgPoStage, unit)} ${unit} · ${poStagePct.toFixed(0)}% of gross`
                  : undefined}
              />
            ) : (
              // Nett has no target (13 days is defined on gross) and no weekly series → value vs prior period only
              <TKpiCard
                label="Lead Time"
                value={nett != null ? fmtLt(nett, unit) : null}
                unit={unit}
                trend={kpi?.leadTime.nettTrend ?? null}
                inverse
                footerLeft="End-to-end nett · time in active production activities"
                noData={!kpi}
              />
            )}
            <DonutCard
              title="VA · NNVA · UNVA"
              segments={vanaSegments}
              footer={nnvaFooter}
              loading={!kpi}
              unitSuffix={sfx}
            />
            <DonutCard
              title="Group Process"
              segments={groupSegments}
              footer={groupFooter}
              loading={!kpi}
              unitSuffix={sfx}
            />
          </>
        )}
      </div>

      <LeadTimeHistogram filters={plantFilters} basis={ltBasis} metric={measure} unit={unit} />

      <TacticalParetoChart filters={plantFilters} stageStd={stageStd} stageLoading={stageLoading} unit={unit} />

      {/* The table is its own card (ChartCard) with the Group Process / Process toggle */}
      {selectedPlant && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "#1E4076", fontWeight: 600, fontFamily: "Lato, sans-serif" }}>
          <span>Filtered by plant: {selectedPlant}</span>
          <button onClick={() => setSelectedPlant(null)} style={{ color: "#98a2b3", background: "none", border: "none", cursor: "pointer", lineHeight: 1, fontSize: 14 }} aria-label="Clear plant filter">×</button>
        </div>
      )}
      <LeadTimePlantTable
        data={plantLT?.plants ?? null}
        activities={plantLT?.activities ?? []}
        targetDays={plantLT?.targetDays ?? 13}
        loading={stageLoading}
        basis={ltBasis}
        unit={unit}
        selectedPlant={selectedPlant}
        onRowClick={(p) => setSelectedPlant(p)}
      />
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

// ── Output Trend chart ────────────────────────────────────────────────────────

type OutputBarDatum = { label: string; Actual: number; theoretical: number } & BarDatum;
const ACTUAL_BAR_COLOR = "#4A6BA3";
const THEO_LINE_COLOR  = "#667085";

function TheoreticalLineLayer({ bars, yScale }: BarCustomLayerProps<OutputBarDatum>) {
  const visible = bars.filter((b) => String(b.key).endsWith("Actual"));
  if (!visible.length) return null;
  const pts = visible.map((b) => ({
    x: b.x + b.width / 2,
    y: (yScale as (v: number) => number)(b.data.data.theoretical),
  }));
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  return (
    <g>
      <path d={d} fill="none" stroke={THEO_LINE_COLOR} strokeWidth={1.5} strokeDasharray="6 3" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="white" stroke={THEO_LINE_COLOR} strokeWidth={1.5} />
      ))}
    </g>
  );
}

function TacticalOutputTrendChart({ filters, metric }: { filters: TacticalFilters; metric: "fg" | "bulk" }) {
  const { t } = useT();
  const [grain, setGrain] = useState<"month" | "week">("month");
  const [rawData, setRawData] = useState<{ date: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (metric === "bulk") { setRawData([]); setLoading(false); return; }
    setLoading(true);
    const params = new URLSearchParams({ kpiType: "output", grain, plant: filters.plant, startDate: filters.startDate, endDate: filters.endDate });
    if (filters.period) params.set("period", filters.period);
    fetch(`/api/dashboard/trends?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setRawData((d?.trendSeries ?? []).map((row: Record<string, unknown>) => ({ date: String(row.date), value: Number(row["All plants"] ?? 0) }))))
      .catch(() => setRawData([]))
      .finally(() => setLoading(false));
  }, [filters.plant, filters.startDate, filters.endDate, filters.period, metric, grain]);

  const barData: OutputBarDatum[] = rawData.map((p) => {
    const dt = new Date(p.date + "T00:00:00Z");
    const label = grain === "week"
      ? `W${String(Math.ceil(dt.getUTCDate() / 7)).padStart(2, "0")} ${dt.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}`
      : dt.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    return { label, Actual: Number((p.value / 1_000_000).toFixed(2)), theoretical: 0 };
  });
  const maxVal = Math.max(...barData.map((d) => d.Actual), 1);

  return (
    <div className="rounded-lg border border-[#EBEBEB] bg-white p-4" style={{ fontFamily: "Lato, sans-serif" }}>
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t("output_trend_title")}</p>
          <InfoTooltip text={t("output_trend_tooltip")} size={13} width={240} />
        </div>
        <select
          value={grain}
          onChange={(e) => setGrain(e.target.value as "month" | "week")}
          style={{
            fontSize: 11, fontFamily: "Lato, sans-serif", fontWeight: 600, color: "#344054",
            border: "1px solid #D0D5DD", borderRadius: 6, padding: "3px 8px",
            background: "white", cursor: "pointer", outline: "none",
          }}
        >
          <option value="month">{t("toggle_monthly")}</option>
          <option value="week">{t("toggle_weekly")}</option>
        </select>
      </div>

      {metric === "bulk" ? (
        <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ fontSize: 11, color: "#98a2b3", fontWeight: 600 }}>{t("output_bulk_coming_soon")}</p>
        </div>
      ) : loading ? (
        <div style={{ height: 240, borderRadius: 6, background: "#f9fafb" }} className="animate-pulse" />
      ) : barData.length === 0 ? (
        <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ fontSize: 11, color: "#98a2b3" }}>{t("output_trend_no_data")}</p>
        </div>
      ) : (
        <Fade depKey={`${metric}|${grain}|${filters.plant}|${filters.startDate}|${filters.endDate}`}>
          <div style={{ height: 240 }}>
            <ResponsiveBar<OutputBarDatum>
              data={barData}
              keys={["Actual"]}
              indexBy="label"
              theme={LINE_THEME}
              margin={{ top: 8, right: 16, bottom: 36, left: 52 }}
              padding={0.3}
              colors={[ACTUAL_BAR_COLOR]}
              borderRadius={2}
              enableLabel={false}
              enableGridX={false}
              valueScale={{ type: "linear", min: 0, max: maxVal * 1.2 }}
              axisLeft={{
                tickSize: 0, tickPadding: 8,
                format: (v) => Number(v).toFixed(1),
                legend: t("output_fg_unit_mpcs"), legendOffset: -44, legendPosition: "middle",
              }}
              axisBottom={{ tickSize: 0, tickPadding: 8 }}
              layers={["grid", "axes", "bars", TheoreticalLineLayer]}
              tooltip={({ data: d }) => (
                <LineTooltip
                  title={d.label}
                  rows={[
                    { label: t("chart_actual"),            color: ACTUAL_BAR_COLOR, value: `${d.Actual.toFixed(2)}M pcs` },
                    { label: t("output_legend_theoretical"), color: THEO_LINE_COLOR, value: t("empty_no_data") },
                  ]}
                />
              )}
              animate={false}
            />
          </div>
        </Fade>
      )}

      <div style={{ display: "flex", gap: 16, marginTop: 8, justifyContent: "center", fontSize: 10.5, color: "#667085" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width={18} height={10}>
            <line x1={0} y1={5} x2={18} y2={5} stroke={THEO_LINE_COLOR} strokeWidth={1.5} strokeDasharray="5 3" />
            <circle cx={9} cy={5} r={3} fill="white" stroke={THEO_LINE_COLOR} strokeWidth={1.5} />
          </svg>
          {t("output_legend_theoretical")}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: ACTUAL_BAR_COLOR, display: "inline-block" }} />
          {t("chart_actual")}
        </span>
      </div>
    </div>
  );
}

// ── Top Line by Output table ──────────────────────────────────────────────────

interface OutputLineRow { line: string; qtyPo: number; qtyReal: number; theoretical: number | null; gap: number | null; pctContrib: number }

function TopLineByOutputTable({ filters, metric }: { filters: TacticalFilters; metric: "fg" | "bulk" }) {
  const { t } = useT();
  const [rows, setRows] = useState<OutputLineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState<keyof OutputLineRow>("qtyReal");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (metric === "bulk") { setRows([]); setLoading(false); return; }
    setLoading(true);
    const params = new URLSearchParams({ plant: filters.plant, startDate: filters.startDate, endDate: filters.endDate });
    if (filters.period) params.set("period", filters.period);
    fetch(`/api/dashboard/output-line?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setRows(d?.lines ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [filters.plant, filters.startDate, filters.endDate, filters.period, metric]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortCol] ?? -Infinity, bv = b[sortCol] ?? -Infinity;
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }, [rows, sortCol, sortDir]);

  const toggleSort = (col: keyof OutputLineRow) => {
    if (col === sortCol) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const TH = ({ col, label, right }: { col: keyof OutputLineRow; label: string; right?: boolean }) => (
    <th
      onClick={() => toggleSort(col)}
      style={{
        padding: "7px 10px", fontSize: 10.5, fontWeight: 700, color: "white",
        textAlign: right ? "right" : "left", cursor: "pointer",
        background: "#1E4076", whiteSpace: "nowrap", userSelect: "none",
      }}
    >
      {label}{" "}
      <span style={{ opacity: sortCol === col ? 1 : 0.4 }}>{sortCol === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
    </th>
  );

  return (
    <div className="rounded-lg border border-[#EBEBEB] bg-white overflow-hidden" style={{ fontFamily: "Lato, sans-serif" }}>
      <div style={{ padding: "11px 13px 8px", display: "flex", alignItems: "center", gap: 6 }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", flex: 1 }}>
          {t("output_line_title")}
        </p>
        <InfoTooltip text={t("output_line_tooltip")} size={13} width={220} />
      </div>
      {loading ? (
        <div style={{ height: 260, background: "#f9fafb" }} className="animate-pulse" />
      ) : metric === "bulk" ? (
        <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "#98a2b3", fontSize: 11, fontWeight: 600 }}>
          {t("output_line_bulk_coming_soon")}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "#98a2b3", fontSize: 11 }}>
          {t("output_trend_no_data")}
        </div>
      ) : (
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 320 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr>
                <TH col="line"        label={t("th_line")} />
                <TH col="qtyPo"       label={t("output_line_th_qty_po")}      right />
                <TH col="qtyReal"     label={t("output_line_th_qty_real")}    right />
                <TH col="theoretical" label={t("output_line_th_theoretical")} right />
                <TH col="gap"         label={t("output_line_th_gap")}         right />
                <TH col="pctContrib"  label={t("output_line_th_pct_contrib")} right />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr key={row.line} style={{ background: i % 2 === 0 ? "white" : "#fafafa", borderBottom: "1px solid #f0f1f3" }}>
                  <td style={{ padding: "6px 10px", fontWeight: 700, color: "#1E4076" }}>{row.line}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", color: "#344054", fontVariantNumeric: "tabular-nums" }}>
                    {row.qtyPo.toLocaleString()}
                  </td>
                  <td style={{ padding: "6px 10px", textAlign: "right", color: "#344054", fontVariantNumeric: "tabular-nums" }}>
                    {row.qtyReal.toLocaleString()}
                  </td>
                  <td style={{ padding: "6px 10px", textAlign: "right", color: "#98a2b3" }}>—</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", color: "#98a2b3" }}>—</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700, color: "#344054", fontVariantNumeric: "tabular-nums" }}>
                    {row.pctContrib.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Output KPI mini-cards ─────────────────────────────────────────────────────

function OutputFGCard({ fgQty, fgTrend, noData }: {
  fgQty: number; fgTrend: number | null; noData?: boolean;
}) {
  const { t } = useT();
  const toneKey = noData ? "neutral" : trendToneKey(fgTrend, false);
  const tone = TONE_TREND[toneKey];
  const fgM = fgQty / 1_000_000;
  return (
    <div style={{
      background: "white", border: "1px solid #EBEBEB", borderRadius: 8,
      padding: "11px 13px", display: "flex", flexDirection: "column",
      height: "100%", fontFamily: "Lato, sans-serif",
    }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", color: "#64748b", textTransform: "uppercase" }}>
        {t("output_fg_card_title")}
      </span>
      <div style={{ flex: 1, display: "flex", gap: 10, marginTop: 10, alignItems: "flex-start" }}>
        {/* Left: total */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 10, color: "#98a2b3", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t("output_fg_label_total")}</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{
              fontSize: 28, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums",
              color: noData ? "#d0d5dd" : "#101828",
            }}>
              {noData ? "—" : fgM.toFixed(2)}
            </span>
          </div>
          <span style={{ fontSize: 10.5, color: "#98a2b3" }}>{t("output_fg_unit_mpcs")}</span>
          <StatusDot color={noData ? "#667085" : tone.color} label={noData ? t("status_no_data") : tone.label} />
        </div>
        {/* Divider */}
        <div style={{ width: 1, background: "#EBEBEB", alignSelf: "stretch", flexShrink: 0 }} />
        {/* Right: achievement */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 10, color: "#98a2b3", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t("output_fg_label_achievement")}</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: "#d0d5dd", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>—</span>
          <span style={{ fontSize: 11, color: "#98a2b3" }}>{t("output_line_th_gap")} —</span>
        </div>
      </div>
      <div style={{
        borderTop: "1px solid #eceef2", marginTop: 10, paddingTop: 6,
        fontSize: 11, color: "#667085",
      }}>
        {t("output_fg_footer")}
      </div>
    </div>
  );
}

function OutputCountCard({ skuCount, poCount, noData }: {
  skuCount?: number; poCount?: number; noData?: boolean;
}) {
  const { t } = useT();
  const avgPo = (skuCount && skuCount > 0 && poCount) ? (poCount / skuCount).toFixed(0) : null;
  return (
    <div style={{
      background: "white", border: "1px solid #EBEBEB", borderRadius: 8,
      padding: "11px 13px", display: "flex", flexDirection: "column",
      height: "100%", fontFamily: "Lato, sans-serif",
    }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", color: "#64748b", textTransform: "uppercase" }}>
        {t("output_count_title")}
      </span>
      {noData ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#98a2b3", fontSize: 11 }}>
          {t("empty_no_data")}
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", marginTop: 10 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "baseline", justifyContent: "center", gap: 5 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: "#101828", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
              {(skuCount ?? 0).toLocaleString()}
            </span>
            <span style={{ fontSize: 13, color: "#98a2b3", fontWeight: 700 }}>SKU</span>
          </div>
          <div style={{ width: 1, height: 48, background: "#EBEBEB", flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", alignItems: "baseline", justifyContent: "center", gap: 5 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: "#101828", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
              {(poCount ?? 0).toLocaleString()}
            </span>
            <span style={{ fontSize: 13, color: "#98a2b3", fontWeight: 700 }}>PO</span>
          </div>
        </div>
      )}
      <div style={{ borderTop: "1px solid #eceef2", marginTop: 10, paddingTop: 6, fontSize: 11, color: "#667085" }}>
        {avgPo ? `${t("output_count_avg")} ${avgPo} PO / SKU` : "—"}
      </div>
    </div>
  );
}

function OutputPieCard({ title, segments, noData }: {
  title: string;
  segments: { label: string; qty: number; color: string }[];
  noData?: boolean;
}) {
  const { t } = useT();
  const total = segments.reduce((s, seg) => s + Math.max(0, seg.qty), 0);
  const fmtM = (v: number) => (v / 1_000_000).toFixed(2);
  const donutSegs: DonutSegment[] = segments.map((s) => ({ label: s.label, value: s.qty, color: s.color }));
  return (
    <div style={{
      background: "white", border: "1px solid #EBEBEB", borderRadius: 8,
      padding: "11px 13px", display: "flex", flexDirection: "column",
      height: "100%", fontFamily: "Lato, sans-serif",
    }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", color: "#64748b", textTransform: "uppercase" }}>
        {title}
      </span>
      {noData || total <= 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#98a2b3", fontSize: 11 }}>
          {t("empty_no_data")}
        </div>
      ) : (
        <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center", flex: 1 }}>
          <div style={{ flexShrink: 0 }}>
            <PieChart segments={donutSegs} size={90} unit="M pcs" fmt={fmtM} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            {segments.map((seg, i) => {
              const pct = (Math.max(0, seg.qty) / total * 100);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: "#334155", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {seg.label}
                  </span>
                  <span style={{ color: "#101828", fontWeight: 700, fontVariantNumeric: "tabular-nums", minWidth: 34, textAlign: "right" }}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function OutputSection({ kpi, loading, tacticalFilters }: Pick<TacticalViewProps, "kpi" | "loading"> & { tacticalFilters: TacticalFilters }) {
  const { t } = useT();
  const [metric, setMetric] = useState<"fg" | "bulk">("fg");

  const plantSegs = useMemo<{ label: string; qty: number; color: string }[]>(() => {
    if (metric !== "fg") return [];
    const drivers = kpi?.output?.plantDrivers;
    if (!drivers || drivers.length === 0) return [];
    return [...drivers]
      .filter((d) => d.fg > 0)
      .sort((a, b) => b.fg - a.fg)
      .map((d, i) => ({ label: d.plant, qty: d.fg, color: PLANT_COLORS[i % PLANT_COLORS.length] as string }));
  }, [kpi?.output?.plantDrivers, metric]);

  const formSegs = useMemo<{ label: string; qty: number; color: string }[]>(() => {
    if (metric !== "fg") return [];
    const forms = kpi?.output?.byForm;
    if (!forms || forms.length === 0) return [];
    return forms
      .filter((f) => f.qty > 0)
      .map((f, i) => ({ label: f.form, qty: f.qty, color: SERIES_COLORS[i % SERIES_COLORS.length] as string }));
  }, [kpi?.output?.byForm, metric]);

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title={t("card_output")}
        right={
          <SegmentedToggle<"fg" | "bulk">
            ariaLabel="Output metric"
            options={[{ key: "fg", label: "FG" }, { key: "bulk", label: "Bulk" }]}
            value={metric}
            onChange={setMetric}
          />
        }
      />

      <div className="grid grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <OutputFGCard
              fgQty={kpi?.output.fgQty ?? 0}
              fgTrend={kpi?.output.fgTrend ?? null}
              noData={!kpi}
            />
            <OutputCountCard
              skuCount={kpi?.output.skuCount}
              poCount={kpi?.output.poCount}
              noData={!kpi}
            />
            <OutputPieCard title={t("output_pie_plant")} segments={plantSegs} noData={!kpi || metric !== "fg"} />
            <OutputPieCard title={t("output_pie_form")}  segments={formSegs}  noData={!kpi || metric !== "fg"} />
          </>
        )}
      </div>

      <div className="grid grid-cols-[3fr_2fr] gap-4">
        <TacticalOutputTrendChart filters={tacticalFilters} metric={metric} />
        <TopLineByOutputTable filters={tacticalFilters} metric={metric} />
      </div>
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
      {/* ── Sticky tab bar — minimal: text tabs on the page background, navy underline on the active one ── */}
      <div className="sticky top-0 z-20 bg-[#F7F8FA] border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-5 overflow-x-auto">
          {TABS.map((tab) => { const locked = "locked" in tab && tab.locked; return (
            <button
              key={tab.id}
              onClick={() => { if (!locked) scrollTo(tab.id); }}
              disabled={!!locked}
              aria-current={!locked && activeTab === tab.id ? "true" : undefined}
              title={locked ? "Coming soon — data not connected yet" : undefined}
              className={cn(
                "relative flex items-center gap-1.5 py-2 text-[12px] whitespace-nowrap transition-colors shrink-0 focus:outline-none focus-visible:text-[#1E4076]",
                locked
                  ? "text-slate-300 cursor-not-allowed"
                  : activeTab === tab.id
                    ? "text-slate-900 font-semibold"
                    : "text-slate-500 hover:text-slate-800"
              )}
            >
              {tab.label}
              {locked && (
                <span className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-slate-300">Soon</span>
              )}
              {!locked && activeTab === tab.id && (
                <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-[#1E4076] rounded-full" />
              )}
            </button>
          );})}
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">
        {/* No side padding: <main> already has px-5, so tabs, section titles and the filter fields line up (as on Strategic) */}
        <div className="flex flex-col gap-8 py-4">
          <section ref={setRef("leadtime")}>
            <LeadTimeSection {...props} />
          </section>
          <section ref={setRef("output")}>
            <OutputSection kpi={kpi} loading={loading} tacticalFilters={props.tacticalFilters} />
          </section>
          <section ref={setRef("productivity")}>
            <ProductivitySection kpi={kpi} loading={loading} />
          </section>
          <section ref={setRef("yield")}>
            <YieldSection />
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
        </div>
      </div>
    </div>
  );
}
