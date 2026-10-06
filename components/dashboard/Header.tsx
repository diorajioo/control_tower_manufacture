"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, LayoutGrid, Calendar, ChevronDown, Check, Loader2, X, Send, Monitor, Lock } from "lucide-react";

const EN_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const EN_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];


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
      setDate(`${EN_DAYS[now.getDay()]}, ${now.getDate()} ${EN_MONTHS[now.getMonth()]} ${now.getFullYear()}`);
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
import { useI18n } from "@/lib/i18n";
import type { KPIAlert } from "@/lib/alerts";

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

function today() { return new Date().toISOString().split("T")[0]; }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0]; }
function firstOfMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; }
function firstOfLastMonth() { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; }
function lastOfLastMonth() { const d = new Date(); d.setDate(0); return d.toISOString().split("T")[0]; }
function mondayOfWeek(offset = 0) {
  const d = new Date(); const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day) + offset * 7);
  return d.toISOString().split("T")[0];
}
function sundayOfLastWeek() {
  const d = new Date(); const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day) - 1);
  return d.toISOString().split("T")[0];
}

const PERIOD_PRESETS = [
  { key: "YTD",        label: "YTD",               getValue: () => ({ start: `${new Date().getFullYear()}-01-01`, end: today() }) },
  { key: "ThisMonth",  label: "This Month",          getValue: () => ({ start: firstOfMonth(),     end: today() }) },
  { key: "LastMonth",  label: "Last Month",         getValue: () => ({ start: firstOfLastMonth(), end: lastOfLastMonth() }) },
  { key: "Last30Days", label: "Last 30 Days",       getValue: () => ({ start: daysAgo(30),        end: today() }) },
  { key: "ThisWeek",   label: "This Week",          getValue: () => ({ start: mondayOfWeek(0),    end: today() }) },
  { key: "LastWeek",   label: "Last Week",          getValue: () => ({ start: mondayOfWeek(-1),   end: sundayOfLastWeek() }) },
  { key: "Custom",     label: "Custom Range",       getValue: () => ({ start: "", end: "" }) },
];

// Available resolutions per period
const PERIOD_RESOLUTIONS: Record<string, string[]> = {
  YTD:        ["Daily", "Weekly", "Monthly"],
  ThisMonth:  ["Daily", "Weekly"],
  LastMonth:  ["Daily", "Weekly"],
  Last30Days: ["Daily", "Weekly"],
  ThisWeek:   ["Daily"],
  LastWeek:   ["Daily"],
  Custom:     ["Daily", "Weekly", "Monthly"],
};

const DATA_LEVELS: { value: string; label: string }[] = [
  { value: "Daily",   label: "Daily"   },
  { value: "Weekly",  label: "Weekly"  },
  { value: "Monthly", label: "Monthly" },
];

interface HeaderProps {
  plants: string[];
  onFilterChange: (f: { plant: string; startDate: string; endDate: string; dataLevel: string; period: string }) => void;
  /** Filters the page is currently showing (e.g. restored from localStorage); defaults to YTD · All Plant */
  initialFilters?: Partial<{ plant: string; startDate: string; endDate: string; dataLevel: string; period: string }>;
  activeView: string;
  onViewChange: (v: string) => void;
  /** `locked` views are shown with a lock icon and cannot be opened (e.g. still on mock data) */
  views?: Array<{ key: string; label: string; locked?: boolean }>;
  onRefresh: () => void;
  isLoading: boolean;
  lastUpdated?: Date;
  alertCount?: number;
  onBellClick?: () => void;
  alerts?: KPIAlert[];
  onDismiss?: (id: string) => void;
  onMonitorMode?: () => void;
  ltBasis?: "created" | "released";
  onLtBasisChange?: (b: "created" | "released") => void;
}

