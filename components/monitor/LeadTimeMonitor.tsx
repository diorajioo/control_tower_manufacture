"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { FitToScreen } from "@/components/ui/FitToScreen";
import { LiteKPICard } from "@/components/dashboard/LiteKPICard";
import { LeadTimeCategoryCard } from "@/components/dashboard/LeadTimeCategoryCard";
import { LeadTimeTrendChart } from "@/components/dashboard/LeadTimeTrendChart";
import { LeadTimeSkuScatter, type LeadTimeChartData } from "@/components/dashboard/LeadTimeCharts";
import { LeadTimeStageChart } from "@/components/dashboard/LeadTimeStageChart";
import { LeadTimeTopSkuChart } from "@/components/dashboard/LeadTimeTopSkuChart";
import type { MonitorFilters } from "./StrategicMonitor";
import { KpiHighlightTarget } from "@/components/ui/KpiHighlight";

const LT_TARGET = 13;

interface LeadTimeKPI {
  grossDays: number;
  grossTrend: number | null;
  sparkline: number[];
  composition?: {
    vaDays: number; nnvaDays: number; unvaDays: number; wipDays: number;
    vaTrend: number | null; nnvaTrend: number | null; unvaTrend: number | null; wipTrend: number | null;
    vaMonthly: number[]; nnvaMonthly: number[]; unvaMonthly: number[]; wipMonthly: number[];
  };
}

export function LeadTimeMonitor({ filters }: { filters: MonitorFilters; onExit?: () => void }) {
  const [lt,            setLt]            = useState<LeadTimeKPI | null>(null);
  const [chartsData,    setChartsData]    = useState<LeadTimeChartData | null>(null);
  const [chartsLoading, setChartsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLt(null);
    const params = new URLSearchParams({
      plant: filters.plant, startDate: filters.startDate,
      endDate: filters.endDate, period: filters.period,
    });
    fetch(`/api/dashboard/kpi?${params}`)
      .then((r) => r.json())
      .then((res) => { if (!cancelled && res?.leadTime) setLt(res.leadTime); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [filters.plant, filters.startDate, filters.endDate, filters.period]);

  useEffect(() => {
    let cancelled = false;
    setChartsData(null);
    setChartsLoading(true);
    const params = new URLSearchParams({
      plant: filters.plant, startDate: filters.startDate,
      endDate: filters.endDate, period: filters.period,
    });
    fetch(`/api/lead-time/charts?${params}`)
      .then((r) => r.json())
      .then((res) => { if (!cancelled && res?.trend) setChartsData(res); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setChartsLoading(false); });
    return () => { cancelled = true; };
  }, [filters.plant, filters.startDate, filters.endDate, filters.period]);

  const comp = lt?.composition;
  const compTotal = comp ? comp.vaDays + comp.nnvaDays + comp.unvaDays : 0;
  const share = (days?: number) => (compTotal > 0 && days ? Math.round((days / compTotal) * 100) : 0);

  return (
    <FitToScreen className="h-full" resetKey={chartsLoading ? "loading" : "loaded"}>
      <div className="px-4 py-3 space-y-2.5">

        {/* 5 KPI cards */}
        <div className="grid grid-cols-5 gap-2">
          <KpiHighlightTarget id="leadtime">
            <LiteKPICard
              label="Lead Time"
              icon={<Clock size={13} color="#d97706" strokeWidth={1.75} />}
              value={lt ? lt.grossDays.toFixed(1) : "—"}
              unit="days"
              target={`≤ ${LT_TARGET} days`}
              attainment={lt && lt.grossDays > 0 ? (LT_TARGET / lt.grossDays) * 100 : 0}
              trend={lt?.grossTrend ?? null}
              series={lt?.sparkline ?? []}
              noData={!lt}
            />
          </KpiHighlightTarget>
          <KpiHighlightTarget id="va">
            <LeadTimeCategoryCard
              category="va"
              label="Value-Added"
              value={comp ? comp.vaDays.toFixed(1) : "—"}
              unit="days"
              context={`${share(comp?.vaDays)}% of total`}
              description="Occurs in Weighing, Processing, and Filling & Packing"
              info="Average per PO: SUM(NET_LEADTIME) of activities with ACTIVITY_CATEGORY = VA"
              trend={comp?.vaTrend ?? null}
              series={comp?.vaMonthly ?? []}
              noData={!comp}
            />
          </KpiHighlightTarget>
          <KpiHighlightTarget id="nnva">
            <LeadTimeCategoryCard
              category="nnva"
              label="Necessary Non-Value-Added"
              value={comp ? comp.nnvaDays.toFixed(1) : "—"}
              unit="days"
              context={`${share(comp?.nnvaDays)}% of total`}
              description="Occurs in PO, cleaning, unboxing, and NDC receiving"
              info="Average per PO: SUM(NET_LEADTIME) of activities with ACTIVITY_CATEGORY = NNVA"
              trend={comp?.nnvaTrend ?? null}
              series={comp?.nnvaMonthly ?? []}
              noData={!comp}
            />
          </KpiHighlightTarget>
          <KpiHighlightTarget id="waste">
            <LeadTimeCategoryCard
              category="waste"
              label="Waste"
              value={comp ? comp.unvaDays.toFixed(1) : "—"}
              unit="days"
              context={`${share(comp?.unvaDays)}% of total`}
              description="Made up of WIP and waiting time"
              info="Average per PO: SUM(NET_LEADTIME) of activities with ACTIVITY_CATEGORY = UNVA"
              trend={comp?.unvaTrend ?? null}
              series={comp?.unvaMonthly ?? []}
              noData={!comp}
            />
          </KpiHighlightTarget>
          <KpiHighlightTarget id="saving">
            <LeadTimeCategoryCard
              category="saving"
              label="Potential Saving"
              value={comp ? comp.wipDays.toFixed(1) : "—"}
              unit="days"
              context={`${comp && comp.unvaDays > 0 ? Math.round((comp.wipDays / comp.unvaDays) * 100) : 0}% of Waste is WIP`}
              description="Assuming all WIP can be eliminated"
              info="Average per PO: SUM(NET_LEADTIME) of UNVA activities with ACTIVITY_TYPE = WIP"
              trend={comp?.wipTrend ?? null}
              series={comp?.wipMonthly ?? []}
              noData={!comp}
            />
          </KpiHighlightTarget>
        </div>

        {/* Charts — 2×2 grid to keep chart ratios healthy */}
        <div className="grid grid-cols-2 gap-2">
          <LeadTimeTrendChart
            data={chartsData}
            loading={chartsLoading}
            filters={{ plant: filters.plant, startDate: filters.startDate, endDate: filters.endDate, period: filters.period }}
          />
          <LeadTimeSkuScatter data={chartsData} loading={chartsLoading} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <LeadTimeStageChart data={chartsData} loading={chartsLoading} />
          <LeadTimeTopSkuChart data={chartsData} loading={chartsLoading} />
        </div>

      </div>
    </FitToScreen>
  );
}
