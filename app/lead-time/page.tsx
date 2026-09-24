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
import { Clock, BarChart3, TrendingDown, AlertTriangle, Zap } from "lucide-react";
import { FitToScreen } from "@/components/ui/FitToScreen";

// ── Constants ──────────────────────────────────────────────────────────────────
// 38 weeks YTD (W1–W38, Jan 1 – Sep 24 2026)
const GROSS_LT_SPARKLINE  = [13.5, 13.8, 14.0, 14.2, 14.1, 14.3, 14.5, 14.8, 14.6, 15.0, 15.1, 14.9, 15.2, 15.5, 15.3, 15.6, 15.8, 16.0, 15.7, 15.9, 16.1, 16.2, 16.0, 16.3, 16.4, 16.2, 16.5, 16.3, 16.4, 16.5, 16.4, 16.6, 16.5, 16.3, 16.5, 16.4, 16.6, 16.67];
const WASTE_SPARKLINE     = [56, 57, 58, 59, 58, 60, 61, 62, 61, 63, 62, 64, 63, 62, 63, 64, 63, 65, 64, 63, 64, 65, 63, 64, 64, 65, 64, 63, 64, 65, 64, 65, 64, 63, 65, 64, 65, 64];
const SAVINGS_SPARKLINE   = [4.8, 4.6, 4.5, 4.4, 4.5, 4.3, 4.4, 4.2, 4.3, 4.1, 4.2, 4.0, 4.1, 3.9, 4.0, 3.9, 3.8, 3.9, 3.8, 3.7, 3.8, 3.7, 3.8, 3.7, 3.6, 3.7, 3.7, 3.8, 3.7, 3.6, 3.7, 3.6, 3.7, 3.8, 3.7, 3.7, 3.6, 3.67];
const NETT_LT_SPARKLINE   = [7.8, 7.6, 7.7, 7.5, 7.6, 7.5, 7.4, 7.5, 7.3, 7.4, 7.4, 7.3, 7.2, 7.4, 7.3, 7.2, 7.3, 7.1, 7.2, 7.1, 7.2, 7.0, 7.1, 7.0, 7.1, 7.0, 7.1, 6.9, 7.0, 7.1, 7.0, 6.9, 7.0, 7.1, 7.0, 6.9, 7.0, 7.0];

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
      <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.08em] leading-none">{label}</span>
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
        [NNVA_COLOR, "NNVA (Perlu, tidak tambah nilai)"],
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
        <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.08em] leading-none">Lead Time per Stage</span>
        <SegmentedControl
          options={[
            { key: "group",    label: "Per Stage Group" },
            { key: "activity", label: "Per Activity" },
          ]}
          value={view}
          onChange={(k) => setView(k as StageView)}
        />
      </div>
      <p className="text-[10.5px] text-slate-400 mb-2">YTD 2026 · All Plant · Median per stage dalam hari</p>
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
            <div style={{
              background: "#2A3D4A", borderRadius: 10, padding: "8px 13px",
              fontSize: 11, minWidth: 140, boxShadow: "0 8px 32px rgba(0,0,0,0.28)", fontFamily: "inherit",
            }}>
              <p style={{ fontWeight: 700, marginBottom: 4, color: String(color) }}>{String(indexValue)}</p>
              <p style={{ color: "#f1f5f9", margin: 0 }}>{Number(value).toFixed(2)} hari</p>
            </div>
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
        <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.08em] leading-none">{title}</span>
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
        <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.08em] leading-none">On-Time PO Trend</span>
        <span className="text-[10px] bg-[#D3DEEE] text-[#143665] px-2.5 py-0.5 rounded-full font-semibold">Monthly · 2026</span>
      </div>
      <p className="text-[10.5px] text-slate-400 mb-2">% PO delivered on-time dari target NDC · Rata-rata {avg}%</p>
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
            <div style={{
              background: "#2A3D4A", borderRadius: 10, padding: "8px 13px",
              fontSize: 11, minWidth: 120, boxShadow: "0 8px 32px rgba(0,0,0,0.28)", fontFamily: "inherit",
            }}>
              <p style={{ color: "#64748b", margin: "0 0 4px", fontSize: 10 }}>{String(point.data.x)}</p>
              <p style={{ color: "#f1f5f9", margin: 0, fontWeight: 700 }}>{Number(point.data.y).toFixed(0)}%</p>
            </div>
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
        <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.08em] leading-none">Lead Time Pareto per SKU</span>
        <span className="text-[10px] bg-[#D3DEEE] text-[#143665] px-2.5 py-0.5 rounded-full font-semibold">Top 10 · YTD 2026</span>
      </div>
      <p className="text-[10.5px] text-slate-400 mb-2">SKU diurutkan dari lead time tertinggi · Garis oranye = kumulatif %</p>
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
            <div style={{
              background: "#2A3D4A", borderRadius: 10, padding: "8px 13px",
              fontSize: 11, minWidth: 140, boxShadow: "0 8px 32px rgba(0,0,0,0.28)", fontFamily: "inherit",
            }}>
              <p style={{ fontWeight: 700, marginBottom: 4, color: String(color) }}>{String(indexValue)}</p>
              <p style={{ color: "#f1f5f9", margin: 0 }}>{Number(value).toFixed(2)} hari</p>
            </div>
          )}
        />
      </div>
      <div className="flex flex-wrap gap-4 mt-1">
        {([
          [UNVA_COLOR, "UNVA (>20 hari)"],
          [NNVA_COLOR, "NNVA (13–20 hari)"],
          ["#10b981",  "On Target (<13 hari)"],
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
              <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.08em] leading-none">Lead Time per Stage</span>
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
                <div style={{
                  background: "#2A3D4A", borderRadius: 10, padding: "8px 13px",
                  fontSize: 11, minWidth: 140, boxShadow: "0 8px 32px rgba(0,0,0,0.28)", fontFamily: "inherit",
                }}>
                  <p style={{ fontWeight: 700, marginBottom: 4, color: String(color) }}>{String(indexValue)}</p>
                  <p style={{ color: "#f1f5f9", margin: 0 }}>{Number(value).toFixed(2)} hari</p>
                </div>
              )}
            />
          </div>
        </div>
      </div>

      {/* Trend line chart */}
      <div className="px-5 pb-5">
        <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.08em] leading-none">Lead Time Stages Trend</span>
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
                <div style={{
                  background: "#2A3D4A", borderRadius: 10, padding: "8px 13px",
                  fontSize: 11, minWidth: 140, boxShadow: "0 8px 32px rgba(0,0,0,0.28)", fontFamily: "inherit",
                }}>
                  <p style={{ color: "#64748b", margin: "0 0 4px", fontSize: 10 }}>{String(point.data.x)}</p>
                  <p style={{ color: String(point.serieColor), fontWeight: 700, margin: 0 }}>{String(point.serieId)}</p>
                  <p style={{ color: "#f1f5f9", margin: "2px 0 0" }}>{Number(point.data.y).toFixed(2)} hari</p>
                </div>
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Lead Time Strategic card ─────────────────────────────────────────────────

