"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { FloatingChat } from "@/components/dashboard/FloatingChat";
import { cn } from "@/lib/utils";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsiveLine } from "@nivo/line";
import { Clock, AlertTriangle, Zap } from "lucide-react";
import { FitToScreen } from "@/components/ui/FitToScreen";
import { LiteKPICard } from "@/components/dashboard/LiteKPICard";
import { LeadTimeCategoryCard } from "@/components/dashboard/LeadTimeCategoryCard";
import { LeadTimeSkuScatter, type LeadTimeChartData } from "@/components/dashboard/LeadTimeCharts";
import { LeadTimeTrendChart } from "@/components/dashboard/LeadTimeTrendChart";
import { LeadTimeStageChart } from "@/components/dashboard/LeadTimeStageChart";
import { LeadTimeTopSkuChart } from "@/components/dashboard/LeadTimeTopSkuChart";
import { LineTooltip } from "@/components/charts/StandardLine";

// ── Constants ──────────────────────────────────────────────────────────────────

const VA_COLOR   = "#215AA8";
const NNVA_COLOR = "#d97706";
const UNVA_COLOR = "#b91c1c";

const nivoTheme = {
  background: "transparent",
  axis: {
    ticks: {
      line: { strokeWidth: 0 },
      text: { fill: "#9ca3af", fontSize: 10, fontFamily: "inherit" },
    },
    domain: { line: { strokeWidth: 0 } },
  },
  grid: { line: { stroke: "#f3f4f6", strokeWidth: 1 } },
  crosshair: { line: { stroke: "#215AA8", strokeWidth: 1, strokeOpacity: 0.3 } },
};

// ── Types ──────────────────────────────────────────────────────────────────────
type Persona   = "strategic" | "tactical" | "operational";
type StageView = "group" | "activity";
type ChartTab  = "gross" | "nett" | "pareto";

// ── Shared components ──────────────────────────────────────────────────────────

function ChartTitle({ label, badge }: { label: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between mb-1">
      <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-[0.08em] leading-none">{label}</span>
      {badge && (
        <span className="text-[10px] bg-[#D3DEEE] text-[#143665] px-2.5 py-0.5 rounded-full font-semibold">{badge}</span>
      )}
    </div>
  );
}

