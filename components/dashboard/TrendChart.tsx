"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { ResponsiveLine } from "@nivo/line";
import { format, parseISO, getISOWeek } from "date-fns";
import {
  PLANT_COLORS,
  KPI_OPTIONS,
  computeControlLimits,
  computePerPlantLimits,
} from "@/lib/chartConfig";
import { cn } from "@/lib/utils";
import {
  LINE_DEFAULTS, LineTooltip, LineLegend, rowsAtX, isolatedColor,
  makeActivePointsLayer, makeActiveLineLayer, controlMarkers, LimitsSub,
} from "@/components/charts/StandardLine";

interface Filters {
  plant: string;
  startDate: string;
  endDate: string;
}

interface TrendChartProps {
  filters: Filters;
  kpiType: string;
  onKpiChange: (kpi: string) => void;
  chartHeight?: number;
  fillHeight?: boolean;
  hideSelector?: boolean;
  hoveredPlant?: string | null;
  onPlantHover?: (plant: string | null) => void;
}

const KPI_TAB_LABELS: Record<string, string> = {
  leadtime: "chart_tab_leadtime",
  output:   "chart_tab_output",
};

export function TrendChart({ filters, kpiType, onKpiChange, chartHeight = 195, fillHeight = false, hideSelector = false, hoveredPlant = null, onPlantHover }: TrendChartProps) {
  const [data,    setData]    = useState<Record<string, unknown>[]>([]);
  const [plants,  setPlants]  = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const activeXRef = useRef<string | null>(null);
  const { t } = useI18n();

  const selectedKpi = KPI_OPTIONS.find((o) => o.value === kpiType)!;

  useEffect(() => {
    setLoading(true);
    // OPE is derived from OEE × 0.8 — fetch OEE data and scale client-side
    const fetchType = kpiType === "ope" ? "oee" : kpiType;
    const params = new URLSearchParams({
      plant:     filters.plant,
      startDate: filters.startDate,
      endDate:   filters.endDate,
      kpiType:   fetchType,
    });
    fetch(`/api/dashboard/trends?${params}`)
      .then((r) => r.json())
      .then((d) => {
        const series: Record<string, unknown>[] = d.trendSeries ?? [];
        if (kpiType === "ope") {
          const plants: string[] = d.plants ?? [];
          setData(series.map((pt) => {
            const scaled: Record<string, unknown> = { date: pt.date };
            for (const p of plants) {
              const v = pt[p];
              scaled[p] = typeof v === "number" ? Number((v * 0.8).toFixed(2)) : v;
            }
            return scaled;
          }));
        } else {
          setData(series);
        }
        setPlants(d.plants ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters.plant, filters.startDate, filters.endDate, kpiType]);

  const { mean, ucl, lcl } = useMemo(
    () => computeControlLimits(data, plants),
    [data, plants]
  );

  const perPlantLimits = useMemo(
    () => computePerPlantLimits(data, plants),
    [data, plants]
  );

  const parseAnyDate = (s: string): Date => {
    const iso = parseISO(s);
    if (!isNaN(iso.getTime())) return iso;
    return new Date(s);
  };

  const formatTick = useCallback((s: string) => {
    try {
      const d = parseAnyDate(s);
      if (isNaN(d.getTime())) return s;
      return `W${getISOWeek(d)}`;
    } catch { return s; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show ticks at every even ISO week (W2, W4, W6…)
  const axisTicks = useMemo(() => {
    if (!data.length) return undefined;
    const evenWeeks = data.filter((d) => {
      try {
        return getISOWeek(parseAnyDate(String(d.date))) % 2 === 0;
      } catch { return false; }
    });
    // For very dense datasets thin further (every 4th even week)
    const step = evenWeeks.length > 26 ? 2 : 1;
    return evenWeeks.filter((_, i) => i % step === 0).map((d) => String(d.date));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const nivoData = useMemo(
    () =>
      plants.map((plant, i) => ({
        id: plant,
        color: PLANT_COLORS[i % PLANT_COLORS.length],
        data: data
          .filter((pt) => typeof pt[plant] === "number" && !isNaN(pt[plant] as number))
          .map((pt) => ({ x: pt.date as string, y: pt[plant] as number })),
      })),
    [data, plants]
  );

  const ActivePointsLayer = useMemo(
    () => makeActivePointsLayer(nivoData, () => activeXRef.current),
    [nivoData]
  );

  const markers = useMemo(() => controlMarkers({ mean, ucl, lcl }), [ucl, mean, lcl]);

  const ActiveLineLayer = useMemo(
    () => makeActiveLineLayer(nivoData, hoveredPlant),
    [nivoData, hoveredPlant]
  );

  const isEmpty = nivoData.length === 0 || nivoData.every((s) => s.data.length === 0);

  return (
    <div className={cn("bg-white rounded-lg p-3 border border-[#EBEBEB] hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200", fillHeight && "h-full flex flex-col")}>
      {/* Header */}
      <div className={cn("flex items-center justify-between mb-2", fillHeight && "shrink-0")}>
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] font-bold text-slate-500 uppercase tracking-[0.08em] leading-none">
            {t("chart_metric_trend")}
          </span>
          {loading && (
            <span className="w-3 h-3 border border-[#215AA8] border-t-transparent rounded-full animate-spin inline-block" />
          )}
        </div>
        <span className="text-[11px] bg-[#D3DEEE] text-[#143665] px-2.5 py-0.5 rounded-full font-semibold tracking-tight">
          {selectedKpi.label} · {selectedKpi.unit}
        </span>
      </div>

      {/* KPI tabs (legend sits below the plot) */}
      {!hideSelector && (
        <div className={cn("flex items-center justify-between gap-2 mb-2", fillHeight && "shrink-0")}>
          {!hideSelector && (
            <div className="flex flex-wrap gap-1">
              {KPI_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onKpiChange(opt.value)}
                  className={`text-[11px] px-2.5 py-1 rounded-full font-semibold transition-colors ${
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
        </div>
      )}

      {/* Chart */}
      <div className={fillHeight ? "flex-1 min-h-0" : ""} style={fillHeight ? undefined : { height: chartHeight }}>
        {isEmpty ? (
          <div className="h-full flex items-center justify-center text-[11px] text-gray-300">No data available</div>
        ) : (
          <ResponsiveLine
            {...LINE_DEFAULTS}
            data={nivoData}
            axisBottom={{
              format: (v) => formatTick(String(v)),
              tickSize: 0,
              tickPadding: 8,
              tickValues: axisTicks,
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onMouseMove={(point: any) => { activeXRef.current = String(point.data.x); }}
            onMouseLeave={() => { activeXRef.current = null; }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            colors={(serie: any) => isolatedColor(String(serie.color), String(serie.id), hoveredPlant)}
            markers={markers}
            layers={["grid", "markers", "axes", "lines", "crosshair", ActivePointsLayer, ActiveLineLayer, "mesh"]}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tooltip={({ point }: any) => {
              const x = String(point.data.x);
              const dateLabel = (() => {
                try {
                  const d = parseAnyDate(x);
                  return isNaN(d.getTime()) ? x : format(d, "dd MMM yyyy");
                } catch { return x; }
              })();
              const rows = rowsAtX(nivoData, x, selectedKpi.unit).map((r) => {
                const lim = perPlantLimits[r.label];
                return lim ? { ...r, sub: <LimitsSub lim={lim} /> } : r;
              });
              return <LineTooltip title={dateLabel} rows={rows} />;
            }}
          />
        )}
      </div>

      {/* Legend — below the plot (standard) */}
      {plants.length > 0 && (
        <div className={cn("mt-1.5", fillHeight && "shrink-0")}>
          <LineLegend series={nivoData} hovered={hoveredPlant} onHover={onPlantHover} />
        </div>
      )}
    </div>
  );
}
