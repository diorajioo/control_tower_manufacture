"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/ui/StatusDot";
import { LeadTimePlantTable, type PlantBreakdown } from "@/components/dashboard/LeadTimePlantTable";
import { LeadTimeStageStdChart, type StageStdPoint } from "@/components/dashboard/LeadTimeStageStdChart";
import { LEAD_TIME_TARGET_DAYS } from "@/lib/leadTimeDefinition";

// ── Types ─────────────────────────────────────────────────────────────────────

interface KPI {
  leadTime: {
    grossDays: number; nettDays: number;
    grossTrend: number | null; nettTrend: number | null;
    sparkline: number[];
    composition?: {
      vaDays: number; nnvaDays: number; unvaDays: number; wipDays: number;
      nnvaTrend: number | null; wipTrend: number | null;
      nnvaMonthly: number[]; wipMonthly: number[];
    };
  };
  output: { fgQty: number; bulkQty: number; fgTrend: number | null; bulkTrend: number | null; sparkline: number[]; bulkSparkline: number[] };
  productivity: {
    e2e: number; e2eTrend?: number | null; sparkline: number[];
    stages?: Record<"mixing" | "filpac", { value: number; trend: number | null; sparkline: number[] }>;
  };
  oee: { value: number; quality: number; performance: number; trend: number | null; sparkline: number[] };
  yield: { bulkLossPct: number; packLossPct: number; bulkLossTrend: number | null; packLossTrend: number | null };
}

interface TacticalViewProps {
  kpi: KPI | null;
  loading: boolean;
  plantLT: { plants: PlantBreakdown[]; targetDays: number } | null;
  stageStd: StageStdPoint[];
  stageLoading: boolean;
  ltBasis: "created" | "released";
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
  /** Pass grossDays to use lead-time target-based tone ("On Track"/"At Risk"/"Above Target") */
  ltDays?: number;
  footerLeft?: string;
  noData?: boolean;
}

function TKpiCard({
  label, value, unit, trend = null, inverse = false,
  sparkline, ltDays, footerLeft, noData = false,
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
      overflow: "hidden",
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
              {!noData && trend !== null && (
                <span style={{
                  fontSize: 11.5, fontWeight: 700,
                  color: trendGood ? "#067647" : "#d92d20",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {isUp ? "↗" : "↘"} {(trend > 0 ? "+" : "") + trend.toFixed(1)}%
                </span>
              )}
            </div>

            <div style={{ fontSize: 11, color: "#98a2b3" }}>
              {ltDays !== undefined
                ? `vs ${LEAD_TIME_TARGET_DAYS}-day target`
                : trend !== null ? "vs prior period" : ""}
            </div>

            <StatusDot color={tone.color} label={statusLabel} />
          </div>

          {/* Sparkline */}
          {hasSpark && (
            <div style={{ paddingTop: 4 }}>
              <Spark data={sparkline!} />
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 10 }} />

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

function LeadTimeSection({ kpi, loading, plantLT, stageStd, stageLoading, ltBasis }: TacticalViewProps) {
  const c = kpi?.leadTime.composition;
  return (
    <div className="flex flex-col gap-4">
      <SectionHeading title="Lead Time" />

      <div className="grid grid-cols-5 gap-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <TKpiCard
              label="Lead Time"
              value={kpi ? kpi.leadTime.grossDays.toFixed(2) : null}
              unit="days"
              trend={kpi?.leadTime.grossTrend ?? null}
              inverse
              sparkline={kpi?.leadTime.sparkline}
              ltDays={kpi?.leadTime.grossDays}
              footerLeft="End-to-end gross"
              noData={!kpi}
            />
            <TKpiCard
              label="VA"
              value={c ? c.vaDays.toFixed(2) : null}
              unit="days"
              footerLeft="Value-added"
              noData={!kpi}
            />
            <TKpiCard
              label="NNVA"
              value={c ? c.nnvaDays.toFixed(2) : null}
              unit="days"
              trend={c?.nnvaTrend ?? null}
              inverse
              sparkline={c?.nnvaMonthly}
              footerLeft="Non-value-added"
              noData={!kpi}
            />
            <TKpiCard
              label="UNVA"
              value={c ? c.unvaDays.toFixed(2) : null}
              unit="days"
              footerLeft="Unnecessary NVA"
              noData={!kpi}
            />
            <TKpiCard
              label="WIP"
              value={c ? c.wipDays.toFixed(2) : null}
              unit="days"
              trend={c?.wipTrend ?? null}
              inverse
              sparkline={c?.wipMonthly}
              footerLeft="Work in progress"
              noData={!kpi}
            />
          </>
        )}
      </div>

      <div className="rounded-lg border border-[#EBEBEB] bg-white p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-3">Pareto Lead Time</p>
        <LeadTimeStageStdChart data={stageStd} loading={stageLoading} />
      </div>

      <ChartPlaceholder
        title="Lead Time Distribution per PO"
        subtitle="Histogram of end-to-end gross lead time (days)"
        height={200}
      />

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
              sparkline={mixing?.sparkline}
              footerLeft="Mixing stage"
              noData={!kpi || !mixing}
            />
            <TKpiCard
              label="Productivity Filpac"
              value={filpac ? filpac.value.toFixed(2) : null}
              unit="pcs/manhour"
              trend={filpac?.trend ?? null}
              sparkline={filpac?.sparkline}
              footerLeft="Filling & packing"
              noData={!kpi || !filpac}
            />
            <TKpiCard
              label="Productivity E2E"
              value={kpi ? kpi.productivity.e2e.toFixed(2) : null}
              unit="pcs/manhour"
              trend={kpi?.productivity.e2eTrend ?? null}
              sparkline={kpi?.productivity.sparkline}
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
              sparkline={kpi?.output.sparkline}
              footerLeft="Finished goods"
              noData={!kpi}
            />
            <TKpiCard
              label="Bulk Output"
              value={kpi ? (kpi.output.bulkQty / 1_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null}
              unit="thousand kg"
              trend={kpi?.output.bulkTrend ?? null}
              sparkline={kpi?.output.bulkSparkline}
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
