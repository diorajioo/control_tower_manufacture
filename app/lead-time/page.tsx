"use client";

// Lead Time page (rebuilt 2026-10-13).
//   Global filters (Header) · Lead Time filters (Scope · Basis · Unit · No. PO · Activity · Line category · Line ·
//   SKU group · SKU · Variant) · tabs:
//     Analysis — Lead Time card, composition, Group process and process sunburst, lead time trend
//     Pareto   — Pareto lead time (Group Process / Process, Par / Seq) + lead time breakdown per plant
//     Ranking  — Top 10 SKU by lead time + lead time vs PO count scatter
// Every figure is real data; the dimension filters select whole POs (lib/leadTimeFilters.ts).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { FloatingChat } from "@/components/dashboard/FloatingChat";
import { KpiHighlightTarget } from "@/components/ui/KpiHighlight";
import { LeadTimeSkuScatter, type LeadTimeChartData } from "@/components/dashboard/LeadTimeCharts";
import { LeadTimeTrendChart } from "@/components/dashboard/LeadTimeTrendChart";
import { LeadTimeTopSkuChart } from "@/components/dashboard/LeadTimeTopSkuChart";
import { LeadTimePlantTable, type PlantBreakdown, type PlantActivity } from "@/components/dashboard/LeadTimePlantTable";
import type { StageStdPoint } from "@/components/dashboard/LeadTimeStageStdChart";
import { TacticalParetoChart } from "@/components/dashboard/TacticalView";
import { LeadTimeFilterCard, type LtBasis, type LtScope, type LtUnit } from "@/components/leadtime/LeadTimeFilterCard";
import { LeadTimeSummaryCard, LeadTimeCompositionCard, type LtStats } from "@/components/leadtime/LeadTimeSummaryCards";
import { ProcessSunburst, type ActivityTime } from "@/components/leadtime/ProcessSunburst";
import { dimsKey, dimsToParams, type LtDims } from "@/lib/leadTimeFilters";
import { LEAD_TIME_TARGET_DAYS } from "@/lib/leadTimeDefinition";
import { trackFilterApplied } from "@/lib/analytics/events";
import { cn } from "@/lib/utils";

type BaseFilters = { plant: string; startDate: string; endDate: string; period: string };

// Matches Header's initial state (All Plant · YTD) so the page always reflects what the filter row shows.
const DEFAULT_FILTERS: BaseFilters = {
  plant:     "All Plant",
  startDate: `${new Date().getFullYear()}-01-01`,
  endDate:   new Date().toISOString().split("T")[0],
  period:    "YTD",
};

const TABS = [
  { id: "analysis", label: "Analysis" },
  { id: "pareto",   label: "Pareto" },
  { id: "ranking",  label: "Ranking" },
] as const;
type TabId = typeof TABS[number]["id"];

interface Analysis {
  targetDays: number;
  gross: LtStats; nett: LtStats;
  weekly: { week: string; gross: number | null; nett: number | null }[];
  composition: { va: number; nnva: number; unva: number; wip: number };
  activities: ActivityTime[];
}

