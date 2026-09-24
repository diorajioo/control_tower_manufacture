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

function hexToRgba(hex: string, alpha: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

const KPI_TAB_LABELS: Record<string, string> = {
  leadtime: "chart_tab_leadtime",
  output:   "chart_tab_output",
};

const nivoTheme = {
  background: "transparent",
  axis: {
    ticks: {
      line: { strokeWidth: 0 },
      text: { fill: "#9ca3af", fontSize: 11, fontFamily: "inherit" },
    },
    domain: { line: { strokeWidth: 0 } },
  },
  grid: {
    line: { stroke: "#f3f4f6", strokeWidth: 1 },
  },
  crosshair: {
    line: { stroke: "#215AA8", strokeWidth: 1, strokeOpacity: 0.3 },
  },
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

  const lastValues = useMemo(() => {
    const out: Record<string, number | null> = {};
    nivoData.forEach((serie) => {
      const last = serie.data[serie.data.length - 1];
      out[String(serie.id)] = last != null ? last.y : null;
    });
    return out;
  }, [nivoData]);

  const ActivePointsLayer = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any) => {
      const x = activeXRef.current;
      if (!x || !props.xScale || !props.yScale) return null;
      return (
        <g>
          {nivoData.map((serie) => {
            const pt = serie.data.find((d) => d.x === x);
            if (!pt || pt.y == null) return null;
            return (
              <circle
                key={serie.id}
                cx={props.xScale(x)}
                cy={props.yScale(pt.y)}
                r={5}
                fill="white"
                stroke={serie.color}
                strokeWidth={2}
              />
            );
          })}
        </g>
      );
    },
    [nivoData]
  );

  const markers = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m: any[] = [];
    if (ucl > 0) m.push({
      axis: "y", value: ucl,
      lineStyle: { stroke: "#ef4444", strokeDasharray: "5 3", strokeWidth: 1.5 },
      legend: `UCL ${ucl.toFixed(1)}`,
      legendOffsetX: -8, legendOffsetY: -8,
      textStyle: { fill: "#ef4444", fontSize: 10, fontFamily: "inherit", fontWeight: 600 },
    });
    if (mean > 0) m.push({
      axis: "y", value: mean,
      lineStyle: { stroke: "#94a3b8", strokeDasharray: "4 2", strokeWidth: 1.5 },
      legend: `Mean ${mean.toFixed(1)}`,
      legendOffsetX: -8, legendOffsetY: -8,
      textStyle: { fill: "#94a3b8", fontSize: 10, fontFamily: "inherit" },
    });
    if (lcl > 0) m.push({
      axis: "y", value: lcl,
      lineStyle: { stroke: "#ef4444", strokeDasharray: "5 3", strokeWidth: 1.5 },
      legend: `LCL ${lcl.toFixed(1)}`,
      legendOffsetX: -8, legendOffsetY: 12,
      textStyle: { fill: "#ef4444", fontSize: 10, fontFamily: "inherit", fontWeight: 600 },
    });
    return m;
  }, [ucl, mean, lcl]);

  const ControlZoneLayer = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any) => {
      if (!props.yScale || ucl <= 0) return null;
      const y1  = props.yScale(ucl);
      const y2  = props.yScale(Math.max(lcl, 0));
      const top = Math.min(y1, y2);
      const h   = Math.max(Math.abs(y2 - y1), 0);
      return <rect x={0} y={top} width={props.innerWidth} height={h} fill="#E9EFF6" opacity={0.55} />;
    },
    [ucl, lcl]
  );

  const ActiveLineLayer = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any) => {
      if (!hoveredPlant || !props.xScale || !props.yScale) return null;
      const serie = nivoData.find((s) => s.id === hoveredPlant);
      if (!serie) return null;
      const points = serie.data.filter((d) => d.y != null);
      if (points.length < 2) return null;
      const pathD = points
        .map((d, i) => `${i === 0 ? "M" : "L"} ${props.xScale(d.x)} ${props.yScale(d.y)}`)
        .join(" ");
      return (
        <path
          d={pathD}
          fill="none"
          stroke={String(serie.color)}
          strokeWidth={3.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      );
    },
    [hoveredPlant, nivoData]
  );

  const isEmpty = nivoData.length === 0 || nivoData.every((s) => s.data.length === 0);

  return (
    <div className={cn("bg-white rounded-lg p-3 border border-[#EBEBEB] hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200", fillHeight && "h-full flex flex-col")}>
      {/* Header */}
      <div className={cn("flex items-center justify-between mb-2", fillHeight && "shrink-0")}>
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] font-bold text-slate-400 uppercase tracking-[0.08em] leading-none">
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

      {/* KPI tabs + plant legend */}
      {(!hideSelector || plants.length > 0) && (
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
          {plants.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 shrink-0 ml-auto">
              {plants.map((plant, i) => {
                const isHovered = hoveredPlant === plant;
                const isDimmed = hoveredPlant !== null && !isHovered;
                const lv = lastValues[plant];
                return (
                  <button
                    key={plant}
                    className="flex items-center gap-1.5 transition-opacity cursor-default"
                    style={{ opacity: isDimmed ? 0.35 : 1 }}
                    onMouseEnter={() => onPlantHover?.(plant)}
                    onMouseLeave={() => onPlantHover?.(null)}
                  >
                    <span
                      className="w-4 h-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: PLANT_COLORS[i % PLANT_COLORS.length] }}
                    />
                    <span className={`text-[11px] font-medium tracking-tight ${isHovered ? "text-gray-700" : "text-gray-400"}`}>{plant}</span>
                    {lv != null && (
                      <span className="text-[11px] text-gray-400 tabular-nums">{lv.toFixed(1)}</span>
                    )}
                  </button>
                );
              })}
              {hoveredPlant === null && onPlantHover && (
                <span className="text-[10px] text-gray-300 italic">hover to isolate</span>
              )}
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
            data={nivoData}
            theme={nivoTheme}
            margin={{ top: 4, right: 4, bottom: 28, left: 42 }}
            xScale={{ type: "point" }}
            yScale={{ type: "linear", min: "auto", max: "auto", stacked: false }}
            curve="linear"
            axisBottom={{
              format: (v) => formatTick(String(v)),
              tickSize: 0,
              tickPadding: 8,
              tickValues: axisTicks,
            }}
            axisLeft={{
              tickSize: 0,
              tickPadding: 6,
              tickValues: 5,
              format: (v) => Number(v).toFixed(1),
            }}
            gridYValues={5}
            enablePoints={false}
            useMesh={true}
            crosshairType="x"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onMouseMove={(point: any) => { activeXRef.current = String(point.data.x); }}
            onMouseLeave={() => { activeXRef.current = null; }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            colors={(serie: any) => {
              if (hoveredPlant && String(serie.id) !== hoveredPlant) {
                return hexToRgba(String(serie.color), 0.16);
              }
              return String(serie.color);
            }}
            lineWidth={2.5}
            markers={markers}
            layers={["grid", "axes", ControlZoneLayer, "lines", "crosshair", ActivePointsLayer, ActiveLineLayer, "mesh"]}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tooltip={({ point }: any) => {
              const x = String(point.data.x);
              const dateLabel = (() => {
                try {
                  const d = parseAnyDate(x);
                  return isNaN(d.getTime()) ? x : format(d, "dd MMM yyyy");
                } catch { return x; }
              })();
              const allAtX = nivoData.flatMap((serie) =>
                serie.data
                  .filter((d) => String(d.x) === x)
                  .map((d) => ({ plant: String(serie.id), y: d.y, color: serie.color }))
              );
              return (
                <div style={{
                  background: "#2A3D4A",
                  borderRadius: 10,
                  padding: "9px 13px",
                  fontSize: 12,
                  minWidth: 190,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
                  fontFamily: "inherit",
                  animation: "chart-tooltip-in 0.15s ease-out",
                }}>
                  <p style={{ fontWeight: 500, marginBottom: 7, color: "#64748b", fontSize: 11, letterSpacing: "0.02em" }}>
                    {dateLabel}
                  </p>
                  {allAtX.map(({ plant, y, color }) => {
                    const lim = perPlantLimits[plant];
                    return (
                      <div key={plant} style={{ marginBottom: 6 }}>
                        <p style={{ color: String(color), margin: 0, fontWeight: 700 }}>
                          {plant}
                          <span style={{ color: "#f1f5f9", fontWeight: 400, marginLeft: 6 }}>
                            {Number(y).toFixed(2)}
                          </span>
                          <span style={{ color: "#475569", fontWeight: 400, marginLeft: 3 }}>
                            {selectedKpi.unit}
                          </span>
                        </p>
                        {lim && (
                          <p style={{ color: "#475569", margin: "3px 0 0 0", fontSize: 11 }}>
                            Mean {lim.mean.toFixed(2)} · UCL{" "}
                            <span style={{ color: "#f87171" }}>{lim.ucl.toFixed(2)}</span> · LCL{" "}
                            <span style={{ color: "#f87171" }}>{lim.lcl.toFixed(2)}</span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
