"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Clock, Droplets, ShieldCheck, Package, Gauge, Activity } from "lucide-react";
import Link from "next/link";
import { AlertPanel } from "@/components/dashboard/AlertPanel";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { KPICard, TrendBadge, Sparkline } from "@/components/dashboard/KPICard";
import { AIRisksPanel } from "@/components/dashboard/AIRisksPanel";
import { AISummary } from "@/components/dashboard/AISummary";
import { SkeletonCard } from "@/components/dashboard/SkeletonCard";
import { computeAlerts, type KPIAlert } from "@/lib/alerts";
import { formatThousands, cn } from "@/lib/utils";
import { FitToScreen } from "@/components/ui/FitToScreen";

interface KPIResponse {
  leadTime: {
    grossDays: number; nettDays: number;
    grossTrend: number | null; nettTrend: number | null;
    byPositionNett: { position: string; avgHours: number }[];
    byPositionGross: { position: string; avgHours: number }[];
    sparkline: number[];
  };
  yield: {
    bulkLossPct: number; packLossPct: number; bulkLossKg: number;
    bulkLossTrend: number | null; packLossTrend: number | null; sparkline: number[];
  };
  rightFirstTime: { value: number; trend: number | null; sparkline: number[] };
  output: {
    bulkQty: number; fgQty: number;
    fgTrend: number | null; bulkTrend: number | null; sparkline: number[];
  };
  oee: {
    value: number; quality: number; performance: number;
    byPlant: { PLANT: string; OEE: number }[]; trend: number | null; sparkline: number[];
  };
  productivity: {
    e2e: number; upstream: number; downstream: number;
    manhours: number; avgOperators: number; e2eTrend?: number | null; sparkline: number[];
  };
}

export interface MonitorFilters {
  plant: string; period: string; startDate: string; endDate: string; dataLevel: string;
}

function OutlineBadge({ children, color }: { children: React.ReactNode; color: "red" | "green" | "amber" }) {
  const cls =
    color === "red"   ? "text-red-600 border-red-200"
    : color === "green" ? "text-emerald-600 border-emerald-300"
    : "text-[#b45309] border-[#fcd34d]";
  return (
    <span className={`inline-flex items-center gap-1.5 text-[14px] font-bold px-2.5 py-[3.5px] rounded-md border-[1.5px] w-fit ${cls}`}>
      {children}
    </span>
  );
}