/** GET helper: base filters + dims (+ extra), cancelled when inputs change. */
function useFetch<T>(path: string | null, base: BaseFilters, dims: LtDims, extra: Record<string, string>, refreshKey: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const key = `${path}|${JSON.stringify(base)}|${dimsKey(dims)}|${JSON.stringify(extra)}|${refreshKey}`;
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    setLoading(true);
    const params = dimsToParams(dims, new URLSearchParams({ ...base, ...extra }));
    fetch(`${path}?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setData(d && !d.error ? d : null); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { data, loading };
}

export default function LeadTimePage() {
  const { status } = useSession();
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = useState<Date>();
  const [filters, setFilters] = useState<BaseFilters>(DEFAULT_FILTERS);
  const [plants, setPlants] = useState<string[]>(["All Plant"]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<TabId>("analysis");
  const [scope, setScope] = useState<LtScope>("created");
  const [basis, setBasis] = useState<LtBasis>("gross");
  const [unit, setUnit] = useState<LtUnit>("days");
  const [dims, setDims] = useState<LtDims>({});

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/dashboard/plants")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d?.plants)) setPlants(d.plants); })
      .catch(() => { /* keep All Plant */ });
  }, [status]);
  useEffect(() => { if (status === "unauthenticated") router.replace("/login"); }, [status, router]);
  useEffect(() => { setLastUpdated(new Date()); }, []);

  const handleRefresh = useCallback(() => { setRefreshKey((n) => n + 1); setLastUpdated(new Date()); }, []);

  const analysis = useFetch<Analysis>(tab === "analysis" ? "/api/lead-time/analysis" : null, filters, dims, { scope }, refreshKey);
  const charts   = useFetch<LeadTimeChartData>(tab !== "pareto" ? "/api/lead-time/charts" : null, filters, dims, {}, refreshKey);
  const stages   = useFetch<{ plants: PlantBreakdown[]; targetDays: number; activities: PlantActivity[]; stages: StageStdPoint[] }>(
    tab === "pareto" ? "/api/lead-time/stages" : null, filters, dims, { basis: scope }, refreshKey);

  // Flattened filters for components that build their own query string (trend Monthly, scatter, Pareto)
  const flat = useMemo(() => dimsToParams(dims, new URLSearchParams(filters)), [filters, dims]);
  const flatRecord = useMemo(() => Object.fromEntries(flat.entries()), [flat]);
  const tacticalFilters = useMemo(() => ({ ...filters, lt: dims }), [filters, dims]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA]">
        <div className="w-6 h-6 border-2 border-[#1E4076] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const a = analysis.data;
  const stats = a ? (basis === "gross" ? a.gross : a.nett) : null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F8FA]">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          plants={plants}
          onFilterChange={({ plant, startDate, endDate, period }) => {
            setFilters({ plant, startDate, endDate, period: period ?? "" });
            setLastUpdated(new Date());
            trackFilterApplied("lead_time", "apply", { period: period ?? "", plant: Array.isArray(plant) ? plant.join(",") : (plant ?? "All") });
          }}
          views={[]}
          activeView=""
          onViewChange={() => {}}
          onRefresh={handleRefresh}
          isLoading={false}
          lastUpdated={lastUpdated}
          alertCount={0}
          alerts={[]}
          onMonitorMode={() => router.push("/monitor?page=lead-time")}
        />

        <main className="flex-1 overflow-y-auto min-h-0 px-5 py-4 flex flex-col gap-3.5">
          <h1 className="text-[20px] font-bold text-slate-900 leading-tight">Lead Time</h1>

          <LeadTimeFilterCard
            base={filters}
            scope={scope} onScope={(v) => { setScope(v); trackFilterApplied("lead_time", "apply", { lt_basis: v }); }}
            basis={basis} onBasis={setBasis}
            unit={unit} onUnit={setUnit}
            dims={dims} onDims={setDims}
          />

          {/* Tabs — same minimal style as the Overview Tactical tab bar */}
          <div className="border-b border-slate-200 flex items-center gap-5" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={cn("relative py-2 text-[12px] transition-colors focus:outline-none focus-visible:text-[#1E4076]",
                  tab === t.id ? "text-slate-900 font-semibold" : "text-slate-500 hover:text-slate-800")}>
                {t.label}
                {tab === t.id && <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-[#1E4076] rounded-full" />}
              </button>
            ))}
          </div>

          {tab === "analysis" && (
            <>
              <div className="grid grid-cols-12 gap-3.5">
                <div className="col-span-5 flex flex-col gap-3.5">
                  <KpiHighlightTarget id="leadtime">
                    <LeadTimeSummaryCard
                      stats={stats}
                      weekly={(a?.weekly ?? []).map((w) => (basis === "gross" ? w.gross : w.nett)).filter((v): v is number => v != null)}
                      basis={basis} scope={scope} unit={unit}
                      targetDays={a?.targetDays ?? LEAD_TIME_TARGET_DAYS}
                      loading={analysis.loading}
                      poStageDays={a ? a.activities.filter((x) => x.stage === "PO").reduce((t, x) => t + x.nett, 0) : null}
                    />
                  </KpiHighlightTarget>
                  <KpiHighlightTarget id="composition">
                    <LeadTimeCompositionCard comp={a?.composition ?? null} unit={unit} loading={analysis.loading} />
                  </KpiHighlightTarget>
                </div>
                <div className="col-span-7">
                  <ProcessSunburst activities={a?.activities ?? []} basis={basis} scope={scope} unit={unit}
                    onlyActivity={dims.activity} loading={analysis.loading} />
                </div>
              </div>
              <LeadTimeTrendChart data={charts.data} loading={charts.loading} filters={flatRecord} />
            </>
          )}

          {tab === "pareto" && (
            <>
              <TacticalParetoChart filters={tacticalFilters} stageStd={stages.data?.stages ?? []} stageLoading={stages.loading}
                unit={unit} onlyActivity={dims.activity} detailHref={null} />
              <LeadTimePlantTable
                data={stages.data?.plants ?? null}
                activities={stages.data?.activities ?? []}
                targetDays={stages.data?.targetDays ?? LEAD_TIME_TARGET_DAYS}
                loading={stages.loading}
                basis={scope}
                unit={unit}
              />
            </>
          )}

          {tab === "ranking" && (
            <div className="flex flex-col gap-3.5">
              <LeadTimeTopSkuChart data={charts.data} loading={charts.loading} />
              <LeadTimeSkuScatter filters={tacticalFilters} />
            </div>
          )}
        </main>
      </div>

      <FloatingChat />
    </div>
  );
}
