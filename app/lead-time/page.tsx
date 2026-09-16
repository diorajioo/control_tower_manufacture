"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { FloatingChat } from "@/components/dashboard/FloatingChat";
import { Bell, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Helpers ────────────────────────────────────────────────────────────────────

const ID_DAYS = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
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

type Persona = "strategic" | "tactical" | "operational";
type ActivityView = "activity" | "group";
type SKUView = "top" | "bottom";

// ── Shared sub-components ──────────────────────────────────────────────────────

function FilterSelect({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-[0.07em]">{label}</span>
      <button className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-3 py-1.5 text-[12px] font-medium text-slate-700 bg-white hover:border-slate-300 transition-colors">
        {value}
        <ChevronDown size={10} className="text-slate-400 ml-auto" />
      </button>
    </div>
  );
}

// ── KPI cards row (Tactical / Strategic shared) ───────────────────────────────

function KpiSummaryCard({
  label, value, unit, desc, accentColor, footer,
}: {
  label: string; value: string; unit: string; desc: string;
  accentColor: string; footer?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 relative overflow-hidden hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow duration-200">
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ background: accentColor }} />
      <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-2">{label}</p>
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-[2rem] font-bold leading-none tabular-nums tracking-tight" style={{ color: accentColor }}>
          {value}
        </span>
        <span className="text-[13px] text-slate-400 font-medium">{unit}</span>
      </div>
      <p className="text-[12px] text-slate-500 leading-snug">{desc}</p>
      {footer}
    </div>
  );
}

// ── TACTICAL VIEW ─────────────────────────────────────────────────────────────