const LT_CARD_TONES = {
  on:      { color: "#067647", bg: "#f0fdf6", border: "#bbf0d2", icon: "✓", label: "On Track"     },
  risk:    { color: "#b45309", bg: "#fffaeb", border: "#f0d58a", icon: "!", label: "At Risk"       },
  off:     { color: "#d92d20", bg: "#fef4f3", border: "#fbd5d1", icon: "↑", label: "Above Target" },
  neutral: { color: "#667085", bg: "#f8f9fb", border: "#e4e7ec", icon: "—", label: "No Data"      },
};

const LT_CARD_TARGET = 13;

const MOCK_BY_POS_GROSS = [
  { position: "WIP Waiting",   avgHours: 8.97 * 24 },
  { position: "PO & Approval", avgHours: 6.62 * 24 },
  { position: "Produksi",      avgHours: 2.84 * 24 },
  { position: "QC & NDC",      avgHours: 0.60 * 24 },
];

const MOCK_BY_POS_NETT = [
  { position: "Produksi",      avgHours: 3.50 * 24 },
  { position: "QC Hold",       avgHours: 1.80 * 24 },
  { position: "Lab Test",      avgHours: 0.90 * 24 },
  { position: "Transport/NDC", avgHours: 0.80 * 24 },
];

function ltToneFromDays(days: number): keyof typeof LT_CARD_TONES {
  if (days === 0) return "neutral";
  if (days <= LT_CARD_TARGET) return "on";
  if (days <= LT_CARD_TARGET * 1.15) return "risk";
  return "off";
}

