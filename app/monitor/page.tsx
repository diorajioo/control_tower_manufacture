"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { StrategicMonitor } from "@/components/monitor/StrategicMonitor";
import { LeadTimeMonitor } from "@/components/monitor/LeadTimeMonitor";

type MonitorPage = "strategic" | "lead-time";

const MONITOR_PAGES = [
  { key: "strategic" as MonitorPage, label: "Strategic", icon: LayoutGrid, exitHref: "/dashboard" },
  { key: "lead-time" as MonitorPage, label: "Lead Time", icon: Clock,      exitHref: "/lead-time" },
] as const;

function MonitorClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setTime(`${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}:${String(n.getSeconds()).padStart(2, "0")} WIB`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="text-[12px] font-bold text-white/80 tabular-nums tracking-tight">{time}</span>;
}

function MonitorShell() {
  const { status } = useSession();
  const router     = useRouter();
  const params     = useSearchParams();

  const [activePage, setActivePage] = useState<MonitorPage>(
    () => (params.get("page") as MonitorPage | null) ?? "strategic"
  );
  const currentPage = MONITOR_PAGES.find((p) => p.key === activePage) ?? MONITOR_PAGES[0];

  const filters = {
    plant:     params.get("plant")     ?? "All Plant",
    period:    params.get("period")    ?? "YTD",
    startDate: params.get("startDate") ?? `${new Date().getFullYear()}-01-01`,
    endDate:   params.get("endDate")   ?? new Date().toISOString().split("T")[0],
    dataLevel: params.get("dataLevel") ?? "Daily",
  };

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    const onFsChange = () => {
      if (!document.fullscreenElement) router.back();
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [router]);

  const handleExit = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    router.push(currentPage.exitHref);
  };

  if (status === "loading") return null;

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F4F6F9] flex flex-col select-none">

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activePage === "strategic" && <StrategicMonitor filters={filters} onExit={handleExit} />}
        {activePage === "lead-time" && <LeadTimeMonitor onExit={handleExit} />}
      </div>

      {/* Bottom navigation — strategic only; lead-time has its own toolbar */}
      {activePage === "strategic" && (
        <div className="shrink-0 flex items-center justify-center pb-4 pt-2">
          <div className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0f172a]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">

            <MonitorClock />
            <span className="text-[10px] text-white/35 font-medium ml-1">
              {`${filters.plant} · ${filters.period || "Custom"}`}
            </span>

            <div className="w-px h-4 bg-white/15 mx-2" />

            {MONITOR_PAGES.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setActivePage(key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all",
                  activePage === key ? "bg-[#215AA8] text-white" : "text-white/50 hover:text-white/90 hover:bg-white/10"
                )}>
                <Icon size={11} />
                {label}
              </button>
            ))}

            <div className="w-px h-4 bg-white/15 mx-2" />

            <button onClick={handleExit}
              className="text-white/50 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              title="Exit fullscreen">
              <X size={13} />
            </button>

          </div>
        </div>
      )}
    </div>
  );
}

export default function MonitorPage() {
  return (
    <Suspense>
      <MonitorShell />
    </Suspense>
  );
}
