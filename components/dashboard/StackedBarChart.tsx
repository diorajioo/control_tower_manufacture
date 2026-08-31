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

interface Filters {
  plant: string;
  startDate: string;
  endDate: string;
}

interface StackedBarChartProps {
  filters: Filters;
  kpiType: string;
  onKpiChange: (kpi: string) => void;
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

export function StackedBarChart({ filters, kpiType, onKpiChange }: StackedBarChartProps) {
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

  // Aggregate per plant: use per-plant mean as the bar value
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
    if (val > ucl)         return { label: `Above UCL`, cls: "text-red-500"    };
    if (lcl > 0 && val < lcl) return { label: `Below LCL`, cls: "text-amber-500" };
    return                     { label: t("chart_in_control"), cls: "text-emerald-600" };
  };

  // Markers for reference lines
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
    <div className="bg-white rounded-2xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] border border-gray-100/80">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-[13px] font-bold text-slate-800 tracking-tight">{t("chart_kpi_by_plant")}</h3>
          <p className="text-[10px] text-gray-400 mt-0.5 tracking-tight">{t("chart_subtitle_plant")}</p>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin inline-block" />
          )}
          <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full font-semibold tracking-tight">
            {selectedKpi.label}
          </span>
        </div>
      </div>

      {/* KPI tabs */}
      <div className="flex flex-wrap gap-1 mb-3">
        {KPI_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onKpiChange(opt.value)}
            className={`text-[10px] px-2.5 py-1 rounded-full font-semibold transition-colors ${
              kpiType === opt.value
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
            }`}
          >
            {KPI_TAB_LABELS[opt.value] ? t(KPI_TAB_LABELS[opt.value] as Parameters<typeof t>[0]) : opt.label}
          </button>
        ))}
      </div>

      {/* Bar chart */}
      <div style={{ height: 148 }}>
        {plantData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[11px] text-gray-300">No data available</div>
        ) : (
          <ResponsiveBar
            data={plantData}
            keys={["value"]}
            indexBy="plant"
            theme={nivoTheme}
            margin={{ top: 10, right: 20, bottom: 28, left: 40 }}
            padding={0.38}
            borderRadius={5}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            colors={(bar: any) => String(bar.data.color)}
            colorBy="indexValue"
            axisBottom={{
              tickSize: 0,
              tickPadding: 10,
            }}
            axisLeft={{
              tickSize: 0,
              tickPadding: 8,
              tickValues: 4,
              format: (v) => Number(v).toFixed(1),
            }}
            enableGridX={false}
            enableLabel={false}
            markers={markers}
            tooltip={({ indexValue, value, color }) => (
              <div style={{
                background: "#1e293b",
                borderRadius: 10,
                padding: "9px 13px",
                fontSize: 11,
                minWidth: 170,
                boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
                fontFamily: "inherit",
                animation: "chart-tooltip-in 0.15s ease-out",
              }}>
                <p style={{ fontWeight: 700, marginBottom: 6, color: String(color) }}>{String(indexValue)}</p>
                {(() => {
                  const p = plantData.find((d) => d.plant === indexValue);
                  if (!p) return null;
                  return (
                    <>
                      <p style={{ color: "#f1f5f9", margin: "2px 0", fontWeight: 600 }}>
                        Avg: {Number(value).toFixed(2)}{" "}
                        <span style={{ color: "#475569", fontWeight: 400 }}>{selectedKpi.unit}</span>
                        <span style={{ color: "#475569", fontWeight: 400, marginLeft: 6 }}>· {p.weeks}w</span>
                      </p>
                      <div style={{ height: 1, background: "#334155", margin: "7px 0" }} />
                      <p style={{ color: "#64748b", margin: "2px 0", fontSize: 10 }}>
                        σ {p.plantStdev.toFixed(2)} · UCL{" "}
                        <span style={{ color: "#f87171" }}>{p.plantUcl.toFixed(2)}</span> · LCL{" "}
                        <span style={{ color: "#f87171" }}>{p.plantLcl.toFixed(2)}</span>
                      </p>
                    </>
                  );
                })()}
              </div>
            )}
          />
        )}
      </div>

      {/* Plant status list */}
      {plantData.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
          {plantData.map((p) => {
            const { label, cls } = getStatus(p.value);
            return (
              <div key={p.plant} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-slate-700 font-semibold tracking-tight">{p.plant}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-gray-400 tabular-nums">{p.weeks}w</span>
                  <span className="font-bold text-slate-700 tabular-nums">
                    {p.value.toFixed(2)}&thinsp;
                    <span className="font-normal text-gray-400">{selectedKpi.unit}</span>
                  </span>
                  <span className={`font-semibold w-20 text-right ${cls}`}>{label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
