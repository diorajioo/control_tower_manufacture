"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { FloatingChat } from "@/components/dashboard/FloatingChat";
import { Bell, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Constants ──────────────────────────────────────────────────────────────────
const VA_COLOR   = "#215AA8";
const NNVA_COLOR = "#d97706";
const UNVA_COLOR = "#b91c1c";

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

function StageGroupChart() {
  const [view, setView] = useState<StageView>("group");

  const groupData = [
    { label: "PO & Approval", value: 6.62, color: UNVA_COLOR, cls: "UNVA" },
    { label: "Produksi",       value: 2.84, color: VA_COLOR,   cls: "VA"   },
    { label: "QC & NDC",       value: 0.60, color: NNVA_COLOR, cls: "NNVA" },
    { label: "WIP Waiting",    value: 8.97, color: UNVA_COLOR, cls: "UNVA" },
  ];

  const activityData = [
    { label: "WIP-PO",     value: 4.20, color: UNVA_COLOR },
    { label: "PO-Rel",     value: 2.42, color: UNVA_COLOR },
    { label: "Scheduling", value: 1.60, color: NNVA_COLOR },
    { label: "WIP-Kemas",  value: 2.80, color: UNVA_COLOR },
    { label: "Timbang",    value: 0.35, color: VA_COLOR   },
    { label: "Olah",       value: 0.61, color: VA_COLOR   },
    { label: "Kemas 1",    value: 0.60, color: VA_COLOR   },
    { label: "Kemas 2",    value: 1.36, color: VA_COLOR   },
    { label: "QC Hold",    value: 3.80, color: UNVA_COLOR },
    { label: "Lab Test",   value: 0.60, color: NNVA_COLOR },
    { label: "Transport",  value: 0.50, color: NNVA_COLOR },
    { label: "NDC-In",     value: 0.35, color: NNVA_COLOR },
  ];

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
      <p className="text-[10.5px] text-slate-400 mb-3">YTD 2026 · All Plant · Median per stage dalam hari</p>
      <VALegend />
      <div className="mt-3">
        {view === "group" ? (
          <svg viewBox="0 0 700 210" style={{ width: "100%" }} fontFamily="inherit">
            {[0, 3, 6, 9].map((v) => {
              const y = 180 - (v / 10) * 150;
              return (
                <g key={v}>
                  <line x1="44" y1={y} x2="690" y2={y} stroke="#f3f4f6" strokeWidth="1" />
                  <text x="38" y={y + 3} textAnchor="end" fontSize="9" fill="#9ca3af">{v}</text>
                </g>
              );
            })}
            <line x1="44" y1="30" x2="44" y2="180" stroke="#f3f4f6" strokeWidth="1" />
            {groupData.map((d, i) => {
              const barW = 110, spacing = 158, x = 68 + i * spacing;
              const h = (d.value / 10) * 150, y = 180 - h;
              return (
                <g key={d.label}>
                  <rect x={x} y={y} width={barW} height={h} fill={d.color} rx="3" opacity="0.88" />
                  <text x={x + barW / 2} y={y - 7} textAnchor="middle" fontSize="10.5" fill="#374151" fontWeight="700">{d.value}</text>
                  <text x={x + barW / 2} y="195" textAnchor="middle" fontSize="9.5" fill="#374151" fontWeight="600">{d.label}</text>
                  <text x={x + barW / 2} y="206" textAnchor="middle" fontSize="8" fill={d.color} fontWeight="700">{d.cls}</text>
                </g>
              );
            })}
          </svg>
        ) : (
          <div className="overflow-x-auto">
            <svg viewBox="0 0 760 210" style={{ width: "100%", minWidth: 580 }} fontFamily="inherit">
              {[0, 1, 2, 3, 4, 5].map((v) => {
                const y = 180 - (v / 5) * 150;
                return (
                  <g key={v}>
                    <line x1="44" y1={y} x2="750" y2={y} stroke="#f3f4f6" strokeWidth="1" />
                    <text x="38" y={y + 3} textAnchor="end" fontSize="9" fill="#9ca3af">{v}</text>
                  </g>
                );
              })}
              <line x1="44" y1="30" x2="44" y2="180" stroke="#f3f4f6" strokeWidth="1" />
              {activityData.map((d, i) => {
                const barW = 38, spacing = 58, x = 54 + i * spacing;
                const h = (d.value / 5) * 150, y = 180 - h;
                return (
                  <g key={d.label}>
                    <rect x={x} y={y} width={barW} height={h} fill={d.color} rx="3" opacity="0.88" />
                    <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize="8.5" fill="#374151" fontWeight="700">{d.value}</text>
                    <text x={x + barW / 2} y="196" textAnchor="middle" fontSize="7.5" fill="#64748b">{d.label}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
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
  const data = [
    { month: "Jan", pct: 72 }, { month: "Feb", pct: 68 }, { month: "Mar", pct: 75 },
    { month: "Apr", pct: 71 }, { month: "Mei", pct: 78 }, { month: "Jun", pct: 82 },
    { month: "Jul", pct: 79 },
  ];
  const avg = Math.round(data.reduce((s, d) => s + d.pct, 0) / data.length);
  const W = 640, H = 160, padL = 44, padR = 48, padT = 22, padB = 28;
  const cW = W - padL - padR, cH = H - padT - padB;
  const minY = 60, maxY = 100;
  const toX = (i: number) => padL + (i / (data.length - 1)) * cW;
  const toY = (v: number) => padT + cH - ((v - minY) / (maxY - minY)) * cH;
  const pts = data.map((d, i) => `${toX(i)},${toY(d.pct)}`).join(" ");
  const avgY = toY(avg);

  return (
    <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200">
      <ChartTitle label="On-Time PO Trend" badge="Monthly · 2026" />
      <p className="text-[10.5px] text-slate-400 mb-3">% PO yang delivered on-time dari target NDC · Rata-rata {avg}%</p>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }} fontFamily="inherit">
        {[60, 70, 80, 90, 100].map((v) => {
          const y = toY(v);
          return (
            <g key={v}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f3f4f6" strokeWidth="1" />
              <text x={padL - 4} y={y + 3} textAnchor="end" fontSize="8.5" fill="#9ca3af">{v}%</text>
            </g>
          );
        })}
        <line x1={padL} y1={avgY} x2={W - padR} y2={avgY} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="5,4" />
        <text x={W - padR + 4} y={avgY + 3} fontSize="8.5" fill="#94a3b8" fontWeight="600">avg {avg}%</text>
        <defs>
          <linearGradient id="onTimeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={VA_COLOR} stopOpacity="0.13" />
            <stop offset="100%" stopColor={VA_COLOR} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`${toX(0)},${padT + cH} ${pts} ${toX(data.length - 1)},${padT + cH}`} fill="url(#onTimeGrad)" />
        <polyline points={pts} fill="none" stroke={VA_COLOR} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={d.month}>
            <circle cx={toX(i)} cy={toY(d.pct)} r="4" fill="white" stroke={VA_COLOR} strokeWidth="2" />
            <text x={toX(i)} y={toY(d.pct) - 9} textAnchor="middle" fontSize="9" fill={VA_COLOR} fontWeight="700">{d.pct}%</text>
            <text x={toX(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#9ca3af">{d.month}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function LTParetoSKU() {
  const raw = [
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
  ].sort((a, b) => b.lt - a.lt);

  const total = raw.reduce((s, d) => s + d.lt, 0);
  let cum = 0;
  const data = raw.map((d) => { cum += (d.lt / total) * 100; return { ...d, cum }; });

  const W = 680, H = 200, padL = 44, padR = 44, padT = 18, padB = 32;
  const cW = W - padL - padR, cH = H - padT - padB;
  const n = data.length, barW = (cW / n) * 0.62;
  const maxLT = raw[0].lt * 1.15;
  const toBarX  = (i: number) => padL + (i / n) * cW + (cW / n) * 0.19;
  const toLineX = (i: number) => padL + ((i + 0.5) / n) * cW;
  const toLineY = (v: number) => padT + cH - (v / 100) * cH;
  const toBarH  = (lt: number) => (lt / maxLT) * cH;
  const linePts = data.map((d, i) => `${toLineX(i)},${toLineY(d.cum)}`).join(" ");

  return (
    <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200">
      <ChartTitle label="Lead Time Pareto per SKU" badge="Top 10 · YTD 2026" />
      <p className="text-[10.5px] text-slate-400 mb-3">SKU diurutkan dari lead time tertinggi · Garis oranye = kumulatif %</p>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }} fontFamily="inherit">
        {[0, 10, 20, 30].map((v) => {
          const y = padT + cH - (v / maxLT) * cH;
          return (
            <g key={v}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f3f4f6" strokeWidth="1" />
              <text x={padL - 4} y={y + 3} textAnchor="end" fontSize="8.5" fill="#9ca3af">{v}</text>
            </g>
          );
        })}
        {[0, 25, 50, 75, 100].map((v) => (
          <text key={v} x={W - padR + 4} y={toLineY(v) + 3} fontSize="8.5" fill="#9ca3af">{v}%</text>
        ))}
        <line x1={padL} y1={toLineY(80)} x2={W - padR} y2={toLineY(80)} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,3" />
        <text x={W - padR + 4} y={toLineY(80) - 3} fontSize="7.5" fill="#94a3b8">80%</text>
        {data.map((d, i) => {
          const h = toBarH(d.lt), x = toBarX(i), y = padT + cH - h;
          return (
            <g key={d.name}>
              <rect x={x} y={y} width={barW} height={h} fill={d.color} rx="2" opacity="0.85" />
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600">{d.lt}</text>
              <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="7.5" fill="#64748b">{d.name}</text>
            </g>
          );
        })}
        <polyline points={linePts} fill="none" stroke="#f97316" strokeWidth="2" strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle key={i} cx={toLineX(i)} cy={toLineY(d.cum)} r="3" fill="white" stroke="#f97316" strokeWidth="1.5" />
        ))}
      </svg>
      <div className="flex flex-wrap gap-4 mt-2">
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
          <div className="flex items-center justify-between mb-3">
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
          <div className="overflow-x-auto mt-3">
            <svg viewBox="0 0 820 210" style={{ width: "100%", minWidth: 560 }} fontFamily="inherit">
              <line x1="52" y1="10" x2="52" y2="180" stroke="#f3f4f6" strokeWidth="1" />
              <line x1="52" y1="180" x2="810" y2="180" stroke="#f3f4f6" strokeWidth="1" />
              {[0, 2, 4, 6, 8].map((v, i) => {
                const y = 180 - i * 42;
                return <g key={v}><line x1="52" y1={y} x2="810" y2={y} stroke="#f3f4f6" strokeWidth="1" /><text x="46" y={y + 3} textAnchor="end" fontSize="9" fill="#9ca3af">{v}</text></g>;
              })}
              {[
                [57, 150, UNVA_COLOR], [91, 130, UNVA_COLOR], [125, 105, UNVA_COLOR], [159, 85, UNVA_COLOR],
                [193, 67, UNVA_COLOR], [227, 57, UNVA_COLOR], [261, 47, UNVA_COLOR], [295, 37, UNVA_COLOR],
                [329, 55, NNVA_COLOR], [363, 47, NNVA_COLOR], [397, 40, NNVA_COLOR], [431, 35, NNVA_COLOR],
                [465, 30, NNVA_COLOR], [499, 25, NNVA_COLOR],
                [533, 37, VA_COLOR],   [567, 32, VA_COLOR],   [601, 27, VA_COLOR],   [635, 23, VA_COLOR],
                [669, 18, VA_COLOR],   [703, 14, VA_COLOR],
              ].map(([x, h, color], i) => (
                <rect key={i} x={Number(x)} y={180 - Number(h)} width="28" height={Number(h)} fill={String(color)} rx="2" opacity="0.88" />
              ))}
              {["WIP-PO","QC Hold","PO-Rel","Sched","WIP-Kemas","Timbang","Transport","GR-Delay",
                "Inspect","Lab Test","NDC-In","Release","Quarantine","Sampling",
                "Olah","Kemas","Kemas 2","NDC-QC","Dispensing","IPC"
              ].map((lbl, i) => (
                <text key={lbl} x={71 + i * 34} y="197" textAnchor="middle" fontSize="7" fill="#64748b">{lbl}</text>
              ))}
            </svg>
          </div>
        </div>
      </div>

      {/* Trend line chart */}
      <div className="px-5 pb-5">
        <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200">
          <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.08em] leading-none">Lead Time Stages Trend</span>
          <p className="text-[10.5px] text-slate-400 mb-3 mt-0.5">Median per stage, mingguan · Jan – Jul 2026</p>
          <svg viewBox="0 0 760 210" style={{ width: "100%" }} fontFamily="inherit">
            <line x1="48" y1="15" x2="48" y2="180" stroke="#f3f4f6" strokeWidth="1" />
            <line x1="48" y1="180" x2="745" y2="180" stroke="#f3f4f6" strokeWidth="1" />
            {[0, 2, 4, 6, 8, 10, 12].map((v, i) => {
              const y = 180 - i * 27;
              return <g key={v}><line x1="48" y1={y} x2="745" y2={y} stroke="#f3f4f6" strokeWidth="1" /><text x="42" y={y + 3} textAnchor="end" fontSize="8.5" fill="#9ca3af">{v}</text></g>;
            })}
            <line x1="48" y1="113" x2="745" y2="113" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="5,4" />
            <polyline points="73,178 123,179 173,178 223,179 273,178 323,179 373,178 423,179 473,178 523,179 573,178 623,179 673,178 723,178" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" />
            <polyline points="73,177 123,178 173,177 223,178 273,177 323,178 373,177 423,178 473,177 523,178 573,177 623,178 673,177 723,177" fill="none" stroke={NNVA_COLOR} strokeWidth="2" strokeLinejoin="round" strokeDasharray="4,3" />
            <polyline points="73,28 123,17 173,36 223,56 273,47 323,66 373,57 423,53 473,76 523,84 573,108 623,111 673,99 723,7" fill="none" stroke={UNVA_COLOR} strokeWidth="2.5" strokeLinejoin="round" />
            {[73,123,173,223,273,323,373,423,473,523,573,623,673,723].map((cx, i) => (
              <circle key={i} cx={cx} cy={[28,17,36,56,47,66,57,53,76,84,108,111,99,7][i]} r="3.5" fill={UNVA_COLOR} />
            ))}
            <polyline points="73,121 123,105 173,121 223,79 273,108 323,92 373,23 423,105 473,0 523,16 573,88 623,95 673,87 723,83" fill="none" stroke={VA_COLOR} strokeWidth="2.5" strokeLinejoin="round" />
            {[73,123,173,223,273,323,373,423,473,523,573,623,673,723].map((cx, i) => (
              <circle key={i} cx={cx} cy={[121,105,121,79,108,92,23,105,0,16,88,95,87,83][i]} r="3.5" fill={VA_COLOR} />
            ))}
            {["Jan 12","Jan 26","Feb 9","Feb 23","Mar 9","Mar 23","Apr 6","Apr 20","Mei 4","Mei 18","Jun 1","Jun 15","Jun 29","Jul 13"].map((lbl, i) => (
              <text key={lbl} x={73 + i * 50} y="197" textAnchor="middle" fontSize="8" fill="#64748b">{lbl}</text>
            ))}
          </svg>
          <div className="flex items-center gap-5 justify-center mt-3 flex-wrap">
            {([
              [VA_COLOR,   "VA (PO)"],
              [UNVA_COLOR, "UNVA (WIP after Rework)"],
              ["#22c55e",  "Filling 2"],
              [NNVA_COLOR, "NNVA (Manpack)"],
              ["#9ca3af",  "Avg Standard"],
            ] as [string, string][]).map(([c, l]) => (
              <div key={l} className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
                <span className="w-5 h-[2.5px] rounded-sm inline-block" style={{ background: c }} />{l}
              </div>
            ))}
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
