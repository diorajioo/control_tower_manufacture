"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, Bell, LayoutGrid, Calendar, ChevronDown, Check, Loader2, X, Send } from "lucide-react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PLANT_COLORS } from "@/lib/chartConfig";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import type { KPIAlert } from "@/lib/alerts";

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

const PERIOD_PRESETS = [
  { key: "YTD", short: "YTD", tKey: "header_period_ytd" as TranslationKey, getValue: () => ({ start: `${new Date().getFullYear()}-01-01`, end: today() }) },
  { key: "30D", short: "30D", tKey: "header_period_30d" as TranslationKey, getValue: () => ({ start: daysAgo(30),  end: today() }) },
  { key: "90D", short: "90D", tKey: "header_period_90d" as TranslationKey, getValue: () => ({ start: daysAgo(90),  end: today() }) },
  { key: "6M",  short: "6M",  tKey: "header_period_6m"  as TranslationKey, getValue: () => ({ start: daysAgo(180), end: today() }) },
];

const DATA_LEVELS: { value: string; tKey: TranslationKey }[] = [
  { value: "Daily",   tKey: "header_data_daily"   },
  { value: "Weekly",  tKey: "header_data_weekly"  },
  { value: "Monthly", tKey: "header_data_monthly" },
];

function today() { return new Date().toISOString().split("T")[0]; }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

interface HeaderProps {
  plants: string[];
  onFilterChange: (f: { plant: string; startDate: string; endDate: string; dataLevel: string; period: string }) => void;
  activeView: "strategic" | "tactical";
  onViewChange: (v: "strategic" | "tactical") => void;
  onRefresh: () => void;
  isLoading: boolean;
  lastUpdated?: Date;
  alertCount?: number;
  onBellClick?: () => void;
  alerts?: KPIAlert[];
  onDismiss?: (id: string) => void;
}

