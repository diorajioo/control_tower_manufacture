"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Droplets, Gauge, Zap, Users } from "lucide-react";
import { AlertPanel } from "@/components/dashboard/AlertPanel";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { LeadTimeKPICard } from "@/components/dashboard/LeadTimeKPICard";
import { OutputKPICard } from "@/components/dashboard/OutputKPICard";
import { RegularKPICard } from "@/components/dashboard/RegularKPICard";
import { AIRisksPanel } from "@/components/dashboard/AIRisksPanel";
import { AISummary } from "@/components/dashboard/AISummary";
import { SkeletonCard } from "@/components/dashboard/SkeletonCard";
import { computeAlerts, type KPIAlert } from "@/lib/alerts";
import { formatThousands } from "@/lib/utils";
import { KpiHighlightTarget } from "@/components/ui/KpiHighlight";

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
    fgTrend: number | null; bulkTrend: number | null;
    sparkline: number[]; bulkSparkline: number[];
  };
  oee: {
    value: number; quality: number; performance: number;
    byPlant: { PLANT: string; OEE: number }[]; trend: number | null; sparkline: number[];
  };
  productivity: {
    e2e: number; e2ePrev?: number; upstream: number; downstream: number;
    manhours: number; avgOperators: number; e2eTrend?: number | null; sparkline: number[];
  };
}

export interface MonitorFilters {
  plant: string; period: string; startDate: string; endDate: string; dataLevel: string;
}

export function StrategicMonitor({ filters }: { filters: MonitorFilters; onExit?: () => void }) {
  const [kpi,          setKpi]          = useState<KPIResponse | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [alerts,       setAlerts]       = useState<KPIAlert[]>([]);
  const [kpiType,      setKpiType]      = useState("leadtime");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
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

  const visibleAlerts = alerts.filter((a) => !dismissedIds.has(a.id));
  const critAlerts    = visibleAlerts.filter((a) => a.severity === "critical");
  const handleDismiss = (id: string) => setDismissedIds((prev) => new Set(Array.from(prev).concat(id)));

  return (
    <div className="h-full flex flex-col px-5 py-3 gap-2.5 overflow-hidden">

      <AISummary kpi={kpi} filters={filters} ready={!loading && kpi !== null} />

      {critAlerts.length > 0 && (
        <AlertPanel alerts={critAlerts} onDismiss={handleDismiss} plant={filters.plant} period={filters.period} />
      )}

      {/* Row 1: Lead Time · Output · E2E Productivity */}
      <div className="grid grid-cols-3 gap-2.5 shrink-0">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <KpiHighlightTarget id="leadtime">
              <LeadTimeKPICard
                compact
                showBreakdown={false}
                grossDays={kpi?.leadTime?.grossDays ?? 0}
                nettDays={kpi?.leadTime?.nettDays ?? 0}
                grossTrend={kpi?.leadTime?.grossTrend ?? null}
                nettTrend={kpi?.leadTime?.nettTrend ?? null}
                byPositionGross={kpi?.leadTime?.byPositionGross ?? []}
                byPositionNett={kpi?.leadTime?.byPositionNett ?? []}
                sparkline={kpi?.leadTime?.sparkline ?? []}
                hasAlert={visibleAlerts.some((a) => a.id.startsWith("leadtime"))}
              />
            </KpiHighlightTarget>
            <KpiHighlightTarget id="output">
              <OutputKPICard
                compact
                fgQty={kpi?.output?.fgQty ?? 0}
                bulkQty={kpi?.output?.bulkQty ?? 0}
                fgTrend={kpi?.output?.fgTrend ?? null}
                bulkTrend={kpi?.output?.bulkTrend ?? null}
                sparkline={kpi?.output?.sparkline ?? []}
                bulkSparkline={kpi?.output?.bulkSparkline ?? []}
              />
            </KpiHighlightTarget>
            <KpiHighlightTarget id="productivity">
              <RegularKPICard
                compact
                label="E2E Productivity"
                icon={<Users size={13} color="#8b5cf6" strokeWidth={1.75} />}
                value={kpi ? (kpi.productivity?.e2e ?? 0).toFixed(1) : "—"}
                unit="pcs/manhour"
                sparkUnit="pcs/mh"
                trend={kpi?.productivity?.e2eTrend ?? null}
                subLabel={kpi?.productivity?.e2ePrev ? `vs prior period ${kpi.productivity.e2ePrev.toFixed(1)}` : "vs prior period"}
                sparkline={kpi?.productivity?.sparkline ?? []}
                secondary={{
                  value: `${(kpi?.productivity?.upstream ?? 0).toFixed(1)} · ${(kpi?.productivity?.downstream ?? 0).toFixed(1)}`,
                  unit: "pcs/mh",
                  label: "Upstream · Downstream",
                }}
                footerLeft="Output per operator manhour, end to end"
                footerRight={kpi?.productivity?.manhours ? `${formatThousands(Math.round(kpi.productivity.manhours))} mh` : undefined}
              />
            </KpiHighlightTarget>
          </>
        )}
      </div>

      {/* Row 2: OEE · Yield Loss · Energy (all noData — CT_MANUF_KEMAS not connected) */}
      <div className="grid grid-cols-3 gap-2.5 shrink-0">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <KpiHighlightTarget id="oee">
              <RegularKPICard
                compact noData
                label="OEE"
                icon={<Gauge size={13} color="#8b5cf6" strokeWidth={1.75} />}
                value="—" unit="%"
                subLabel="target ≥ 65%"
                secondary={{ value: "—", unit: "%", label: "OPE (OEE × 0.8)" }}
                footerLeft="CT_MANUF_KEMAS not connected yet"
                footerRight="Target ≥ 65%"
              />
            </KpiHighlightTarget>
            <KpiHighlightTarget id="yield">
              <RegularKPICard
                compact noData inverse
                label="Yield Loss"
                icon={<Droplets size={13} color="#f59e0b" strokeWidth={1.75} />}
                value="—" unit="%"
                subLabel="target ≤ 3%"
                secondary={{ value: "—", unit: "%", label: "Bulk loss · Pack loss" }}
                footerLeft="CT_MANUF_KEMAS not connected yet"
                footerRight="Target ≤ 3%"
              />
            </KpiHighlightTarget>
            <KpiHighlightTarget id="energy">
              <RegularKPICard
                compact noData inverse
                label="Energy"
                icon={<Zap size={13} color="#eab308" strokeWidth={1.75} />}
                value="—" unit="kWh/unit"
                subLabel="target not set"
                secondary={{ value: "—", unit: "kWh/unit", label: "Prior period" }}
                footerLeft="No source table yet"
              />
            </KpiHighlightTarget>
          </>
        )}
      </div>

      {/* Row 3: Trend chart + AI Risks — fills all remaining vertical space */}
      <div
        className="flex-1 min-h-0 grid gap-2.5"
        style={{ gridTemplateColumns: "2fr 1fr" }}
      >
        {loading ? (
          <>
            <div className="bg-white rounded-lg border border-[#EBEBEB] animate-pulse" />
            <div className="bg-white rounded-lg border border-[#EBEBEB] animate-pulse" />
          </>
        ) : (
          <>
            <TrendChart filters={filters} kpiType={kpiType} onKpiChange={setKpiType} fillHeight />
            <AIRisksPanel kpi={kpi} alerts={visibleAlerts} filters={filters} ready={!loading && kpi !== null} />
          </>
        )}
      </div>

    </div>
  );
}
