"use client";

import { useEffect, useState, useCallback } from "react";
import { AISummary } from "@/components/dashboard/AISummary";
import { AlertPanel } from "@/components/dashboard/AlertPanel";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { StackedBarChart } from "@/components/dashboard/StackedBarChart";
import { computeAlerts, type KPIAlert } from "@/lib/alerts";
import { formatThousands, cn } from "@/lib/utils";

interface KPIResponse {
  leadTime: { grossDays: number; nettDays: number; grossTrend: number | null; nettTrend: number | null };
  yield: { bulkLossPct: number; packLossPct: number; bulkLossKg: number; bulkLossTrend: number | null; packLossTrend: number | null };
  rightFirstTime: { value: number; trend: number | null };
  output: { bulkQty: number; fgQty: number; fgTrend: number | null; bulkTrend: number | null };
  oee: { value: number; quality: number; performance: number; byPlant: { PLANT: string; OEE: number }[]; trend: number | null; sparkline: number[] };
  productivity: { e2e: number; upstream: number; downstream: number; manhours: number; avgOperators: number; e2eTrend?: number | null; sparkline: number[] };
}

export interface MonitorFilters {
  plant: string;
  period: string;
  startDate: string;
  endDate: string;
  dataLevel: string;
}

function MonitorSubStat({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 mb-0.5">{label}</p>
      <p className={cn("text-[1.4rem] font-bold tabular-nums leading-none", good ? "text-emerald-600" : "text-amber-500")}>{value}</p>
      <p className={cn("text-[10px] font-semibold mt-0.5", good ? "text-emerald-500" : "text-amber-500")}>
        {good ? "✓ On target" : "Below target"}
      </p>
    </div>
  );
}

