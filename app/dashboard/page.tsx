"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Clock, Droplets, ShieldCheck, Package, Gauge, Activity, Users } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { KPICard, MiniStat, CircularGauge } from "@/components/dashboard/KPICard";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { StackedBarChart } from "@/components/dashboard/StackedBarChart";
import { SkeletonCard } from "@/components/dashboard/SkeletonCard";
import { AISummary } from "@/components/dashboard/AISummary";
import { AlertPanel } from "@/components/dashboard/AlertPanel";
import { FloatingChat } from "@/components/dashboard/FloatingChat";
import { formatThousands, cn } from "@/lib/utils";
import { computeAlerts, type KPIAlert } from "@/lib/alerts";

// Tipe respons dari API /api/dashboard/kpi yang memuat semua KPI manufaktur
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
    bulkQty: number;   // DATAMART_PRODUCTION_OUTPUT_OLAH.REALIZATION_QUANTITY
    fgQty: number;     // DATAMART_PRODUCTION_OUTPUT_FG.QUANTITY
  };
  oee: { value: number; byPlant: { PLANT: string; OEE: number }[]; trend: number | null };
  productivity: {
    e2e: number;        // AVG_E2E_PROD — pcs/manhour
    upstream: number;   // AVG_UPSTREAM_PROD — kg/manhour
    downstream: number; // AVG_DOWNSTREAM_PROD — pcs/manhour
    byPlant: { PLANT: string }[];
  };
}

// Tipe filter aktif yang dikirim ke semua API endpoint dan komponen chart
interface Filters {
  plant: string;
  startDate: string;
  endDate: string;
  dataLevel: string;
}