function TacticalView() {
  const [chartTab, setChartTab] = useState<"gross" | "nett" | "pareto">("gross");

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <p className="text-[11px] text-slate-400 font-medium mb-1">
          Tactical › <span className="text-slate-700 font-semibold">Lead Time per Stage Group</span>
        </p>
        <h1 className="text-[20px] font-bold text-slate-900 leading-tight mb-1">
          Lead Time per Stage Group
        </h1>
        <p className="text-[12px] text-slate-500">PO Created → NDC Received, diurai per stage dengan klasifikasi VA / NNVA / UNVA</p>
      </div>

      {/* Filters */}
      <div className="flex items-end gap-3 px-5 pb-4 flex-wrap">
        <FilterSelect label="Quick Filter" value="Year To Date" />
        <div className="flex flex-col gap-1">
          <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-[0.07em]">Start Date</span>
          <div className="flex items-center gap-2">
            <div className="border border-slate-200 rounded-lg px-3 py-1.5 text-[12px] font-medium text-slate-700 bg-white">01/01/2026</div>
            <span className="text-slate-400 text-sm">—</span>
            <div className="border border-slate-200 rounded-lg px-3 py-1.5 text-[12px] font-medium text-slate-700 bg-white">20/07/2026</div>
          </div>
        </div>
        <FilterSelect label="Plant" value="All Plant" />
        <FilterSelect label="Data Level" value="Weekly" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3.5 px-5 mb-4">
        <KpiSummaryCard label="PO Created → NDC" value="16.67" unit="days" accentColor="#d97706"
          desc="Gross time, seluruh stage"
          footer={
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
              <span className="text-[10.5px] text-slate-400">standar 13,0</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-700">+3,67 hari</span>
            </div>
          }
        />
        <KpiSummaryCard label="PO Released → NDC" value="7.00" unit="days" accentColor="#10b981"
          desc="Basis alternatif — tidak pernah dirata-rata dengan yang di kiri"
          footer={
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
              <span className="text-[10.5px] text-slate-400">standar 6,5</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-700">+0,50 hari</span>
            </div>
          }
        />
        <KpiSummaryCard label="UNVA — WIP Menunggu" value="30.14" unit="days" accentColor="#ef4444"
          desc="Akumulasi seluruh stage WIP"
          footer={<span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-700">pool perbaikan terbesar</span>}
        />
        <KpiSummaryCard label="VA — Waktu Proses" value="11.14" unit="days" accentColor="#1e4076"
          desc="Stage yang benar-benar mengolah produk"
          footer={
            <div className="mt-3 pt-3 border-t border-slate-100">
              <span className="text-[10.5px] text-slate-400">NNVA 8,22 hari</span>
            </div>
          }
        />
      </div>

      {/* Stage chart */}
      <div className="px-5 mb-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow duration-200">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[13px] font-bold text-slate-800 tracking-tight">Lead Time per Stage</p>
              <p className="text-[11px] text-slate-500 mt-0.5">45 stage · klasifikasi VA / NNVA / UNVA dimiliki Lean Senior Advisor, berversi</p>
            </div>
            <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5">
              {([["gross","Gross Time"],["nett","Nett Time"],["pareto","Pareto Gap View"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setChartTab(key)}
                  className={cn("px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all",
                    chartTab === key ? "bg-[#1e4076] text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Legend */}
          <div className="flex gap-4 mb-3">
            {[["#b91c1c","UNVA (Waste)"],["#d97706","NNVA (Perlu tapi tidak tambah nilai)"],["#1e4076","VA (Value-added)"]].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
                <span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: c }} />{l}
              </div>
            ))}
          </div>
          {/* SVG Chart */}
          <div className="overflow-x-auto">
            <svg viewBox="0 0 820 205" style={{ width: "100%", minWidth: 560 }} className="block" fontFamily="Inter, sans-serif">
              <line x1="52" y1="10" x2="52" y2="175" stroke="#e2e8f0" strokeWidth="1"/>
              <line x1="52" y1="175" x2="810" y2="175" stroke="#e2e8f0" strokeWidth="1"/>
              {[0,1,2,4,6].map((v, i) => {
                const y = 175 - (i === 0 ? 0 : i === 1 ? 28 : i === 2 ? 56 : i === 3 ? 84 : 140);
                return <g key={v}><line x1="52" y1={y} x2="810" y2={y} stroke="#f1f5f9" strokeWidth="1"/><text x="46" y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{v}</text></g>;
              })}
              <text x="14" y="100" textAnchor="middle" fontSize="9" fill="#94a3b8" transform="rotate(-90,14,100)">Lead time (hari)</text>
              {/* Bars */}
              {[
                [57, 150, "#b91c1c"],[91, 130, "#b91c1c"],[125, 105, "#b91c1c"],[159, 85, "#b91c1c"],
                [193, 67, "#b91c1c"],[227, 57, "#b91c1c"],[261, 47, "#b91c1c"],[295, 37, "#b91c1c"],
                [329, 55, "#d97706"],[363, 47, "#d97706"],[397, 40, "#d97706"],[431, 35, "#d97706"],
                [465, 30, "#d97706"],[499, 25, "#d97706"],
                [533, 37, "#1e4076"],[567, 32, "#1e4076"],[601, 27, "#1e4076"],[635, 23, "#1e4076"],
                [669, 18, "#1e4076"],[703, 14, "#1e4076"],
              ].map(([x, h, color], i) => (
                <rect key={i} x={Number(x)} y={175 - Number(h)} width="28" height={h} fill={String(color)} rx="2"/>
              ))}
              {/* X labels */}
              {["WIP-PO","QC Hold","PO-Rel","Sched","WIP-Kemas","Timbang","Transport","GR-Delay",
                "Inspect","Lab Test","NDC-In","Release","Quarantine","Sampling",
                "Olah","Kemas","Kemas 2","NDC-QC","Dispensing","IPC"
              ].map((lbl, i) => (
                <text key={lbl} x={71 + i * 34} y="192" textAnchor="middle" fontSize="7" fill="#64748b">{lbl}</text>
              ))}
            </svg>
          </div>
        </div>
      </div>

      {/* Trend line chart */}
      <div className="px-5 pb-5">
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow duration-200">
          <p className="text-[13px] font-bold text-slate-800 tracking-tight mb-0.5">Lead Time Stages Trend Line</p>
          <p className="text-[11px] text-slate-500 mb-3">Median per stage, mingguan · Jan – Jul 2026</p>
          <svg viewBox="0 0 760 210" style={{ width: "100%" }} className="block" fontFamily="Inter, sans-serif">
            <line x1="48" y1="15" x2="48" y2="175" stroke="#e2e8f0" strokeWidth="1"/>
            <line x1="48" y1="175" x2="745" y2="175" stroke="#e2e8f0" strokeWidth="1"/>
            {[0,2,4,6,8,10,12].map((v, i) => {
              const y = 175 - i * 26.7;
              return <g key={v}><line x1="48" y1={y} x2="745" y2={y} stroke="#f1f5f9" strokeWidth="1"/><text x="42" y={y+3} textAnchor="end" fontSize="8.5" fill="#94a3b8">{v}</text></g>;
            })}
            <text x="14" y="100" textAnchor="middle" fontSize="8.5" fill="#94a3b8" transform="rotate(-90,14,100)">Hari</text>
            {/* Avg standard dashed line at 5 hari → y=175-5*13.35=108 */}
            <line x1="48" y1="108" x2="745" y2="108" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="5,4"/>
            {/* Filling 2 (green, near 0) */}
            <polyline points="73,173 123,174 173,173 223,174 273,173 323,174 373,173 423,174 473,173 523,174 573,173 623,174 673,173 723,173" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round"/>
            {/* Manpack (amber) */}
            <polyline points="73,172 123,173 173,172 223,173 273,172 323,173 373,172 423,173 473,172 523,173 573,172 623,173 673,172 723,172" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinejoin="round" strokeDasharray="4,3"/>
            {/* WIP after Rework (red) */}
            <polyline points="73,28 123,17 173,36 223,56 273,47 323,66 373,57 423,53 473,76 523,84 573,108 623,111 673,99 723,7" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinejoin="round"/>
            {[73,123,173,223,273,323,373,423,473,523,573,623,673,723].map((x,i) => {
              const ys = [28,17,36,56,47,66,57,53,76,84,108,111,99,7];
              return <circle key={i} cx={x} cy={ys[i]} r="3.5" fill="#dc2626"/>;
            })}
            {/* PO (navy) */}
            <polyline points="73,121 123,105 173,121 223,79 273,108 323,92 373,23 423,105 473,0 523,16 573,88 623,95 673,87 723,83" fill="none" stroke="#1e4076" strokeWidth="2.5" strokeLinejoin="round"/>
            {[73,123,173,223,273,323,373,423,473,523,573,623,673,723].map((x,i) => {
              const ys = [121,105,121,79,108,92,23,105,0,16,88,95,87,83];
              return <circle key={i} cx={x} cy={ys[i]} r="3.5" fill="#1e4076"/>;
            })}
            {/* X labels */}
            {["Jan 12","Jan 26","Feb 9","Feb 23","Mar 9","Mar 23","Apr 6","Apr 20","Mei 4","Mei 18","Jun 1","Jun 15","Jun 29","Jul 13"].map((lbl,i) => (
              <text key={lbl} x={73 + i * 50} y="192" textAnchor="middle" fontSize="8" fill="#64748b">{lbl}</text>
            ))}
          </svg>
          <div className="flex items-center gap-5 justify-center mt-3 flex-wrap">
            {[["#1e4076","PO"],["#dc2626","WIP after Rework"],["#22c55e","Filling 2"],["#f59e0b","Manpack"],["#9ca3af","Avg Standard"]].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
                <span className="w-5 h-[3px] rounded-sm inline-block" style={{ background: c }} />{l}
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
  const [activityView, setActivityView] = useState<ActivityView>("activity");
  const [skuView, setSkuView] = useState<SKUView>("top");

  const topSKUs = [
    { rank: 1, name: "KAHF SKIN ENERGIZING AND BRIGHTENING FACE WASH 100ML RE...", vol: "6,432,675", lt: 12.65, ltRel: 5.13, pct: 47, color: "#10b981" },
    { rank: 2, name: "OMG OH MY GLAM MATTELAST LIP CREAM 12 SCARLET 2.9G",      vol: "6,315,600", lt: 19.47, ltRel: 14.42, pct: 73, color: "#d97706" },
    { rank: 3, name: "OMG OH MY GLAM MATTELAST LIP CREAM 15 ESPRESSO 2.9G",     vol: "5,873,568", lt: 23.98, ltRel: 15.30, pct: 90, color: "#ef4444" },
    { rank: 4, name: "OMG OH MY GLAM MATTELAST LIP CREAM 14 CAPPUCCINO 2.9G",   vol: "5,431,440", lt: 26.73, ltRel: 17.92, pct: 100, color: "#ef4444" },
    { rank: 5, name: "OMG OH MY GLAM MATTELAST LIP CREAM 13 LATTE 2.9G",        vol: "5,100,084", lt: 23.72, ltRel: 16.76, pct: 89, color: "#ef4444" },
  ];

  const bottomSKUs = [
    { rank: 1, name: "WARDAH UV SHIELD BRIGHT-C HYDRATING SUNSCREEN SERUM SP...",vol: "3,447,164", lt: 16.06, ltRel: 10.87, pct: 60, color: "#ef4444" },
    { rank: 2, name: "EMINA SUN BATTLE SPF 35 PA+++ BRIGHT GLOW AMINO + VIT C...",vol: "2,458,750", lt: 12.78, ltRel: 5.89,  pct: 48, color: "#ef4444" },
    { rank: 3, name: "EMINA BRIGHT STUFF NIACINAMIDE OXY CERAMIDE BRIGHTENING...",vol: "2,321,820", lt: 12.57, ltRel: 5.41,  pct: 47, color: "#d97706" },
    { rank: 4, name: "KAHF TRIPLE ACTION OIL AND COMEDO DEFENSE FACE WASH 100...",vol: "2,184,495", lt: 13.19, ltRel: 6.07,  pct: 49, color: "#d97706" },
    { rank: 5, name: "KAHF BRIGHTENING AND DARK SPOT SCRUB FACE WASH 100ML R...", vol: "2,104,125", lt: 12.19, ltRel: 6.02,  pct: 46, color: "#d97706" },
  ];

  const skus = skuView === "top" ? topSKUs : bottomSKUs;

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <p className="text-[11px] text-slate-400 font-medium mb-1">
          Strategic › <span className="text-slate-700 font-semibold">Lead Time Executive Summary</span>
        </p>
        <h1 className="text-[20px] font-bold text-slate-900 leading-tight mb-1">
          Lead Time Executive Summary
        </h1>
        <p className="text-[12px] text-slate-500">Ringkasan kinerja lead time untuk VP dan BOD · Quarterly · All Plant</p>
      </div>

      {/* 3 Strategic KPI cards */}
      <div className="grid grid-cols-3 gap-3.5 px-5 mb-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 relative overflow-hidden hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow duration-200">
          <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl bg-amber-500" />
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.06em] mb-2">Gross Lead Time YTD</p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[34px] font-bold leading-none text-amber-600">16.67</span>
            <span className="text-[14px] text-slate-500">hari</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-700 ml-1">vs target 13,0</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: "78%", background: "linear-gradient(90deg,#f59e0b,#d97706)" }} />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-slate-400">Target 13,0 hari</span>
            <span className="text-[10px] text-amber-600 font-semibold">78% dari target</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 relative overflow-hidden hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow duration-200">
          <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl bg-red-500" />
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.06em] mb-2">Porsi UNVA (Waste)</p>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-[34px] font-bold leading-none text-red-700">64%</span>
            <span className="text-[14px] text-slate-500">dari total LT</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex gap-0.5">
            <div className="h-full rounded-l-full" style={{ width: "64%", background: "#b91c1c" }} />
            <div className="h-full" style={{ width: "22%", background: "#d97706" }} />
            <div className="h-full rounded-r-full" style={{ width: "14%", background: "#1e4076" }} />
          </div>
          <div className="flex gap-3 mt-2">
            <span className="text-[10px] text-red-700 font-semibold">■ UNVA 64%</span>
            <span className="text-[10px] text-amber-600 font-semibold">■ NNVA 22%</span>
            <span className="text-[10px] text-[#1e4076] font-semibold">■ VA 14%</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 relative overflow-hidden hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow duration-200">
          <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl bg-emerald-500" />
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.06em] mb-2">Potensi Penghematan</p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[34px] font-bold leading-none text-emerald-600">3.67</span>
            <span className="text-[14px] text-slate-500">hari/batch</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">Jika UNVA top-5 stage dieleminasi, lead time turun ke ~13,0 hari</p>
        </div>
      </div>

      {/* Activity chart */}
      <div className="px-5 mb-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow duration-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[13px] font-bold text-slate-800 tracking-tight">Lead Time per Activity</p>
              <p className="text-[11px] text-slate-500 mt-0.5">YTD 2026 · All Plant · Median per stage dalam hari</p>
            </div>
            <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5">
              {([["activity","Per Activity"],["group","Per Stage Group"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setActivityView(key)}
                  className={cn("px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all",
                    activityView === key ? "bg-[#1e4076] text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {activityView === "activity" ? (
            <>
              <svg viewBox="0 0 720 215" style={{ width: "100%" }} className="block" fontFamily="Inter, sans-serif">
                <line x1="55" y1="20" x2="55" y2="195" stroke="#e2e8f0" strokeWidth="1"/>
                <line x1="55" y1="195" x2="710" y2="195" stroke="#e2e8f0" strokeWidth="1"/>
                {[0,2,4,6,8,10].map((v,i) => {
                  const y = 195 - i * 34;
                  return <g key={v}><line x1="55" y1={y} x2="710" y2={y} stroke="#f1f5f9" strokeWidth="1"/><text x="49" y={y+3} textAnchor="end" fontSize="9" fill="#94a3b8">{v}</text></g>;
                })}
                <text x="14" y="112" textAnchor="middle" fontSize="9" fill="#94a3b8" transform="rotate(-90,14,112)">Lead Time (Days)</text>
                {/* Bars: PO=6.62, TIMBANG=0.35, OLAH=0.61, CUCI OLAH=0.21, KEMAS1=0.60, KEMAS2=1.36, CUCI KEMAS=0.06, REC NDC=0.60, WIP=8.97 */}
                {[
                  [60,  112.5, "6.62", "PO"],
                  [135,   6,   "0.35", "TIMBANG"],
                  [210,  10.4, "0.61", "OLAH"],
                  [285,   3.6, "0.21", "CUCI OLAH"],
                  [360,  10.2, "0.60", "KEMAS 1"],
                  [435,  23.1, "1.36", "KEMAS 2"],
                  [510,   1.0, "0.06", "CUCI KEMAS"],
                  [585,  10.2, "0.60", "REC NDC"],
                  [660, 152.5, "8.97", "WIP"],
                ].map(([x, h, v, lbl]) => (
                  <g key={String(lbl)}>
                    <rect x={Number(x)} y={195 - Number(h)} width="48" height={Number(h)} fill="#4472C4" rx="2"/>
                    <text x={Number(x) + 24} y={195 - Number(h) - 4} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600">{String(v)}</text>
                    <circle cx={Number(x) + 24} cy="192" r="3" fill="#1e3a5f"/>
                    <text x={Number(x) + 24} y="210" textAnchor="middle" fontSize="8.5" fill="#64748b">{String(lbl)}</text>
                  </g>
                ))}
              </svg>
              <div className="flex gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
                  <span className="w-4 h-2 rounded-sm bg-[#4472C4] inline-block" />Aktual
                </div>
                <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-[#1e3a5f] inline-block" />Standar
                </div>
              </div>
            </>
          ) : (
            <svg viewBox="0 0 720 215" style={{ width: "100%" }} className="block" fontFamily="Inter, sans-serif">
              <line x1="55" y1="20" x2="55" y2="195" stroke="#e2e8f0" strokeWidth="1"/>
              <line x1="55" y1="195" x2="710" y2="195" stroke="#e2e8f0" strokeWidth="1"/>
              {[0,2,4,6,8,10].map((v,i) => {
                const y = 195 - i * 34;
                return <g key={v}><line x1="55" y1={y} x2="710" y2={y} stroke="#f1f5f9" strokeWidth="1"/><text x="49" y={y+3} textAnchor="end" fontSize="9" fill="#94a3b8">{v}</text></g>;
              })}
              {/* PO & Approval 6.62 (UNVA) */}
              <rect x="80" y={195-112.5} width="110" height="112.5" fill="#b91c1c" rx="3"/>
              <text x="135" y={195-112.5-7} textAnchor="middle" fontSize="11" fill="#374151" fontWeight="700">6.62</text>
              {/* Produksi 2.84 (VA) */}
              <rect x="250" y={195-48.3} width="110" height="48.3" fill="#1e4076" rx="3"/>
              <text x="305" y={195-48.3-7} textAnchor="middle" fontSize="11" fill="#374151" fontWeight="700">2.84</text>
              {/* QC & NDC 0.60 (NNVA) */}
              <rect x="420" y={195-10.2} width="110" height="10.2" fill="#d97706" rx="3"/>
              <text x="475" y={195-10.2-7} textAnchor="middle" fontSize="11" fill="#374151" fontWeight="700">0.60</text>
              {/* WIP Waiting 8.97 (UNVA) */}
              <rect x="590" y={195-152.5} width="110" height="152.5" fill="#b91c1c" rx="3"/>
              <text x="645" y={195-152.5-7} textAnchor="middle" fontSize="11" fill="#374151" fontWeight="700">8.97</text>
              {/* Labels */}
              <text x="135" y="208" textAnchor="middle" fontSize="9.5" fill="#374151" fontWeight="600">PO &amp; Approval</text>
              <text x="305" y="208" textAnchor="middle" fontSize="9.5" fill="#374151" fontWeight="600">Produksi</text>
              <text x="475" y="208" textAnchor="middle" fontSize="9.5" fill="#374151" fontWeight="600">QC &amp; NDC</text>
              <text x="645" y="208" textAnchor="middle" fontSize="9.5" fill="#374151" fontWeight="600">WIP Waiting</text>
              <text x="135" y="216" textAnchor="middle" fontSize="8" fill="#b91c1c">UNVA</text>
              <text x="305" y="216" textAnchor="middle" fontSize="8" fill="#1e4076">VA + NNVA</text>
              <text x="475" y="216" textAnchor="middle" fontSize="8" fill="#d97706">NNVA</text>
              <text x="645" y="216" textAnchor="middle" fontSize="8" fill="#b91c1c">UNVA</text>
            </svg>
          )}
        </div>
      </div>

      {/* SKU table */}
      <div className="px-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-bold text-slate-800 tracking-tight">Top SKU by Volume Lead Time Performance</p>
          <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5">
            {([["top","Top 5"],["bottom","Bottom 5"]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setSkuView(key)}
                className={cn("px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all",
                  skuView === key ? "bg-[#1e4076] text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow duration-200">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.06em] px-4 py-2.5 text-left w-8">#</th>
                <th className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.06em] px-4 py-2.5 text-left">Product Name</th>
                <th className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.06em] px-4 py-2.5 text-right">Release FG (pcs)</th>
                <th className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.06em] px-4 py-2.5 text-right">LT from PO (hari)</th>
                <th className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.06em] px-4 py-2.5 text-right">LT from PO Released</th>
              </tr>
            </thead>
            <tbody>
              {skus.map((sku) => (
                <tr key={sku.rank} className="border-b border-slate-100 hover:bg-slate-50 transition-colors last:border-none">
                  <td className="px-4 py-2.5">
                    <span className={cn(
                      "w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold",
                      skuView === "top" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                    )}>{sku.rank}</span>
                  </td>
                  <td className="px-4 py-2.5 max-w-[240px]">
                    <p className="text-[11.5px] font-medium text-slate-700 truncate" title={sku.name}>{sku.name}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-[11px] text-slate-500 tabular-nums">{sku.vol}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-[12px] font-bold tabular-nums" style={{ color: sku.color, fontFamily: "Inter, sans-serif" }}>{sku.lt}</span>
                    <div className="h-1 rounded-full bg-slate-100 overflow-hidden mt-1 w-16 ml-auto">
                      <div className="h-full rounded-full" style={{ width: `${sku.pct}%`, background: sku.color }} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-[12px] font-bold tabular-nums" style={{ color: sku.ltRel <= 7 ? "#10b981" : sku.ltRel <= 12 ? "#d97706" : "#ef4444", fontFamily: "Inter, sans-serif" }}>{sku.ltRel}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quarterly trend + Risk table */}
      <div className="grid grid-cols-[2fr_1fr] gap-3.5 px-5 pb-5">
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow duration-200">
          <p className="text-[13px] font-bold text-slate-800 tracking-tight mb-0.5">Tren Gross Lead Time — Quarterly</p>
          <p className="text-[11px] text-slate-500 mb-3">Rolling 4 kuartal · All Plant · vs target 13,0 hari</p>
          <svg viewBox="0 0 480 170" style={{ width: "100%" }} className="block" fontFamily="Inter, sans-serif">
            <line x1="50" y1="10" x2="50" y2="145" stroke="#e2e8f0" strokeWidth="1"/>
            <line x1="50" y1="145" x2="470" y2="145" stroke="#e2e8f0" strokeWidth="1"/>
            {[12,14,16,18].map((v,i) => {
              const y = 145 - i * 38;
              return <g key={v}><line x1="50" y1={y} x2="470" y2={y} stroke="#f1f5f9" strokeWidth="1"/><text x="44" y={y+3} textAnchor="end" fontSize="9" fill="#94a3b8">{v}</text></g>;
            })}
            {/* Target at 13 → y=145-1*38=107 */}
            <line x1="50" y1="107" x2="470" y2="107" stroke="#10b981" strokeWidth="1.5" strokeDasharray="5,4"/>
            <text x="472" y="110" fontSize="8" fill="#10b981" fontWeight="600">target</text>
            {/* Area */}
            <defs><linearGradient id="qGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d97706" stopOpacity="0.18"/><stop offset="100%" stopColor="#d97706" stopOpacity="0"/></linearGradient></defs>
            <polygon points="110,68 215,78 320,73 425,55 425,145 110,145" fill="url(#qGrad)"/>
            <polyline points="110,68 215,78 320,73 425,55" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
            {[[110,68,"17.2"],[215,78,"16.8"],[320,73,"17.0"],[425,55,"16.7"]].map(([x,y,v]) => (
              <g key={String(v)}>
                <circle cx={Number(x)} cy={Number(y)} r="4" fill="#d97706"/>
                <text x={Number(x)} y={Number(y)-8} textAnchor="middle" fontSize="9" fill="#d97706" fontWeight="700">{String(v)}</text>
              </g>
            ))}
            {["Q3 2025","Q4 2025","Q1 2026","Q2 2026"].map((q,i) => (
              <text key={q} x={110+i*105} y="160" textAnchor="middle" fontSize="9" fill="#64748b">{q}</text>
            ))}
          </svg>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow duration-200">
          <p className="text-[13px] font-bold text-slate-800 tracking-tight mb-3">Top Risk Areas</p>
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.06em] pb-2 text-left">Area</th>
                <th className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.06em] pb-2 text-right">Gap</th>
                <th className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.06em] pb-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[
                { area: "WIP menunggu", sub: "Akumulasi antar stage",     gap: "+30.1 hr", gapColor: "#b91c1c", pill: "Critical", pillBg: "bg-red-50 text-red-700" },
                { area: "PO → Release", sub: "Approval & dokumen",         gap: "+3.7 hr",  gapColor: "#92400e", pill: "Warning",  pillBg: "bg-amber-50 text-amber-700" },
                { area: "QC Hold time", sub: "Lab test turnaround",         gap: "+2.1 hr",  gapColor: "#92400e", pill: "Warning",  pillBg: "bg-amber-50 text-amber-700" },
                { area: "NDC-In",       sub: "Penerimaan gudang",           gap: "−0.4 hr",  gapColor: "#15803d", pill: "On Track", pillBg: "bg-green-50 text-green-700" },
              ].map(({ area, sub, gap, gapColor, pill, pillBg }) => (
                <tr key={area}>
                  <td className="py-2.5">
                    <p className="text-[12px] font-semibold text-slate-800">{area}</p>
                    <p className="text-[10px] text-slate-400">{sub}</p>
                  </td>
                  <td className="py-2.5 text-right"><span className="text-[11px] font-bold" style={{ color: gapColor }}>{gap}</span></td>
                  <td className="py-2.5 text-right"><span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md", pillBg)}>{pill}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── OPERATIONAL VIEW ──────────────────────────────────────────────────────────

function OperationalView() {
  const exceptions = [
    { batch: "#BT-20260913-042", stage: "WIP Menunggu",  msg: "Sudah 8,4 hari di stage WIP sebelum Kemas. Standar maks 4 hari.", meta: "Plant 1 · Bulk Line A · Delay 4,4 hari",  severity: "critical" as const },
    { batch: "#BT-20260911-018", stage: "QC Hold",       msg: "QC Hold 5,2 hari — menunggu hasil lab uji stabilitas.",           meta: "Plant 2 · Lab QC · Delay 2,2 hari",       severity: "critical" as const },
    { batch: "#BT-20260910-055", stage: "PO Released",   msg: "Approval dokumen PO sudah 3,1 hari. Approaching limit 3,5 hari.", meta: "Plant 1 · Procurement · Sisa 0,4 hari",  severity: "warning" as const },
    { batch: "#BT-20260912-031", stage: "NDC-In",        msg: "Penerimaan NDC 2,8 hari. Mendekati batas 3 hari.",               meta: "NDC Cikarang · Receiving · Sisa 0,2 hari", severity: "warning" as const },
  ];

  return (
    <div className="flex flex-col gap-0">
      <div className="px-5 pt-5 pb-3">
        <p className="text-[11px] text-slate-400 font-medium mb-1">
          Operational › <span className="text-slate-700 font-semibold">Lead Time Daily Tracker</span>
        </p>
        <h1 className="text-[20px] font-bold text-slate-900 leading-tight mb-1">
          Lead Time Daily Tracker
        </h1>
        <p className="text-[12px] text-slate-500">Monitoring harian per batch · PO yang sedang berjalan · Update setiap hari kerja pukul 07:00 WIB</p>
      </div>

      <div className="flex items-end gap-3 px-5 pb-4 flex-wrap">
        <FilterSelect label="Quick Filter" value="7 Hari Terakhir" />
        <FilterSelect label="Plant" value="All Plant" />
        <FilterSelect label="Stage" value="Semua Stage" />
        <button className="flex items-center gap-1.5 border border-red-300 rounded-lg px-3 py-1.5 text-[12px] font-bold text-red-600 bg-red-50 self-end">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          {exceptions.length} Exceptions Aktif
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3.5 px-5 pb-5">
        {/* Exceptions */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow duration-200">
          <p className="text-[13px] font-bold text-slate-800 tracking-tight mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Exceptions Aktif
          </p>
          <div className="flex flex-col gap-2.5">
            {exceptions.map((ex) => (
              <div key={ex.batch}
                className={cn("flex gap-3 p-3 rounded-xl border-l-4", ex.severity === "critical" ? "bg-red-50 border-l-red-500" : "bg-amber-50 border-l-amber-400")}>
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5", ex.severity === "critical" ? "bg-red-100" : "bg-amber-100")}>
                  <span className="text-[12px]">{ex.severity === "critical" ? "🔴" : "🟡"}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-slate-800">{ex.batch} · {ex.stage}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{ex.msg}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{ex.meta}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Heatmap */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow duration-200">
          <p className="text-[13px] font-bold text-slate-800 tracking-tight mb-0.5">Lead Time Stage Harian</p>
          <p className="text-[11px] text-slate-500 mb-3">Rata-rata lead time per stage · 7 hari terakhir · hari kerja</p>
          <svg viewBox="0 0 360 220" style={{ width: "100%" }} className="block" fontFamily="Inter, sans-serif">
            {["WIP-PO","QC Hold","PO-Release","Scheduling","Transport","NDC-In"].map((stage, i) => (
              <text key={stage} x="78" y={28 + i * 28} textAnchor="end" fontSize="9.5" fill="#374151">{stage}</text>
            ))}
            {["8 Sep","9 Sep","10 Sep","11 Sep","12 Sep","13 Sep"].map((d, i) => (
              <text key={d} x={108 + i * 40} y="195" textAnchor="middle" fontSize="9" fill="#94a3b8">{d}</text>
            ))}
            {/* Heatmap rows (6 stages × 6 days) */}
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
                  <rect x={85 + ci * 40} y={13 + ri * 28} width="38" height="22" fill={fill} rx="3"/>
                  <text x={104 + ci * 40} y={28 + ri * 28} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600">
                    {[[8.1,8.4,7.9,7.6,8.4,8.1],[5.1,4.6,5.3,4.4,4.8,5.2],[3.2,2.8,3.1,2.9,2.7,3.1],[1.8,1.7,1.9,1.6,1.8,1.7],[0.8,0.9,1.2,0.8,0.9,0.7],[2.6,2.4,2.7,2.9,2.5,2.8]][ri][ci]}
                  </text>
                </g>
              ))
            )}
            {/* Legend */}
            <rect x="85" y="208" width="10" height="7" fill="#fca5a5" rx="1"/><text x="98" y="215" fontSize="8" fill="#64748b">Critical</text>
            <rect x="140" y="208" width="10" height="7" fill="#fde68a" rx="1"/><text x="153" y="215" fontSize="8" fill="#64748b">Warning</text>
            <rect x="200" y="208" width="10" height="7" fill="#d1fae5" rx="1"/><text x="213" y="215" fontSize="8" fill="#64748b">Normal</text>
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const PERSONA_CONFIG = {
  strategic:   { badge: "VP / BOD", badgeCls: "bg-violet-100 text-violet-700", label: "Strategic" },
  tactical:    { badge: "Manager",  badgeCls: "bg-blue-100 text-blue-700",    label: "Tactical" },
  operational: { badge: "Leader",   badgeCls: "bg-green-100 text-green-700",  label: "Operational" },
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-6 h-6 border-2 border-[#1e4076] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Topbar */}
        <div className="h-[52px] bg-[#1e4076] flex items-center gap-3 px-4 shrink-0 border-b border-[#16305C]">
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
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-[1.5px] border-[#1e4076] flex items-center justify-center text-[8px] font-bold text-white">3</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center cursor-pointer shadow-sm">
            <span className="text-white text-[11px] font-bold">ES</span>
          </div>
        </div>

        {/* Persona switcher */}
        <div className="flex items-center bg-white border-b border-slate-200 px-5 shrink-0">
          {(Object.entries(PERSONA_CONFIG) as [Persona, typeof PERSONA_CONFIG[Persona]][]).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setPersona(key)}
              className={cn(
                "flex items-center gap-2 py-3 px-4 border-b-2 text-[12px] font-semibold transition-all",
                persona === key
                  ? "border-[#1e4076] text-[#1e4076]"
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
