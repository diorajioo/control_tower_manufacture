"use client";

import { useState } from "react";
import { ResponsiveBar } from "@nivo/bar";
import { cn } from "@/lib/utils";

const VA_COLOR   = "#215AA8";
const NNVA_COLOR = "#d97706";
const UNVA_COLOR = "#b91c1c";

const STAGE_GROUP_DATA = [
  { stage: "PO & Approval", value: 6.62, color: UNVA_COLOR, cls: "UNVA" },
  { stage: "Produksi",      value: 2.84, color: VA_COLOR,   cls: "VA"   },
  { stage: "QC & NDC",      value: 0.60, color: NNVA_COLOR, cls: "NNVA" },
  { stage: "WIP Waiting",   value: 8.97, color: UNVA_COLOR, cls: "UNVA" },
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

const TOP_SKUS = [
  { rank: 1, name: "KAHF SKIN ENERGIZING FACE WASH 100ML",       lt: 12.65, ltRel: 5.13,  color: "#10b981" },
  { rank: 2, name: "OMG MATTELAST LIP CREAM 12 SCARLET 2.9G",    lt: 19.47, ltRel: 14.42, color: NNVA_COLOR },
  { rank: 3, name: "OMG MATTELAST LIP CREAM 15 ESPRESSO 2.9G",   lt: 23.98, ltRel: 15.30, color: UNVA_COLOR },
  { rank: 4, name: "OMG MATTELAST LIP CREAM 14 CAPPUCCINO 2.9G", lt: 26.73, ltRel: 17.92, color: UNVA_COLOR },
  { rank: 5, name: "OMG MATTELAST LIP CREAM 13 LATTE 2.9G",      lt: 23.72, ltRel: 16.76, color: UNVA_COLOR },
];

const TOTAL_LT  = STAGE_GROUP_DATA.reduce((s, d) => s + d.value, 0);
const VA_DAYS   = STAGE_GROUP_DATA.filter((d) => d.cls === "VA").reduce((s, d) => s + d.value, 0);
const NNVA_DAYS = STAGE_GROUP_DATA.filter((d) => d.cls === "NNVA").reduce((s, d) => s + d.value, 0);
const UNVA_DAYS = STAGE_GROUP_DATA.filter((d) => d.cls === "UNVA").reduce((s, d) => s + d.value, 0);

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
};