export default function DashboardPage() {
  const { status } = useSession();
  const router = useRouter();

  const [kpi, setKpi] = useState<KPIResponse | null>(null);
  const [plants, setPlants] = useState<string[]>(["All Plant"]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>();
  const [activeView, setActiveView] = useState<"strategic" | "tactical">("strategic");
  const [alerts, setAlerts] = useState<KPIAlert[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [alertPanelOpen, setAlertPanelOpen] = useState(false);
  const [leadTimeUnit, setLeadTimeUnit] = useState<"days" | "hours">("days");
  const [leadTimeType, setLeadTimeType] = useState<"gross" | "nett">("gross");
  const [kpiType, setKpiType] = useState("leadtime");
  const [filters, setFilters] = useState<Filters>({
    plant: "All Plant",
    startDate: `${new Date().getFullYear()}-01-01`,
    endDate: new Date().toISOString().split("T")[0],
    dataLevel: "Daily",
  });

  // Redirect ke halaman login jika session belum terautentikasi
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  // Ambil daftar plant dari API saat pertama kali halaman dimuat
  useEffect(() => {
    fetch("/api/dashboard/plants")
      .then((r) => r.json())
      .then((d) => setPlants(d.plants ?? ["All Plant"]));
  }, []);

  // Fetch semua data KPI dari API lalu hitung alert berdasarkan threshold yang sudah ditentukan
  const fetchData = useCallback(async (f: Filters) => {
    setLoading(true);
    const params = new URLSearchParams({
      plant: f.plant,
      startDate: f.startDate,
      endDate: f.endDate,
    });

    try {
      const [kpiRes] = await Promise.all([
        fetch(`/api/dashboard/kpi?${params}`).then((r) => r.json()),
      ]);
      setKpi(kpiRes);
      setLastUpdated(new Date());

      const newAlerts = computeAlerts({
        leadTime: { value: kpiRes.leadTime?.grossDays ?? 0, trend: kpiRes.leadTime?.grossTrend ?? null },
        yield: {
          bulkLossPct: kpiRes.yield?.bulkLossPct ?? 0,
          packLossPct: kpiRes.yield?.packLossPct ?? 0,
          bulkLossTrend: kpiRes.yield?.bulkLossTrend ?? null,
          packLossTrend: kpiRes.yield?.packLossTrend ?? null,
        },
        rightFirstTime: { value: kpiRes.rightFirstTime?.value ?? 100, trend: kpiRes.rightFirstTime?.trend ?? null },
        oee: { value: kpiRes.oee?.value ?? 100, trend: kpiRes.oee?.trend ?? null },
      });
      setAlerts(newAlerts);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Jalankan fetchData pertama kali setelah session authenticated
  useEffect(() => {
    if (status === "authenticated") fetchData(filters);
  }, [status, fetchData, filters]);

  // Simpan filter baru ke state lalu trigger fetch ulang dengan filter terbaru
  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters);
    fetchData(newFilters);
  };

  // Tambah ID alert yang di-dismiss ke set agar tidak muncul lagi
  const handleDismissAlert = (id: string) => {
    setDismissedIds((prev) => new Set(Array.from(prev).concat(id)));
  };

  // Filter alert aktif yang belum di-dismiss oleh user
  const visibleAlerts = alerts.filter((a) => !dismissedIds.has(a.id));


  // Nilai dan tren Lead Time sesuai mode gross/nett yang dipilih user
  const leadTimeRawDays = leadTimeType === "gross"
    ? (kpi?.leadTime?.grossDays ?? 0)
    : (kpi?.leadTime?.nettDays ?? 0);
  const leadTimeRawTrend = leadTimeType === "gross"
    ? kpi?.leadTime?.grossTrend
    : kpi?.leadTime?.nettTrend;
  // Tren dibalik tanda karena LT turun = bagus (warna hijau), sedangkan badge positif = naik
  const leadTimeTrendInverted = leadTimeRawTrend != null ? -leadTimeRawTrend : undefined;
  const bulkLossTrendInverted = kpi?.yield?.bulkLossTrend != null ? -kpi.yield.bulkLossTrend : undefined;
  const packLossTrendInverted = kpi?.yield?.packLossTrend != null ? -kpi.yield.packLossTrend : undefined;

  // OPE dihitung sebagai estimasi dari OEE × 0.8 karena belum ada kolom langsung di Snowflake
  const rftValue = kpi?.rightFirstTime?.value ?? 0;
  const opeValue = kpi ? (kpi.oee?.value ?? 0) * 0.8 : null;

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7ff]">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8f7ff]">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        <Header
          plants={plants}
          onFilterChange={handleFilterChange}
          activeView={activeView}
          onViewChange={setActiveView}
          onRefresh={() => fetchData(filters)}
          isLoading={loading}
          lastUpdated={lastUpdated}
          alertCount={visibleAlerts.length}
          onBellClick={() => setAlertPanelOpen(!alertPanelOpen)}
        />

        <main className="flex-1 p-3 overflow-auto">
          {/* AI Summary */}
          <AISummary kpi={kpi} filters={filters} ready={!loading && kpi !== null} />

          {/* Alerts */}
          {(alertPanelOpen || visibleAlerts.some((a) => a.severity === "critical")) && (
            <AlertPanel alerts={visibleAlerts} onDismiss={handleDismissAlert} />
          )}

          {/* ── Section: Operation KPIs ─────────────────────────────────── */}
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-1 h-4 bg-brand-500 rounded-full" />
            <h2 className="text-sm font-bold text-gray-600 tracking-wide uppercase">Operation KPIs</h2>
          </div>

          {/* ── Row 1: 4 main KPI cards ─────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-2">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                {/* Lead Time — CT_MANUF_LEADTIME */}
                <KPICard
                  title="Lead Time"
                  icon={<Clock size={17} />}
                  iconColor="#3b82f6"
                  value={
                    kpi
                      ? leadTimeUnit === "hours"
                        ? (leadTimeRawDays * 24).toFixed(1)
                        : leadTimeRawDays.toFixed(2)
                      : "—"
                  }
                  unit={leadTimeUnit === "days" ? "days" : "hrs"}
                  subtitle={leadTimeType === "gross" ? "Gross LT · PO Created → NDC Receive" : "Nett LT · Actual on-line time"}
                  trend={leadTimeTrendInverted}
                  trendLabel="vs periode sebelumnya"
                  alert={visibleAlerts.some((a) => a.id.startsWith("leadtime"))}
                >
                  <div className="flex gap-1.5 pt-0.5">
                    <div className="flex gap-1">
                      {(["gross", "nett"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setLeadTimeType(t)}
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full transition-colors",
                            leadTimeType === t
                              ? "bg-brand-600 text-white"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          )}
                        >
                          {t === "gross" ? "Gross" : "Nett"}
                        </button>
                      ))}
                    </div>
                    <div className="w-px bg-gray-200 self-stretch" />
                    <div className="flex gap-1">
                      {(["days", "hours"] as const).map((u) => (
                        <button
                          key={u}
                          onClick={() => setLeadTimeUnit(u)}
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full transition-colors",
                            leadTimeUnit === u
                              ? "bg-gray-700 text-white"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          )}
                        >
                          {u === "days" ? "Daily" : "Hourly"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Position breakdown bar chart */}
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
                      <div className="pt-1.5 border-t border-gray-100 space-y-1 max-h-20 overflow-y-auto">
                        {positions.map((p) => (
                          <div key={p.position} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-24 shrink-0 truncate" title={p.position}>
                              {p.position}
                            </span>
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full bg-brand-400 rounded-full"
                                style={{ width: `${(p.avgHours / max) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-400 w-10 text-right shrink-0">
                              {toDisplay(p.avgHours)}{unitLabel}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </KPICard>

                {/* Yield — CT_MANUF_KEMAS (pack) + DATAMART_PRODUCTION_OUTPUT_OLAH (bulk) */}
                <KPICard
                  title="Yield / Loss"
                  icon={<Droplets size={17} />}
                  iconColor="#f59e0b"
                  alert={visibleAlerts.some((a) => a.id.startsWith("bulkloss") || a.id.startsWith("packloss"))}
                >
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <div className="flex items-baseline gap-1 mb-0.5">
                        <span className="text-2xl font-bold text-slate-800 font-display tracking-tight">
                          {kpi?.yield?.bulkLossPct?.toFixed(1) ?? "—"}
                        </span>
                        <span className="text-xs text-gray-400">%</span>
                      </div>
                      <p className="text-xs text-gray-400">Bulk Loss</p>
                      {bulkLossTrendInverted !== undefined && (
                        <span className={`text-xs font-semibold ${bulkLossTrendInverted >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {bulkLossTrendInverted >= 0 ? "↓" : "↑"} {Math.abs(bulkLossTrendInverted).toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <div className="w-px bg-gray-100 self-stretch" />
                    <div className="flex-1">
                      <div className="flex items-baseline gap-1 mb-0.5">
                        <span className="text-2xl font-bold text-slate-800 font-display tracking-tight">
                          {kpi?.yield?.packLossPct?.toFixed(1) ?? "—"}
                        </span>
                        <span className="text-xs text-gray-400">%</span>
                      </div>
                      <p className="text-xs text-gray-400">Pack Loss</p>
                      {packLossTrendInverted !== undefined && (
                        <span className={`text-xs font-semibold ${packLossTrendInverted >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {packLossTrendInverted >= 0 ? "↓" : "↑"} {Math.abs(packLossTrendInverted).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  {kpi && (
                    <p className="text-xs text-gray-400 pt-1 border-t border-gray-100">
                      ~{formatThousands(kpi.yield?.bulkLossKg ?? 0)} kg bulk loss
                    </p>
                  )}
                </KPICard>

                {/* Right First Time — CT_MANUF_LEADTIME: RELEASE_QTY / TARGET_QTY */}
                <KPICard
                  title="Right First Time"
                  icon={<ShieldCheck size={17} />}
                  iconColor="#22c55e"
                  trend={kpi?.rightFirstTime?.trend ?? undefined}
                  trendLabel="vs periode sebelumnya"
                  alert={visibleAlerts.some((a) => a.id.startsWith("rft"))}
                >
                  <div className="flex items-center gap-4">
                    <CircularGauge
                      value={rftValue}
                      color={rftValue >= 95 ? "#22c55e" : rftValue >= 90 ? "#f59e0b" : "#ef4444"}
                    />
                    <div>
                      <p className="text-xs text-gray-500 leading-snug">First Time Passed Rate</p>
                      {rftValue >= 95 ? (
                        <p className="text-xs text-green-600 font-semibold mt-1">✓ Meets target</p>
                      ) : rftValue > 0 ? (
                        <p className="text-xs text-amber-600 font-semibold mt-1">! Below target</p>
                      ) : null}
                    </div>
                  </div>
                </KPICard>

                {/* Output — DATAMART_PRODUCTION_OUTPUT_OLAH + DATAMART_PRODUCTION_OUTPUT_FG */}
                <KPICard
                  title="Output"
                  icon={<Package size={17} />}
                  iconColor="#6366f1"
                >
                  <div className="flex-1 flex flex-col justify-evenly">
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-500 mb-1">Finished Goods</p>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-3xl font-bold text-slate-800 font-display tracking-tight">
                          {kpi ? formatThousands(kpi.output?.fgQty ?? 0) : "—"}
                        </span>
                        <span className="text-sm text-gray-500 font-semibold">pcs</span>
                      </div>
                    </div>
                    <div className="w-full h-px bg-gray-100" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-500 mb-1">Bulk Output</p>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-3xl font-bold text-slate-800 font-display tracking-tight">
                          {kpi ? formatThousands(kpi.output?.bulkQty ?? 0) : "—"}
                        </span>
                        <span className="text-sm text-gray-500 font-semibold">pcs</span>
                      </div>
                    </div>
                  </div>
                </KPICard>
              </>
            )}
          </div>

          {/* ── Section: Equipment & People ──────────────────────────── */}
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-1 h-4 bg-purple-500 rounded-full" />
            <h2 className="text-sm font-bold text-gray-600 tracking-wide uppercase">Equipment &amp; People</h2>
          </div>

          {/* ── Row 2: 3 operational KPI cards ──────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mb-2">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                {/* OEE — CT_MANUF_KEMAS: Quality × Performance per plant */}
                <KPICard
                  title="OEE"
                  icon={<Gauge size={17} />}
                  iconColor="#8b5cf6"
                  value={kpi?.oee?.value?.toFixed(1) ?? "—"}
                  unit="%"
                  trend={kpi?.oee?.trend ?? undefined}
                  trendLabel="vs periode sebelumnya"
                  subtitle="Overall Equipment Effectiveness"
                  badge={(kpi?.oee?.value ?? 100) < 65 ? "! Below Target" : "On Track"}
                  badgeColor={(kpi?.oee?.value ?? 100) < 65 ? "amber" : "green"}
                  alert={visibleAlerts.some((a) => a.id.startsWith("oee"))}
                />

                {/* OPE — derived: OEE × 0.8 (no direct Snowflake column yet) */}
                <KPICard
                  title="OPE"
                  icon={<Activity size={17} />}
                  iconColor="#06b6d4"
                  value={opeValue !== null ? opeValue.toFixed(1) : "—"}
                  unit="%"
                  subtitle="Overall Plant Effectiveness · est. OEE × 0.8"
                  badge={(opeValue ?? 100) < 60 ? "! Below Target" : "On Track"}
                  badgeColor={(opeValue ?? 100) < 60 ? "amber" : "green"}
                />

                {/* Productivity — CT_MANUF_E2E (e2e), CT_MANUF_OLAH (upstream), CT_MANUF_KEMAS (downstream) */}
                <KPICard
                  title="Productivity"
                  icon={<Users size={17} />}
                  iconColor="#10b981"
                  value={kpi?.productivity?.e2e?.toFixed(1) ?? "—"}
                  unit="pcs/manhour"
                  subtitle="E2E Productivity"
                >
                  <div className="flex gap-4 pt-2 border-t border-gray-100">
                    <MiniStat
                      label="Upstream"
                      value={kpi ? formatThousands(kpi.productivity?.upstream ?? 0) : "—"}
                      unit=" kg/mh"
                    />
                    <MiniStat
                      label="Downstream"
                      value={kpi?.productivity?.downstream?.toFixed(1) ?? "—"}
                      unit=" pcs/mh"
                    />
                  </div>
                </KPICard>
              </>
            )}
          </div>

          {/* ── Section: Trend & Benchmark ──────────────────────────────── */}
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-1 h-4 bg-blue-500 rounded-full" />
            <h2 className="text-sm font-bold text-gray-600 tracking-wide uppercase">Trend &amp; Benchmark</h2>
          </div>

          {/* ── Charts ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {loading ? (
              <>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 h-64 animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-1/3 mb-4" />
                  <div className="h-48 bg-gray-50 rounded" />
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 h-64 animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-1/3 mb-4" />
                  <div className="h-48 bg-gray-50 rounded" />
                </div>
              </>
            ) : (
              <>
                <TrendChart filters={filters} kpiType={kpiType} onKpiChange={setKpiType} />
                <StackedBarChart filters={filters} kpiType={kpiType} onKpiChange={setKpiType} />
              </>
            )}
          </div>
        </main>
      </div>

      <FloatingChat filters={filters} />
    </div>
  );
}
