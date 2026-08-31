"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, Bell, LayoutGrid, Calendar, ChevronDown, Check } from "lucide-react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PLANT_COLORS } from "@/lib/chartConfig";
import { useI18n, type TranslationKey } from "@/lib/i18n";

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
}

export function Header({
  plants, onFilterChange, activeView, onViewChange,
  onRefresh, isLoading, lastUpdated, alertCount = 0, onBellClick,
}: HeaderProps) {
  const { data: session } = useSession();
  const { t } = useI18n();
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS);
  const [plant,     setPlant]     = useState("All Plant");
  const [period,    setPeriod]    = useState("YTD");
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [endDate,   setEndDate]   = useState(today());
  const [dataLevel, setDataLevel] = useState("Daily");
  const [plantOpen, setPlantOpen] = useState(false);
  const plantRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (plantRef.current && !plantRef.current.contains(e.target as Node)) setPlantOpen(false);
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
  const handleStart     = (v: string) => { setStartDate(v); push({ startDate: v }); };
  const handleEnd       = (v: string) => { setEndDate(v);   push({ endDate: v }); };

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "AP";

  const fmtCountdown = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <header className="bg-white border-b border-gray-100 shrink-0 px-5 h-14 flex items-center gap-3 shadow-[0_1px_0_rgba(0,0,0,0.04)]">

      {/* Title */}
      <div className="shrink-0">
        <p className="text-[13px] font-bold text-slate-800 leading-none tracking-tight">Manufacturing Overview</p>
        <p className="text-[11px] text-gray-400 leading-none mt-0.5">KPI Control Tower</p>
      </div>

      <div className="w-px h-6 bg-gray-100 shrink-0 mx-0.5" />

      {/* Period pills */}
      <div className="flex items-center gap-0.5 bg-gray-100/80 rounded-full p-0.5 shrink-0">
        {PERIOD_PRESETS.map((p) => (
          <button key={p.key} onClick={() => handlePeriod(p.key)}
            className={cn(
              "relative px-3 py-1 rounded-full text-[11px] font-semibold transition-colors z-10",
              period === p.key ? "text-indigo-600" : "text-gray-500 hover:text-gray-700"
            )}>
            {period === p.key && (
              <motion.span
                layoutId="period-pill"
                className="absolute inset-0 bg-white rounded-full shadow-sm"
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
      <div className="flex items-center gap-0.5 bg-gray-100/80 rounded-full p-0.5 shrink-0">
        {DATA_LEVELS.map(({ value, tKey }) => (
          <button key={value} onClick={() => handleDataLevel(value)}
            className={cn(
              "relative px-3 py-1 rounded-full text-[11px] font-semibold transition-colors z-10",
              dataLevel === value ? "text-indigo-600" : "text-gray-500 hover:text-gray-700"
            )}>
            {dataLevel === value && (
              <motion.span
                layoutId="datalevel-pill"
                className="absolute inset-0 bg-white rounded-full shadow-sm"
                style={{ zIndex: -1 }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            {t(tKey)}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-gray-100 shrink-0 mx-0.5" />

      {/* Strategic / Tactical */}
      <div className="flex items-center gap-0.5 bg-gray-100/80 rounded-full p-0.5 shrink-0">
        {(["strategic", "tactical"] as const).map((v) => (
          <button key={v} onClick={() => onViewChange(v)}
            className={cn(
              "relative px-3 py-1 rounded-full text-[11px] font-semibold transition-colors z-10",
              activeView === v ? "text-indigo-600" : "text-gray-500 hover:text-gray-700"
            )}>
            {activeView === v && (
              <motion.span
                layoutId="view-pill"
                className="absolute inset-0 bg-white rounded-full shadow-sm"
                style={{ zIndex: -1 }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            {v === "strategic" ? t("header_view_strategic") : t("header_view_tactical")}
          </button>
        ))}
      </div>

      {/* Right: bell + live + avatar */}
      <div className="ml-auto flex items-center gap-2">
        <button onClick={onBellClick}
          className="relative p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <Bell size={15} />
          {alertCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center text-white text-[8px] font-bold">
              {alertCount > 9 ? "9+" : alertCount}
            </span>
          )}
        </button>

        <button onClick={onRefresh} disabled={isLoading}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100 disabled:opacity-50 transition-all">
          <span className={cn("w-1.5 h-1.5 rounded-full bg-emerald-500", !isLoading && "animate-pulse")} />
          <RefreshCw size={9} className={cn(isLoading && "animate-spin")} />
          {isLoading ? t("common_loading") : `Live ${lastUpdated ? fmtCountdown(countdown) : ""}`}
        </button>

        <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center shadow-sm cursor-pointer shrink-0"
          title={session?.user?.name ?? ""}>
          <span className="text-white text-[11px] font-bold tracking-tight">{initials}</span>
        </div>
      </div>
    </header>
  );
}
