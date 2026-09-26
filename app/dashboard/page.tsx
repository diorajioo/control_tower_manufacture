"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useI18n } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { Clock, Droplets, Package, Gauge, Zap, Users } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { SecurityOverlay } from "@/components/dashboard/SecurityOverlay";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { SkeletonCard } from "@/components/dashboard/SkeletonCard";
import { AIRisksPanel } from "@/components/dashboard/AIRisksPanel";
import { AISummary } from "@/components/dashboard/AISummary";
import { AlertPanel } from "@/components/dashboard/AlertPanel";
import { FloatingChat } from "@/components/dashboard/FloatingChat";
import { OutputKPICard } from "@/components/dashboard/OutputKPICard";
import { LeadTimeKPICard } from "@/components/dashboard/LeadTimeKPICard";
import { RegularKPICard } from "@/components/dashboard/RegularKPICard";
import { FitToScreen } from "@/components/ui/FitToScreen";
import { formatThousands, cn } from "@/lib/utils";
import { computeAlerts, type KPIAlert } from "@/lib/alerts";

interface KPIResponse {
  leadTime: {
    grossDays: number;
    nettDays: number;
    grossTrend: number | null;
    nettTrend: number | null;
    byPositionNett: { position: string; avgHours: number }[];
    byPositionGross: { position: string; avgHours: number }[];
    sparkline: number[];
  };
  yield: {
    bulkLossPct: number;
    packLossPct: number;
    bulkLossKg: number;
    bulkLossTrend: number | null;
    packLossTrend: number | null;
    sparkline: number[];
  };
  rightFirstTime: { value: number; trend: number | null; sparkline: number[] };
  output: {
    bulkQty: number;
    fgQty: number;
    fgTrend: number | null;
    bulkTrend: number | null;
    sparkline: number[];
    bulkSparkline: number[];
  };
  oee: { value: number; quality: number; performance: number; byPlant: { PLANT: string; OEE: number }[]; trend: number | null; sparkline: number[] };
  productivity: {
    e2e: number;
    e2ePrev?: number;
    upstream: number;
    downstream: number;
    byPlant: { PLANT: string }[];
    e2eTrend?: number | null;
    manhours: number;
    avgOperators: number;
    sparkline: number[];
  };
}

interface Filters {
  plant: string;
  startDate: string;
  endDate: string;
  dataLevel: string;
  period: string;
}



