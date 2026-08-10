"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Clock, Droplets, ShieldCheck, Package, Gauge, Activity, Users } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { KPICard, MiniStat, CircularGauge, TrendBadge } from "@/components/dashboard/KPICard";
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
  const [filters, setFilters] = useState<Filters>(() => {
    const defaults: Filters = {
      plant: "All Plant",
      startDate: `${new Date().getFullYear()}-01-01`,
      endDate: new Date().toISOString().split("T")[0],
      dataLevel: "Daily",
    };
    try {
      const stored = localStorage.getItem("ct-filters");
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch { return defaults; }
  });
  const [undoId, setUndoId] = useState<string | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Simpan filter baru ke state, localStorage, lalu trigger fetch ulang
  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters);
    try { localStorage.setItem("ct-filters", JSON.stringify(newFilters)); } catch { /* ignore */ }
    fetchData(newFilters);
  };

  // Tambah ID alert yang di-dismiss ke set, tampilkan opsi undo selama 5 detik
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
          <div className="flex items-center gap-3 mb-2">
            <div className="w-0.5 h-3 bg-brand-400 rounded-full shrink-0" />
            <h2 className="text-xs font-semibold text-gray-400 tracking-widest uppercase">Operation KPIs</h2>
            <div className="flex-1 h-px bg-gray-100" />
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
                  tooltip="Waktu dari PO dibuat hingga produk diterima NDC. Gross = total proses; Nett = waktu aktual produksi. Target: serendah mungkin."
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
                  tooltip="Persentase bahan baku yang hilang dalam proses produksi. Bulk Loss = kehilangan di proses olah; Pack Loss = proses kemas. Target: serendah mungkin."
                  icon={<Droplets size={17} />}
                  iconColor="#f59e0b"
                  alert={visibleAlerts.some((a) => a.id.startsWith("bulkloss") || a.id.startsWith("packloss"))}
                >
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <div className="flex items-baseline gap-1 mb-0.5">
                        <span className="text-2xl font-bold text-slate-800 tracking-tight">
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
                        <span className="text-2xl font-bold text-slate-800 tracking-tight">
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
                  tooltip="Persentase batch yang lulus QC tanpa rework atau rejection pada percobaan pertama. Target: ≥95%."
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
                      ariaLabel={`Right First Time: ${rftValue.toFixed(1)}% dari target 95%`}
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
                  tooltip="Jumlah produk yang berhasil diproduksi dalam periode ini. Finished Goods (FG) = produk jadi dalam pcs; Bulk = produk setengah jadi."
                  icon={<Package size={17} />}
                  iconColor="#6366f1"
                >
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-slate-800 tracking-tight">
                            {kpi ? formatThousands(kpi.output?.fgQty ?? 0) : "—"}
                          </span>
                          <span className="text-xs text-gray-400 font-medium">pcs</span>
                        </div>
                        {kpi?.output?.fgTrend != null && <TrendBadge trend={kpi.output.fgTrend} />}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">Finished Goods released</p>
                    </div>
                    <div className="h-px bg-gray-100" />
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-slate-800 tracking-tight">
                            {kpi ? formatThousands(kpi.output?.bulkQty ?? 0) : "—"}
                          </span>
                          <span className="text-xs text-gray-400 font-medium">kg</span>
                        </div>
                        {kpi?.output?.bulkTrend != null && <TrendBadge trend={kpi.output.bulkTrend} />}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">Accepted Bulk</p>
                    </div>
                  </div>
                </KPICard>
              </>
            )}
          </div>

          {/* ── Section: Equipment & People ──────────────────────────── */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-0.5 h-3 bg-purple-400 rounded-full shrink-0" />
            <h2 className="text-xs font-semibold text-gray-400 tracking-widest uppercase">Equipment &amp; People</h2>
            <div className="flex-1 h-px bg-gray-100" />
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
                  tooltip="Overall Equipment Effectiveness: efisiensi penggunaan mesin (Performance × Quality). Target: ≥65%."
                  icon={<Gauge size={17} />}
                  iconColor="#8b5cf6"
                  value={kpi?.oee?.value?.toFixed(1) ?? "—"}
                  unit="%"
                  trend={kpi?.oee?.trend ?? undefined}
                  trendLabel="vs periode sebelumnya"
                  subtitle="Overall Equipment Effectiveness"
                  badge={(kpi?.oee?.value ?? 100) < 65 ? "Critical" : "On Track"}
                  badgeColor={(kpi?.oee?.value ?? 100) < 65 ? "red" : "green"}
                  alert={visibleAlerts.some((a) => a.id.startsWith("oee"))}
                  sparkline={kpi?.oee?.sparkline}
                  sparklineColor={(kpi?.oee?.value ?? 100) < 65 ? "#ef4444" : "#22c55e"}
                >
                  {kpi && (
                    <>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">vs target 65.0%</span>
                          {(kpi.oee?.value ?? 100) < 65 && (
                            <span className="text-red-500 font-semibold">gap {(65 - kpi.oee.value).toFixed(1)} pts</span>
                          )}
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={(kpi.oee?.value ?? 0) >= 65 ? "h-full bg-green-400 rounded-full transition-all" : "h-full bg-red-400 rounded-full transition-all"}
                            style={{ width: `${Math.min(((kpi.oee?.value ?? 0) / 65) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-2 border-t border-gray-100">
                        <div>
                          <p className="text-xs text-gray-400">Performance</p>
                          <p className="text-sm font-bold text-slate-700">{kpi.oee.performance.toFixed(1)}<span className="text-xs font-normal text-gray-400 ml-0.5">%</span></p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Quality</p>
                          <p className="text-sm font-bold text-slate-700">{kpi.oee.quality.toFixed(1)}<span className="text-xs font-normal text-gray-400 ml-0.5">%</span></p>
                        </div>
                      </div>
                    </>
                  )}
                </KPICard>

                {/* OPE — derived: OEE × 0.8 (no direct Snowflake column yet) */}
                <KPICard
                  title="OPE"
                  tooltip="Overall Plant Effectiveness: estimasi performa seluruh pabrik, dihitung sebagai OEE × 0.8. Belum ada kolom langsung di Snowflake."
                  icon={<Activity size={17} />}
                  iconColor="#06b6d4"
                  value={opeValue !== null ? opeValue.toFixed(1) : "—"}
                  unit="%"
                  subtitle="Overall Plant Effectiveness"
                  badge={(opeValue ?? 100) < 60 ? "Below Target" : "On Track"}
                  badgeColor={(opeValue ?? 100) < 60 ? "amber" : "green"}
                  sparkline={kpi?.oee?.sparkline?.map((v) => Number((v * 0.8).toFixed(1)))}
                  sparklineColor={(opeValue ?? 100) < 60 ? "#f59e0b" : "#22c55e"}
                >
                  {kpi && opeValue !== null && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">vs target 60.0%</span>
                        {opeValue < 60 && (
                          <span className="text-amber-500 font-semibold">gap {(60 - opeValue).toFixed(1)} pts</span>
                        )}
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={opeValue >= 60 ? "h-full bg-green-400 rounded-full transition-all" : "h-full bg-amber-400 rounded-full transition-all"}
                          style={{ width: `${Math.min((opeValue / 60) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </KPICard>

                {/* Productivity — CT_MANUF_E2E (e2e), CT_MANUF_OLAH (upstream), CT_MANUF_KEMAS (downstream) */}
                <KPICard
                  title="Productivity"
                  tooltip="Efisiensi tenaga kerja. E2E = pcs/manhour keseluruhan; Upstream = kg/manhour proses olah; Downstream = pcs/manhour proses kemas."
                  icon={<Users size={17} />}
                  iconColor="#10b981"
                  value={kpi?.productivity?.e2e?.toFixed(1) ?? "—"}
                  unit="pcs/manhour"
                  subtitle="Downstream · E2E productivity"
                  trend={kpi?.productivity?.e2eTrend ?? undefined}
                  trendLabel="vs periode sebelumnya"
                  sparkline={kpi?.productivity?.sparkline}
                  sparklineColor="#10b981"
                >
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-2 border-t border-gray-100">
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
                    <MiniStat
                      label="Manhours logged"
                      value={kpi ? formatThousands(Math.round(kpi.productivity?.manhours ?? 0)) : "—"}
                      unit=" mh"
                    />
                    <MiniStat
                      label="Avg operator/batch"
                      value={kpi?.productivity?.avgOperators ?? "—"}
                      unit=" opr"
                    />
                  </div>
                </KPICard>
              </>
            )}
          </div>

          {/* ── Section: Trend & Benchmark ──────────────────────────────── */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-0.5 h-3 bg-blue-400 rounded-full shrink-0" />
            <h2 className="text-xs font-semibold text-gray-400 tracking-widest uppercase">Trend &amp; Benchmark</h2>
            <div className="flex-1 h-px bg-gray-100" />
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

      {/* Undo toast setelah dismiss alert */}
      {undoId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-200">
          <span>Alert dihapus</span>
          <button onClick={handleUndoDismiss} className="text-brand-300 font-semibold hover:text-brand-200 transition-colors">
            Batalkan
          </button>
        </div>
      )}
    </div>
  );
}
