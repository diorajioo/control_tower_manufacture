"use client";

import { useState, useEffect, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { ResponsiveBar } from "@nivo/bar";
import {
  PLANT_COLORS,
  KPI_OPTIONS,
  computeControlLimits,
  computePerPlantLimits,
} from "@/lib/chartConfig";
import { cn } from "@/lib/utils";
import { LineTooltip } from "@/components/charts/StandardLine";

interface Filters {
  plant: string;
  startDate: string;
  endDate: string;
}

interface StackedBarChartProps {
  filters: Filters;
  kpiType: string;
  onKpiChange: (kpi: string) => void;
  chartHeight?: number;
  fillHeight?: boolean;
  hideSelector?: boolean;
  hoveredPlant?: string | null;
}

function hexToRgba(hex: string, alpha: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

const KPI_TAB_LABELS: Record<string, string> = {
  leadtime:   "chart_tab_leadtime",
  upstream:   "chart_tab_upstream",
  downstream: "chart_tab_downstream",
  e2e:        "chart_tab_e2e",
  output:     "chart_tab_output",
};

const nivoTheme = {
  background: "transparent",
  axis: {
    ticks: {
      line: { strokeWidth: 0 },
      text: { fill: "#9ca3af", fontSize: 10, fontFamily: "inherit" },
    },
    domain: { line: { strokeWidth: 0 } },
  },
  grid: {
    line: { stroke: "#f3f4f6", strokeWidth: 1 },
  },
};

export function StackedBarChart({ filters, kpiType, onKpiChange, chartHeight = 180, fillHeight = false, hideSelector = false, hoveredPlant = null }: StackedBarChartProps) {
  const [rawData,  setRawData]  = useState<Record<string, unknown>[]>([]);
  const [plants,   setPlants]   = useState<string[]>([]);
  const [loading,  setLoading]  = useState(false);
  const { t } = useI18n();

  const selectedKpi = KPI_OPTIONS.find((o) => o.value === kpiType)!;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      plant:     filters.plant,
      startDate: filters.startDate,
      endDate:   filters.endDate,
      kpiType,
    });
    fetch(`/api/dashboard/trends?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setRawData(d.trendSeries ?? []);
        setPlants(d.plants ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters.plant, filters.startDate, filters.endDate, kpiType]);

  const { mean, ucl, lcl } = useMemo(
    () => computeControlLimits(rawData, plants),
    [rawData, plants]
  );

  const perPlantLimits = useMemo(
    () => computePerPlantLimits(rawData, plants),
    [rawData, plants]
  );

  const plantData = useMemo(
    () =>
      plants.map((plant, i) => {
        const lim = perPlantLimits[plant] ?? { mean: 0, stdev: 0, ucl: 0, lcl: 0 };
        const vals = rawData
          .map((pt) => pt[plant])
          .filter((v): v is number => typeof v === "number" && !isNaN(v));
        return {
          plant,
          value:      lim.mean,
          color:      PLANT_COLORS[i % PLANT_COLORS.length],
          weeks:      vals.length,
          plantMean:  lim.mean,
          plantStdev: lim.stdev,
          plantUcl:   lim.ucl,
          plantLcl:   lim.lcl,
        };
      }),
    [rawData, plants, perPlantLimits]
  );

  const getStatus = (val: number) => {
    if (ucl === 0) return { label: "—", cls: "text-gray-300" };
    if (val > ucl)             return { label: "Above UCL",             cls: "text-red-500"     };
    if (lcl > 0 && val < lcl) return { label: "Below LCL",             cls: "text-amber-500"   };
    return                          { label: t("chart_in_control"),     cls: "text-emerald-600" };
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markers: any[] = useMemo(() => {
    const m = [];
    if (ucl > 0) m.push({
      axis: "y", value: ucl,
      lineStyle: { stroke: "#ef4444", strokeDasharray: "5 3", strokeWidth: 1.5 },
      legend: `UCL ${ucl.toFixed(1)}`,
      legendOffsetX: -8, legendOffsetY: -8,
      textStyle: { fill: "#ef4444", fontSize: 9, fontFamily: "inherit", fontWeight: 600 },
    });
    if (mean > 0) m.push({
      axis: "y", value: mean,
      lineStyle: { stroke: "#94a3b8", strokeDasharray: "4 2", strokeWidth: 1.5 },
      legend: `Mean ${mean.toFixed(1)}`,
      legendOffsetX: -8, legendOffsetY: -8,
      textStyle: { fill: "#94a3b8", fontSize: 9, fontFamily: "inherit" },
    });
    if (lcl > 0) m.push({
      axis: "y", value: lcl,
      lineStyle: { stroke: "#ef4444", strokeDasharray: "5 3", strokeWidth: 1.5 },
      legend: `LCL ${lcl.toFixed(1)}`,
      legendOffsetX: -8, legendOffsetY: 12,
      textStyle: { fill: "#ef4444", fontSize: 9, fontFamily: "inherit", fontWeight: 600 },
    });
    return m;
  }, [ucl, mean, lcl]);

  return (
    <div className={cn("bg-white rounded-lg p-3 border border-[#EBEBEB] hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200", fillHeight && "h-full flex flex-col")}>
      {/* Header */}
      <div className={cn("flex items-center justify-between mb-2", fillHeight && "shrink-0")}>
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-[0.08em] leading-none">
            {t("chart_kpi_by_plant")}
          </span>
          {loading && (
            <span className="w-3 h-3 border border-[#215AA8] border-t-transparent rounded-full animate-spin inline-block" />
          )}
        </div>
        <span className="text-[10px] bg-[#D3DEEE] text-[#143665] px-2.5 py-0.5 rounded-full font-semibold tracking-tight">
          {selectedKpi.label}
        </span>
      </div>

      {/* KPI tabs */}
      {!hideSelector && (
        <div className={cn("flex flex-wrap gap-1 mb-2", fillHeight && "shrink-0")}>
          {KPI_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onKpiChange(opt.value)}
              className={`text-[10px] px-2.5 py-1 rounded-full font-semibold transition-colors ${
                kpiType === opt.value
                  ? "bg-[#215AA8] text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
              }`}
            >
              {KPI_TAB_LABELS[opt.value] ? t(KPI_TAB_LABELS[opt.value] as Parameters<typeof t>[0]) : opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Bar chart */}
      <div className={fillHeight ? "flex-1 min-h-0" : ""} style={fillHeight ? undefined : { height: chartHeight }}>
        {plantData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[11px] text-gray-300">No data available</div>
        ) : (
          <ResponsiveBar
            data={plantData}
            keys={["value"]}
            indexBy="plant"
            theme={nivoTheme}
            margin={{ top: 4, right: 16, bottom: 24, left: 36 }}
            padding={0.38}
            borderRadius={5}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            colors={(bar: any) => {
              if (hoveredPlant && String(bar.data.plant) !== hoveredPlant) {
                return hexToRgba(String(bar.data.color), 0.16);
              }
              return String(bar.data.color);
            }}
            colorBy="indexValue"
            axisBottom={{
              tickSize: 0,
              tickPadding: 8,
            }}
            axisLeft={{
              tickSize: 0,
              tickPadding: 6,
              tickValues: 4,
              format: (v) => Number(v).toFixed(1),
            }}
            enableGridX={false}
            enableLabel={false}
            markers={markers}
            tooltip={({ indexValue, value, color }) => {
              const p = plantData.find((d) => d.plant === indexValue);
              return (
                <LineTooltip
                  title={String(indexValue)}
                  rows={[{
                    label: p ? `Avg · ${p.weeks}w` : "Avg",
                    color: String(color),
                    value: Number(value),
                    unit: selectedKpi.unit,
                    sub: p && <>σ {p.plantStdev.toFixed(2)} · UCL <span style={{ color: "#f5a39a" }}>{p.plantUcl.toFixed(2)}</span> · LCL <span style={{ color: "#f5a39a" }}>{p.plantLcl.toFixed(2)}</span></>,
                  }]}
                />
              );
            }}
          />
        )}
      </div>

      {/* Plant status — compact 2-col grid so bar chart stays dominant */}
      {plantData.length > 0 && (
        <div className={cn("mt-2 pt-2 border-t border-gray-100 grid gap-x-4 gap-y-1", fillHeight && "shrink-0",
          plantData.length > 2 ? "grid-cols-2" : "grid-cols-1"
        )}>
          {plantData.map((p) => {
            const { label, cls } = getStatus(p.value);
            return (
              <div key={p.plant} className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-[10px] font-semibold text-slate-700 shrink-0">{p.plant}</span>
                <span className="text-[10px] text-gray-400 tabular-nums shrink-0">{p.weeks}w</span>
                <span className="text-[10px] font-bold text-slate-700 tabular-nums shrink-0">
                  {p.value.toFixed(2)}<span className="font-normal text-gray-400 ml-0.5">{selectedKpi.unit}</span>
                </span>
                <span className={`text-[10px] font-semibold ml-auto shrink-0 ${cls}`}>{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