function MonitorStat({ label, value, unit, accent, note, sub }: {
  label: string; value: string; unit?: string;
  accent: "green" | "amber" | "red" | "blue" | "slate";
  note?: string; sub?: { label: string; value: string }[];
}) {
  const accentBar = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", blue: "bg-blue-500", slate: "bg-slate-300" }[accent];
  const valColor  = { green: "text-emerald-600", amber: "text-amber-500", red: "text-red-500", blue: "text-blue-600", slate: "text-slate-800" }[accent];
  return (
    <div className="bg-white rounded-xl border border-slate-200 flex overflow-hidden">
      <div className={cn("w-[5px] shrink-0", accentBar)} />
      <div className="flex-1 px-3.5 py-2.5 min-w-0">
        <p className="text-[9.5px] font-bold uppercase tracking-[0.09em] text-slate-400 mb-1">{label}</p>
        <div className="flex items-baseline gap-1 leading-none">
          <span className={cn("text-[1.75rem] font-bold tabular-nums tracking-tight leading-none", valColor)}>{value}</span>
          {unit && <span className="text-[12px] font-medium text-slate-400 ml-0.5">{unit}</span>}
        </div>
        {note && <p className="text-[10px] text-slate-500 mt-0.5">{note}</p>}
        {sub && sub.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 pt-1 border-t border-slate-100">
            {sub.map((s, i) => (
              <span key={i} className="text-[9.5px] text-slate-500">
                <span className="text-slate-400">{s.label} </span>
                <span className="font-semibold text-slate-700">{s.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function StrategicMonitor({ filters }: { filters: MonitorFilters }) {
  const [kpi,          setKpi]          = useState<KPIResponse | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [alerts,       setAlerts]       = useState<KPIAlert[]>([]);
  const [kpiType,      setKpiType]      = useState("leadtime");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      plant:     filters.plant,
      startDate: filters.startDate,
      endDate:   filters.endDate,
      period:    filters.period,
    });
    try {
      const data = await fetch(`/api/dashboard/kpi?${params}`).then((r) => r.json()) as KPIResponse;
      setKpi(data);
      setAlerts(computeAlerts({
        leadTime:       { value: data.leadTime?.grossDays ?? 0,     trend: data.leadTime?.grossTrend ?? null },
        yield:          { bulkLossPct: data.yield?.bulkLossPct ?? 0, packLossPct: data.yield?.packLossPct ?? 0, bulkLossTrend: data.yield?.bulkLossTrend ?? null, packLossTrend: data.yield?.packLossTrend ?? null },
        rightFirstTime: { value: data.rightFirstTime?.value ?? 100, trend: data.rightFirstTime?.trend ?? null },
        oee:            { value: data.oee?.value ?? 100,            trend: data.oee?.trend ?? null },
      }));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [filters.plant, filters.startDate, filters.endDate, filters.period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const visibleAlerts = alerts.filter((a) => !dismissedIds.has(a.id));
  const handleDismiss = (id: string) => setDismissedIds((prev) => new Set(Array.from(prev).concat(id)));

  const oeeVal   = kpi?.oee?.value       ?? 0;
  const perfVal  = kpi?.oee?.performance ?? 0;
  const qualVal  = kpi?.oee?.quality     ?? 0;
  const availVal = perfVal > 0 && qualVal > 0
    ? ((oeeVal / 100) / ((perfVal / 100) * (qualVal / 100))) * 100
    : null;
  const oeeGood  = oeeVal >= 65;

  const ltDays     = kpi?.leadTime?.grossDays ?? 0;
  const ltAccent: "green" | "amber" | "red" = ltDays <= 5 ? "green" : ltDays <= 15 ? "amber" : "red";
  const bulkLoss   = kpi?.yield?.bulkLossPct ?? 0;
  const packLoss   = kpi?.yield?.packLossPct ?? 0;
  const lossAccent: "green" | "amber" | "red" = bulkLoss <= 3 ? "green" : bulkLoss <= 5 ? "amber" : "red";
  const rftValue   = kpi?.rightFirstTime?.value ?? 0;
  const rftAccent: "green" | "amber" | "red"  = rftValue >= 95 ? "green" : rftValue >= 90 ? "amber" : "red";
  const opeValue   = kpi ? oeeVal * 0.8 : null;

  return (
    <div className="h-full overflow-hidden flex flex-col gap-2 p-3">

      {/* AI Summary */}
      <div className="shrink-0 [&>div]:mb-0">
        <AISummary kpi={kpi} filters={filters} ready={!loading && kpi !== null} />
      </div>

      {/* Alerts */}
      {visibleAlerts.length > 0 && (
        <div className="shrink-0 [&>div]:mb-0">
          <AlertPanel alerts={visibleAlerts} onDismiss={handleDismiss} plant={filters.plant} period={filters.period} />
        </div>
      )}

      {/* Hero OEE */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 h-[66px] animate-pulse shrink-0" />
      ) : kpi ? (
        <div className={cn("bg-white rounded-xl border flex overflow-hidden shrink-0", oeeGood ? "border-slate-200" : "border-red-200")}>
          <div className={cn("w-[5px] shrink-0", oeeGood ? "bg-emerald-500" : "bg-red-500")} />
          <div className="flex-1 px-5 py-2 flex items-center gap-6 flex-wrap">
            <div className="shrink-0 border-r border-slate-100 pr-5">
              <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-[0.09em] mb-0.5">Filter</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[13px] font-semibold text-slate-800">{filters.plant}</span>
              </div>
              <p className="text-[9.5px] text-slate-400">{filters.period || "Custom"} · {filters.dataLevel}</p>
            </div>
            <div className="shrink-0">
              <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-[0.09em] mb-0.5">OEE — Overall Equipment Effectiveness</p>
              <div className="flex items-baseline gap-1 leading-none">
                <span className={cn("text-[2.4rem] font-bold tabular-nums tracking-tight leading-none", oeeGood ? "text-emerald-600" : "text-red-500")}>{oeeVal.toFixed(1)}</span>
                <span className={cn("text-lg font-bold", oeeGood ? "text-emerald-600" : "text-red-500")}>%</span>
              </div>
            </div>
            <div className="w-px h-9 bg-slate-100 shrink-0" />
            <div className="flex gap-5">
              {availVal !== null && <MonitorSubStat label="Availability" value={`${availVal.toFixed(1)}%`} good={availVal >= 80} />}
              <MonitorSubStat label="Performance" value={`${perfVal.toFixed(1)}%`} good={perfVal >= 80} />
              <MonitorSubStat label="Quality"     value={`${qualVal.toFixed(1)}%`} good={qualVal >= 95} />
            </div>
            <div className="ml-auto shrink-0">
              <span className={cn("text-[11px] font-bold px-3 py-1.5 rounded-full", oeeGood ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
                {oeeGood ? "✓ On Target" : "⚠ Below Target"}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* 4 Operation KPIs */}
      <div className="grid grid-cols-4 gap-2 shrink-0">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 h-[82px] animate-pulse" />
          ))
        ) : (
          <>
            <MonitorStat
              label="Lead Time" value={kpi ? ltDays.toFixed(1) : "—"} unit="d"
              accent={kpi ? ltAccent : "slate"} note="PO → NDC receipt"
              sub={kpi ? [{ label: "Nett", value: `${kpi.leadTime?.nettDays?.toFixed(1) ?? "—"} d` }] : undefined}
            />
            <MonitorStat
              label="Yield Loss" value={kpi ? bulkLoss.toFixed(1) : "—"} unit="%"
              accent={kpi ? lossAccent : "slate"} note="Bulk loss rate"
              sub={kpi ? [{ label: "Pack", value: `${packLoss.toFixed(2)}%` }] : undefined}
            />
            <MonitorStat
              label="Right First Time" value={kpi ? rftValue.toFixed(1) : "—"} unit="%"
              accent={kpi ? rftAccent : "slate"} note="Target ≥95%"
            />
            <MonitorStat
              label="Output" value={kpi ? formatThousands(kpi.output?.fgQty ?? 0) : "—"} unit="pcs"
              accent="blue" note="Finished goods"
              sub={kpi ? [{ label: "Bulk", value: `${formatThousands(kpi.output?.bulkQty ?? 0)} kg` }] : undefined}
            />
          </>
        )}
      </div>

      {/* Equipment */}
      <div className="grid grid-cols-2 gap-2 shrink-0">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 h-[72px] animate-pulse" />
          ))
        ) : (
          <>
            <MonitorStat
              label="OPE — Overall Plant Effectiveness"
              value={opeValue !== null ? opeValue.toFixed(1) : "—"} unit="%"
              accent={opeValue !== null ? (opeValue >= 60 ? "green" : "amber") : "slate"}
              note="OEE × 0.8"
            />
            <MonitorStat
              label="Productivity" value={kpi?.productivity?.e2e?.toFixed(1) ?? "—"} unit="pcs/mh"
              accent="slate" note="End-to-end"
              sub={kpi ? [
                { label: "Man-hours", value: `${formatThousands(Math.round(kpi.productivity?.manhours ?? 0))} mh` },
                { label: "Avg Ops",   value: `${kpi.productivity?.avgOperators ?? "—"} opr` },
              ] : undefined}
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="flex-1 min-h-0 max-h-[260px] grid grid-cols-2 gap-2">
        <div className="min-h-0 h-full overflow-hidden">
          <TrendChart filters={filters} kpiType={kpiType} onKpiChange={setKpiType} fillHeight />
        </div>
        <div className="min-h-0 h-full overflow-hidden">
          <StackedBarChart filters={filters} kpiType={kpiType} onKpiChange={setKpiType} fillHeight />
        </div>
      </div>

    </div>
  );
}
