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

interface Filters {
  plant: string;
  startDate: string;
  endDate: string;
}

interface TrendChartProps {
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
  crosshair: {
    line: { stroke: "#6366f1", strokeWidth: 1, strokeOpacity: 0.3 },
  },
};

export function TrendChart({ filters, kpiType, onKpiChange }: TrendChartProps) {
  const [data,    setData]    = useState<Record<string, unknown>[]>([]);
  const [plants,  setPlants]  = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  // useRef instead of useState — avoids re-render chain that causes twitching
  const activeXRef = useRef<string | null>(null);
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
        setData(d.trendSeries ?? []);
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

  // Show every Nth tick so x-axis stays readable at any data density
  const axisTicks = useMemo(() => {
    if (!data.length) return undefined;
    const step = data.length > 24 ? 4 : data.length > 12 ? 2 : 1;
    return data.filter((_, i) => i % step === 0).map((d) => String(d.date));
  }, [data]);

  // Transform flat data to Nivo Line series format — must be before ActivePointsLayer
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

  // Custom layer: render dots only at hovered x — reads ref (no extra re-render)
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
    [nivoData] // activeXRef is a stable object — not needed in deps
  );


  // Reference lines for UCL / Mean / LCL
  const markers = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m: any[] = [];
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

  // Custom SVG layer that fills the control zone between LCL and UCL
  const ControlZoneLayer = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any) => {
      if (!props.yScale || ucl <= 0) return null;
      const y1  = props.yScale(ucl);
      const y2  = props.yScale(Math.max(lcl, 0));
      const top = Math.min(y1, y2);
      const h   = Math.max(Math.abs(y2 - y1), 0);
      return <rect x={0} y={top} width={props.innerWidth} height={h} fill="#eef2ff" opacity={0.55} />;
    },
    [ucl, lcl]
  );

  const isEmpty = nivoData.length === 0 || nivoData.every((s) => s.data.length === 0);

  return (
    <div className="bg-white rounded-2xl pt-4 px-4 pb-2 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] border border-gray-100/80">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-bold text-slate-800 tracking-tight">{t("chart_metric_trend")}</h3>
          {loading && (
            <span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin inline-block" />
          )}
        </div>
        <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full font-semibold tracking-tight">
          {selectedKpi.label} · {selectedKpi.unit}
        </span>
      </div>

      {/* KPI tabs + plant legend */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap gap-1">
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
        {plants.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 shrink-0">
            {plants.map((plant, i) => (
              <div key={plant} className="flex items-center gap-1.5">
                <span
                  className="w-4 h-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: PLANT_COLORS[i % PLANT_COLORS.length] }}
                />
                <span className="text-[10px] font-medium text-gray-400 tracking-tight">{plant}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chart */}
      <div style={{ height: 210 }}>
        {isEmpty ? (
          <div className="h-full flex items-center justify-center text-[11px] text-gray-300">No data available</div>
        ) : (
          <ResponsiveLine
            data={nivoData}
            theme={nivoTheme}
            margin={{ top: 8, right: 20, bottom: 28, left: 40 }}
            xScale={{ type: "point" }}
            yScale={{ type: "linear", min: "auto", max: "auto", stacked: false }}
            curve="linear"
            axisBottom={{
              format: (v) => formatTick(String(v)),
              tickSize: 0,
              tickPadding: 10,
              tickValues: axisTicks,
            }}
            axisLeft={{
              tickSize: 0,
              tickPadding: 8,
              tickValues: 5,
              format: (v) => Number(v).toFixed(1),
            }}
            gridYValues={5}
            enablePoints={false}
            useMesh={true}
            crosshairType="x"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onMouseMove={(point: any) => { activeXRef.current = String(point.data.x); }}
            onMouseLeave={() => { activeXRef.current = null; }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            colors={(serie: any) => String(serie.color)}
            lineWidth={2.5}
            markers={markers}
            layers={["grid", "axes", ControlZoneLayer, "lines", "crosshair", ActivePointsLayer, "mesh"]}
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
                  background: "#1e293b",
                  borderRadius: 10,
                  padding: "9px 13px",
                  fontSize: 11,
                  minWidth: 190,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
                  fontFamily: "inherit",
                }}>
                  <p style={{ fontWeight: 500, marginBottom: 7, color: "#64748b", fontSize: 10, letterSpacing: "0.02em" }}>
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
                          <p style={{ color: "#475569", margin: "3px 0 0 0", fontSize: 10 }}>
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