export default function DashboardPage() {
  const { status } = useSession();
  const router = useRouter();
  const { t } = useI18n();

  const [kpi,           setKpi]           = useState<KPIResponse | null>(null);
  const [plants,        setPlants]        = useState<string[]>(["All Plant"]);
  const [loading,       setLoading]       = useState(true);
  const [lastUpdated,   setLastUpdated]   = useState<Date>();
  const [alerts,        setAlerts]        = useState<KPIAlert[]>([]);
  const [dismissedIds,  setDismissedIds]  = useState<Set<string>>(new Set());
  const [alertPanelOpen, setAlertPanelOpen] = useState(false);
  const [activeView,    setActiveView]    = useState<"strategic" | "tactical">("strategic");
  const [kpiType,       setKpiType]       = useState("leadtime");
  const [fetchError,    setFetchError]    = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(() => {
    const defaults: Filters = {
      plant:     "All Plant",
      startDate: `${new Date().getFullYear()}-01-01`,
      endDate:   new Date().toISOString().split("T")[0],
      dataLevel: "Daily",
      period:    "YTD",
    };
    try {
      const stored = localStorage.getItem("ct-filters");
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch { return defaults; }
  });
  const [highlightedKpi, setHighlightedKpi] = useState<string | null>(null);
  const [refreshCount,  setRefreshCount]  = useState(0);
  const [undoId, setUndoId] = useState<string | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentAlertIds = useRef<Set<string>>(new Set());
  const teamsSettingsRef = useRef<{ enabled?: boolean; recipients?: Array<{ email: string; kpis: Record<string, boolean> }> } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    const handler = (e: Event) => {
      const kpi = (e as CustomEvent<{ kpi: string }>).detail.kpi;
      setHighlightedKpi((prev) => (prev === kpi ? null : kpi));
    };
    window.addEventListener("kpi-highlight", handler);
    return () => window.removeEventListener("kpi-highlight", handler);
  }, []);

  useEffect(() => {
    fetch("/api/dashboard/plants")
      .then((r) => r.json())
      .then((d) => setPlants(d.plants ?? ["All Plant"]));
  }, []);

  // Fetch Teams settings from server on mount so auto-send uses up-to-date config
  useEffect(() => {
    fetch("/api/settings/teams")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          teamsSettingsRef.current = data;
          localStorage.setItem("ct-teams-settings", JSON.stringify(data));
        } else {
          try {
            const raw = localStorage.getItem("ct-teams-settings");
            if (raw) teamsSettingsRef.current = JSON.parse(raw);
          } catch { /* ignore */ }
        }
      })
      .catch(() => {
        try {
          const raw = localStorage.getItem("ct-teams-settings");
          if (raw) teamsSettingsRef.current = JSON.parse(raw);
        } catch { /* ignore */ }
      });
  }, []);

  const fetchData = useCallback(async (f: Filters) => {
    setLoading(true);
    setKpi(null);
    setFetchError(null);
    const params = new URLSearchParams({
      plant:     f.plant,
      startDate: f.startDate,
      endDate:   f.endDate,
      period:    f.period,
    });
    try {
      const [kpiRes] = await Promise.all([
        fetch(`/api/dashboard/kpi?${params}`).then((r) => r.json()),
      ]);
      if (!kpiRes?.leadTime) throw new Error(kpiRes?.error ?? "Invalid KPI response shape");
      setKpi(kpiRes);
      setLastUpdated(new Date());
      setRefreshCount((n) => n + 1);
      const newAlerts = computeAlerts({
        leadTime:     { value: kpiRes.leadTime?.grossDays ?? 0, trend: kpiRes.leadTime?.grossTrend ?? null },
        yield:        { bulkLossPct: kpiRes.yield?.bulkLossPct ?? 0, packLossPct: kpiRes.yield?.packLossPct ?? 0, bulkLossTrend: kpiRes.yield?.bulkLossTrend ?? null, packLossTrend: kpiRes.yield?.packLossTrend ?? null },
        rightFirstTime: { value: kpiRes.rightFirstTime?.value ?? 100, trend: kpiRes.rightFirstTime?.trend ?? null },
        oee:          { value: kpiRes.oee?.value ?? 100, trend: kpiRes.oee?.trend ?? null },
      });
      setAlerts(newAlerts);
      setDismissedIds(new Set());

      // Auto-send new critical alerts to Teams (if configured).
      // Only sends alert IDs not yet sent this session — prevents spam on every hourly refresh.
      const newCritical = newAlerts.filter(
        (a) => a.severity === "critical" && !sentAlertIds.current.has(a.id)
      );
      if (newCritical.length > 0) {
        newCritical.forEach((a) => sentAlertIds.current.add(a.id));
        const cfg = teamsSettingsRef.current;
        const teamsRecipients = cfg?.enabled && cfg.recipients?.length ? cfg.recipients : undefined;
        fetch("/api/notifications/teams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            alerts: newCritical,
            plant: f.plant,
            period: f.period,
            withRecommendation: true,
            ...(teamsRecipients ? { recipients: teamsRecipients } : {}),
          }),
        }).catch(() => {/* silent — Teams is optional */});
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setFetchError(
        err instanceof Error ? err.message : "Failed to load data — try refreshing"
      );
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load only — filter changes go through handleFilterChange which calls fetchData directly
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (status === "authenticated") fetchData(filters);
  }, [status]);

  const handleRefresh = useCallback(async () => {
    try {
      await fetch("/api/cache/revalidate", { method: "POST" });
    } catch {/* silent */}
    fetchData(filters);
  }, [filters, fetchData]);

  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters);
    try { localStorage.setItem("ct-filters", JSON.stringify(newFilters)); } catch { /* ignore */ }
    fetchData(newFilters);
  };

  const handleDismissAlert = (id: string) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setDismissedIds((prev) => new Set(Array.from(prev).concat(id)));
    setUndoId(id);
    undoTimerRef.current = setTimeout(() => setUndoId(null), 5000);
  };

  const handleUndoDismiss = () => {
    if (!undoId) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setDismissedIds((prev) => { const next = new Set(Array.from(prev)); next.delete(undoId); return next; });
    setUndoId(null);
  };

  const visibleAlerts = alerts.filter((a) => !dismissedIds.has(a.id));

  const bulkLossTrendInverted  = kpi?.yield?.bulkLossTrend  != null ? -kpi.yield.bulkLossTrend  : undefined;

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0eff8]">
        <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const monitorUrl = `/monitor?page=strategic&plant=${encodeURIComponent(filters.plant)}&period=${encodeURIComponent(filters.period)}&startDate=${filters.startDate}&endDate=${filters.endDate}&dataLevel=${filters.dataLevel}`;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F8FA]">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          plants={plants}
          onFilterChange={handleFilterChange}
          views={[{ key: "strategic", label: "Strategic" }, { key: "tactical", label: "Tactical" }]}
          activeView={activeView}
          onViewChange={(v) => setActiveView(v as "strategic" | "tactical")}
          onRefresh={handleRefresh}
          isLoading={loading}
          lastUpdated={lastUpdated}
          alertCount={visibleAlerts.length}
          onBellClick={() => setAlertPanelOpen(!alertPanelOpen)}
          alerts={visibleAlerts}
          onDismiss={handleDismissAlert}
          onMonitorMode={() => router.push(monitorUrl)}
        />

        <main className="flex-1 px-5 py-4 overflow-y-auto min-h-0 flex flex-col gap-3.5" onClick={() => setHighlightedKpi(null)}>
          {fetchError && (
            <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 flex items-center justify-between gap-3">
              <span className="text-[12px] text-red-600 font-medium">{fetchError}</span>
              <button onClick={() => setFetchError(null)} className="text-red-400 hover:text-red-600 text-xs shrink-0">✕</button>
            </div>
          )}
          <AISummary kpi={kpi} filters={filters} ready={!loading && kpi !== null} />

          <AlertPanel
            alerts={visibleAlerts}
            onDismiss={handleDismissAlert}
            plant={filters.plant}
            period={filters.period}
          />

          {activeView === "strategic" && (<>

          {/* ── Row 1: Lead Time · Output · E2E Productivity (3 per row, compact regular cards) ── */}
          <div className="grid grid-cols-3 gap-3.5">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (<>
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
            <OutputKPICard
              compact
              fgQty={kpi?.output?.fgQty ?? 0}
              bulkQty={kpi?.output?.bulkQty ?? 0}
              fgTrend={kpi?.output?.fgTrend ?? null}
              bulkTrend={kpi?.output?.bulkTrend ?? null}
              sparkline={kpi?.output?.sparkline ?? []}
              bulkSparkline={kpi?.output?.bulkSparkline ?? []}
            />
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
          </>)}
          </div>

          {/* ── Row 2: OEE · Yield Loss · Energy (3 per row, compact regular cards) ── */}
          <div className="grid grid-cols-3 gap-3.5">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                {/* OEE — no data yet (CT_MANUF_KEMAS not connected) */}
                <RegularKPICard
                  compact
                  noData
                  label="OEE"
                  icon={<Gauge size={13} color="#8b5cf6" strokeWidth={1.75} />}
                  value="—"
                  unit="%"
                  subLabel="target ≥ 65%"
                  secondary={{ value: "—", unit: "%", label: "OPE (OEE × 0.8)" }}
                  footerLeft="CT_MANUF_KEMAS not connected yet"
                  footerRight="Target ≥ 65%"
                />

                {/* Yield Loss — no data yet (CT_MANUF_KEMAS not connected) */}
                <RegularKPICard
                  compact
                  noData
                  inverse
                  label="Yield Loss"
                  icon={<Droplets size={13} color="#f59e0b" strokeWidth={1.75} />}
                  value="—"
                  unit="%"
                  subLabel="target ≤ 3%"
                  secondary={{ value: "—", unit: "%", label: "Bulk loss · Pack loss" }}
                  footerLeft="CT_MANUF_KEMAS not connected yet"
                  footerRight="Target ≤ 3%"
                />

                {/* Energy — no data yet */}
                <RegularKPICard
                  compact
                  noData
                  inverse
                  label="Energy"
                  icon={<Zap size={13} color="#eab308" strokeWidth={1.75} />}
                  value="—"
                  unit="kWh/unit"
                  subLabel="target not set"
                  secondary={{ value: "—", unit: "kWh/unit", label: "Prior period" }}
                  footerLeft="No source table yet"
                />
              </>
            )}
          </div>

          {/* ── Row 3: Trend chart + AI Risks panel — shrink-0 so the flex column scrolls instead of squashing the chart ── */}
          <div className="grid gap-3.5 shrink-0" style={{ gridTemplateColumns: "2fr 1fr", height: "420px" }}>
            {loading ? (
              <>
                <div className="bg-white rounded-lg border border-[#EBEBEB] h-full animate-pulse" />
                <div className="bg-white rounded-lg border border-[#EBEBEB] h-full animate-pulse" />
              </>
            ) : (
              <>
                <TrendChart filters={filters} kpiType={kpiType} onKpiChange={setKpiType} fillHeight />
                <AIRisksPanel
                  kpi={kpi}
                  alerts={visibleAlerts}
                  filters={filters}
                  ready={!loading && kpi !== null}
                />
              </>
            )}
          </div>

          </>)}

          {/* ── Tactical view ── */}
          {activeView === "tactical" && (
            <div className="bg-white rounded-lg border border-[#EBEBEB] overflow-hidden shrink-0">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-[#EBEBEB]">
                    <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[180px]">KPI</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Value</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Target</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">vs Target</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Trend MoM</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(() => {
                    if (loading) return (
                      Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 6 }).map((__, j) => (
                            <td key={j} className="px-4 py-3">
                              <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
                            </td>
                          ))}
                        </tr>
                      ))
                    );
                    const rows: { icon: React.ReactNode; name: string; value: string; unit: string; target: string; delta: string; deltaColor: string; trend: number | null; alertId: string }[] = [
                      {
                        icon: <Clock size={13} className="text-blue-500" />,
                        name: "Lead Time",
                        value: kpi ? (kpi.leadTime?.grossDays ?? 0).toFixed(2) : "—",
                        unit: "days",
                        target: "≤ 13",
                        delta: kpi ? `${(kpi.leadTime?.grossDays ?? 0) > 13 ? "+" : ""}${((kpi.leadTime?.grossDays ?? 0) - 13).toFixed(2)}d` : "—",
                        deltaColor: kpi && (kpi.leadTime?.grossDays ?? 0) > 13 ? "text-red-600" : "text-emerald-600",
                        trend: kpi?.leadTime?.grossTrend ?? null,
                        alertId: "leadtime",
                      },
                      {
                        icon: <Package size={13} className="text-teal-500" />,
                        name: "Output (FG)",
                        value: kpi ? formatThousands(kpi.output?.fgQty ?? 0) : "—",
                        unit: "pcs",
                        target: "—",
                        delta: kpi?.output?.fgTrend != null ? `${kpi.output.fgTrend >= 0 ? "+" : ""}${kpi.output.fgTrend.toFixed(1)}%` : "—",
                        deltaColor: kpi && (kpi.output?.fgTrend ?? 0) >= 0 ? "text-emerald-600" : "text-red-600",
                        trend: kpi?.output?.fgTrend ?? null,
                        alertId: "output",
                      },
                      {
                        icon: <Gauge size={13} className="text-red-500" />,
                        name: "OEE",
                        value: kpi ? (kpi.oee?.value ?? 0).toFixed(1) : "—",
                        unit: "%",
                        target: "≥ 65%",
                        delta: kpi ? `${(kpi.oee?.value ?? 0) - 65 >= 0 ? "+" : ""}${((kpi.oee?.value ?? 0) - 65).toFixed(1)}pp` : "—",
                        deltaColor: kpi && (kpi.oee?.value ?? 0) >= 65 ? "text-emerald-600" : "text-red-600",
                        trend: kpi?.oee?.trend ?? null,
                        alertId: "oee",
                      },
                      {
                        icon: <Users size={13} className="text-violet-500" />,
                        name: "Productivity",
                        value: kpi ? (kpi.productivity?.e2e ?? 0).toFixed(1) : "—",
                        unit: "pcs/mh",
                        target: "—",
                        delta: kpi?.productivity?.e2eTrend != null ? `${kpi.productivity.e2eTrend >= 0 ? "+" : ""}${kpi.productivity.e2eTrend.toFixed(1)}%` : "—",
                        deltaColor: kpi && (kpi.productivity?.e2eTrend ?? 0) >= 0 ? "text-emerald-600" : "text-red-600",
                        trend: kpi?.productivity?.e2eTrend ?? null,
                        alertId: "productivity",
                      },
                      {
                        icon: <Droplets size={13} className="text-amber-500" />,
                        name: "Bulk Loss",
                        value: kpi ? (kpi.yield?.bulkLossPct ?? 0).toFixed(1) : "—",
                        unit: "%",
                        target: "≤ 3%",
                        delta: kpi ? `${(kpi.yield?.bulkLossPct ?? 0) - 3 >= 0 ? "+" : ""}${((kpi.yield?.bulkLossPct ?? 0) - 3).toFixed(1)}pp` : "—",
                        deltaColor: kpi && (kpi.yield?.bulkLossPct ?? 0) <= 3 ? "text-emerald-600" : "text-red-600",
                        trend: kpi?.yield?.bulkLossTrend ?? null,
                        alertId: "bulkloss",
                      },
                      {
                        icon: <Zap size={13} className="text-yellow-500" />,
                        name: "Energy",
                        value: "—",
                        unit: "kWh/unit",
                        target: "—",
                        delta: "—",
                        deltaColor: "text-gray-400",
                        trend: null,
                        alertId: "energy",
                      },
                    ];
                    return rows.map((row) => {
                      const hasAlert = visibleAlerts.some((a) => a.id.startsWith(row.alertId));
                      const trendGood = row.trend != null && (
                        ["oee","ope","rft","output"].includes(row.alertId) ? row.trend >= 0 : row.trend <= 0
                      );
                      return (
                        <tr key={row.name} className={cn("hover:bg-gray-50/50 transition-colors", hasAlert && "bg-red-50/40")}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {row.icon}
                              <span className="text-[12px] font-semibold text-gray-800">{row.name}</span>
                              {hasAlert && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[13px] font-bold text-gray-900 tabular-nums">{row.value}</span>
                            <span className="text-[10px] text-gray-400 ml-1">{row.unit}</span>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-gray-500">{row.target}</td>
                          <td className="px-4 py-3">
                            <span className={cn("text-[11px] font-semibold tabular-nums", row.deltaColor)}>{row.delta}</span>
                          </td>
                          <td className="px-4 py-3">
                            {row.trend != null ? (
                              <span className={cn("text-[11px] font-semibold tabular-nums", trendGood ? "text-emerald-600" : "text-red-500")}>
                                {row.trend > 0 ? "▲" : "▼"} {Math.abs(row.trend).toFixed(1)}%
                              </span>
                            ) : <span className="text-[11px] text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {hasAlert
                              ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700">⚠ Alert</span>
                              : <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">✓ OK</span>
                            }
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      <FloatingChat
        filters={filters}
        kpiSnapshot={kpi ? {
          oee:              kpi.oee?.value,
          oeePerformance:   kpi.oee?.performance,
          oeeQuality:       kpi.oee?.quality,
          leadTimeGross:    kpi.leadTime?.grossDays,
          bulkLoss:         kpi.yield?.bulkLossPct,
          packLoss:         kpi.yield?.packLossPct,
          rft:              kpi.rightFirstTime?.value,
          outputFg:         kpi.output?.fgQty,
          outputBulk:       kpi.output?.bulkQty,
          productivityE2e:  kpi.productivity?.e2e,
        } : undefined}
        alerts={visibleAlerts}
      />
      <SecurityOverlay />

      {undoId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1e293b] text-slate-100 text-[12px] px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-200">
          <span>{t("alert_dismissed")}</span>
          <button onClick={handleUndoDismiss} className="text-indigo-300 font-semibold hover:text-indigo-200 transition-colors">
            {t("alert_undo")}
          </button>
        </div>
      )}
    </div>
  );
}
