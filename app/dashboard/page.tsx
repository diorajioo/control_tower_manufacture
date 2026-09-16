"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useI18n } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { Clock, Droplets, ShieldCheck, Package, Gauge, Activity, Users } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { SecurityOverlay } from "@/components/dashboard/SecurityOverlay";
import { KPICard, MiniStat, CircularGauge, TrendBadge } from "@/components/dashboard/KPICard";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { StackedBarChart } from "@/components/dashboard/StackedBarChart";
import { SkeletonCard } from "@/components/dashboard/SkeletonCard";
import { AISummary } from "@/components/dashboard/AISummary";
import { AlertPanel } from "@/components/dashboard/AlertPanel";
import { FloatingChat } from "@/components/dashboard/FloatingChat";
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
  };
  yield: {
    bulkLossPct: number;
    packLossPct: number;
    bulkLossKg: number;
    bulkLossTrend: number | null;
    packLossTrend: number | null;
  };
  rightFirstTime: { value: number; trend: number | null };
  output: {
    bulkQty: number;
    fgQty: number;
    fgTrend: number | null;
    bulkTrend: number | null;
  };
  oee: { value: number; quality: number; performance: number; byPlant: { PLANT: string; OEE: number }[]; trend: number | null; sparkline: number[] };
  productivity: {
    e2e: number;
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


// ── Section divider ────────────────────────────────────────────────────────────

function SectionDivider({ label, accentColor = "#6366f1" }: { label: string; accentColor?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-px flex-1 bg-gray-100" />
      <span
        className="text-[10px] font-bold tracking-widest uppercase shrink-0"
        style={{ color: accentColor, opacity: 0.7 }}
      >
        {label}
      </span>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  );
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
  const [leadTimeUnit,  setLeadTimeUnit]  = useState<"days" | "hours">("days");
  const [leadTimeType,  setLeadTimeType]  = useState<"gross" | "nett">("gross");
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
        err instanceof Error ? err.message : "Gagal memuat data — coba refresh"
      );
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

  const leadTimeRawDays   = leadTimeType === "gross" ? (kpi?.leadTime?.grossDays ?? 0) : (kpi?.leadTime?.nettDays ?? 0);
  const leadTimeRawTrend  = leadTimeType === "gross" ? kpi?.leadTime?.grossTrend : kpi?.leadTime?.nettTrend;
  const leadTimeTrendInverted  = leadTimeRawTrend  != null ? -leadTimeRawTrend  : undefined;
  const bulkLossTrendInverted  = kpi?.yield?.bulkLossTrend  != null ? -kpi.yield.bulkLossTrend  : undefined;
  const packLossTrendInverted  = kpi?.yield?.packLossTrend  != null ? -kpi.yield.packLossTrend  : undefined;

  const rftValue  = kpi?.rightFirstTime?.value ?? 0;
  const opeValue  = kpi ? (kpi.oee?.value ?? 0) * 0.8 : null;

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0eff8]">
        <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const monitorUrl = `/monitor?page=strategic&plant=${encodeURIComponent(filters.plant)}&period=${encodeURIComponent(filters.period)}&startDate=${filters.startDate}&endDate=${filters.endDate}&dataLevel=${filters.dataLevel}`;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          plants={plants}
          onFilterChange={handleFilterChange}
          views={[]}
          activeView=""
          onViewChange={() => {}}
          onRefresh={handleRefresh}
          isLoading={loading}
          lastUpdated={lastUpdated}
          alertCount={visibleAlerts.length}
          onBellClick={() => setAlertPanelOpen(!alertPanelOpen)}
          alerts={visibleAlerts}
          onDismiss={handleDismissAlert}
          onMonitorMode={() => router.push(monitorUrl)}
        />

        <main className="flex-1 p-5 overflow-y-auto min-h-0" onClick={() => setHighlightedKpi(null)}>
          {fetchError && (
            <div className="mb-3 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-3">
              <span className="text-[12px] text-red-600 font-medium">{fetchError}</span>
              <button onClick={() => setFetchError(null)} className="text-red-400 hover:text-red-600 text-xs shrink-0">✕</button>
            </div>
          )}
          <AISummary kpi={kpi} filters={filters} ready={!loading && kpi !== null} />

          {(alertPanelOpen || visibleAlerts.some((a) => a.severity === "critical")) && (
            <AlertPanel
              alerts={visibleAlerts}
              onDismiss={handleDismissAlert}
              plant={filters.plant}
              period={filters.period}
            />
          )}

          {/* ── Hero OEE ────────────────────────────────────────────────── */}
          {loading ? (
              <div className="mb-4 rounded-xl border border-slate-200 bg-white h-[92px] animate-pulse" />
            ) : kpi ? (() => {
              const oeeVal  = kpi.oee?.value       ?? 0;
              const perfVal = kpi.oee?.performance ?? 0;
              const qualVal = kpi.oee?.quality     ?? 0;
              const availVal = perfVal > 0 && qualVal > 0
                ? ((oeeVal / 100) / ((perfVal / 100) * (qualVal / 100))) * 100
                : null;
              const isGood = oeeVal >= 65;
              const accent = isGood ? "bg-emerald-500" : "bg-red-500";
              const valCls = isGood ? "text-emerald-600" : "text-red-600";
              return (
                <div className={cn("mb-4 bg-white rounded-xl border border-slate-200 flex overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.06)] transition-all duration-200", highlightedKpi !== null && highlightedKpi !== "oee" && "opacity-30 scale-[0.99]")}>
                  <div className={cn("w-[5px] shrink-0", accent)} />
                  <div className="flex-1 px-6 py-[18px] flex items-center gap-10 flex-wrap">
                    <div className="shrink-0">
                      <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-2">OEE — Overall Equipment Effectiveness</p>
                      <div className="flex items-baseline gap-1 leading-none">
                        <span className={cn("text-[3.25rem] font-bold tabular-nums tracking-tight leading-none", valCls)}>
                          {oeeVal.toFixed(1)}
                        </span>
                        <span className={cn("text-xl font-bold", valCls)}>%</span>
                      </div>
                      <p className="text-[12px] text-slate-500 mt-1.5">
                        {isGood
                          ? "Meets target (≥65%)"
                          : `Gap ${(65 - oeeVal).toFixed(1)} pts below target 65%`}
                      </p>
                    </div>
                    <div className="w-px h-14 bg-slate-100 shrink-0" />
                    <div className="flex gap-9">
                      {availVal !== null && (
                        <div>
                          <p className="text-[11px] text-slate-400 mb-1.5">Availability</p>
                          <p className={cn("text-2xl font-bold leading-none tabular-nums", availVal >= 80 ? "text-emerald-600" : "text-amber-600")}>
                            {availVal.toFixed(1)}<span className="text-[13px] font-medium text-slate-400 ml-0.5">%</span>
                          </p>
                          <p className={cn("text-[11px] font-semibold mt-1.5", availVal >= 80 ? "text-emerald-600" : "text-amber-600")}>
                            {availVal >= 80 ? "✓ On target" : "Below target"}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-[11px] text-slate-400 mb-1.5">Performance</p>
                        <p className={cn("text-2xl font-bold leading-none tabular-nums", perfVal >= 80 ? "text-emerald-600" : "text-amber-600")}>
                          {perfVal.toFixed(1)}<span className="text-[13px] font-medium text-slate-400 ml-0.5">%</span>
                        </p>
                        <p className={cn("text-[11px] font-semibold mt-1.5", perfVal >= 80 ? "text-emerald-600" : "text-amber-600")}>
                          {perfVal >= 80 ? "✓ On target" : "Below target"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-400 mb-1.5">Quality</p>
                        <p className={cn("text-2xl font-bold leading-none tabular-nums", qualVal >= 95 ? "text-emerald-600" : "text-amber-600")}>
                          {qualVal.toFixed(1)}<span className="text-[13px] font-medium text-slate-400 ml-0.5">%</span>
                        </p>
                        <p className={cn("text-[11px] font-semibold mt-1.5", qualVal >= 95 ? "text-emerald-600" : "text-amber-600")}>
                          {qualVal >= 95 ? "✓ Excellent" : "Needs attention"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })() : null
          }

          <div>
          {/* ── Operation KPIs ─────────────────────────────────────────── */}
          <SectionDivider label={t("section_operation_kpis")} accentColor="#215AA8" />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-[14px] mb-5">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                {/* Lead Time */}
                <KPICard
                  dimmed={highlightedKpi !== null && highlightedKpi !== "leadtime"}
                  flashKey={refreshCount}
                  title={t("card_leadtime")}
                  tooltip="Waktu dari PO dibuat hingga produk diterima NDC. Gross = total proses; Nett = waktu aktual produksi."
                  icon={<Clock size={16} />}
                  iconColor="#3b82f6"
                  value={
                    kpi
                      ? leadTimeUnit === "hours"
                        ? (leadTimeRawDays * 24).toFixed(1)
                        : leadTimeRawDays.toFixed(2)
                      : "—"
                  }
                  unit={leadTimeUnit === "days" ? "days" : "hrs"}
                  subtitle={leadTimeType === "gross" ? t("lt_subtitle_gross") : t("lt_subtitle_nett")}
                  trend={leadTimeTrendInverted}
                  trendLabel={t("lt_vs_prev")}
                  alert={visibleAlerts.some((a) => a.id.startsWith("leadtime"))}
                >
                  <div className="flex gap-1.5 pt-0.5">
                    <div className="flex gap-1">
                      {(["gross", "nett"] as const).map((lt) => (
                        <button
                          key={lt}
                          onClick={() => setLeadTimeType(lt)}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors",
                            leadTimeType === lt
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          )}
                        >
                          {lt === "gross" ? t("lt_gross") : t("lt_nett")}
                        </button>
                      ))}
                    </div>
                    <div className="w-px bg-gray-100 self-stretch" />
                    <div className="flex gap-1">
                      {(["days", "hours"] as const).map((u) => (
                        <button
                          key={u}
                          onClick={() => setLeadTimeUnit(u)}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors",
                            leadTimeUnit === u
                              ? "bg-slate-700 text-white"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          )}
                        >
                          {u === "days" ? t("lt_daily") : t("lt_hourly")}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(() => {
                    const positions = leadTimeType === "gross"
                      ? (kpi?.leadTime?.byPositionGross ?? [])
                      : (kpi?.leadTime?.byPositionNett ?? []);
                    if (positions.length === 0) return null;
                    const max = positions[0].avgHours || 1;
                    const toDisplay = (h: number) =>
                      leadTimeUnit === "days" ? (h / 24).toFixed(2) : h.toFixed(1);
                    const unitLabel = leadTimeUnit === "days" ? "d" : "h";
                    return (
                      <div className="pt-2 border-t border-gray-100 space-y-1.5 max-h-20 overflow-y-auto">
                        {positions.map((p) => (
                          <div key={p.position} className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-500 w-24 shrink-0 truncate tracking-tight" title={p.position}>
                              {p.position}
                            </span>
                            <div className="flex-1 bg-gray-100 rounded-full h-1 overflow-hidden">
                              <div
                                className="h-full bg-blue-400 rounded-full"
                                style={{ width: `${(p.avgHours / max) * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-gray-400 w-10 text-right shrink-0 tabular-nums">
                              {toDisplay(p.avgHours)}{unitLabel}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </KPICard>

                {/* Yield */}
                <KPICard
                  dimmed={highlightedKpi !== null && highlightedKpi !== "yield"}
                  flashKey={refreshCount}
                  title={t("card_yield")}
                  tooltip="Persentase bahan baku yang hilang dalam proses produksi. Bulk Loss = proses olah; Pack Loss = proses kemas."
                  icon={<Droplets size={16} />}
                  iconColor="#f59e0b"
                  alert={visibleAlerts.some((a) => a.id.startsWith("bulkloss") || a.id.startsWith("packloss"))}
                >
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <div className="flex items-baseline gap-1 mb-0.5">
                        <span className="text-[1.75rem] font-bold text-slate-900 tabular-nums tracking-tight">
                          {kpi?.yield?.bulkLossPct?.toFixed(1) ?? "—"}
                        </span>
                        <span className="text-[11px] text-gray-400">%</span>
                      </div>
                      <p className="text-[10px] text-gray-400">{t("yield_bulk_loss")}</p>
                      {bulkLossTrendInverted !== undefined && (
                        <span className={`text-[10px] font-semibold ${bulkLossTrendInverted >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {bulkLossTrendInverted >= 0 ? "↓" : "↑"} {Math.abs(bulkLossTrendInverted).toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <div className="w-px bg-gray-100 self-stretch" />
                    <div className="flex-1">
                      <div className="flex items-baseline gap-1 mb-0.5">
                        <span className="text-[1.75rem] font-bold text-slate-900 tabular-nums tracking-tight">
                          {kpi?.yield?.packLossPct?.toFixed(1) ?? "—"}
                        </span>
                        <span className="text-[11px] text-gray-400">%</span>
                      </div>
                      <p className="text-[10px] text-gray-400">{t("yield_pack_loss")}</p>
                      {packLossTrendInverted !== undefined && (
                        <span className={`text-[10px] font-semibold ${packLossTrendInverted >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {packLossTrendInverted >= 0 ? "↓" : "↑"} {Math.abs(packLossTrendInverted).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  {kpi && (
                    <p className="text-[10px] text-gray-400 pt-2 border-t border-gray-100">
                      ~{formatThousands(kpi.yield?.bulkLossKg ?? 0)} {t("yield_loss_volume")}
                    </p>
                  )}
                </KPICard>

                {/* Right First Time */}
                <KPICard
                  dimmed={highlightedKpi !== null && highlightedKpi !== "rft"}
                  flashKey={refreshCount}
                  title={t("card_rft")}
                  tooltip="Persentase batch yang lulus QC tanpa rework atau rejection pada percobaan pertama. Target: ≥95%."
                  icon={<ShieldCheck size={16} />}
                  iconColor="#22c55e"
                  trend={kpi?.rightFirstTime?.trend ?? undefined}
                  trendLabel="vs periode sebelumnya"
                  alert={visibleAlerts.some((a) => a.id.startsWith("rft"))}
                >
                  <div className="flex items-center gap-4">
                    <CircularGauge
                      value={rftValue}
                      color={rftValue >= 95 ? "#22c55e" : rftValue >= 90 ? "#f59e0b" : "#ef4444"}
                      ariaLabel={`Right First Time: ${rftValue.toFixed(1)}% dari target 95%`}
                    />
                    <div>
                      <p className="text-[11px] text-gray-500 leading-snug">{t("rft_passed_rate")}</p>
                      {rftValue >= 95 ? (
                        <p className="text-[11px] text-emerald-600 font-semibold mt-1">{t("rft_meets")}</p>
                      ) : rftValue > 0 ? (
                        <p className="text-[11px] text-amber-600 font-semibold mt-1">{t("rft_below")}</p>
                      ) : null}
                    </div>
                  </div>
                </KPICard>

                {/* Output */}
                <KPICard
                  dimmed={highlightedKpi !== null && highlightedKpi !== "output"}
                  flashKey={refreshCount}
                  title={t("card_output")}
                  tooltip="Jumlah produk yang berhasil diproduksi dalam periode ini. FG = produk jadi (pcs); Bulk = produk setengah jadi."
                  icon={<Package size={16} />}
                  iconColor="#6366f1"
                >
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex items-baseline gap-1">
                          <span className="text-[1.75rem] font-bold text-slate-900 tabular-nums tracking-tight">
                            {kpi ? formatThousands(kpi.output?.fgQty ?? 0) : "—"}
                          </span>
                          <span className="text-[11px] text-gray-400 font-medium">pcs</span>
                        </div>
                        {kpi?.output?.fgTrend != null && <TrendBadge trend={kpi.output.fgTrend} />}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">{t("output_fg")}</p>
                    </div>
                    <div className="h-px bg-gray-100" />
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex items-baseline gap-1">
                          <span className="text-[1.75rem] font-bold text-slate-900 tabular-nums tracking-tight">
                            {kpi ? formatThousands(kpi.output?.bulkQty ?? 0) : "—"}
                          </span>
                          <span className="text-[11px] text-gray-400 font-medium">kg</span>
                        </div>
                        {kpi?.output?.bulkTrend != null && <TrendBadge trend={kpi.output.bulkTrend} />}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">{t("output_bulk")}</p>
                    </div>
                  </div>
                </KPICard>
              </>
            )}
          </div>

          </div>

          <div>
          {/* ── Equipment & People ──────────────────────────────────────── */}
          <SectionDivider label={t("section_equipment_people")} accentColor="#8b5cf6" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-[14px] mb-5">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                {/* OEE */}
                <KPICard
                  dimmed={highlightedKpi !== null && highlightedKpi !== "oee"}
                  flashKey={refreshCount}
                  title={t("card_oee")}
                  tooltip="Overall Equipment Effectiveness: efisiensi penggunaan mesin (Performance × Quality). Target: ≥65%."
                  icon={<Gauge size={16} />}
                  iconColor="#8b5cf6"
                  value={kpi?.oee?.value?.toFixed(1) ?? "—"}
                  unit="%"
                  trend={kpi?.oee?.trend ?? undefined}
                  trendLabel={t("lt_vs_prev")}
                  subtitle={t("oee_subtitle")}
                  badge={(kpi?.oee?.value ?? 100) < 65 ? t("badge_critical") : t("badge_on_track")}
                  badgeColor={(kpi?.oee?.value ?? 100) < 65 ? "red" : "green"}
                  alert={visibleAlerts.some((a) => a.id.startsWith("oee"))}
                  sparkline={kpi?.oee?.sparkline}
                  sparklineColor={(kpi?.oee?.value ?? 100) < 65 ? "#ef4444" : "#22c55e"}
                >
                  {kpi && (
                    <>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-gray-400">{t("oee_vs_target")} 65.0%</span>
                          {(kpi.oee?.value ?? 100) < 65 && (
                            <span className="text-red-500 font-semibold">{t("oee_gap")} {(65 - kpi.oee.value).toFixed(1)} {t("oee_pts")}</span>
                          )}
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={(kpi.oee?.value ?? 0) >= 65 ? "h-full bg-emerald-400 rounded-full transition-all" : "h-full bg-red-400 rounded-full transition-all"}
                            style={{ width: `${Math.min(((kpi.oee?.value ?? 0) / 65) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 pt-2 border-t border-gray-100">
                        <div>
                          <p className="text-[10px] text-gray-400">{t("oee_performance")}</p>
                          <p className="text-sm font-bold text-slate-700 tabular-nums">{kpi.oee.performance.toFixed(1)}<span className="text-[10px] font-normal text-gray-400 ml-0.5">%</span></p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400">{t("oee_quality")}</p>
                          <p className="text-sm font-bold text-slate-700 tabular-nums">{kpi.oee.quality.toFixed(1)}<span className="text-[10px] font-normal text-gray-400 ml-0.5">%</span></p>
                        </div>
                      </div>
                    </>
                  )}
                </KPICard>

                {/* OPE */}
                <KPICard
                  dimmed={highlightedKpi !== null && highlightedKpi !== "ope"}
                  flashKey={refreshCount}
                  title={t("card_ope")}
                  tooltip="Overall Plant Effectiveness: estimasi performa seluruh pabrik, dihitung sebagai OEE × 0.8."
                  icon={<Activity size={16} />}
                  iconColor="#06b6d4"
                  value={opeValue !== null ? opeValue.toFixed(1) : "—"}
                  unit="%"
                  subtitle={t("ope_subtitle")}
                  badge={(opeValue ?? 100) < 60 ? t("badge_below_target") : t("badge_on_track")}
                  badgeColor={(opeValue ?? 100) < 60 ? "amber" : "green"}
                  sparkline={kpi?.oee?.sparkline?.map((v) => Number((v * 0.8).toFixed(1)))}
                  sparklineColor={(opeValue ?? 100) < 60 ? "#f59e0b" : "#22c55e"}
                >
                  {kpi && opeValue !== null && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-gray-400">{t("oee_vs_target")} 60.0%</span>
                        {opeValue < 60 && (
                          <span className="text-amber-500 font-semibold">{t("oee_gap")} {(60 - opeValue).toFixed(1)} {t("oee_pts")}</span>
                        )}
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={opeValue >= 60 ? "h-full bg-emerald-400 rounded-full transition-all" : "h-full bg-amber-400 rounded-full transition-all"}
                          style={{ width: `${Math.min((opeValue / 60) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </KPICard>

                {/* Productivity */}
                <KPICard
                  dimmed={highlightedKpi !== null && highlightedKpi !== "productivity"}
                  flashKey={refreshCount}
                  title={t("card_productivity")}
                  tooltip="Efisiensi tenaga kerja. E2E = pcs/manhour keseluruhan; Upstream = kg/manhour proses olah; Downstream = pcs/manhour proses kemas."
                  icon={<Users size={16} />}
                  iconColor="#10b981"
                  value={kpi?.productivity?.e2e?.toFixed(1) ?? "—"}
                  unit="pcs/mh"
                  subtitle={t("prod_subtitle")}
                  trend={kpi?.productivity?.e2eTrend ?? undefined}
                  trendLabel={t("lt_vs_prev")}
                  sparkline={kpi?.productivity?.sparkline}
                  sparklineColor="#10b981"
                >
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-2 border-t border-gray-100">
                    <MiniStat label={t("prod_upstream")}    value={kpi ? formatThousands(kpi.productivity?.upstream ?? 0) : "—"} unit=" kg/mh"  />
                    <MiniStat label={t("prod_downstream")}  value={kpi?.productivity?.downstream?.toFixed(1) ?? "—"} unit=" pcs/mh" />
                    <MiniStat label={t("prod_manhours")}    value={kpi ? formatThousands(Math.round(kpi.productivity?.manhours ?? 0)) : "—"} unit=" mh" />
                    <MiniStat label={t("prod_avg_operator")} value={kpi?.productivity?.avgOperators ?? "—"} unit=" opr" />
                  </div>
                </KPICard>
              </>
            )}
          </div>

          </div>

          <div>
          {/* ── Trend & Benchmark ────────────────────────────────────────── */}
          <SectionDivider label={t("section_trend_benchmark")} accentColor="#3b82f6" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {loading ? (
              <>
                <div className="bg-white rounded-2xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] border border-gray-100/80 h-72 animate-pulse">
                  <div className="h-3.5 bg-gray-100 rounded-full w-1/3 mb-4" />
                  <div className="h-56 bg-gray-50 rounded-xl" />
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] border border-gray-100/80 h-72 animate-pulse">
                  <div className="h-3.5 bg-gray-100 rounded-full w-1/3 mb-4" />
                  <div className="h-56 bg-gray-50 rounded-xl" />
                </div>
              </>
            ) : (
              <>
                <TrendChart filters={filters} kpiType={kpiType} onKpiChange={setKpiType} />
                <StackedBarChart filters={filters} kpiType={kpiType} onKpiChange={setKpiType} />
              </>
            )}
          </div>
          </div>
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