function SegmentedControl({ options, value, onChange }: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex bg-gray-100 border border-[#EBEBEB] rounded-lg p-0.5 gap-0.5">
      {options.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            "px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all",
            value === key ? "bg-[#215AA8] text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function VALegend() {
  return (
    <div className="flex flex-wrap gap-4">
      {([
        [VA_COLOR,   "VA (Value-added)"],
        [NNVA_COLOR, "NNVA (Necessary, non-value-added)"],
        [UNVA_COLOR, "UNVA (Waste)"],
      ] as [string, string][]).map(([c, l]) => (
        <div key={l} className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
          <span className="w-2.5 h-2.5 rounded-[2px] shrink-0" style={{ background: c }} />
          {l}
        </div>
      ))}
    </div>
  );
}

const LT_TONES = {
  on:      { color: "#067647", bg: "#f0fdf6", border: "#bbf0d2" },
  risk:    { color: "#b45309", bg: "#fffaeb", border: "#f0d58a" },
  off:     { color: "#d92d20", bg: "#fef4f3", border: "#fbd5d1" },
  neutral: { color: "#667085", bg: "#f8f9fb", border: "#e4e7ec" },
};

interface LTSummaryCardProps {
  icon: React.ReactNode;
  iconColor?: string;
  label: string;
  value: string;
  unit: string;
  trend?: string;
  trendColor?: string;
  supportLine?: React.ReactNode;
  tone: "on" | "risk" | "off" | "neutral";
  statusLabel: string;
  middle?: React.ReactNode;
  secondaryValue?: string;
  secondaryUnit?: string;
  secondaryLabel?: string;
  footerLeft: string;
  footerRight?: string;
}

function LTSummaryCard({
  icon,
  iconColor = "#8a90a0",
  label,
  value,
  unit,
  trend,
  trendColor = "#667085",
  supportLine,
  tone,
  statusLabel,
  middle,
  secondaryValue,
  secondaryUnit,
  secondaryLabel,
  footerLeft,
  footerRight,
}: LTSummaryCardProps) {
  const t = LT_TONES[tone];
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e9eaee",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        width: "100%",
        fontFamily: "Lato, sans-serif",
        height: "100%",
      }}
    >
      {/* Inner layout: accent bar + main content */}
      <div style={{ display: "flex", flex: 1 }}>
        {/* Left accent bar */}
        <div style={{ width: 6, background: t.color, flexShrink: 0 }} />

        {/* Main content */}
        <div
          style={{
            flex: 1,
            padding: "14px 16px 0",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {/* Eyebrow row */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: iconColor, display: "flex", alignItems: "center", flexShrink: 0 }}>{icon}</span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: "0.11em",
                color: "#8a90a0",
                fontFamily: "Lato, sans-serif",
                textTransform: "uppercase",
              }}
            >
              {label}
            </span>
          </div>

          {/* Primary value row */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: "-0.015em",
                color: "#101828",
                fontFamily: "Lato, sans-serif",
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
              }}
            >
              {value}
            </span>
            <span style={{ fontSize: 12, color: "#98a2b3", fontFamily: "Lato, sans-serif" }}>{unit}</span>
            {trend && (
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: trendColor,
                  fontFamily: "Lato, sans-serif",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {trend}
              </span>
            )}
          </div>

          {/* Supporting line */}
          {supportLine && (
            <div style={{ fontSize: 11, color: "#667085", fontFamily: "Lato, sans-serif" }}>
              {supportLine}
            </div>
          )}

          {/* Status pill */}
          <div>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                background: t.bg,
                border: `1px solid ${t.border}`,
                color: t.color,
                borderRadius: 5,
                padding: "2px 8px",
                fontFamily: "Lato, sans-serif",
                display: "inline-block",
              }}
            >
              {statusLabel}
            </span>
          </div>

          {/* Custom middle section */}
          {middle && <div>{middle}</div>}

          {/* Secondary metric row */}
          {secondaryValue !== undefined && (
            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: "1px solid #eceef2",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 12,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: "#101828",
                      fontFamily: "Lato, sans-serif",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {secondaryValue}
                  </span>
                  {secondaryUnit && (
                    <span style={{ fontSize: 11, color: "#98a2b3", fontFamily: "Lato, sans-serif" }}>
                      {secondaryUnit}
                    </span>
                  )}
                </div>
                {secondaryLabel && (
                  <div style={{ fontSize: 10.5, color: "#a3a8b5", fontFamily: "Lato, sans-serif" }}>
                    {secondaryLabel}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer bar */}
      <div
        style={{
          background: "#f6f7f9",
          borderTop: "1px solid #eceef2",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "7px 16px 7px 22px",
          borderRadius: "0 0 9px 9px",
        }}
      >
        <span style={{ fontSize: 11, color: "#667085", fontFamily: "Lato, sans-serif" }}>{footerLeft}</span>
        {footerRight && (
          <span style={{ fontSize: 10, color: "#a3a8b5", fontFamily: "Lato, sans-serif" }}>{footerRight}</span>
        )}
      </div>
    </div>
  );
}

// ── Static data ────────────────────────────────────────────────────────────────

const TOP_SKUS = [
  { rank: 1, name: "KAHF SKIN ENERGIZING AND BRIGHTENING FACE WASH 100ML",    vol: "6,432,675", lt: 12.65, ltRel: 5.13,  pct: 47, color: "#10b981" },
  { rank: 2, name: "OMG OH MY GLAM MATTELAST LIP CREAM 12 SCARLET 2.9G",      vol: "6,315,600", lt: 19.47, ltRel: 14.42, pct: 73, color: NNVA_COLOR },
  { rank: 3, name: "OMG OH MY GLAM MATTELAST LIP CREAM 15 ESPRESSO 2.9G",     vol: "5,873,568", lt: 23.98, ltRel: 15.30, pct: 90, color: UNVA_COLOR },
  { rank: 4, name: "OMG OH MY GLAM MATTELAST LIP CREAM 14 CAPPUCCINO 2.9G",   vol: "5,431,440", lt: 26.73, ltRel: 17.92, pct: 100, color: UNVA_COLOR },
  { rank: 5, name: "OMG OH MY GLAM MATTELAST LIP CREAM 13 LATTE 2.9G",        vol: "5,100,084", lt: 23.72, ltRel: 16.76, pct: 89, color: UNVA_COLOR },
];

const BOTTOM_SKUS = [
  { rank: 1, name: "WARDAH UV SHIELD BRIGHT-C HYDRATING SUNSCREEN SERUM SP",  vol: "3,447,164", lt: 16.06, ltRel: 10.87, pct: 60, color: UNVA_COLOR },
  { rank: 2, name: "EMINA SUN BATTLE SPF 35 PA+++ BRIGHT GLOW AMINO + VIT C", vol: "2,458,750", lt: 12.78, ltRel: 5.89,  pct: 48, color: NNVA_COLOR },
  { rank: 3, name: "EMINA BRIGHT STUFF NIACINAMIDE OXY CERAMIDE BRIGHTENING",  vol: "2,321,820", lt: 12.57, ltRel: 5.41,  pct: 47, color: NNVA_COLOR },
  { rank: 4, name: "KAHF TRIPLE ACTION OIL AND COMEDO DEFENSE FACE WASH 100",  vol: "2,184,495", lt: 13.19, ltRel: 6.07,  pct: 49, color: NNVA_COLOR },
  { rank: 5, name: "KAHF BRIGHTENING AND DARK SPOT SCRUB FACE WASH 100ML",     vol: "2,104,125", lt: 12.19, ltRel: 6.02,  pct: 46, color: NNVA_COLOR },
];

// ── Chart components ───────────────────────────────────────────────────────────

const STAGE_GROUP_DATA = [
  { stage: "PO & Approval", value: 6.62, color: UNVA_COLOR, cls: "UNVA" },
  { stage: "Produksi",       value: 2.84, color: VA_COLOR,   cls: "VA"   },
  { stage: "QC & NDC",       value: 0.60, color: NNVA_COLOR, cls: "NNVA" },
  { stage: "WIP Waiting",    value: 8.97, color: UNVA_COLOR, cls: "UNVA" },
];

const ACTIVITY_DATA = [
  { stage: "WIP-PO",     value: 4.20, color: UNVA_COLOR },
  { stage: "PO-Rel",     value: 2.42, color: UNVA_COLOR },
  { stage: "Scheduling", value: 1.60, color: NNVA_COLOR },
  { stage: "WIP-Kemas",  value: 2.80, color: UNVA_COLOR },
  { stage: "Timbang",    value: 0.35, color: VA_COLOR   },
  { stage: "Olah",       value: 0.61, color: VA_COLOR   },
  { stage: "Kemas 1",    value: 0.60, color: VA_COLOR   },
  { stage: "Kemas 2",    value: 1.36, color: VA_COLOR   },
  { stage: "QC Hold",    value: 3.80, color: UNVA_COLOR },
  { stage: "Lab Test",   value: 0.60, color: NNVA_COLOR },
  { stage: "Transport",  value: 0.50, color: NNVA_COLOR },
  { stage: "NDC-In",     value: 0.35, color: NNVA_COLOR },
];

function StageGroupChart() {
  const [view, setView] = useState<StageView>("group");
  const data = view === "group" ? STAGE_GROUP_DATA : ACTIVITY_DATA;

  return (
    <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-[0.08em] leading-none">Lead Time per Stage</span>
        <SegmentedControl
          options={[
            { key: "group",    label: "Per Stage Group" },
            { key: "activity", label: "Per Activity" },
          ]}
          value={view}
          onChange={(k) => setView(k as StageView)}
        />
      </div>
      <p className="text-[10.5px] text-slate-400 mb-2">YTD 2026 · All Plant · Median per stage in days</p>
      <VALegend />
      <div style={{ height: 200 }} className="mt-3">
        <ResponsiveBar
          data={data}
          keys={["value"]}
          indexBy="stage"
          theme={nivoTheme}
          margin={{ top: 4, right: 16, bottom: 32, left: 36 }}
          padding={view === "group" ? 0.48 : 0.36}
          borderRadius={4}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          colors={(bar: any) => String(bar.data.color)}
          colorBy="indexValue"
          axisBottom={{ tickSize: 0, tickPadding: 8 }}
          axisLeft={{
            tickSize: 0,
            tickPadding: 6,
            tickValues: 4,
            format: (v) => Number(v).toFixed(1),
          }}
          enableGridX={false}
          enableLabel={false}
          tooltip={({ indexValue, value, color }) => (
            <LineTooltip title={String(indexValue)} rows={[{ label: "Lead time", color: String(color), value: Number(value), unit: "days" }]} />
          )}
        />
      </div>
    </div>
  );
}

function SKUTable({ skus, title, variant }: {
  skus: typeof TOP_SKUS;
  title: string;
  variant: "top" | "bottom";
}) {
  return (
    <div className="bg-white rounded-lg border border-[#EBEBEB] overflow-hidden hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200">
      <div className="px-4 py-2.5 border-b border-[#EBEBEB] flex items-center gap-2">
        <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-[0.08em] leading-none">{title}</span>
        <span className={cn("text-[9.5px] font-bold px-2 py-0.5 rounded-full ml-auto",
          variant === "top" ? "bg-[#D3DEEE] text-[#143665]" : "bg-[#FFEDEF] text-[#8A0011]"
        )}>
          {variant === "top" ? "Highest Volume" : "Lowest Volume"}
        </span>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#F8FAFC]">
            <th className="text-[9.5px] font-bold text-slate-400 uppercase tracking-[0.06em] px-3 py-2 text-left w-6">#</th>
            <th className="text-[9.5px] font-bold text-slate-400 uppercase tracking-[0.06em] px-3 py-2 text-left">Product</th>
            <th className="text-[9.5px] font-bold text-slate-400 uppercase tracking-[0.06em] px-3 py-2 text-right">LT PO</th>
            <th className="text-[9.5px] font-bold text-slate-400 uppercase tracking-[0.06em] px-3 py-2 text-right">LT Rel</th>
          </tr>
        </thead>
        <tbody>
          {skus.map((sku) => (
            <tr key={sku.rank} className="border-t border-[#EBEBEB] hover:bg-[#F8FAFC] transition-colors">
              <td className="px-3 py-2">
                <span className={cn("w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold",
                  variant === "top" ? "bg-[#D3DEEE] text-[#143665]" : "bg-[#FFEDEF] text-[#8A0011]"
                )}>{sku.rank}</span>
              </td>
              <td className="px-3 py-2 max-w-[180px]">
                <p className="text-[10.5px] font-medium text-[#2A3D4A] truncate" title={sku.name}>{sku.name}</p>
                <p className="text-[9.5px] text-slate-400 tabular-nums mt-0.5">{sku.vol} pcs</p>
              </td>
              <td className="px-3 py-2 text-right">
                <span className="text-[11.5px] font-bold tabular-nums" style={{ color: sku.color }}>{sku.lt}</span>
                <div className="h-1 rounded-full bg-slate-100 overflow-hidden mt-1 w-10 ml-auto">
                  <div className="h-full rounded-full" style={{ width: `${sku.pct}%`, background: sku.color }} />
                </div>
              </td>
              <td className="px-3 py-2 text-right">
                <span className="text-[11.5px] font-bold tabular-nums" style={{
                  color: sku.ltRel <= 7 ? "#10b981" : sku.ltRel <= 12 ? NNVA_COLOR : UNVA_COLOR
                }}>{sku.ltRel}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OnTimePOTrend() {
  const raw = [
    { x: "Jan", y: 72 }, { x: "Feb", y: 68 }, { x: "Mar", y: 75 },
    { x: "Apr", y: 71 }, { x: "Mei", y: 78 }, { x: "Jun", y: 82 },
    { x: "Jul", y: 79 },
  ];
  const avg = Math.round(raw.reduce((s, d) => s + d.y, 0) / raw.length);
  const nivoData = useMemo(() => [{ id: "On-Time PO", color: VA_COLOR, data: raw }], []);  // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markers: any[] = useMemo(() => [{
    axis: "y", value: avg,
    lineStyle: { stroke: "#94a3b8", strokeDasharray: "5 3", strokeWidth: 1.5 },
    legend: `avg ${avg}%`,
    legendOffsetX: -8, legendOffsetY: -8,
    textStyle: { fill: "#94a3b8", fontSize: 9, fontFamily: "inherit" },
  }], [avg]);

  return (
    <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-[0.08em] leading-none">On-Time PO Trend</span>
        <span className="text-[10px] bg-[#D3DEEE] text-[#143665] px-2.5 py-0.5 rounded-full font-semibold">Monthly · 2026</span>
      </div>
      <p className="text-[10.5px] text-slate-400 mb-2">% of POs delivered on time vs NDC target · Average {avg}%</p>
      <div style={{ height: 180 }}>
        <ResponsiveLine
          data={nivoData}
          theme={nivoTheme}
          margin={{ top: 4, right: 16, bottom: 24, left: 36 }}
          xScale={{ type: "point" }}
          yScale={{ type: "linear", min: 60, max: 100 }}
          curve="monotoneX"
          axisBottom={{ tickSize: 0, tickPadding: 8 }}
          axisLeft={{
            tickSize: 0, tickPadding: 6, tickValues: 5,
            format: (v) => `${v}%`,
          }}
          gridYValues={5}
          enablePoints={true}
          pointSize={7}
          pointColor="white"
          pointBorderWidth={2}
          pointBorderColor={{ from: "serieColor" }}
          enableArea={true}
          areaOpacity={0.08}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          colors={(serie: any) => String(serie.color)}
          lineWidth={2.5}
          markers={markers}
          useMesh={true}
          enableCrosshair={false}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tooltip={({ point }: any) => (
            <LineTooltip title={String(point.data.x)} rows={[{ label: "On-time PO", color: String(point.seriesColor), value: `${Number(point.data.y).toFixed(0)}%` }]} />
          )}
        />
      </div>
    </div>
  );
}

const PARETO_RAW = [
  { name: "OMG LC 14",   lt: 26.73, color: UNVA_COLOR },
  { name: "OMG LC 15",   lt: 23.98, color: UNVA_COLOR },
  { name: "OMG LC 13",   lt: 23.72, color: UNVA_COLOR },
  { name: "OMG LC 12",   lt: 19.47, color: NNVA_COLOR },
  { name: "WARDAH UV",   lt: 16.06, color: NNVA_COLOR },
  { name: "KAHF Triple", lt: 13.19, color: "#10b981"  },
  { name: "EMINA SB35",  lt: 12.78, color: "#10b981"  },
  { name: "KAHF FW",     lt: 12.65, color: "#10b981"  },
  { name: "EMINA BN",    lt: 12.57, color: "#10b981"  },
  { name: "KAHF Scrub",  lt: 12.19, color: "#10b981"  },
];
const PARETO_TOTAL = PARETO_RAW.reduce((s, d) => s + d.lt, 0);
const PARETO_MAX   = PARETO_RAW[0].lt * 1.12;
const PARETO_DATA  = (() => {
  let c = 0;
  return PARETO_RAW.map((d) => {
    c += (d.lt / PARETO_TOTAL) * 100;
    return { ...d, cumPct: Math.round(c), cumNorm: (c / 100) * PARETO_MAX };
  });
})();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PARETO_MARKERS: any[] = [{
  axis: "y", value: 0.8 * PARETO_MAX,
  lineStyle: { stroke: "#94a3b8", strokeDasharray: "4 3", strokeWidth: 1.5 },
  legend: "80%", legendOffsetX: -8, legendOffsetY: -8,
  textStyle: { fill: "#94a3b8", fontSize: 9, fontFamily: "inherit" },
}];

function LTParetoSKU() {
  // Custom layer: cumulative % line using Nivo bar coordinates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CumulativeLine = useCallback((props: any) => {
    const { bars, yScale } = props;
    if (!bars || !yScale || bars.length === 0) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pts = bars.map((bar: any, i: number) => {
      const d = PARETO_DATA[i];
      if (!d || bar.x == null) return null;
      return { x: bar.x + bar.width / 2, y: yScale(d.cumNorm), pct: d.cumPct };
    }).filter(Boolean) as { x: number; y: number; pct: number }[];

    if (pts.length < 2) return null;
    const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    return (
      <g>
        <path d={pathD} fill="none" stroke="#f97316" strokeWidth="2" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="white" stroke="#f97316" strokeWidth="1.5" />
            {(i === 0 || i === 3 || i === 6 || i === 9) && (
              <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize="8" fill="#f97316" fontWeight="600">{p.pct}%</text>
            )}
          </g>
        ))}
      </g>
    );
  }, []);

  return (
    <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-[0.08em] leading-none">Lead Time Pareto per SKU</span>
        <span className="text-[10px] bg-[#D3DEEE] text-[#143665] px-2.5 py-0.5 rounded-full font-semibold">Top 10 · YTD 2026</span>
      </div>
      <p className="text-[10.5px] text-slate-400 mb-2">SKUs sorted by highest lead time · Orange line = cumulative %</p>
      <div style={{ height: 200 }}>
        <ResponsiveBar
          data={PARETO_DATA}
          keys={["lt"]}
          indexBy="name"
          theme={nivoTheme}
          margin={{ top: 16, right: 16, bottom: 32, left: 36 }}
          padding={0.36}
          borderRadius={3}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          colors={(bar: any) => String(bar.data.color)}
          colorBy="indexValue"
          axisBottom={{ tickSize: 0, tickPadding: 8 }}
          axisLeft={{
            tickSize: 0, tickPadding: 6, tickValues: 4,
            format: (v) => `${Number(v).toFixed(0)}d`,
          }}
          enableGridX={false}
          enableLabel={false}
          markers={PARETO_MARKERS}
          layers={["grid", "axes", "bars", CumulativeLine, "markers"]}
          tooltip={({ indexValue, value, color }) => (
            <LineTooltip title={String(indexValue)} rows={[{ label: "Lead time", color: String(color), value: Number(value), unit: "days" }]} />
          )}
        />
      </div>
      <div className="flex flex-wrap gap-4 mt-1">
        {([
          [UNVA_COLOR, "UNVA (>20 days)"],
          [NNVA_COLOR, "NNVA (13–20 days)"],
          ["#10b981",  "On Target (<13 days)"],
          ["#f97316",  "Kumulatif %"],
        ] as [string, string][]).map(([c, l]) => (
          <div key={l} className="flex items-center gap-1.5 text-[10px] text-slate-500">
            {l.includes("Kumulatif")
              ? <span className="w-4 h-0.5 rounded-full inline-block" style={{ background: c }} />
              : <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: c }} />
            }
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TACTICAL VIEW ─────────────────────────────────────────────────────────────

function TacticalView() {
  const [chartTab, setChartTab] = useState<ChartTab>("gross");

  return (
    <div className="flex flex-col gap-0 pt-5">
      {/* KPI Cards: PO Created | PO Released | VA | UNVA */}
      <div className="grid grid-cols-4 gap-3.5 px-5 mb-4">
        <LTSummaryCard
          icon={<Clock size={13} />}
          iconColor="#d97706"
          label="PO CREATED → NDC"
          value="16.67"
          unit="days"
          trend="+3.67d"
          trendColor="#d92d20"
          supportLine="Gross time, all stages"
          tone="off"
          statusLabel="Above Target"
          secondaryValue="13.0"
          secondaryUnit="days"
          secondaryLabel="Standard target"
          footerLeft="Gross lead time · all stages"
          footerRight="+3.67 days over target"
        />
        <LTSummaryCard
          icon={<Clock size={13} />}
          iconColor="#10b981"
          label="PO RELEASED → NDC"
          value="7.00"
          unit="days"
          trend="+0.50d"
          trendColor="#d92d20"
          supportLine="Alternative basis — independent from PO Created metric"
          tone="risk"
          statusLabel="Slightly Over"
          secondaryValue="6.5"
          secondaryUnit="days"
          secondaryLabel="Standard target"
          footerLeft="From PO release to NDC receiving"
          footerRight="+0.50 days over target"
        />
        <LTSummaryCard
          icon={<Zap size={13} />}
          iconColor="#215AA8"
          label="VA — PROCESS TIME"
          value="11.14"
          unit="days"
          supportLine="Stages that directly add product value"
          tone="neutral"
          statusLabel="Value-Added Stages"
          secondaryValue="8.22"
          secondaryUnit="days"
          secondaryLabel="NNVA (necessary, non-value-added)"
          footerLeft="Pure production processing time"
          footerRight="NNVA adds 8.22d"
        />
        <LTSummaryCard
          icon={<AlertTriangle size={13} />}
          iconColor="#b91c1c"
          label="UNVA — WIP WAITING"
          value="30.14"
          unit="days"
          supportLine="Accumulated WIP waiting across all stages"
          tone="off"
          statusLabel="Largest Waste Pool"
          middle={
            <div
              style={{
                borderLeft: "2px solid #fbd5d1",
                background: "#fef4f3",
                borderRadius: "0 5px 5px 0",
                padding: "7px 10px",
                fontSize: 11.5,
                fontFamily: "Lato, sans-serif",
                color: "#667085",
              }}
            >
              Primary improvement target — eliminate WIP delays to unlock 3.67 days savings
            </div>
          }
          footerLeft="Total accumulated WIP waiting"
          footerRight="Improvement priority"
        />
      </div>

      {/* Stage chart */}
      <div className="px-5 mb-4">
        <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-[0.08em] leading-none">Lead Time per Stage</span>
              <p className="text-[10.5px] text-slate-400 mt-0.5">45 stage · klasifikasi VA / NNVA / UNVA</p>
            </div>
            <SegmentedControl
              options={[
                { key: "gross",  label: "Gross Time" },
                { key: "nett",   label: "Nett Time" },
                { key: "pareto", label: "Pareto Gap" },
              ]}
              value={chartTab}
              onChange={(k) => setChartTab(k as ChartTab)}
            />
          </div>
          <VALegend />
          <div style={{ height: 210 }} className="mt-3">
            <ResponsiveBar
              data={[
                { stage: "WIP-PO",      value: 5.6,  color: UNVA_COLOR },
                { stage: "QC Hold",     value: 4.8,  color: UNVA_COLOR },
                { stage: "PO-Rel",      value: 3.9,  color: UNVA_COLOR },
                { stage: "Sched",       value: 3.1,  color: UNVA_COLOR },
                { stage: "WIP-Kemas",   value: 2.5,  color: UNVA_COLOR },
                { stage: "Timbang",     value: 2.1,  color: UNVA_COLOR },
                { stage: "Transport",   value: 1.7,  color: UNVA_COLOR },
                { stage: "GR-Delay",    value: 1.4,  color: UNVA_COLOR },
                { stage: "Inspect",     value: 2.0,  color: NNVA_COLOR },
                { stage: "Lab Test",    value: 1.7,  color: NNVA_COLOR },
                { stage: "NDC-In",      value: 1.5,  color: NNVA_COLOR },
                { stage: "Release",     value: 1.3,  color: NNVA_COLOR },
                { stage: "Quarantine",  value: 1.1,  color: NNVA_COLOR },
                { stage: "Sampling",    value: 0.9,  color: NNVA_COLOR },
                { stage: "Olah",        value: 1.4,  color: VA_COLOR   },
                { stage: "Kemas",       value: 1.2,  color: VA_COLOR   },
                { stage: "Kemas 2",     value: 1.0,  color: VA_COLOR   },
                { stage: "NDC-QC",      value: 0.8,  color: VA_COLOR   },
                { stage: "Dispensing",  value: 0.7,  color: VA_COLOR   },
                { stage: "IPC",         value: 0.5,  color: VA_COLOR   },
              ]}
              keys={["value"]}
              indexBy="stage"
              theme={nivoTheme}
              margin={{ top: 4, right: 16, bottom: 36, left: 36 }}
              padding={0.3}
              borderRadius={3}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              colors={(bar: any) => String(bar.data.color)}
              colorBy="indexValue"
              axisBottom={{ tickSize: 0, tickPadding: 8, tickRotation: -30 }}
              axisLeft={{
                tickSize: 0, tickPadding: 6, tickValues: 4,
                format: (v) => Number(v).toFixed(1),
              }}
              enableGridX={false}
              enableLabel={false}
              tooltip={({ indexValue, value, color }) => (
                <LineTooltip title={String(indexValue)} rows={[{ label: "Lead time", color: String(color), value: Number(value), unit: "days" }]} />
              )}
            />
          </div>
        </div>
      </div>

      {/* Trend line chart */}
      <div className="px-5 pb-5">
        <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-[0.08em] leading-none">Lead Time Stages Trend</span>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {([
                [VA_COLOR,   "VA (PO)"],
                [UNVA_COLOR, "UNVA (WIP Rework)"],
                ["#22c55e",  "Filling 2"],
                [NNVA_COLOR, "NNVA (Manpack)"],
              ] as [string, string][]).map(([c, l]) => (
                <div key={l} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className="w-4 h-0.5 rounded-sm inline-block" style={{ background: c }} />{l}
                </div>
              ))}
            </div>
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveLine
              data={[
                { id: "VA (PO)",        color: VA_COLOR,   data: [
                  {x:"W2",y:2.2},{x:"W4",y:2.8},{x:"W6",y:2.2},{x:"W8",y:3.7},{x:"W10",y:2.7},
                  {x:"W12",y:3.3},{x:"W14",y:5.8},{x:"W16",y:2.8},{x:"W18",y:6.7},{x:"W20",y:6.1},
                  {x:"W22",y:3.4},{x:"W24",y:3.1},{x:"W26",y:3.4},{x:"W28",y:3.6},
                ]},
                { id: "UNVA (WIP Rework)", color: UNVA_COLOR, data: [
                  {x:"W2",y:5.6},{x:"W4",y:6.0},{x:"W6",y:5.3},{x:"W8",y:4.6},{x:"W10",y:4.9},
                  {x:"W12",y:4.2},{x:"W14",y:4.6},{x:"W16",y:4.7},{x:"W18",y:3.9},{x:"W20",y:3.6},
                  {x:"W22",y:2.7},{x:"W24",y:2.6},{x:"W26",y:3.0},{x:"W28",y:6.4},
                ]},
                { id: "Filling 2",      color: "#22c55e",  data: [
                  {x:"W2",y:0.1},{x:"W4",y:0.1},{x:"W6",y:0.1},{x:"W8",y:0.1},{x:"W10",y:0.1},
                  {x:"W12",y:0.1},{x:"W14",y:0.1},{x:"W16",y:0.1},{x:"W18",y:0.1},{x:"W20",y:0.1},
                  {x:"W22",y:0.1},{x:"W24",y:0.1},{x:"W26",y:0.1},{x:"W28",y:0.1},
                ]},
                { id: "NNVA (Manpack)", color: NNVA_COLOR, data: [
                  {x:"W2",y:0.8},{x:"W4",y:0.7},{x:"W6",y:0.8},{x:"W8",y:0.7},{x:"W10",y:0.8},
                  {x:"W12",y:0.7},{x:"W14",y:0.8},{x:"W16",y:0.7},{x:"W18",y:0.8},{x:"W20",y:0.7},
                  {x:"W22",y:0.8},{x:"W24",y:0.7},{x:"W26",y:0.8},{x:"W28",y:0.8},
                ]},
              ]}
              theme={nivoTheme}
              margin={{ top: 4, right: 16, bottom: 24, left: 36 }}
              xScale={{ type: "point" }}
              yScale={{ type: "linear", min: "auto", max: "auto", stacked: false }}
              curve="linear"
              axisBottom={{ tickSize: 0, tickPadding: 8 }}
              axisLeft={{
                tickSize: 0, tickPadding: 6, tickValues: 5,
                format: (v) => Number(v).toFixed(1),
              }}
              gridYValues={5}
              enablePoints={false}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              colors={(serie: any) => String(serie.color)}
              lineWidth={2.5}
              useMesh={true}
              crosshairType="x"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              markers={[{
                axis: "y", value: 5,
                lineStyle: { stroke: "#9ca3af", strokeDasharray: "5 3", strokeWidth: 1.5 },
                legend: "Avg Standard",
                legendOffsetX: -8, legendOffsetY: -8,
                textStyle: { fill: "#9ca3af", fontSize: 9, fontFamily: "inherit" },
              }] as any}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              tooltip={({ point }: any) => (
                <LineTooltip title={String(point.data.x)} rows={[{ label: String(point.seriesId), color: String(point.seriesColor), value: Number(point.data.y), unit: "days" }]} />
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Lead Time Strategic card ─────────────────────────────────────────────────

const LT_CARD_TARGET = 13;

interface LeadTimeKPI {
  grossDays: number;
  grossTrend: number | null;
  sparkline: number[];
  composition?: {
    vaDays: number; nnvaDays: number; unvaDays: number; wipDays: number;
    vaPrev: number; nnvaPrev: number; unvaPrev: number; wipPrev: number;
    vaTrend: number | null; nnvaTrend: number | null; unvaTrend: number | null; wipTrend: number | null;
    vaMonthly: number[]; nnvaMonthly: number[]; unvaMonthly: number[]; wipMonthly: number[];
  };
}


type LeadTimeFilters = { plant: string; startDate: string; endDate: string; period: string };

// Matches Header's initial state (All Plant · YTD) so the cards always reflect what the filter row shows.
const DEFAULT_LT_FILTERS: LeadTimeFilters = {
  plant:     "All Plant",
  startDate: `${new Date().getFullYear()}-01-01`,
  endDate:   new Date().toISOString().split("T")[0],
  period:    "YTD",
};

// Same source as the Overview Lead Time card (/api/dashboard/kpi → CT_MANUF_LEADTIME, date = PO_FG_DONE_DATE).
function useLeadTimeKPI(filters: LeadTimeFilters, refreshKey: number) {
  const [lt, setLt] = useState<LeadTimeKPI | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLt(null);
    const params = new URLSearchParams(filters);
    fetch(`/api/dashboard/kpi?${params}`)
      .then((r) => r.json())
      .then((res) => { if (!cancelled && res?.leadTime) setLt(res.leadTime); })
      .catch(() => { /* cards fall back to No Data */ });
    return () => { cancelled = true; };
  }, [filters, refreshKey]);
  return lt;
}

// Trend per POSITION + SKU scatter (/api/lead-time/charts → CT_MANUF_LEADTIME)
function useLeadTimeCharts(filters: LeadTimeFilters, refreshKey: number) {
  const [data, setData]       = useState<LeadTimeChartData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setLoading(true);
    fetch(`/api/lead-time/charts?${new URLSearchParams(filters)}`)
      .then((r) => r.json())
      .then((res) => { if (!cancelled && res?.trend) setData(res); })
      .catch(() => { /* charts show empty state */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters, refreshKey]);
  return { data, loading };
}

function StrategicView({ filters, refreshKey }: { filters: LeadTimeFilters; refreshKey: number }) {
  const charts = useLeadTimeCharts(filters, refreshKey);
  const lt   = useLeadTimeKPI(filters, refreshKey);
  const comp = lt?.composition;
  // Share of VA + NNVA + Waste (activities overlap, so this is not a share of gross lead time)
  const compTotal = comp ? comp.vaDays + comp.nnvaDays + comp.unvaDays : 0;
  const share = (days?: number) => (compTotal > 0 && days ? Math.round((days / compTotal) * 100) : 0);
  return (
    <div className="flex flex-col gap-0 pt-5">
      {/* 5 KPI cards — CT_MANUF_LEADTIME via /api/dashboard/kpi.
          VA / NNVA / Waste / Potential Saving use LeadTimeCategoryCard — fixed color, no status rules; sparkline = monthly avg. */}
      <div className="grid grid-cols-5 gap-3.5 px-5 mb-4">
        <LiteKPICard
          label="Lead Time"
          icon={<Clock size={13} color="#d97706" strokeWidth={1.75} />}
          value={lt ? lt.grossDays.toFixed(1) : "—"}
          unit="days"
          target={`≤ ${LT_CARD_TARGET} days`}
          attainment={lt && lt.grossDays > 0 ? (LT_CARD_TARGET / lt.grossDays) * 100 : 0}
          trend={lt?.grossTrend ?? null}
          series={lt?.sparkline ?? []}
          noData={!lt}
        />
        <LeadTimeCategoryCard
          category="va"
          label="Value-Added"
          value={comp ? comp.vaDays.toFixed(1) : "—"}
          unit="days"
          context={`${share(comp?.vaDays)}% of total`}
          description="Occurs in Weighing, Processing, and Filling & Packing"
          info="Average per PO: SUM(NET_LEADTIME) of activities with ACTIVITY_CATEGORY = VA"
          trend={comp?.vaTrend ?? null}
          series={comp?.vaMonthly ?? []}
          noData={!comp}
        />
        <LeadTimeCategoryCard
          category="nnva"
          label="Necessary Non-Value-Added"
          value={comp ? comp.nnvaDays.toFixed(1) : "—"}
          unit="days"
          context={`${share(comp?.nnvaDays)}% of total`}
          description="Occurs in PO, cleaning, unboxing, and NDC receiving"
          info="Average per PO: SUM(NET_LEADTIME) of activities with ACTIVITY_CATEGORY = NNVA"
          trend={comp?.nnvaTrend ?? null}
          series={comp?.nnvaMonthly ?? []}
          noData={!comp}
        />
        <LeadTimeCategoryCard
          category="waste"
          label="Waste"
          value={comp ? comp.unvaDays.toFixed(1) : "—"}
          unit="days"
          context={`${share(comp?.unvaDays)}% of total`}
          description="Made up of WIP and waiting time"
          info="Average per PO: SUM(NET_LEADTIME) of activities with ACTIVITY_CATEGORY = UNVA"
          trend={comp?.unvaTrend ?? null}
          series={comp?.unvaMonthly ?? []}
          noData={!comp}
        />
        <LeadTimeCategoryCard
          category="saving"
          label="Potential Saving"
          value={comp ? comp.wipDays.toFixed(1) : "—"}
          unit="days"
          context={`${comp && comp.unvaDays > 0 ? Math.round((comp.wipDays / comp.unvaDays) * 100) : 0}% of Waste is WIP`}
          description="Assuming all WIP can be eliminated"
          info="Average per PO: SUM(NET_LEADTIME) of UNVA activities with ACTIVITY_TYPE = WIP"
          trend={comp?.wipTrend ?? null}
          series={comp?.wipMonthly ?? []}
          noData={!comp}
        />
      </div>

      {/* Lead time trend (overall + per POSITION) and SKU scatter */}
      <div className="grid grid-cols-2 gap-3.5 px-5 mb-4">
        <LeadTimeTrendChart data={charts.data} loading={charts.loading} />
        <LeadTimeSkuScatter data={charts.data} loading={charts.loading} />
      </div>

      {/* Lead time per stage — Pareto, real data (replaces the mock StageGroupChart, whose code is kept but no longer rendered) */}
      <div className="px-5 mb-4">
        <LeadTimeStageChart data={charts.data} loading={charts.loading} />
      </div>

      {/* Top 10 SKU by lead time — composition / P10–P90 range, real data */}
      <div className="px-5 pb-5">
        <LeadTimeTopSkuChart data={charts.data} loading={charts.loading} />
      </div>

      {/* Mock SKU tables, On-Time PO Trend and SKU Pareto removed from Strategic (no real data yet); components kept below for reuse */}
    </div>
  );
}

// ── OPERATIONAL VIEW ──────────────────────────────────────────────────────────

function OperationalView() {
  const exceptions = [
    { batch: "#BT-20260913-042", stage: "WIP Waiting",   msg: "8.4 days in WIP before Packing. Standard max 4 days.", meta: "Plant 1 · Bulk Line A · Delay 4.4 days",    severity: "critical" as const },
    { batch: "#BT-20260911-018", stage: "QC Hold",       msg: "QC Hold 5.2 days — waiting for stability test lab results.", meta: "Plant 2 · Lab QC · Delay 2.2 days",         severity: "critical" as const },
    { batch: "#BT-20260910-055", stage: "PO Released",   msg: "PO document approval at 3.1 days. Approaching limit 3.5 days.", meta: "Plant 1 · Procurement · 0.4 days left",    severity: "warning" as const },
    { batch: "#BT-20260912-031", stage: "NDC-In",        msg: "NDC receiving at 2.8 days. Approaching limit 3 days.", meta: "NDC Cikarang · Receiving · 0.2 days left",  severity: "warning" as const },
  ];

  return (
    <div className="flex flex-col gap-0 pt-5">
      <div className="grid grid-cols-2 gap-3.5 px-5 pb-5">
        {/* Exceptions */}
        <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-[0.08em] leading-none">Exceptions Aktif</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#E6001C] animate-pulse ml-1" />
          </div>
          <div className="flex flex-col gap-2">
            {exceptions.map((ex) => (
              <div
                key={ex.batch}
                className={cn(
                  "flex gap-3 p-3 rounded-lg border-l-4",
                  ex.severity === "critical"
                    ? "bg-[#FFEDEF] border-l-[#E6001C]"
                    : "bg-[#FFFBE4] border-l-[#D1A400]"
                )}
              >
                <div className="min-w-0">
                  <p className="text-[11.5px] font-bold text-[#2A3D4A]">{ex.batch} · {ex.stage}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{ex.msg}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{ex.meta}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Heatmap */}
        <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200">
          <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-[0.08em] leading-none">Lead Time Stage Harian</span>
          <p className="text-[10.5px] text-slate-400 mb-3 mt-0.5">Average lead time per stage · last 7 days · working days</p>
          <svg viewBox="0 0 360 220" style={{ width: "100%" }} fontFamily="inherit">
            {["WIP-PO","QC Hold","PO-Release","Scheduling","Transport","NDC-In"].map((stage, i) => (
              <text key={stage} x="78" y={28 + i * 28} textAnchor="end" fontSize="9.5" fill="#374151">{stage}</text>
            ))}
            {["8 Sep","9 Sep","10 Sep","11 Sep","12 Sep","13 Sep"].map((d, i) => (
              <text key={d} x={108 + i * 40} y="195" textAnchor="middle" fontSize="9" fill="#9ca3af">{d}</text>
            ))}
            {[
              ["#fca5a5","#f87171","#fca5a5","#fecaca","#f87171","#fca5a5"],
              ["#fed7aa","#fef3c7","#fed7aa","#fef3c7","#fde68a","#fed7aa"],
              ["#fde68a","#d1fae5","#fde68a","#d1fae5","#d1fae5","#fde68a"],
              ["#d1fae5","#d1fae5","#d1fae5","#d1fae5","#d1fae5","#d1fae5"],
              ["#d1fae5","#d1fae5","#fde68a","#d1fae5","#d1fae5","#d1fae5"],
              ["#d1fae5","#d1fae5","#d1fae5","#fde68a","#d1fae5","#fde68a"],
            ].map((row, ri) =>
              row.map((fill, ci) => (
                <g key={`${ri}-${ci}`}>
                  <rect x={85 + ci * 40} y={13 + ri * 28} width="38" height="22" fill={fill} rx="3" />
                  <text x={104 + ci * 40} y={28 + ri * 28} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600">
                    {[[8.1,8.4,7.9,7.6,8.4,8.1],[5.1,4.6,5.3,4.4,4.8,5.2],[3.2,2.8,3.1,2.9,2.7,3.1],[1.8,1.7,1.9,1.6,1.8,1.7],[0.8,0.9,1.2,0.8,0.9,0.7],[2.6,2.4,2.7,2.9,2.5,2.8]][ri][ci]}
                  </text>
                </g>
              ))
            )}
            <rect x="85" y="208" width="10" height="7" fill="#fca5a5" rx="1" /><text x="98" y="215" fontSize="8" fill="#64748b">Critical</text>
            <rect x="140" y="208" width="10" height="7" fill="#fde68a" rx="1" /><text x="153" y="215" fontSize="8" fill="#64748b">Warning</text>
            <rect x="200" y="208" width="10" height="7" fill="#d1fae5" rx="1" /><text x="213" y="215" fontSize="8" fill="#64748b">Normal</text>
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const LEAD_TIME_VIEWS = [
  { key: "strategic",   label: "Strategic" },
  { key: "tactical",    label: "Tactical" },
  { key: "operational", label: "Operational" },
];

export default function LeadTimePage() {
  const { status } = useSession();
  const router = useRouter();
  const [persona,       setPersona]     = useState<Persona>("strategic");
  const [lastUpdated,   setLastUpdated] = useState<Date>();
  const [filters,       setFilters]     = useState<LeadTimeFilters>(DEFAULT_LT_FILTERS);
  const [plants,        setPlants]      = useState<string[]>(["All Plant"]);
  const [refreshKey,    setRefreshKey]  = useState(0);

  // Plant values come from the same list as Overview (J1/J2/J4/J6 — identical to CT_MANUF_LEADTIME.PLANT)
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/dashboard/plants")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d?.plants)) setPlants(d.plants); })
      .catch(() => { /* keep All Plant */ });
  }, [status]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((n) => n + 1);
    setLastUpdated(new Date());
  }, []);
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    setLastUpdated(new Date());
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F6F9]">
        <div className="w-6 h-6 border-2 border-[#215AA8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F6F9]">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          plants={plants}
          onFilterChange={({ plant, startDate, endDate, period }) => {
            setFilters({ plant, startDate, endDate, period });
            setLastUpdated(new Date());
          }}
          views={LEAD_TIME_VIEWS}
          activeView={persona}
          onViewChange={(v) => setPersona(v as Persona)}
          onRefresh={handleRefresh}
          isLoading={false}
          lastUpdated={lastUpdated}
          alertCount={0}
          alerts={[]}
          onMonitorMode={() => router.push("/monitor?page=lead-time")}
        />

        <div className="flex-1 overflow-y-auto min-h-0">
          {persona === "strategic"   && <StrategicView filters={filters} refreshKey={refreshKey} />}
          {persona === "tactical"    && <TacticalView />}
          {persona === "operational" && <OperationalView />}
        </div>
      </div>

      <FloatingChat />
    </div>
  );
}
