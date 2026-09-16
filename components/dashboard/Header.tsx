"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, LayoutGrid, Calendar, ChevronDown, Check, Loader2, X, Send, Monitor } from "lucide-react";

const ID_DAYS = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const ID_MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];


function useClock() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      const s = String(now.getSeconds()).padStart(2, "0");
      setTime(`${h}:${m}:${s} WIB`);
      setDate(`${ID_DAYS[now.getDay()]}, ${now.getDate()} ${ID_MONTHS[now.getMonth()]} ${now.getFullYear()}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return { time, date };
}
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
  activeView: string;
  onViewChange: (v: string) => void;
  views?: Array<{ key: string; label: string }>;
  onRefresh: () => void;
  isLoading: boolean;
  lastUpdated?: Date;
  alertCount?: number;
  onBellClick?: () => void;
  alerts?: KPIAlert[];
  onDismiss?: (id: string) => void;
  onMonitorMode?: () => void;
}

export function Header({
  plants, onFilterChange, activeView, onViewChange, views,
  onRefresh, isLoading, lastUpdated, alertCount = 0, onBellClick,
  alerts = [], onDismiss, onMonitorMode,
}: HeaderProps) {
  const { data: session } = useSession();
  const { t } = useI18n();
  const resolvedViews = views ?? [
    { key: "strategic", label: t("header_view_strategic") },
    { key: "tactical",  label: t("header_view_tactical") },
  ];
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
      // Prefer server settings for cross-device consistency, fall back to localStorage cache
      try {
        const settingsRes = await fetch("/api/settings/teams");
        if (settingsRes.ok) {
          const cfg = await settingsRes.json() as { enabled?: boolean; recipients?: typeof teamsRecipients };
          if (cfg.enabled && cfg.recipients?.length) teamsRecipients = cfg.recipients;
        }
      } catch {
        const raw = localStorage.getItem("ct-teams-settings");
        if (raw) {
          const cfg = JSON.parse(raw) as { enabled?: boolean; recipients?: typeof teamsRecipients };
          if (cfg.enabled && cfg.recipients?.length) teamsRecipients = cfg.recipients;
        }
      }
      const res = await fetch("/api/notifications/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alerts,
          plant,
          period,
          withRecommendation: false,
          force: true, // manual send — skip dedup
          ...(teamsRecipients ? { recipients: teamsRecipients } : {}),
        }),
      });
      const d = await res.json() as { ok?: boolean };
      setTeamsState(d.ok ? "ok" : "err");
    } catch { setTeamsState("err"); }
    setTimeout(() => setTeamsState("idle"), 3500);
  };

  const { time: clockTime, date: clockDate } = useClock();

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "AP";

  const fmtCountdown = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <header className="shrink-0">

      {/* ── Row 1: Navy topbar ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 h-[52px] bg-[#215AA8] border-b border-[#1A4886]">

        {/* Brand */}
        <span className="text-[13px] font-medium text-white/50 tracking-[0.07em] uppercase shrink-0">Manufacturing Control Tower</span>

        {period && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/15 shrink-0">
            {period}
          </span>
        )}

        <div className="flex-1" />

        {/* Live clock */}
        <div className="flex flex-col items-end pr-2.5 border-r border-white/10 shrink-0">
          <span className="text-[13px] font-bold text-white/90 tracking-[0.03em] leading-tight tabular-nums">{clockTime}</span>
          <span className="text-[9.5px] text-white/40 leading-tight">{clockDate}</span>
        </div>

        {/* Sync / countdown */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.08] border border-white/[0.12] text-[11px] text-white/55 font-medium shrink-0">
          <span className={cn("w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0", !isLoading && "animate-pulse")} />
          {isLoading ? "Memuat..." : `Live ${lastUpdated ? fmtCountdown(countdown) : ""}`}
        </div>

        {/* Monitor mode */}
        {onMonitorMode && (
          <button
            onClick={onMonitorMode}
            className="w-8 h-8 rounded-[9px] flex items-center justify-center bg-white/[0.08] border border-white/[0.12] text-white/75 hover:bg-white/[0.15] hover:text-white transition-colors shrink-0"
            title="Monitor mode — tampilan full screen"
          >
            <Monitor size={14} />
          </button>
        )}

        {/* Alert bell */}
        <div className="relative shrink-0" ref={alertRef}>
          <button
            onClick={() => { setAlertOpen((o) => !o); onBellClick?.(); }}
            className={cn(
              "relative w-8 h-8 rounded-[9px] flex items-center justify-center transition-colors",
              alertCount > 0
                ? "bg-amber-400/20 border border-amber-300/30 text-amber-200 hover:bg-amber-400/30"
                : "bg-white/[0.08] border border-white/[0.12] text-white/75 hover:bg-white/[0.15]"
            )}
          >
            <Bell size={14} />
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-[1.5px] border-[#215AA8] flex items-center justify-center text-[8px] font-bold text-white">
                {alertCount}
              </span>
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
                                                 "bg-[#D3DEEE] text-[#143665] border-[#A6BDDC] hover:bg-[#A6BDDC]"
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

        {/* Avatar */}
        <div
          className="w-8 h-8 bg-[#215AA8] rounded-full flex items-center justify-center shadow-sm cursor-pointer shrink-0"
          title={session?.user?.name ?? ""}
          onClick={onRefresh}
        >
          <span className="text-white text-[11px] font-bold tracking-tight">{initials}</span>
        </div>
      </div>

      {/* ── Row 2: Filter bar ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-5 py-2 bg-white border-b border-gray-100 flex-wrap shadow-[0_1px_0_rgba(0,0,0,0.03)]">

        {/* Period pills */}
        <div className="flex items-center gap-0.5 bg-white rounded-full p-0.5 border border-gray-200 shrink-0">
          {PERIOD_PRESETS.map((p) => (
            <button key={p.key} onClick={() => handlePeriod(p.key)}
              className={cn(
                "relative px-3 py-1 rounded-full text-[11px] font-semibold transition-colors z-10",
                period === p.key ? "text-[#143665]" : "text-gray-500 hover:text-gray-700"
              )}>
              {period === p.key && (
                <motion.span
                  layoutId="period-pill"
                  className="absolute inset-0 bg-[#D3DEEE] rounded-full"
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
                ? "border-[#A6BDDC] bg-[#D3DEEE] text-[#143665]"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
            )}>
            <LayoutGrid size={10} className={plant !== "All Plant" ? "text-[#215AA8]" : "text-gray-400"} />
            {plant}
            <ChevronDown size={9} className={cn("text-gray-400 transition-transform duration-150", plantOpen && "rotate-180")} />
          </button>
          {plantOpen && (
            <div className="absolute top-full mt-2 left-0 z-50 bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-100 py-2 min-w-[148px]">
              {plants.map((p, i) => (
                <button key={p} onClick={() => { handlePlant(p); setPlantOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left transition-colors",
                    plant === p ? "bg-[#D3DEEE]/60 text-[#143665]" : "text-gray-600 hover:bg-gray-50"
                  )}>
                  <span className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: PLANT_COLORS[i % PLANT_COLORS.length] }} />
                  <span className="font-medium flex-1">{p}</span>
                  {plant === p && <Check size={10} className="text-[#215AA8] shrink-0" />}
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
                dataLevel === value ? "text-[#143665]" : "text-gray-500 hover:text-gray-700"
              )}>
              {dataLevel === value && (
                <motion.span
                  layoutId="datalevel-pill"
                  className="absolute inset-0 bg-[#D3DEEE] rounded-full"
                  style={{ zIndex: -1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              {t(tKey)}
            </button>
          ))}
        </div>

        {resolvedViews.length >= 2 && (
          <>
            <div className="w-px h-4 bg-gray-200 shrink-0 mx-0.5" />
            {/* View toggle */}
            <div className="flex items-center gap-0.5 bg-white rounded-full p-0.5 border border-gray-200 shrink-0">
              {resolvedViews.map(({ key, label }) => (
                <button key={key} onClick={() => onViewChange(key)}
                  className={cn(
                    "relative px-3 py-1 rounded-full text-[11px] font-semibold transition-colors z-10",
                    activeView === key ? "text-[#143665]" : "text-gray-500 hover:text-gray-700"
                  )}>
                  {activeView === key && (
                    <motion.span
                      layoutId="view-pill"
                      className="absolute inset-0 bg-[#D3DEEE] rounded-full"
                      style={{ zIndex: -1 }}
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

      </div>
    </header>
  );
}