export function Header({
  plants, onFilterChange, activeView, onViewChange, views,
  onRefresh, isLoading, lastUpdated, alertCount = 0, onBellClick,
  alerts = [], onDismiss, onMonitorMode,
  ltBasis, onLtBasisChange, initialFilters,
}: HeaderProps) {
  const { data: session } = useSession();
  const { t } = useI18n();
  const resolvedViews: Array<{ key: string; label: string; locked?: boolean }> = views ?? [
    { key: "strategic", label: t("header_view_strategic") },
    { key: "tactical",  label: t("header_view_tactical") },
  ];
  const [countdown,      setCountdown]      = useState(REFRESH_INTERVAL_MS);
  // Filter controls edit a draft; nothing reaches the page until the user clicks Apply.
  const [applied, setApplied] = useState(() => ({
    plant:     initialFilters?.plant     ?? "All Plant",
    period:    initialFilters?.period    ?? "YTD",
    startDate: initialFilters?.startDate ?? `${new Date().getFullYear()}-01-01`,
    endDate:   initialFilters?.endDate   ?? today(),
    dataLevel: initialFilters?.dataLevel ?? "Daily",
  }));
  const [plant,          setPlant]          = useState(applied.plant);
  const [period,         setPeriod]         = useState(applied.period);
  const [startDate,      setStartDate]      = useState(applied.startDate);
  const [endDate,        setEndDate]        = useState(applied.endDate);
  const [dataLevel,      setDataLevel]      = useState(applied.dataLevel);
  const [plantOpen,      setPlantOpen]      = useState(false);
  const [periodOpen,     setPeriodOpen]     = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const [alertOpen,      setAlertOpen]      = useState(false);
  const [teamsState,     setTeamsState]     = useState<"idle"|"sending"|"ok"|"err">("idle");
  const plantRef      = useRef<HTMLDivElement>(null);
  const periodRef     = useRef<HTMLDivElement>(null);
  const resolutionRef = useRef<HTMLDivElement>(null);
  const alertRef      = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (plantRef.current      && !plantRef.current.contains(e.target as Node))      setPlantOpen(false);
      if (periodRef.current     && !periodRef.current.contains(e.target as Node))     setPeriodOpen(false);
      if (resolutionRef.current && !resolutionRef.current.contains(e.target as Node)) setResolutionOpen(false);
      if (alertRef.current      && !alertRef.current.contains(e.target as Node))      setAlertOpen(false);
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

  const draft = { plant, period, startDate, endDate, dataLevel };
  const dirty = (Object.keys(draft) as (keyof typeof draft)[]).some((k) => draft[k] !== applied[k]);
  const invalidRange = period === "Custom" && (!startDate || !endDate || startDate > endDate);
  const applyFilters = () => {
    if (!dirty || invalidRange) return;
    setApplied(draft);
    onFilterChange(draft);
  };
  const discardFilters = () => {
    setPlant(applied.plant); setPeriod(applied.period); setStartDate(applied.startDate);
    setEndDate(applied.endDate); setDataLevel(applied.dataLevel);
  };

  const handlePlant     = (v: string) => { setPlant(v); };
  const handlePeriod    = (key: string) => {
    const p = PERIOD_PRESETS.find((x) => x.key === key); if (!p) return;
    if (key === "Custom") { setPeriod("Custom"); setPeriodOpen(false); return; }
    const { start, end } = p.getValue();
    const allowed = PERIOD_RESOLUTIONS[key] ?? ["Daily", "Weekly", "Monthly"];
    const newLevel = allowed.includes(dataLevel) ? dataLevel : allowed[0];
    setStartDate(start); setEndDate(end); setPeriod(key); setDataLevel(newLevel);
    setPeriodOpen(false);
  };
  const handleDataLevel = (v: string) => { setDataLevel(v); setResolutionOpen(false); };
  const handleStart     = (v: string) => { setStartDate(v); };
  const handleEnd       = (v: string) => { setEndDate(v); };

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
          plant:  applied.plant,
          period: applied.period,
          startDate: applied.startDate,
          endDate: applied.endDate,
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

      {/* ── Row 1: Paragon Blue topbar (joins the Sidebar logo block) ─────── */}
      <div className="flex items-center gap-3 px-4 h-[52px] bg-[#1E4076]">

        {/* Brand */}
        <span className="text-[13px] font-medium text-white/70 tracking-[0.07em] uppercase shrink-0">Manufacturing Control Tower</span>

        {applied.period && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white shrink-0">
            {applied.period}
          </span>
        )}

        <div className="flex-1" />

        {/* Live clock */}
        <div className="flex flex-col items-end pr-2.5 border-r border-white/20 shrink-0">
          <span className="text-[13px] font-bold text-white tracking-[0.03em] leading-tight tabular-nums">{clockTime}</span>
          <span className="text-[9.5px] text-white/60 leading-tight">{clockDate}</span>
        </div>

        {/* Sync / countdown */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 text-[11px] text-white/85 font-medium shrink-0">
          <span className={cn("w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0", !isLoading && "animate-pulse")} />
          {isLoading ? "Loading..." : `Live ${lastUpdated ? fmtCountdown(countdown) : ""}`}
        </div>

        {/* Monitor mode */}
        {onMonitorMode && (
          <button
            onClick={onMonitorMode}
            className="w-8 h-8 rounded-[9px] flex items-center justify-center border border-white/25 text-white/85 hover:bg-white/10 hover:text-white transition-colors shrink-0"
            title="Monitor mode — full screen view"
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
                ? "bg-amber-50 border border-amber-300 text-amber-500 hover:bg-amber-100"
                : "border border-white/25 text-white/85 hover:bg-white/10"
            )}
          >
            <Bell size={14} />
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-[1.5px] border-[#1E4076] flex items-center justify-center text-[8px] font-bold text-white">
                {alertCount}
              </span>
            )}
          </button>

          {alertOpen && (
            <div className="absolute right-0 top-full mt-2 z-50 w-[340px] bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.14)] border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-[12px] font-bold text-gray-800">
                  {alertCount > 0 ? `${alertCount} KPI${alertCount > 1 ? "s" : ""} Need Attention` : "No active alerts"}
                </span>
                <button onClick={() => setAlertOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={14} />
                </button>
              </div>

              <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-50">
                {alerts.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[12px] text-gray-400">All KPIs within normal range</div>
                ) : (
                  alerts.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                      <span className="shrink-0 mt-0.5">
                        <span className={cn("block w-2 h-2 mt-1 rounded-full", a.severity === "critical" ? "bg-red-500" : a.severity === "warning" ? "bg-amber-400" : "bg-[#1E4076]")} />
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
                                                 "bg-[#EEF4FB] text-[#16305C] border-[#C3CEE3] hover:bg-[#C3CEE3]"
                    )}
                  >
                    {teamsState === "sending" ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    {teamsState === "ok"      ? "Sent to Teams!" :
                     teamsState === "err"     ? "Failed — check config" :
                     teamsState === "sending" ? "Sending..." :
                     "Send to Teams"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Avatar */}
        <div
          className="w-8 h-8 bg-white/15 rounded-full flex items-center justify-center cursor-pointer shrink-0"
          title={session?.user?.name ?? ""}
          onClick={onRefresh}
        >
          <span className="text-white text-[11px] font-bold tracking-tight">{initials}</span>
        </div>
      </div>

      {/* ── Row 2: Filter bar ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-5 py-2 bg-white border-b border-gray-100 flex-wrap shadow-[0_1px_0_rgba(0,0,0,0.03)]">

        {/* Period dropdown */}
        <div className="relative shrink-0" ref={periodRef}>
          <button onClick={() => setPeriodOpen((o) => !o)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold transition-all",
              period
                ? "border-[#C3CEE3] bg-[#EEF4FB] text-[#16305C]"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
            )}>
            <Calendar size={10} className={period ? "text-[#1E4076]" : "text-gray-400"} />
            {PERIOD_PRESETS.find((p) => p.key === period)?.label ?? "Select Period"}
            <ChevronDown size={9} className={cn("text-gray-400 transition-transform duration-150", periodOpen && "rotate-180")} />
          </button>
          {periodOpen && (
            <div className="absolute top-full mt-2 left-0 z-50 bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-100 py-2 min-w-[176px]">
              {PERIOD_PRESETS.map((p) => (
                <button key={p.key} onClick={() => handlePeriod(p.key)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-3.5 py-2 text-[11px] text-left transition-colors",
                    period === p.key ? "bg-[#EEF4FB]/60 text-[#16305C]" : "text-gray-600 hover:bg-gray-50"
                  )}>
                  <span className="font-medium">{p.label}</span>
                  {period === p.key && <Check size={10} className="text-[#1E4076] shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Plant dropdown */}
        <div className="relative shrink-0" ref={plantRef}>
          <button onClick={() => setPlantOpen((o) => !o)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold transition-all",
              plant !== "All Plant"
                ? "border-[#C3CEE3] bg-[#EEF4FB] text-[#16305C]"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
            )}>
            <LayoutGrid size={10} className={plant !== "All Plant" ? "text-[#1E4076]" : "text-gray-400"} />
            {plant}
            <ChevronDown size={9} className={cn("text-gray-400 transition-transform duration-150", plantOpen && "rotate-180")} />
          </button>
          {plantOpen && (
            <div className="absolute top-full mt-2 left-0 z-50 bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-100 py-2 min-w-[148px]">
              {plants.map((p, i) => (
                <button key={p} onClick={() => { handlePlant(p); setPlantOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left transition-colors",
                    plant === p ? "bg-[#EEF4FB]/60 text-[#16305C]" : "text-gray-600 hover:bg-gray-50"
                  )}>
                  <span className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: PLANT_COLORS[i % PLANT_COLORS.length] }} />
                  <span className="font-medium flex-1">{p}</span>
                  {plant === p && <Check size={10} className="text-[#1E4076] shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date inputs — only shown for Custom Range */}
        {period === "Custom" && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#C3CEE3] bg-[#EEF4FB] shrink-0">
            <Calendar size={10} className="text-[#1E4076] shrink-0" />
            <input type="date" value={startDate} onChange={(e) => handleStart(e.target.value)}
              className="text-[11px] font-medium text-[#16305C] bg-transparent focus:outline-none w-[86px]" />
            <span className="text-[#C3CEE3] text-xs">–</span>
            <input type="date" value={endDate} onChange={(e) => handleEnd(e.target.value)}
              className="text-[11px] font-medium text-[#16305C] bg-transparent focus:outline-none w-[86px]" />
          </div>
        )}

        {/* Resolusi dropdown */}
        {(() => {
          const allowed = PERIOD_RESOLUTIONS[period] ?? ["Daily", "Weekly", "Monthly"];
          const availableLevels = DATA_LEVELS.filter((l) => allowed.includes(l.value));
          const currentLabel = DATA_LEVELS.find((l) => l.value === dataLevel)?.label ?? "Daily";
          if (availableLevels.length === 1) {
            return (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-[11px] font-semibold text-gray-400 shrink-0 select-none">
                {availableLevels[0].label}
              </div>
            );
          }
          return (
            <div className="relative shrink-0" ref={resolutionRef}>
              <button onClick={() => setResolutionOpen((o) => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-[11px] font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all">
                {currentLabel}
                <ChevronDown size={9} className={cn("text-gray-400 transition-transform duration-150", resolutionOpen && "rotate-180")} />
              </button>
              {resolutionOpen && (
                <div className="absolute top-full mt-2 left-0 z-50 bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-100 py-2 min-w-[128px]">
                  {availableLevels.map(({ value, label }) => (
                    <button key={value} onClick={() => handleDataLevel(value)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-3.5 py-2 text-[11px] text-left transition-colors",
                        dataLevel === value ? "bg-[#EEF4FB]/60 text-[#16305C]" : "text-gray-600 hover:bg-gray-50"
                      )}>
                      <span className="font-medium">{label}</span>
                      {dataLevel === value && <Check size={10} className="text-[#1E4076] shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Apply — filters only run after confirmation */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={applyFilters}
            disabled={!dirty || invalidRange}
            title={invalidRange ? "Start date must be on or before end date" : dirty ? undefined : "No filter changes to apply"}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4076]/40",
              dirty && !invalidRange
                ? "bg-[#1E4076] text-white hover:bg-[#16305C]"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}
          >
            Apply
          </button>
          {dirty && (
            <button onClick={discardFilters}
              className="px-2 py-1.5 rounded-full text-[11px] font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4076]/40">
              Discard
            </button>
          )}
          {invalidRange && <span className="text-[10.5px] text-red-600">Start date is after end date</span>}
        </div>

        {resolvedViews.length >= 2 && (
          <>
            <div className="w-px h-4 bg-gray-200 shrink-0 mx-0.5" />
            <div className="flex items-center gap-0.5 bg-white rounded-full p-0.5 border border-gray-200 shrink-0">
              {resolvedViews.map(({ key, label, locked }) => (
                <button key={key} onClick={() => { if (!locked) onViewChange(key); }}
                  disabled={locked}
                  title={locked ? "Coming soon — data not connected yet" : undefined}
                  className={cn(
                    "relative px-3 py-1 rounded-full text-[11px] font-semibold transition-colors z-10 inline-flex items-center gap-1",
                    locked ? "text-gray-300 cursor-not-allowed"
                      : activeView === key ? "text-[#16305C]" : "text-gray-500 hover:text-gray-700"
                  )}>
                  {locked && <Lock size={9} strokeWidth={2} />}
                  {activeView === key && (
                    <motion.span
                      layoutId="view-pill"
                      className="absolute inset-0 bg-[#EEF4FB] rounded-full"
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

        {ltBasis && onLtBasisChange && (
          <>
            <div className="w-px h-4 bg-gray-200 shrink-0 mx-0.5" />
            <div className="flex items-center gap-0.5 bg-white rounded-full p-0.5 border border-gray-200 shrink-0">
              {(["created", "released"] as const).map((b) => (
                <button key={b} onClick={() => onLtBasisChange(b)}
                  className={cn(
                    "relative px-3 py-1 rounded-full text-[11px] font-semibold transition-colors z-10",
                    ltBasis === b ? "text-[#16305C]" : "text-gray-500 hover:text-gray-700"
                  )}>
                  {ltBasis === b && (
                    <motion.span
                      layoutId="lt-basis-pill"
                      className="absolute inset-0 bg-[#EEF4FB] rounded-full"
                      style={{ zIndex: -1 }}
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  {b === "created" ? "PO Created" : "PO Released"}
                </button>
              ))}
            </div>
          </>
        )}

      </div>
    </header>
  );
}
