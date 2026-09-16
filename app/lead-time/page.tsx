"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { FloatingChat } from "@/components/dashboard/FloatingChat";
import { Bell, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsiveLine } from "@nivo/line";

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

// ── Helpers ────────────────────────────────────────────────────────────────────
const ID_DAYS   = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const ID_MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

function useClock() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      const s = String(now.getSeconds()).padStart(2, "0");
      setTime(`${h}:${m}:${s} WIB`);
      setDate(`${ID_DAYS[now.getDay()]}, ${now.getDate()} ${ID_MONTHS[now.getMonth()]} ${now.getFullYear()}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return { time, date };
}

// ── Types ──────────────────────────────────────────────────────────────────────
type Persona   = "strategic" | "tactical" | "operational";
type StageView = "group" | "activity";
type ChartTab  = "gross" | "nett" | "pareto";

// ── Shared components ──────────────────────────────────────────────────────────

function FilterSelect({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-[0.07em]">{label}</span>
      <button className="flex items-center gap-1.5 border border-[#EBEBEB] rounded-full px-3 py-1.5 text-[11.5px] font-semibold text-[#2A3D4A] bg-white hover:border-[#A6BDDC] hover:bg-[#E9EFF6] transition-colors whitespace-nowrap">
        {value}
        <ChevronDown size={10} className="text-slate-400 ml-1 shrink-0" />
      </button>
    </div>
  );
}

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

function KpiSummaryCard({ label, value, unit, desc, accentColor, footer }: {
  label: string; value: string; unit: string; desc: string;
  accentColor: string; footer?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 relative overflow-hidden hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200">
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg" style={{ background: accentColor }} />
      <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-2">{label}</p>
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-[2rem] font-bold leading-none tabular-nums tracking-tight" style={{ color: accentColor }}>{value}</span>
        <span className="text-[13px] text-slate-400 font-medium">{unit}</span>
      </div>
      <p className="text-[12px] text-slate-500 leading-snug">{desc}</p>
      {footer}
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

function LTParetoSKU() {
  const sorted = [
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

  const total = sorted.reduce((s, d) => s + d.lt, 0);
  const maxLT = sorted[0].lt * 1.12;
  let cumSum = 0;
  const data = useMemo(() => sorted.map((d) => {
    cumSum += (d.lt / total) * 100;
    return { ...d, cumPct: Math.round(cumSum), cumNorm: (cumSum / 100) * maxLT };
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Custom layer: cumulative % line drawn over bars using bar coords
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CumulativeLine = useCallback((props: any) => {
    const { bars, yScale } = props;
    if (!bars || !yScale || bars.length === 0) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pts = bars.map((bar: any, i: number) => ({
      x: bar.x + bar.width / 2,
      y: yScale(data[i]?.cumNorm ?? 0),
      pct: data[i]?.cumPct ?? 0,
    }));
    const pathD = pts.map((p: {x:number;y:number;pct:number}, i: number) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    return (
      <g>
        <path d={pathD} fill="none" stroke="#f97316" strokeWidth="2" strokeLinejoin="round" />
        {pts.map((p: {x:number;y:number;pct:number}, i: number) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="white" stroke="#f97316" strokeWidth="1.5" />
            {(i === 0 || i === 3 || i === 6 || i === 9) && (
              <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize="8" fill="#f97316" fontWeight="600">{p.pct}%</text>
            )}
          </g>
        ))}
      </g>
    );
  }, [data]);

  const markers = useMemo(() => [{
    axis: "y" as const, value: 0.8 * maxLT,
    lineStyle: { stroke: "#94a3b8", strokeDasharray: "4 3", strokeWidth: 1.5 },
    legend: "80%", legendOffsetX: -8, legendOffsetY: -8,
    textStyle: { fill: "#94a3b8", fontSize: 9, fontFamily: "inherit" },
  }], [maxLT]);

  return (
    <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.08em] leading-none">Lead Time Pareto per SKU</span>
        <span className="text-[10px] bg-[#D3DEEE] text-[#143665] px-2.5 py-0.5 rounded-full font-semibold">Top 10 · YTD 2026</span>
      </div>
      <p className="text-[10.5px] text-slate-400 mb-2">SKU diurutkan dari lead time tertinggi · Garis oranye = kumulatif %</p>
      <div style={{ height: 200 }}>
        <ResponsiveBar
          data={data}
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          markers={markers as any}
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
    <div className="flex flex-col gap-0">
      <div className="px-5 pt-5 pb-3">
        <p className="text-[11px] text-slate-400 font-medium mb-1">
          Tactical › <span className="text-[#2A3D4A] font-semibold">Lead Time per Stage Group</span>
        </p>
        <h1 className="text-[20px] font-bold text-[#2A3D4A] leading-tight mb-1">Lead Time per Stage Group</h1>
        <p className="text-[12px] text-slate-500">PO Created → NDC Received, diurai per stage dengan klasifikasi VA / NNVA / UNVA</p>
      </div>

      <div className="flex items-end gap-3 px-5 pb-4 flex-wrap">
        <FilterSelect label="Quick Filter" value="Year To Date" />
        <div className="flex flex-col gap-0.5">
          <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-[0.07em]">Date Range</span>
          <div className="flex items-center gap-2">
            <div className="border border-[#EBEBEB] rounded-full px-3 py-1.5 text-[11.5px] font-semibold text-[#2A3D4A] bg-white">01/01/2026</div>
            <span className="text-slate-400 text-sm">—</span>
            <div className="border border-[#EBEBEB] rounded-full px-3 py-1.5 text-[11.5px] font-semibold text-[#2A3D4A] bg-white">20/07/2026</div>
          </div>
        </div>
        <FilterSelect label="Plant" value="All Plant" />
        <FilterSelect label="Data Level" value="Weekly" />
      </div>

      {/* KPI Cards: PO Created | PO Released | VA | UNVA */}
      <div className="grid grid-cols-4 gap-3.5 px-5 mb-4">
        <KpiSummaryCard label="PO Created → NDC" value="16.67" unit="days" accentColor={NNVA_COLOR}
          desc="Gross time, seluruh stage"
          footer={
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#EBEBEB]">
              <span className="text-[10.5px] text-slate-400">standar 13,0</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#FFEDEF] text-[#8A0011]">+3,67 hari</span>
            </div>
          }
        />
        <KpiSummaryCard label="PO Released → NDC" value="7.00" unit="days" accentColor="#10b981"
          desc="Basis alternatif — tidak dirata-rata dengan yang di kiri"
          footer={
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#EBEBEB]">
              <span className="text-[10.5px] text-slate-400">standar 6,5</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#FFEDEF] text-[#8A0011]">+0,50 hari</span>
            </div>
          }
        />
        <KpiSummaryCard label="VA — Waktu Proses" value="11.14" unit="days" accentColor={VA_COLOR}
          desc="Stage yang benar-benar mengolah produk"
          footer={
            <div className="mt-3 pt-3 border-t border-[#EBEBEB]">
              <span className="text-[10.5px] text-slate-400">NNVA 8,22 hari</span>
            </div>
          }
        />
        <KpiSummaryCard label="UNVA — WIP Menunggu" value="30.14" unit="days" accentColor={UNVA_COLOR}
          desc="Akumulasi seluruh stage WIP"
          footer={<span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FFEDEF] text-[#8A0011]">pool perbaikan terbesar</span>}
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

// ── STRATEGIC VIEW ────────────────────────────────────────────────────────────

function StrategicView() {
  return (
    <div className="flex flex-col gap-0">
      <div className="px-5 pt-5 pb-3">
        <p className="text-[11px] text-slate-400 font-medium mb-1">
          Strategic › <span className="text-[#2A3D4A] font-semibold">Lead Time Executive Summary</span>
        </p>
        <h1 className="text-[20px] font-bold text-[#2A3D4A] leading-tight mb-1">Lead Time Executive Summary</h1>
        <p className="text-[12px] text-slate-500">Ringkasan kinerja lead time untuk VP dan BOD · Quarterly · All Plant</p>
      </div>

      <div className="flex items-end gap-3 px-5 pb-4 flex-wrap">
        <FilterSelect label="Period" value="Q2 2026" />
        <FilterSelect label="Plant" value="All Plant" />
        <FilterSelect label="View" value="Quarterly" />
      </div>

      {/* 3 KPI cards */}
      <div className="grid grid-cols-3 gap-3.5 px-5 mb-4">
        <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 relative overflow-hidden hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200">
          <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg" style={{ background: NNVA_COLOR }} />
          <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-2">Gross Lead Time YTD</p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[34px] font-bold leading-none tabular-nums" style={{ color: NNVA_COLOR }}>16.67</span>
            <span className="text-[14px] text-slate-500">hari</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#FFEDEF] text-[#8A0011] ml-1">vs target 13,0</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: "78%", background: NNVA_COLOR }} />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-slate-400">Target 13,0 hari</span>
            <span className="text-[10px] font-semibold" style={{ color: NNVA_COLOR }}>78% dari target</span>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 relative overflow-hidden hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200">
          <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg" style={{ background: UNVA_COLOR }} />
          <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-2">Porsi UNVA (Waste)</p>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-[34px] font-bold leading-none tabular-nums" style={{ color: UNVA_COLOR }}>64%</span>
            <span className="text-[14px] text-slate-500">dari total LT</span>
          </div>
          {/* VA → NNVA → UNVA order (UNVA rightmost) */}
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
            <div className="h-full" style={{ width: "14%", background: VA_COLOR }} />
            <div className="h-full" style={{ width: "22%", background: NNVA_COLOR }} />
            <div className="h-full" style={{ width: "64%", background: UNVA_COLOR }} />
          </div>
          <div className="flex gap-3 mt-2">
            <span className="text-[10px] font-semibold" style={{ color: VA_COLOR }}>■ VA 14%</span>
            <span className="text-[10px] font-semibold" style={{ color: NNVA_COLOR }}>■ NNVA 22%</span>
            <span className="text-[10px] font-semibold" style={{ color: UNVA_COLOR }}>■ UNVA 64%</span>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 relative overflow-hidden hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200">
          <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg bg-emerald-500" />
          <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-2">Potensi Penghematan</p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[34px] font-bold leading-none tabular-nums text-emerald-600">3.67</span>
            <span className="text-[14px] text-slate-500">hari/batch</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">Jika UNVA top-5 stage dieliminasi, lead time turun ke ~13,0 hari</p>
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
    <div className="flex flex-col gap-0">
      <div className="px-5 pt-5 pb-3">
        <p className="text-[11px] text-slate-400 font-medium mb-1">
          Operational › <span className="text-[#2A3D4A] font-semibold">Lead Time Daily Tracker</span>
        </p>
        <h1 className="text-[20px] font-bold text-[#2A3D4A] leading-tight mb-1">Lead Time Daily Tracker</h1>
        <p className="text-[12px] text-slate-500">Monitoring harian per batch · PO yang sedang berjalan · Update setiap hari kerja pukul 07:00 WIB</p>
      </div>

      <div className="flex items-end gap-3 px-5 pb-4 flex-wrap">
        <FilterSelect label="Quick Filter" value="7 Hari Terakhir" />
        <FilterSelect label="Plant" value="All Plant" />
        <FilterSelect label="Stage" value="Semua Stage" />
        <button className="flex items-center gap-1.5 border border-[#FFEDEF] rounded-full px-3 py-1.5 text-[11.5px] font-bold text-[#8A0011] bg-[#FFEDEF] self-end whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[#E6001C] animate-pulse shrink-0" />
          {exceptions.length} Exceptions Aktif
        </button>
      </div>

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

const PERSONA_CONFIG = {
  strategic:   { badge: "VP / BOD", badgeCls: "bg-[#E9EFF6] text-[#143665]",      label: "Strategic" },
  tactical:    { badge: "Manager",  badgeCls: "bg-[#FFFBE4] text-[#342900]",      label: "Tactical" },
  operational: { badge: "Leader",   badgeCls: "bg-emerald-50 text-emerald-800",   label: "Operational" },
} as const;

export default function LeadTimePage() {
  const { status } = useSession();
  const router = useRouter();
  const { time, date } = useClock();
  const [persona, setPersona] = useState<Persona>("tactical");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

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

        {/* Topbar */}
        <div className="h-[52px] bg-[#215AA8] flex items-center gap-3 px-4 shrink-0 border-b border-[#1A4886]">
          <span className="text-[13px] font-medium text-white/50 tracking-[0.07em] uppercase shrink-0">Manufacturing Control Tower</span>
          <div className="flex-1" />
          <div className="flex flex-col items-end pr-2.5 border-r border-white/10">
            <span className="text-[13px] font-bold text-white/90 tracking-[0.03em] leading-tight tabular-nums">{time}</span>
            <span className="text-[9.5px] text-white/40 leading-tight">{date}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.08] border border-white/[0.12] text-[11px] text-white/55 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            Last sync 12:21 WIB
          </div>
          <div className="relative w-8 h-8 rounded-[9px] bg-white/[0.08] border border-white/[0.12] flex items-center justify-center hover:bg-white/[0.15] transition-colors cursor-pointer">
            <Bell size={14} className="text-white/85" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#E6001C] border-[1.5px] border-[#215AA8] flex items-center justify-center text-[8px] font-bold text-white">3</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#215AA8] border border-white/20 flex items-center justify-center cursor-pointer shadow-sm" style={{ background: "#1A4886" }}>
            <span className="text-white text-[11px] font-bold">DA</span>
          </div>
        </div>

        {/* Persona switcher */}
        <div className="flex items-center bg-white border-b border-[#EBEBEB] px-5 shrink-0">
          {(Object.entries(PERSONA_CONFIG) as [Persona, typeof PERSONA_CONFIG[Persona]][]).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setPersona(key)}
              className={cn(
                "flex items-center gap-2 py-3 px-4 border-b-2 text-[12px] font-semibold transition-all",
                persona === key
                  ? "border-[#215AA8] text-[#143665]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-[0.05em]", cfg.badgeCls)}>
                {cfg.badge}
              </span>
              {cfg.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {persona === "tactical"    && <TacticalView />}
          {persona === "strategic"   && <StrategicView />}
          {persona === "operational" && <OperationalView />}
        </div>

      </div>

      <FloatingChat />
    </div>
  );
}