function LeadTimeStrategicCard() {
  const [type, setType] = useState<"gross" | "nett">("gross");
  const [unit, setUnit] = useState<"days" | "hours">("days");

  const GROSS_DAYS = 16.67;
  const NETT_DAYS  = 7.00;

  const primaryDays    = type === "gross" ? GROSS_DAYS : NETT_DAYS;
  const secondaryDays  = type === "gross" ? NETT_DAYS  : GROSS_DAYS;
  const secondaryLabel = type === "gross" ? "Nett lead time this period" : "Gross lead time this period";

  const tone      = LT_CARD_TONES[ltToneFromDays(primaryDays)];
  const delta     = primaryDays - LT_CARD_TARGET;
  const deltaPct  = (delta / LT_CARD_TARGET) * 100;
  const deltaOver = delta > 0;

  const positions     = type === "gross" ? MOCK_BY_POS_GROSS : MOCK_BY_POS_NETT;
  const maxHours      = positions[0]?.avgHours || 1;
  const sparklineData = type === "gross" ? GROSS_LT_SPARKLINE : NETT_LT_SPARKLINE;
  const nivoData      = [{ id: "lt", data: sparklineData.map((y, x) => ({ x, y })) }];

  const fmtVal = (days: number) => {
    const val = unit === "hours" ? days * 24 : days;
    return val.toFixed(unit === "hours" ? 1 : 2);
  };
  const unitLabel  = unit === "days" ? "days" : "hours";
  const deltaLabel = unit === "hours"
    ? `${deltaOver ? "+" : ""}${(delta * 24).toFixed(1)} hrs`
    : `${deltaOver ? "+" : ""}${delta.toFixed(2)} days`;

  return (
    <div style={{ background: "white", border: "1px solid #e9eaee", borderRadius: 10, display: "flex", flexDirection: "column", overflow: "hidden", width: "100%", fontFamily: "Lato, sans-serif", height: "100%" }}>
      <div style={{ display: "flex", flex: 1 }}>
        <div style={{ width: 6, background: tone.color, flexShrink: 0 }} />
        <div style={{ flex: 1, padding: "14px 16px 0", display: "flex", flexDirection: "column", gap: 8 }}>

          {/* Header row */}
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

            {/* LEFT column */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Clock size={13} color="#d97706" strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.11em", color: "#8a90a0", textTransform: "uppercase" }}>
                  LEAD TIME
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.015em", color: "#101828", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                  {fmtVal(primaryDays)}
                </span>
                <span style={{ fontSize: 12, color: "#98a2b3" }}>{unitLabel}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: deltaOver ? "#d92d20" : "#067647", fontVariantNumeric: "tabular-nums" }}>
                  {deltaOver ? "↗" : "↘"} {deltaLabel}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#667085", fontVariantNumeric: "tabular-nums" }}>
                vs target {LT_CARD_TARGET}.00 days ({deltaOver ? "+" : ""}{deltaPct.toFixed(1)}%)
              </div>
              <div>
                <span style={{ fontSize: 11.5, fontWeight: 700, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, borderRadius: 5, padding: "2px 8px", display: "inline-block" }}>
                  {tone.icon} {tone.label}
                </span>
              </div>
            </div>

            {/* RIGHT column */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>

              {/* Toggles — side by side */}
              <div style={{ display: "flex", gap: 4 }}>
                <div style={{ background: "#f2f3f6", borderRadius: 7, padding: 3, display: "flex", gap: 2 }}>
                  {(["gross", "nett"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      style={{
                        fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 5,
                        border: "none", cursor: "pointer", fontFamily: "Lato, sans-serif",
                        background: type === t ? "white" : "transparent",
                        color: type === t ? "#101828" : "#667085",
                        boxShadow: type === t ? "0 1px 2px rgba(16,24,40,.08)" : "none",
                        transition: "background 0.15s, color 0.15s",
                      }}
                    >
                      {t === "gross" ? "Gross" : "Nett"}
                    </button>
                  ))}
                </div>
                <div style={{ background: "#f2f3f6", borderRadius: 7, padding: 3, display: "flex", gap: 2 }}>
                  {(["days", "hours"] as const).map((u) => (
                    <button
                      key={u}
                      onClick={() => setUnit(u)}
                      style={{
                        fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 5,
                        border: "none", cursor: "pointer", fontFamily: "Lato, sans-serif",
                        background: unit === u ? "white" : "transparent",
                        color: unit === u ? "#101828" : "#667085",
                        boxShadow: unit === u ? "0 1px 2px rgba(16,24,40,.08)" : "none",
                        transition: "background 0.15s, color 0.15s",
                      }}
                    >
                      {u === "days" ? "Days" : "Hours"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sparkline */}
              <div style={{ width: 150, height: 42 }}>
                <ResponsiveLine
                  data={nivoData}
                  margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
                  xScale={{ type: "point" }}
                  yScale={{ type: "linear", min: "auto", max: "auto" }}
                  enableArea
                  areaOpacity={0.07}
                  colors={[tone.color]}
                  lineWidth={1.6}
                  enablePoints={false}
                  enableGridX={false}
                  enableGridY={false}
                  axisLeft={null}
                  axisBottom={null}
                  isInteractive={false}
                  animate={false}
                />
              </div>
              <div style={{ fontSize: 10, color: "#a3a8b5", marginTop: -4, textAlign: "right" }}>
                {sparklineData.length} weeks · {unitLabel}
              </div>
            </div>
          </div>

          {/* Secondary metric */}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #eceef2", display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: "#101828", fontVariantNumeric: "tabular-nums" }}>
                  {fmtVal(secondaryDays)}
                </span>
                <span style={{ fontSize: 11, color: "#98a2b3" }}>{unitLabel}</span>
              </div>
              <div style={{ fontSize: 10.5, color: "#a3a8b5" }}>{secondaryLabel}</div>
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div style={{ background: "#f6f7f9", borderTop: "1px solid #eceef2", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 16px 7px 22px", borderRadius: "0 0 9px 9px" }}>
        <span style={{ fontSize: 11, color: "#667085", fontFamily: "Lato, sans-serif" }}>
          {type === "gross" ? "Total process PO → NDC receiving" : "Actual production time"}
        </span>
        <span style={{ fontSize: 10, color: "#a3a8b5", fontFamily: "Lato, sans-serif" }}>
          Target ≤ {LT_CARD_TARGET} days
        </span>
      </div>
    </div>
  );
}

// ── STRATEGIC VIEW ────────────────────────────────────────────────────────────

function StrategicView() {
  return (
    <div className="flex flex-col gap-0 pt-5">
      {/* 3 KPI cards */}
      <div className="grid grid-cols-3 gap-3.5 px-5 mb-4">
        <LeadTimeStrategicCard />
        {/* WASTE PORTION (UNVA) */}
        <div style={{ background: "white", border: "1px solid #e9eaee", borderRadius: 10, display: "flex", flexDirection: "column", overflow: "hidden", width: "100%", fontFamily: "Lato, sans-serif", height: "100%" }}>
          <div style={{ display: "flex", flex: 1 }}>
            <div style={{ width: 6, background: "#d92d20", flexShrink: 0 }} />
            <div style={{ flex: 1, padding: "14px 16px 0", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#b91c1c", display: "flex", alignItems: "center", flexShrink: 0 }}><BarChart3 size={13} /></span>
                    <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.11em", color: "#8a90a0", textTransform: "uppercase" }}>WASTE PORTION (UNVA)</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.015em", color: "#101828", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>64</span>
                    <span style={{ fontSize: 12, color: "#98a2b3" }}>% of total LT</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#98a2b3" }}>non-value-added time</div>
                  <div>
                    <span style={{ fontSize: 11.5, fontWeight: 700, background: "#fef4f3", border: "1px solid #fbd5d1", color: "#d92d20", borderRadius: 5, padding: "2px 8px", display: "inline-block" }}>
                      ↓ Critical — Majority Waste
                    </span>
                  </div>
                </div>
                <div style={{ width: 150, height: 42, flexShrink: 0 }}>
                  <ResponsiveLine
                    data={[{ id: "waste", data: WASTE_SPARKLINE.map((y, x) => ({ x, y })) }]}
                    margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
                    xScale={{ type: "point" }}
                    yScale={{ type: "linear", min: "auto", max: "auto" }}
                    enableArea
                    areaOpacity={0.07}
                    colors={["#d92d20"]}
                    lineWidth={1.6}
                    enablePoints={false}
                    enableGridX={false}
                    enableGridY={false}
                    axisLeft={null}
                    axisBottom={null}
                    isInteractive={false}
                    animate={false}
                  />
                </div>
              </div>
              {/* Stacked bar */}
              <div>
                <div style={{ height: 8, borderRadius: 999, display: "flex", overflow: "hidden" }}>
                  <div style={{ width: "14%", background: "#215AA8" }} />
                  <div style={{ width: "22%", background: "#d97706" }} />
                  <div style={{ width: "64%", background: "#b91c1c" }} />
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 5, fontSize: 10.5 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: "#215AA8", display: "inline-block" }} />
                    <span style={{ color: "#667085" }}>VA 14%</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: "#d97706", display: "inline-block" }} />
                    <span style={{ color: "#667085" }}>NNVA 22%</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: "#b91c1c", display: "inline-block" }} />
                    <span style={{ color: "#667085" }}>UNVA 64%</span>
                  </span>
                </div>
              </div>
              {/* Secondary metric */}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #eceef2", display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: "#101828", fontVariantNumeric: "tabular-nums" }}>14%</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: "#a3a8b5" }}>VA (value-added) share of total LT</div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ background: "#f6f7f9", borderTop: "1px solid #eceef2", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 16px 7px 22px", borderRadius: "0 0 9px 9px" }}>
            <span style={{ fontSize: 11, color: "#667085", fontFamily: "Lato, sans-serif" }}>Lead time classified as non-value-added</span>
            <span style={{ fontSize: 10, color: "#a3a8b5", fontFamily: "Lato, sans-serif" }}>NNVA 22% · VA 14%</span>
          </div>
        </div>

        {/* SAVINGS POTENTIAL */}
        <div style={{ background: "white", border: "1px solid #e9eaee", borderRadius: 10, display: "flex", flexDirection: "column", overflow: "hidden", width: "100%", fontFamily: "Lato, sans-serif", height: "100%" }}>
          <div style={{ display: "flex", flex: 1 }}>
            <div style={{ width: 6, background: "#067647", flexShrink: 0 }} />
            <div style={{ flex: 1, padding: "14px 16px 0", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#10b981", display: "flex", alignItems: "center", flexShrink: 0 }}><TrendingDown size={13} /></span>
                    <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.11em", color: "#8a90a0", textTransform: "uppercase" }}>SAVINGS POTENTIAL</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.015em", color: "#101828", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>3.67</span>
                    <span style={{ fontSize: 12, color: "#98a2b3" }}>days/batch</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#98a2b3" }}>if top-5 UNVA stages eliminated</div>
                  <div>
                    <span style={{ fontSize: 11.5, fontWeight: 700, background: "#f0fdf6", border: "1px solid #bbf0d2", color: "#067647", borderRadius: 5, padding: "2px 8px", display: "inline-block" }}>
                      ↑ Opportunity Identified
                    </span>
                  </div>
                </div>
                <div style={{ width: 150, height: 42, flexShrink: 0 }}>
                  <ResponsiveLine
                    data={[{ id: "savings", data: SAVINGS_SPARKLINE.map((y, x) => ({ x, y })) }]}
                    margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
                    xScale={{ type: "point" }}
                    yScale={{ type: "linear", min: "auto", max: "auto" }}
                    enableArea
                    areaOpacity={0.07}
                    colors={["#067647"]}
                    lineWidth={1.6}
                    enablePoints={false}
                    enableGridX={false}
                    enableGridY={false}
                    axisLeft={null}
                    axisBottom={null}
                    isInteractive={false}
                    animate={false}
                  />
                </div>
              </div>
              {/* Callout */}
              <div style={{ borderLeft: "2px solid #bbf7d0", background: "#f0fdf4", borderRadius: "0 5px 5px 0", padding: "7px 10px", fontSize: 11.5, color: "#667085" }}>
                Eliminating top-5 UNVA stages reduces lead time to ~13.0 days
              </div>
              {/* Secondary metric */}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #eceef2", display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: "#101828", fontVariantNumeric: "tabular-nums" }}>~13.0</span>
                    <span style={{ fontSize: 11, color: "#98a2b3" }}>days</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: "#a3a8b5" }}>Projected lead time after elimination</div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ background: "#f6f7f9", borderTop: "1px solid #eceef2", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 16px 7px 22px", borderRadius: "0 0 9px 9px" }}>
            <span style={{ fontSize: 11, color: "#667085", fontFamily: "Lato, sans-serif" }}>If top-5 UNVA stages are eliminated</span>
            <span style={{ fontSize: 10, color: "#a3a8b5", fontFamily: "Lato, sans-serif" }}>Current: 16.67 days</span>
          </div>
        </div>
      </div>

      {/* Stage Group Chart */}
      <div className="px-5 mb-4">
        <StageGroupChart />
      </div>

      {/* SKU tables — Top 5 + Bottom 5 side by side */}
      <div className="grid grid-cols-2 gap-3.5 px-5 mb-4">
        <SKUTable skus={TOP_SKUS}    title="Top 5 SKU by Volume" variant="top" />
        <SKUTable skus={BOTTOM_SKUS} title="Bottom 5 SKU by Volume" variant="bottom" />
      </div>

      {/* On-Time PO Trend */}
      <div className="px-5 mb-4">
        <OnTimePOTrend />
      </div>

      {/* Lead Time Pareto per SKU */}
      <div className="px-5 pb-5">
        <LTParetoSKU />
      </div>
    </div>
  );
}

// ── OPERATIONAL VIEW ──────────────────────────────────────────────────────────

function OperationalView() {
  const exceptions = [
    { batch: "#BT-20260913-042", stage: "WIP Menunggu",  msg: "Sudah 8,4 hari di stage WIP sebelum Kemas. Standar maks 4 hari.", meta: "Plant 1 · Bulk Line A · Delay 4,4 hari",    severity: "critical" as const },
    { batch: "#BT-20260911-018", stage: "QC Hold",       msg: "QC Hold 5,2 hari — menunggu hasil lab uji stabilitas.",           meta: "Plant 2 · Lab QC · Delay 2,2 hari",         severity: "critical" as const },
    { batch: "#BT-20260910-055", stage: "PO Released",   msg: "Approval dokumen PO sudah 3,1 hari. Approaching limit 3,5 hari.", meta: "Plant 1 · Procurement · Sisa 0,4 hari",    severity: "warning" as const },
    { batch: "#BT-20260912-031", stage: "NDC-In",        msg: "Penerimaan NDC 2,8 hari. Mendekati batas 3 hari.",               meta: "NDC Cikarang · Receiving · Sisa 0,2 hari",  severity: "warning" as const },
  ];

  return (
    <div className="flex flex-col gap-0 pt-5">
      <div className="grid grid-cols-2 gap-3.5 px-5 pb-5">
        {/* Exceptions */}
        <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.08em] leading-none">Exceptions Aktif</span>
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
          <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.08em] leading-none">Lead Time Stage Harian</span>
          <p className="text-[10.5px] text-slate-400 mb-3 mt-0.5">Rata-rata lead time per stage · 7 hari terakhir · hari kerja</p>
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
          plants={["All Plant", "Plant 1", "Plant 2", "NDC"]}
          onFilterChange={() => {}}
          views={LEAD_TIME_VIEWS}
          activeView={persona}
          onViewChange={(v) => setPersona(v as Persona)}
          onRefresh={() => setLastUpdated(new Date())}
          isLoading={false}
          lastUpdated={lastUpdated}
          alertCount={0}
          alerts={[]}
          onMonitorMode={() => router.push("/monitor?page=lead-time")}
        />

        <div className="flex-1 overflow-y-auto min-h-0">
          {persona === "strategic"   && <StrategicView />}
          {persona === "tactical"    && <TacticalView />}
          {persona === "operational" && <OperationalView />}
        </div>
      </div>

      <FloatingChat />
    </div>
  );
}
