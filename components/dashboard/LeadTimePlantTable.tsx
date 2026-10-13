"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { ChartCard, EmptyState } from "@/components/dashboard/LeadTimeCharts";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { activityLabel, PROCESS_GROUPS } from "@/lib/leadTimeStages";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Lead time breakdown per plant (Overview → Tactical view).
// Rows = network + each PLANT. Columns = Plant · Gross LT · Nett LT · lead time per PO by process · On-time.
// Two views:
//   Group Process — 6 groups: PO · Weighing · Mixing (OLAH + CUCI OLAH) · Filpac (KEMAS 1 + KEMAS 2 + CUCI KEMAS)
//                   · Receive NDC · WIP (every WIP activity)
//   Process       — one column per ACTIVITY under its group header, in ACTIVITY_SEQUENCE order; the WIP group shows
//                   the 5 largest WIP activities (network) + "Others (n processes)". A picker hides columns.
// Cell = SUM(NET_LEADTIME) of the activity / POs of that plant (days, or hours). A plant's cell turns red when
// it is above the network value of the same column. Plant, Gross and Nett stay visible when the table scrolls.
// Data: /api/lead-time/stages → plants (stages + activities per plant) and activities (stage, sequence).
// ─────────────────────────────────────────────────────────────────────────────

export interface PlantBreakdown {
  plant: string | null;   // null = network (all plants)
  poCount: number;
  gross: number | null;
  nett: number | null;
  onTimePct: number | null;
  /** days per PO per POSITION */
  stages: Record<string, number>;
  /** days per PO per ACTIVITY */
  activities?: Record<string, number>;
}

export interface PlantActivity { activity: string; stage: string; sequence: number | null }

type View = "group" | "process";

const GROUPS = PROCESS_GROUPS;
const WIP_TOP = 5;

interface Col { key: string; label: string; group: string; value: (row: PlantBreakdown) => number | undefined }

// Values arrive in days; hours = × 24 with 1 decimal
const fmtIn = (unit: "days" | "hours") => (n: number | null | undefined) =>
  n == null ? "—" : unit === "hours" ? (n * 24).toFixed(1) : n.toFixed(2);

// Red tint scales with how far above the network the plant is; full strength at +30%.
function excessTint(value: number | undefined, network: number | undefined): string | undefined {
  if (value == null || !network || value <= network) return undefined;
  const strength = Math.min((value / network - 1) / 0.3, 1);
  return `rgba(217, 45, 32, ${(0.05 + strength * 0.15).toFixed(3)})`;
}

const sum = (rec: Record<string, number> | undefined, keys: readonly string[]) => {
  let total = 0, any = false;
  for (const k of keys) if (rec?.[k] != null) { total += rec[k]; any = true; }
  return any ? total : undefined;
};

// Header: Paragon Blue group row, light-blue column row (red is reserved for the cell signal)
const TH = "px-3 py-2 text-[10px] font-bold uppercase tracking-wider";
const TH_TOP = "bg-[#1E4076] text-white whitespace-nowrap";
const TH_SUB = "bg-[#EEF4FB] text-[#1E4076] align-bottom leading-tight";
const TH_DIV = "border-l border-white/25";
const TD = "px-3 py-2.5 text-[12px] text-slate-700 text-right tabular-nums whitespace-nowrap";
// Sticky left block (Plant · Gross · Nett): fixed widths so the offsets line up
const STICKY = [
  { w: 128, left: 0 },
  { w: 76, left: 128 },
  { w: 76, left: 204 },
] as const;
const stickyStyle = (i: 0 | 1 | 2) => ({ position: "sticky" as const, left: STICKY[i].left, minWidth: STICKY[i].w, width: STICKY[i].w, zIndex: 2 });