export function StrategicMonitor({ filters, onExit }: { filters: MonitorFilters; onExit?: () => void }) {
  const [kpi,          setKpi]          = useState<KPIResponse | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [alerts,       setAlerts]       = useState<KPIAlert[]>([]);
  const [kpiType,      setKpiType]      = useState("leadtime");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [leadTimeUnit, setLeadTimeUnit] = useState<"days" | "hours">("days");
  const [leadTimeType, setLeadTimeType] = useState<"gross" | "nett">("gross");
  const summaryAbort = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      plant: filters.plant, startDate: filters.startDate,
      endDate: filters.endDate, period: filters.period,
    });
    try {
      const data = await fetch(`/api/dashboard/kpi?${params}`).then((r) => r.json()) as KPIResponse;
      if (!data?.leadTime) return;
      setKpi(data);
      setAlerts(computeAlerts({
        leadTime:       { value: data.leadTime?.grossDays    ?? 0,   trend: data.leadTime?.grossTrend    ?? null },
        yield:          { bulkLossPct: data.yield?.bulkLossPct ?? 0, packLossPct: data.yield?.packLossPct ?? 0, bulkLossTrend: data.yield?.bulkLossTrend ?? null, packLossTrend: data.yield?.packLossTrend ?? null },
        rightFirstTime: { value: data.rightFirstTime?.value  ?? 100, trend: data.rightFirstTime?.trend   ?? null },
        oee:            { value: data.oee?.value              ?? 100, trend: data.oee?.trend              ?? null },
      }));
    } catch { /* silent */ }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.plant, filters.startDate, filters.endDate, filters.period]);

  useEffect(() => {
    fetchData();
    return () => summaryAbort.current?.abort();
  }, [fetchData]);

  const visibleAlerts  = alerts.filter((a) => !dismissedIds.has(a.id));
  const critAlerts     = visibleAlerts.filter((a) => a.severity === "critical");
  const handleDismiss  = (id: string) => setDismissedIds((prev) => new Set(Array.from(prev).concat(id)));

  const leadTimeRawDays  = leadTimeType === "gross" ? (kpi?.leadTime?.grossDays ?? 0) : (kpi?.leadTime?.nettDays ?? 0);
  const leadTimeRawTrend = leadTimeType === "gross" ? kpi?.leadTime?.grossTrend : kpi?.leadTime?.nettTrend;
  const leadTimeTrendInverted = leadTimeRawTrend != null ? -leadTimeRawTrend : undefined;
  const bulkLossTrendInverted = kpi?.yield?.bulkLossTrend != null ? -kpi.yield.bulkLossTrend : undefined;
  const rftValue  = kpi?.rightFirstTime?.value ?? 0;
  const opeValue  = kpi ? (kpi.oee?.value ?? 0) * 0.8 : null;

  return (
    <FitToScreen className="h-full" resetKey={loading ? "loading" : "loaded"}>
      <div className="px-5 py-2 space-y-2">

        <AISummary kpi={kpi} filters={filters} ready={!loading && kpi !== null} />

        {critAlerts.length > 0 && (
          <AlertPanel alerts={critAlerts} onDismiss={handleDismiss} plant={filters.plant} period={filters.period} />
        )}

        {/* Row 1: Lead Time + Output */}
        <div className="grid grid-cols-2 gap-2">
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <KPICard
                title="Lead Time" icon={<Clock size={16} />} iconColor="#3b82f6"
                tooltip="Time from PO creation to NDC receiving."
                value={kpi ? (leadTimeUnit === "hours" ? (leadTimeRawDays * 24).toFixed(1) : leadTimeRawDays.toFixed(2)) : "—"}
                unit={leadTimeUnit === "days" ? "days" : "hours"}
                valueColor={kpi && leadTimeRawDays > 13 ? "#dc2626" : "#16a34a"}
                sparkline={kpi?.leadTime?.sparkline?.length ? kpi.leadTime.sparkline : undefined}
                sparklineColor={(kpi?.leadTime?.grossTrend ?? 0) > 0 ? "#ef4444" : "#22c55e"}
                alert={visibleAlerts.some((a) => a.id.startsWith("leadtime"))}
              >
                {kpi && (() => {
                  const target = 13; const delta = leadTimeRawDays - target;
                  const pct = (delta / target) * 100; const bad = delta > 0;
                  return (
                    <>
                      <p className="text-[14.5px] text-slate-500 flex items-center gap-1 flex-wrap -mt-1">
                        <span className={`font-bold ${bad ? "text-red-600" : "text-emerald-600"}`}>
                          {bad ? "+" : ""}{delta.toFixed(2)} days
                        </span>
                        <span className="text-slate-400">({bad ? "+" : ""}{pct.toFixed(1)}%)</span>
                        <span>vs target {target}.00</span>
                      </p>
                      <OutlineBadge color={bad ? "red" : "green"}>{bad ? "↓ Off Track" : "✓ On Track"}</OutlineBadge>
                    </>
                  );
                })()}
                {kpi && leadTimeTrendInverted !== undefined && (
                  <p className="text-[14.5px] text-slate-500 flex items-center gap-1">
                    {leadTimeTrendInverted >= 0
                      ? <span className="text-emerald-600 font-bold">▲ {Math.abs(leadTimeTrendInverted).toFixed(1)}% better</span>
                      : <span className="text-red-600 font-bold">▼ {Math.abs(leadTimeTrendInverted).toFixed(1)}% worse</span>}
                    <span>vs equivalent prior period</span>
                  </p>
                )}
                {kpi && kpi.leadTime && (() => {
                  const pos = (leadTimeType === "gross" ? kpi.leadTime.byPositionGross : kpi.leadTime.byPositionNett) ?? [];
                  const top = pos[0];
                  const total = pos.reduce((s, p) => s + p.avgHours, 0) || 1;
                  return top ? (
                    <div className="bg-[#F7F8FA] rounded-md px-2.5 py-1.5 text-[14px] text-slate-500">
                      {top.position} {(top.avgHours / 24).toFixed(2)} days · {Math.round((top.avgHours / total) * 100)}% of total
                    </div>
                  ) : null;
                })()}
                <Link href="/lead-time" className="text-[14.5px] font-bold text-[#215AA8] hover:text-[#1A4886] transition-colors w-fit">View feature →</Link>
                <div className="flex gap-1.5 pt-1 border-t border-gray-100">
                  <div className="flex gap-1">
                    {(["gross", "nett"] as const).map((lt) => (
                      <button key={lt} onClick={() => setLeadTimeType(lt)}
                        className={cn("text-[13px] px-2 py-0.5 rounded-full font-semibold transition-colors",
                          leadTimeType === lt ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
                        {lt === "gross" ? "Gross" : "Nett"}
                      </button>
                    ))}
                  </div>
                  <div className="w-px bg-gray-100 self-stretch" />
                  <div className="flex gap-1">
                    {(["days", "hours"] as const).map((u) => (
                      <button key={u} onClick={() => setLeadTimeUnit(u)}
                        className={cn("text-[13px] px-2 py-0.5 rounded-full font-semibold transition-colors",
                          leadTimeUnit === u ? "bg-slate-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
                        {u === "days" ? "Daily" : "Hourly"}
                      </button>
                    ))}
                  </div>
                </div>
              </KPICard>

              <KPICard
                title="Output" icon={<Package size={16} />} iconColor="#6366f1"
                tooltip="Total products produced this period."
              >
                <div className="flex items-center justify-between gap-2 -mt-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-[2rem] font-bold text-slate-900 tabular-nums tracking-tight leading-none">
                      {kpi ? formatThousands(kpi.output?.fgQty ?? 0) : "—"}
                    </span>
                    <span className="text-[13px] text-slate-400 font-medium">pcs</span>
                    {kpi?.output?.fgTrend != null && <TrendBadge trend={kpi.output.fgTrend} />}
                  </div>
                  {kpi?.output?.sparkline && kpi.output.sparkline.length >= 2 && (
                    <Sparkline data={kpi.output.sparkline} color={(kpi.output.fgTrend ?? 0) >= 0 ? "#22c55e" : "#ef4444"} width={88} height={36} />
                  )}
                </div>
                {kpi?.output?.fgTrend != null && (() => {
                  const t2 = kpi.output.fgTrend; const bad = t2 < 0;
                  return (
                    <>
                      <p className="text-[14.5px] text-slate-500 flex items-center gap-1">
                        <span className={`font-bold ${bad ? "text-red-600" : "text-emerald-600"}`}>{bad ? "" : "+"}{t2.toFixed(1)}%</span>
                        <span>vs previous period</span>
                      </p>
                      <OutlineBadge color={bad ? "red" : "green"}>{bad ? "↓ Off Track" : "✓ On Track"}</OutlineBadge>
                    </>
                  );
                })()}
                <div className="h-px bg-gray-100" />
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-[1.5rem] font-bold text-slate-900 tabular-nums tracking-tight">
                      {kpi ? formatThousands(kpi.output?.bulkQty ?? 0) : "—"}
                    </span>
                    <span className="text-[14px] text-gray-400 font-medium">kg</span>
                  </div>
                  {kpi?.output?.bulkTrend != null && <TrendBadge trend={kpi.output.bulkTrend} />}
                </div>
                <p className="text-[13px] text-gray-400 -mt-1">Accepted Bulk</p>
              </KPICard>
            </>
          )}
        </div>

        {/* Row 2: OEE + OPE + Yield + RFT */}
        <div className="grid grid-cols-4 gap-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <KPICard compact title="OEE" icon={<Gauge size={16} />} iconColor="#8b5cf6"
                tooltip="Overall Equipment Effectiveness. Target: ≥65%."
                value={kpi?.oee?.value?.toFixed(1) ?? "—"} unit="%"
                valueColor={(kpi?.oee?.value ?? 100) < 65 ? "#dc2626" : "#16a34a"}
                sparkline={kpi?.oee?.sparkline} sparklineColor={(kpi?.oee?.value ?? 100) < 65 ? "#ef4444" : "#22c55e"}
                alert={visibleAlerts.some((a) => a.id.startsWith("oee"))}
              >
                {kpi && (() => {
                  const v = kpi.oee.value; const target = 65; const delta = v - target; const bad = v < target;
                  const lowestPlant = kpi.oee.byPlant?.slice().sort((a, b) => a.OEE - b.OEE)[0];
                  return (
                    <>
                      <p className="text-[13.5px] text-slate-500 flex items-center gap-1 -mt-1">
                        <span className={`font-bold ${bad ? "text-red-600" : "text-emerald-600"}`}>{bad ? "" : "+"}{delta.toFixed(1)}pp</span>
                        <span>vs ≥ {target}%</span>
                      </p>
                      <OutlineBadge color={bad ? "red" : "green"}>{bad ? "↓ Below Target" : "✓ On Track"}</OutlineBadge>
                      {lowestPlant && (
                        <div className="bg-[#F7F8FA] rounded-md px-2 py-1 text-[13px] text-slate-500">
                          {lowestPlant.PLANT} lowest · {lowestPlant.OEE.toFixed(1)}%
                        </div>
                      )}
                    </>
                  );
                })()}
              </KPICard>

              <KPICard compact title="OPE" icon={<Activity size={16} />} iconColor="#06b6d4"
                tooltip="Overall Plant Effectiveness: OEE × 0.8."
                value={opeValue !== null ? opeValue.toFixed(1) : "—"} unit="%"
                valueColor={(opeValue ?? 100) < 60 ? "#d97706" : "#16a34a"}
                sparkline={kpi?.oee?.sparkline?.map((v) => Number((v * 0.8).toFixed(1)))}
                sparklineColor={(opeValue ?? 100) < 60 ? "#f59e0b" : "#22c55e"}
              >
                {opeValue !== null && (() => {
                  const target = 60; const delta = opeValue - target; const bad = opeValue < target;
                  return (
                    <>
                      <p className="text-[13.5px] text-slate-500 flex items-center gap-1 -mt-1">
                        <span className={`font-bold ${bad ? "text-amber-600" : "text-emerald-600"}`}>{bad ? "" : "+"}{delta.toFixed(1)}pp</span>
                        <span>vs ≥ {target}%</span>
                      </p>
                      <OutlineBadge color={bad ? "amber" : "green"}>{bad ? "↓ Below Target" : "✓ On Track"}</OutlineBadge>
                      <div className="bg-[#F7F8FA] rounded-md px-2 py-1 text-[13px] text-slate-500">Derived: OEE × 0.8</div>
                    </>
                  );
                })()}
              </KPICard>

              <KPICard compact title="Yield / Loss" icon={<Droplets size={16} />} iconColor="#f59e0b"
                tooltip="Raw material lost in production. Target Bulk Loss: <3%."
                value={kpi?.yield?.bulkLossPct?.toFixed(1) ?? "—"} unit="%"
                sparkline={kpi?.yield?.sparkline?.length ? kpi.yield.sparkline : undefined}
                sparklineColor={(kpi?.yield?.bulkLossTrend ?? 0) > 0 ? "#ef4444" : "#22c55e"}
                alert={visibleAlerts.some((a) => a.id.startsWith("bulkloss") || a.id.startsWith("packloss"))}
              >
                {kpi && (() => {
                  const bulk = kpi.yield.bulkLossPct; const pack = kpi.yield.packLossPct;
                  const target = 3; const delta = bulk - target; const bad = bulk > target; const critical = bulk > 5;
                  const badgeColor: "red" | "amber" | "green" = critical ? "red" : bad ? "amber" : "green";
                  const badgeLabel = critical ? "↑ Exceeds Limit" : bad ? "⚠ Near Limit" : "✓ Within Limit";
                  return (
                    <>
                      <p className="text-[13.5px] text-slate-500 flex items-center gap-1 -mt-1">
                        <span className={`font-bold ${bad ? "text-amber-600" : "text-emerald-600"}`}>{bad ? "+" : ""}{delta.toFixed(1)}pp</span>
                        <span>vs ≤ {target}%</span>
                      </p>
                      <OutlineBadge color={badgeColor}>{badgeLabel}</OutlineBadge>
                      {bulkLossTrendInverted !== undefined && (
                        <p className="text-[13.5px] text-slate-500 flex items-center gap-1">
                          {bulkLossTrendInverted >= 0
                            ? <span className="text-emerald-600 font-bold">▼ {Math.abs(bulkLossTrendInverted).toFixed(1)}% improved</span>
                            : <span className="text-amber-600 font-bold">▲ {Math.abs(bulkLossTrendInverted).toFixed(1)}% worsened</span>}
                          <span>vs previous period</span>
                        </p>
                      )}
                      <div className="bg-[#F7F8FA] rounded-md px-2 py-1 text-[13px] text-slate-500">
                        Pack loss {pack.toFixed(1)}% · {pack <= 3 ? "within limit" : "exceeds limit"}
                      </div>
                    </>
                  );
                })()}
              </KPICard>

              <KPICard compact title="Right First Time" icon={<ShieldCheck size={16} />} iconColor="#22c55e"
                tooltip="Batches passing QC without rework on first attempt. Target: ≥95%."
                value={kpi ? rftValue.toFixed(1) : "—"} unit="%"
                valueColor={rftValue >= 95 ? "#16a34a" : rftValue >= 90 ? "#d97706" : "#dc2626"}
                sparkline={kpi?.rightFirstTime?.sparkline?.length ? kpi.rightFirstTime.sparkline : undefined}
                sparklineColor={rftValue >= 95 ? "#22c55e" : rftValue >= 90 ? "#f59e0b" : "#ef4444"}
                alert={visibleAlerts.some((a) => a.id.startsWith("rft"))}
              >
                {kpi && (() => {
                  const target = 95; const delta = rftValue - target; const good = rftValue >= target;
                  return (
                    <>
                      <p className="text-[13.5px] text-slate-500 flex items-center gap-1 -mt-1">
                        <span className={`font-bold ${good ? "text-emerald-600" : "text-red-600"}`}>{good ? "+" : ""}{delta.toFixed(1)}pp</span>
                        <span>vs ≥ {target}%</span>
                      </p>
                      <OutlineBadge color={good ? "green" : "red"}>{good ? "✓ On Track" : "↓ Below Target"}</OutlineBadge>
                      <div className="bg-[#F7F8FA] rounded-md px-2 py-1 text-[13px] text-slate-500">First Time Passed Rate</div>
                    </>
                  );
                })()}
              </KPICard>
            </>
          )}
        </div>

        {/* Row 3: Trend chart + AI Risks */}
        <div className="grid gap-2" style={{ gridTemplateColumns: "2fr 1fr", height: "260px" }}>
          {loading ? (
            <>
              <div className="bg-white rounded-lg border border-[#EBEBEB] h-full animate-pulse" />
              <div className="bg-white rounded-lg border border-[#EBEBEB] h-full animate-pulse" />
            </>
          ) : (
            <>
              <TrendChart filters={filters} kpiType={kpiType} onKpiChange={setKpiType} fillHeight />
              <AIRisksPanel kpi={kpi} alerts={visibleAlerts} filters={filters} ready={!loading && kpi !== null} />
            </>
          )}
        </div>

      </div>
    </FitToScreen>
  );
}