export function Header({
  plants, onFilterChange, activeView, onViewChange,
  onRefresh, isLoading, lastUpdated, alertCount = 0, onBellClick,
  alerts = [], onDismiss,
}: HeaderProps) {
  const { data: session } = useSession();
  const { t } = useI18n();
  const [countdown,  setCountdown]  = useState(REFRESH_INTERVAL_MS);
  const [plant,      setPlant]      = useState("All Plant");
  const [period,     setPeriod]     = useState("YTD");
  const [startDate,  setStartDate]  = useState(`${new Date().getFullYear()}-01-01`);
  const [endDate,    setEndDate]    = useState(today());
  const [dataLevel,  setDataLevel]  = useState("Daily");
  const [plantOpen,  setPlantOpen]  = useState(false);
  const [alertOpen,  setAlertOpen]  = useState(false);
  const [teamsState, setTeamsState] = useState<"idle"|"sending"|"ok"|"err">("idle");
  const plantRef = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (plantRef.current && !plantRef.current.contains(e.target as Node)) setPlantOpen(false);
      if (alertRef.current && !alertRef.current.contains(e.target as Node)) setAlertOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (!lastUpdated) return;
    const tick = () => {
      const rem = REFRESH_INTERVAL_MS - (Date.now() - lastUpdated.getTime());
      if (rem <= 0) { onRefresh(); setCountdown(REFRESH_INTERVAL_MS); }
      else setCountdown(rem);
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [lastUpdated, onRefresh]);

  const push = (o: Partial<{ plant: string; startDate: string; endDate: string; dataLevel: string; period: string }> = {}) =>
    onFilterChange({ plant: o.plant ?? plant, startDate: o.startDate ?? startDate, endDate: o.endDate ?? endDate, dataLevel: o.dataLevel ?? dataLevel, period: o.period ?? period });

  const handlePlant     = (v: string) => { setPlant(v);  push({ plant: v }); };
  const handlePeriod    = (key: string) => {
    const p = PERIOD_PRESETS.find((x) => x.key === key); if (!p) return;
    const { start, end } = p.getValue();
    setStartDate(start); setEndDate(end); setPeriod(key); push({ startDate: start, endDate: end, period: key });
  };
  const handleDataLevel = (v: string) => { setDataLevel(v); push({ dataLevel: v }); };
  const handleStart     = (v: string) => { setStartDate(v); setPeriod(""); push({ startDate: v, period: "" }); };
  const handleEnd       = (v: string) => { setEndDate(v);   setPeriod(""); push({ endDate: v,   period: "" }); };

  const handleTeamsSend = async () => {
    setTeamsState("sending");
    try {
      let teamsRecipients: Array<{ email: string; kpis: Record<string, boolean> }> | undefined;
      const raw = localStorage.getItem("ct-teams-settings");
      if (raw) {
        const cfg = JSON.parse(raw) as { enabled?: boolean; recipients?: typeof teamsRecipients };
        if (cfg.enabled && cfg.recipients?.length) teamsRecipients = cfg.recipients;
      }
      const res = await fetch("/api/notifications/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alerts,
          plant,
          period,
          withRecommendation: false,
          ...(teamsRecipients ? { recipients: teamsRecipients } : {}),
        }),
      });
      const d = await res.json() as { ok?: boolean };
      setTeamsState(d.ok ? "ok" : "err");
    } catch { setTeamsState("err"); }
    setTimeout(() => setTeamsState("idle"), 3500);
  };

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "AP";

  const fmtCountdown = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <header className="bg-white border-b border-gray-100 shrink-0 shadow-[0_1px_0_rgba(0,0,0,0.04)]">

      {/* ── Row 1: Title + Right actions ─────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 h-[52px]">

        <div className="shrink-0">
          <p className="text-[13px] font-bold text-slate-800 leading-none tracking-tight">Manufacturing Overview</p>
          <p className="text-[11px] text-gray-500 leading-none mt-0.5">KPI Control Tower</p>
        </div>

        {period && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
            {period}
          </span>
        )}

        <div className="flex-1" />

        {/* Alert bell pill */}
        <div className="relative shrink-0" ref={alertRef}>
          <button
            onClick={() => { setAlertOpen((o) => !o); onBellClick?.(); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border",
              alertCount > 0
                ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
            )}
          >
            <Bell size={12} />
            {alertCount > 0 ? (
              <>
                <span>{alertCount} Alert</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              </>
            ) : (
              <span>Alert</span>
            )}
          </button>

          {alertOpen && (
            <div className="absolute right-0 top-full mt-2 z-50 w-[340px] bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.14)] border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-[12px] font-bold text-gray-800">
                  {alertCount > 0 ? `${alertCount} KPI Memerlukan Perhatian` : "Tidak ada alert aktif"}
                </span>
                <button onClick={() => setAlertOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={14} />
                </button>
              </div>

              <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-50">
                {alerts.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[12px] text-gray-400">Semua KPI dalam batas normal</div>
                ) : (
                  alerts.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                      <span className="shrink-0 mt-0.5">
                        {a.severity === "critical" ? "🔴" : a.severity === "warning" ? "🟡" : "🔵"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-gray-800">{a.kpi}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{a.message}</p>
                        {a.trend != null && (
                          <span className={cn("text-[10px] font-semibold", a.trend < 0 ? "text-red-500" : "text-emerald-600")}>
                            {a.trend > 0 ? "+" : ""}{a.trend.toFixed(1)}%
                          </span>
                        )}
                      </div>
                      {onDismiss && (
                        <button onClick={() => onDismiss(a.id)} className="shrink-0 p-0.5 text-gray-300 hover:text-gray-500 transition-colors">
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {alerts.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-100">
                  <button
                    onClick={handleTeamsSend}
                    disabled={teamsState === "sending"}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-semibold transition-all border",
                      teamsState === "ok"      ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      teamsState === "err"     ? "bg-red-50 text-red-600 border-red-200" :
                      teamsState === "sending" ? "bg-gray-50 text-gray-400 border-gray-200 cursor-wait" :
                                                 "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                    )}
                  >
                    {teamsState === "sending" ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    {teamsState === "ok"      ? "Terkirim ke Teams!" :
                     teamsState === "err"     ? "Gagal — cek konfigurasi" :
                     teamsState === "sending" ? "Mengirim..." :
                     "Kirim ke Teams"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Refresh */}
        <button onClick={onRefresh} disabled={isLoading}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100 disabled:opacity-50 transition-all shrink-0">
          <span className={cn("w-1.5 h-1.5 rounded-full bg-emerald-500", !isLoading && "animate-pulse")} />
          <RefreshCw size={9} className={cn(isLoading && "animate-spin")} />
          {isLoading ? t("common_loading") : `Live ${lastUpdated ? fmtCountdown(countdown) : ""}`}
        </button>

        {/* Avatar */}
        <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center shadow-sm cursor-pointer shrink-0"
          title={session?.user?.name ?? ""}>
          <span className="text-white text-[11px] font-bold tracking-tight">{initials}</span>
        </div>
      </div>

      {/* ── Row 2: Filter bar ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-5 py-2 border-t border-gray-100 bg-gray-50/60 flex-wrap">

        {/* Period pills */}
        <div className="flex items-center gap-0.5 bg-white rounded-full p-0.5 border border-gray-200 shrink-0">
          {PERIOD_PRESETS.map((p) => (
            <button key={p.key} onClick={() => handlePeriod(p.key)}
              className={cn(
                "relative px-3 py-1 rounded-full text-[11px] font-semibold transition-colors z-10",
                period === p.key ? "text-indigo-600" : "text-gray-500 hover:text-gray-700"
              )}>
              {period === p.key && (
                <motion.span
                  layoutId="period-pill"
                  className="absolute inset-0 bg-indigo-50 rounded-full"
                  style={{ zIndex: -1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              {p.short}
            </button>
          ))}
        </div>

        {/* Plant dropdown */}
        <div className="relative shrink-0" ref={plantRef}>
          <button onClick={() => setPlantOpen((o) => !o)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold transition-all",
              plant !== "All Plant"
                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
            )}>
            <LayoutGrid size={10} className={plant !== "All Plant" ? "text-indigo-500" : "text-gray-400"} />
            {plant}
            <ChevronDown size={9} className={cn("text-gray-400 transition-transform duration-150", plantOpen && "rotate-180")} />
          </button>
          {plantOpen && (
            <div className="absolute top-full mt-2 left-0 z-50 bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-100 py-2 min-w-[148px]">
              {plants.map((p, i) => (
                <button key={p} onClick={() => { handlePlant(p); setPlantOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left transition-colors",
                    plant === p ? "bg-indigo-50/60 text-indigo-700" : "text-gray-600 hover:bg-gray-50"
                  )}>
                  <span className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: PLANT_COLORS[i % PLANT_COLORS.length] }} />
                  <span className="font-medium flex-1">{p}</span>
                  {plant === p && <Check size={10} className="text-indigo-500 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:border-gray-300 transition-colors shrink-0">
          <Calendar size={10} className="text-gray-400 shrink-0" />
          <input type="date" value={startDate} onChange={(e) => handleStart(e.target.value)}
            className="text-[11px] font-medium text-gray-700 bg-transparent focus:outline-none w-[86px]" />
          <span className="text-gray-200 text-xs">–</span>
          <input type="date" value={endDate} onChange={(e) => handleEnd(e.target.value)}
            className="text-[11px] font-medium text-gray-700 bg-transparent focus:outline-none w-[86px]" />
        </div>

        {/* Data level */}
        <div className="flex items-center gap-0.5 bg-white rounded-full p-0.5 border border-gray-200 shrink-0">
          {DATA_LEVELS.map(({ value, tKey }) => (
            <button key={value} onClick={() => handleDataLevel(value)}
              className={cn(
                "relative px-3 py-1 rounded-full text-[11px] font-semibold transition-colors z-10",
                dataLevel === value ? "text-indigo-600" : "text-gray-500 hover:text-gray-700"
              )}>
              {dataLevel === value && (
                <motion.span
                  layoutId="datalevel-pill"
                  className="absolute inset-0 bg-indigo-50 rounded-full"
                  style={{ zIndex: -1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              {t(tKey)}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-gray-200 shrink-0 mx-0.5" />

        {/* Strategic / Tactical */}
        <div className="flex items-center gap-0.5 bg-white rounded-full p-0.5 border border-gray-200 shrink-0">
          {(["strategic", "tactical"] as const).map((v) => (
            <button key={v} onClick={() => onViewChange(v)}
              className={cn(
                "relative px-3 py-1 rounded-full text-[11px] font-semibold transition-colors z-10",
                activeView === v ? "text-indigo-600" : "text-gray-500 hover:text-gray-700"
              )}>
              {activeView === v && (
                <motion.span
                  layoutId="view-pill"
                  className="absolute inset-0 bg-indigo-50 rounded-full"
                  style={{ zIndex: -1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              {v === "strategic" ? t("header_view_strategic") : t("header_view_tactical")}
            </button>
          ))}
        </div>

      </div>
    </header>
  );
}