export function LeadTimePlantTable({ data, activities = [], targetDays, loading, basis = "created", unit = "days" }: {
  data: PlantBreakdown[] | null;
  activities?: PlantActivity[];
  targetDays: number;
  loading: boolean;
  basis?: "created" | "released";
  unit?: "days" | "hours";
}) {
  const [view, setView] = useState<View>("group");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const fmt = fmtIn(unit);
  const basisLabel = basis === "released" ? "PO Released → Receive NDC" : "PO Created → Receive NDC";
  const network = data?.find((p) => p.plant == null);
  const plants = (data ?? []).filter((p) => p.plant != null);

  // All process columns (before the picker), grouped
  const processCols = useMemo((): Col[] => {
    const cols: Col[] = [];
    for (const g of GROUPS) {
      if (g.id !== "wip") {
        activities
          .filter((a) => (g.stages as readonly string[]).includes(a.stage))
          .sort((a, b) => (a.sequence ?? 999) - (b.sequence ?? 999))
          .forEach((a) => cols.push({ key: a.activity, label: activityLabel(a.activity), group: g.id, value: (r) => r.activities?.[a.activity] }));
        continue;
      }
      const wip = activities
        .filter((a) => a.stage === "WIP")
        .sort((a, b) => (network?.activities?.[b.activity] ?? 0) - (network?.activities?.[a.activity] ?? 0));
      wip.slice(0, WIP_TOP).forEach((a) =>
        cols.push({ key: a.activity, label: activityLabel(a.activity), group: g.id, value: (r) => r.activities?.[a.activity] }));
      const rest = wip.slice(WIP_TOP).map((a) => a.activity);
      if (rest.length > 0) {
        cols.push({ key: "__wip_others", label: `Others (${rest.length} processes)`, group: g.id, value: (r) => sum(r.activities, rest) });
      }
    }
    return cols;
  }, [activities, network]);

  const groupCols = useMemo((): Col[] =>
    GROUPS.map((g) => ({ key: g.id, label: g.label, group: g.id, value: (r: PlantBreakdown) => sum(r.stages, g.stages) })), []);

  const cols = view === "group" ? groupCols : processCols.filter((c) => !hidden.has(c.key));
  // Header groups for the Process view (consecutive columns of the same group)
  const spans = useMemo(() => {
    const out: { id: string; label: string; n: number; single: boolean }[] = [];
    for (const c of cols) {
      const last = out[out.length - 1];
      if (last && last.id === c.group) last.n++;
      else out.push({ id: c.group, label: GROUPS.find((g) => g.id === c.group)?.label ?? c.group, n: 1, single: false });
    }
    // A group with one column whose name equals the group (PO, Weighing, Receive NDC) uses a single tall header
    for (const s of out) {
      const col = cols.find((c) => c.group === s.id);
      s.single = s.n === 1 && col?.label.toLowerCase() === s.label.toLowerCase();
    }
    return out;
  }, [cols]);

  const twoRows = view === "process" && spans.some((s) => !s.single);
  const firstOfGroup = (c: Col, i: number) => i === 0 || cols[i - 1].group !== c.group;

  const actions = (
    <>
      {view === "process" && processCols.length > 0 && (
        <ColumnPicker cols={processCols} hidden={hidden} onChange={setHidden} />
      )}
      <SegmentedToggle<View>
        ariaLabel="Breakdown level"
        options={[{ key: "group", label: "Group Process" }, { key: "process", label: "Process" }]}
        value={view}
        onChange={setView}
      />
    </>
  );

  return (
    <ChartCard
      title="Lead time breakdown per plant"
      subtitle={`${unit === "hours" ? "Hours" : "Days"} per PO per ${view === "group" ? "group process" : "process"}. Red cell = above the network value for that column (darker = further above).`}
      info={`Cell = net time of the process ÷ POs of that plant (POs completed in the period). Group Process: Mixing = Processing + Processing Cleaning, Filpac = Packing 1 + Packing 2 + Packing Cleaning, WIP = all waiting. Process: one column per activity in process order; WIP shows the ${WIP_TOP} largest + the rest as Others. Red compares each plant with the network row, not with a standard. Gross LT and On-time follow the PO Created / PO Released toggle (now ${basisLabel}). On-time = share of POs with gross lead time ≤ ${targetDays} days; there is no due-date column yet.`}
      actions={actions}
    >
      {!network ? (
        <div style={{ height: 160 }}><EmptyState loading={loading} /></div>
      ) : view === "process" && processCols.length === 0 ? (
        // Process detail missing (e.g. a response cached before activity data existed) — say so instead of an empty table
        <div className="h-[120px] flex items-center justify-center text-[11px] text-slate-400">
          No process detail for this selection — reload the page or apply the filters again.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-3 mt-2">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th rowSpan={twoRows ? 2 : 1} style={stickyStyle(0)} className={cn(TH, TH_TOP, "text-left align-bottom")}>Plant</th>
                  <th rowSpan={twoRows ? 2 : 1} style={stickyStyle(1)} className={cn(TH, TH_TOP, "text-right align-bottom")}>Gross LT</th>
                  <th rowSpan={twoRows ? 2 : 1} style={stickyStyle(2)} className={cn(TH, TH_TOP, "text-right align-bottom")}>Nett LT</th>
                  {view === "group"
                    ? cols.map((c, i) => (
                        <th key={c.key} className={cn(TH, TH_TOP, "text-right align-bottom", i === 0 && TH_DIV)}>{c.label}</th>
                      ))
                    : spans.map((s) => (
                        <th key={s.id} colSpan={s.n} rowSpan={twoRows && s.single ? 2 : 1}
                          className={cn(TH, TH_TOP, TH_DIV, s.single ? "text-right align-bottom" : "text-center")}>
                          {s.label}
                        </th>
                      ))}
                  <th rowSpan={twoRows ? 2 : 1} className={cn(TH, TH_TOP, TH_DIV, "text-right align-bottom")}>On-time</th>
                </tr>
                {twoRows && (
                  <tr className="border-b border-[#EBEBEB]">
                    {cols.map((c, i) => {
                      const span = spans.find((s) => s.id === c.group);
                      if (span?.single) return null;
                      return (
                        <th key={c.key} className={cn(TH, TH_SUB, "text-right min-w-[72px] max-w-[96px]", firstOfGroup(c, i) && "border-l border-[#C3CEE3]")}>
                          {c.label}
                        </th>
                      );
                    })}
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[network, ...plants].map((row) => {
                  const isNetwork = row.plant == null;
                  const stickyBg = isNetwork ? "#F8FAFC" : "#FFFFFF";
                  return (
                    <tr key={row.plant ?? "network"} className={cn(isNetwork && "bg-[#F8FAFC]")}>
                      <td style={{ ...stickyStyle(0), background: stickyBg }} className={cn(TD, "text-left", isNetwork ? "font-bold text-slate-900" : "text-slate-700")}>
                        {isNetwork ? "Network (all plants)" : row.plant}
                      </td>
                      <td style={{ ...stickyStyle(1), background: stickyBg }} className={cn(TD, "font-bold text-slate-900")}>{fmt(row.gross)}</td>
                      <td style={{ ...stickyStyle(2), background: stickyBg }} className={cn(TD, "font-bold text-slate-900 border-r border-[#EBEBEB]")}>{fmt(row.nett)}</td>
                      {cols.map((c, i) => {
                        const v = c.value(row);
                        return (
                          <td key={c.key}
                            className={cn(TD, firstOfGroup(c, i) && "border-l border-[#f0f1f4]", isNetwork && "font-bold text-slate-900")}
                            style={isNetwork ? undefined : { background: excessTint(v, c.value(network)) }}>
                            {fmt(v)}
                          </td>
                        );
                      })}
                      <td className={cn(TD, "border-l border-[#f0f1f4]", isNetwork && "font-bold text-slate-900")}>{row.onTimePct == null ? "—" : `${row.onTimePct.toFixed(1)}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 pt-3 border-t border-[#f0f1f4] text-[11px] text-slate-500">
            {plants.length} plants · {network.poCount.toLocaleString("en-US")} POs · Gross ({basisLabel}) and nett in {unit} per PO · On-time = gross ≤ {targetDays} days
            {view === "process" && hidden.size > 0 && ` · ${hidden.size} process${hidden.size > 1 ? "es" : ""} hidden`}
          </p>
        </>
      )}
    </ChartCard>
  );
}

/** "N of M processes" dropdown: show / hide process columns (Process view). */
function ColumnPicker({ cols, hidden, onChange }: { cols: Col[]; hidden: Set<string>; onChange: (s: Set<string>) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const shown = cols.length - hidden.size;
  const toggle = (key: string) => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange(next);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        className="h-7 inline-flex items-center gap-1.5 px-2.5 rounded-md border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4076]/40">
        {shown} of {cols.length} processes
        <ChevronDown size={11} className={cn("text-slate-400 transition-transform duration-150", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-60 max-h-80 overflow-y-auto bg-white rounded-lg border border-slate-200 shadow-[0_8px_24px_rgba(16,24,40,0.12)] py-1" role="listbox" aria-multiselectable>
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100">
            <button onClick={() => onChange(new Set())} className="text-[11px] font-semibold text-[#1E4076] hover:underline">Select all</button>
            <button onClick={() => onChange(new Set(cols.map((c) => c.key)))} className="text-[11px] font-semibold text-slate-500 hover:underline">Clear</button>
          </div>
          {GROUPS.map((g) => {
            const items = cols.filter((c) => c.group === g.id);
            if (items.length === 0) return null;
            return (
              <div key={g.id} className="py-1">
                <div className="px-3 pt-1 pb-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-slate-400">{g.label}</div>
                {items.map((c) => {
                  const on = !hidden.has(c.key);
                  return (
                    <button key={c.key} onClick={() => toggle(c.key)} role="option" aria-selected={on}
                      className="w-full flex items-center gap-2 px-3 py-1 text-[11px] text-left text-slate-700 hover:bg-slate-50">
                      <span className={cn("w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center shrink-0",
                        on ? "bg-[#1E4076] border-[#1E4076]" : "border-slate-300 bg-white")}>
                        {on && <Check size={10} className="text-white" strokeWidth={3} />}
                      </span>
                      {c.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