function MonitorKpiHero({ label, value, unit, sub, accent }: {
  label: string; value: string; unit: string; sub: string; accent: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 flex overflow-hidden">
      <div className="w-[5px] shrink-0" style={{ background: accent }} />
      <div className="flex-1 px-4 py-3 min-w-0">
        <p className="text-[9.5px] font-bold uppercase tracking-[0.09em] text-slate-400 mb-1">{label}</p>
        <div className="flex items-baseline gap-1 leading-none">
          <span className="text-[2.2rem] font-bold tabular-nums tracking-tight leading-none" style={{ color: accent }}>{value}</span>
          <span className="text-[13px] font-medium text-slate-400 ml-0.5">{unit}</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

export function LeadTimeMonitor() {
  const [stageView, setStageView] = useState<"group" | "activity">("group");
  const data = stageView === "group" ? STAGE_GROUP_DATA : ACTIVITY_DATA;

  return (
    <div className="h-full overflow-hidden flex flex-col gap-2.5 p-3">

      {/* 3 KPI hero cards */}
      <div className="grid grid-cols-3 gap-2.5 shrink-0">
        <MonitorKpiHero
          label="Gross Lead Time"
          value={TOTAL_LT.toFixed(2)} unit="hari"
          sub="Median YTD 2026 · All Plant"
          accent={VA_COLOR}
        />
        <MonitorKpiHero
          label="UNVA %"
          value={(UNVA_DAYS / TOTAL_LT * 100).toFixed(1)} unit="%"
          sub={`${UNVA_DAYS.toFixed(2)} hari waste dari total ${TOTAL_LT.toFixed(2)} hari`}
          accent={UNVA_COLOR}
        />
        <MonitorKpiHero
          label="Savings Potential"
          value={(UNVA_DAYS * 0.7).toFixed(2)} unit="hari"
          sub="Est. 70% UNVA dapat dieliminasi"
          accent="#10b981"
        />
      </div>

      {/* VA / NNVA / UNVA breakdown — compact row like Strategic's Equipment section */}
      <div className="grid grid-cols-3 gap-2 shrink-0">
        {[
          { label: "VA",   days: VA_DAYS,   color: VA_COLOR   },
          { label: "NNVA", days: NNVA_DAYS, color: NNVA_COLOR },
          { label: "UNVA", days: UNVA_DAYS, color: UNVA_COLOR },
        ].map(({ label, days, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 flex overflow-hidden">
            <div className="w-[5px] shrink-0" style={{ background: color }} />
            <div className="flex-1 px-3 py-2 min-w-0">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.09em] text-slate-400 mb-1">{label}</p>
              <div className="flex items-baseline gap-1 leading-none">
                <span className="text-[1.75rem] font-bold tabular-nums tracking-tight leading-none" style={{ color }}>{days.toFixed(2)}</span>
                <span className="text-[11px] font-medium text-slate-400 ml-0.5">hari</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">{(days / TOTAL_LT * 100).toFixed(1)}% of total</p>
            </div>
          </div>
        ))}
      </div>

      {/* Stage chart + Top 5 SKU — fills remaining space */}
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-2.5">

        {/* Stage breakdown chart */}
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden p-3">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.08em] leading-none">
                Lead Time per Stage
              </span>
              <div className="flex gap-2">
                {([[VA_COLOR, "VA"], [NNVA_COLOR, "NNVA"], [UNVA_COLOR, "UNVA"]] as [string, string][]).map(([c, l]) => (
                  <div key={l} className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: c }} />
                    {l}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5 shrink-0">
              {([["group", "Group"], ["activity", "Activity"]] as const).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setStageView(k)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all",
                    stageView === k ? "bg-[#215AA8] text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveBar
              data={data}
              keys={["value"]}
              indexBy="stage"
              theme={nivoTheme}
              margin={{ top: 4, right: 12, bottom: 28, left: 32 }}
              padding={stageView === "group" ? 0.48 : 0.36}
              borderRadius={4}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              colors={(bar: any) => String(bar.data.color)}
              colorBy="indexValue"
              axisBottom={{ tickSize: 0, tickPadding: 8 }}
              axisLeft={{ tickSize: 0, tickPadding: 6, tickValues: 4, format: (v) => Number(v).toFixed(1) }}
              enableGridX={false}
              enableLabel={false}
              tooltip={({ indexValue, value, color }) => (
                <div style={{ background: "#2A3D4A", borderRadius: 10, padding: "8px 13px", fontSize: 11, minWidth: 130, boxShadow: "0 8px 32px rgba(0,0,0,0.28)", fontFamily: "inherit" }}>
                  <p style={{ fontWeight: 700, marginBottom: 4, color: String(color) }}>{String(indexValue)}</p>
                  <p style={{ color: "#f1f5f9", margin: 0 }}>{Number(value).toFixed(2)} hari</p>
                </div>
              )}
            />
          </div>
        </div>

        {/* Top 5 SKU */}
        <div className="min-h-0 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-slate-100 shrink-0 flex items-center gap-2">
            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.08em]">Top 5 SKU</span>
            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-[#D3DEEE] text-[#143665] ml-auto">Highest Volume</span>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0">
                <tr className="bg-[#F8FAFC]">
                  <th className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.06em] px-3 py-1.5 text-left w-6">#</th>
                  <th className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.06em] px-3 py-1.5 text-left">Product</th>
                  <th className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.06em] px-3 py-1.5 text-right">LT PO</th>
                  <th className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.06em] px-3 py-1.5 text-right">LT Rel</th>
                </tr>
              </thead>
              <tbody>
                {TOP_SKUS.map((sku) => (
                  <tr key={sku.rank} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <span className="w-5 h-5 rounded bg-[#D3DEEE] text-[#143665] flex items-center justify-center text-[9px] font-bold">{sku.rank}</span>
                    </td>
                    <td className="px-3 py-1.5 max-w-[200px]">
                      <p className="text-[10.5px] font-medium text-[#2A3D4A] truncate">{sku.name}</p>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <span className="text-[11px] font-bold tabular-nums" style={{ color: sku.color }}>{sku.lt}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <span className="text-[11px] font-bold tabular-nums" style={{ color: sku.ltRel <= 7 ? "#10b981" : sku.ltRel <= 12 ? NNVA_COLOR : UNVA_COLOR }}>
                        {sku.ltRel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
