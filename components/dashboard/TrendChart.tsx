"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { ResponsiveLine } from "@nivo/line";
import { LineDraw } from "@/components/charts/LineDraw";
import { format, parseISO, getISOWeek } from "date-fns";
import { PLANT_COLORS, TREND_KPI_OPTIONS } from "@/lib/chartConfig";
import { cn } from "@/lib/utils";
import {
  LINE_DEFAULTS, LineTooltip, LineLegend, rowsAtX, isolatedColor,
  makeActivePointsLayer, makeActiveLineLayer,
  monthLabel, GRAIN_OPTIONS, type TrendGrain,
  laneyPLimits, xmrLimits, makePChartLayer, outOfLimitColor, type PointStats,
} from "@/components/charts/StandardLine";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { ToggleSelect } from "@/components/ui/ToggleSelect";
import { LEAD_TIME_TARGET_DAYS } from "@/lib/leadTimeDefinition";

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

// 8,288,526 → "8.29M"; small values keep one decimal
function formatCompact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(1);
}

const KPI_TAB_LABELS: Record<string, string> = {
  leadtime: "chart_tab_leadtime",
  output:   "chart_tab_output",
};

export function TrendChart({ filters, kpiType, onKpiChange, chartHeight = 195, fillHeight = false, hideSelector = false, hoveredPlant = null, onPlantHover }: TrendChartProps) {
  const [data,    setData]    = useState<Record<string, unknown>[]>([]);
  const [plants,  setPlants]  = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [grain,   setGrain]   = useState<TrendGrain>("week");
  const [pointStats, setPointStats] = useState<PointStats | null>(null);
  // Lead Time sub-mode: "pct" = Laney P′ (% PO > target), "avg" = XmR on average days
  const [ltMode, setLtMode] = useState<"pct" | "avg">("pct");
  // Legend hover isolates a plant; parents that track hover (Monitor) pass it in, otherwise kept here
  const [localHover, setLocalHover] = useState<string | null>(null);
  const hovered = onPlantHover ? hoveredPlant : localHover;
  const setHovered = onPlantHover ?? setLocalHover;
  const activeXRef = useRef<string | null>(null);
  // Series under the cursor — the hover point is drawn on that line only
  const activeSerieRef = useRef<string | null>(null);
  const { t } = useI18n();

  const [chartOpacity, setChartOpacity] = useState(1);

  // displayedKpiType and displayedPView lag behind their sources by one fade
  // cycle so the chart only receives new data after fading to 0 — no flicker.
  const [displayedKpiType, setDisplayedKpiType] = useState(kpiType);
  useEffect(() => {
    setChartOpacity(0);
    const tid = setTimeout(() => { setDisplayedKpiType(kpiType); setChartOpacity(1); }, 180);
    return () => clearTimeout(tid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiType]);

  const selectedKpi = TREND_KPI_OPTIONS.find((o) => o.value === displayedKpiType) ?? TREND_KPI_OPTIONS[0];
  // When Lead Time is in "avg" mode, suppress pointStats so the existing XmR path reads KPI_VALUE (avg days) directly.
  const effectivePointStats = displayedKpiType === "leadtime" && ltMode === "avg" ? null : pointStats;
  // Control chart per metric: Laney P′ for count proportions (Lead Time = % PO above target, RFT = % activities
  // without ADJUST — limits move with the count n), XmR for the rest (Output, OEE, OPE, Yield Loss).
  const isPChart = (displayedKpiType === "leadtime" && ltMode === "pct") || displayedKpiType === "rft";
  const isPct = isPChart || (displayedKpiType !== "output" && displayedKpiType !== "productivity" && displayedKpiType !== "leadtime");
  const unitLabel = displayedKpiType === "leadtime"
    ? (ltMode === "pct" ? `% PO > ${LEAD_TIME_TARGET_DAYS} d` : "days")
    : displayedKpiType === "rft" ? "% RFT" : selectedKpi.unit;
  const countLabel = displayedKpiType === "leadtime" ? "POs" : "activities";
  // Overall = the "All plants" series from the API (default); By plant = one line per plant.
  // Yield Loss has no PLANT column in its source, so By plant is locked.
  const OVERALL = "All plants";
  const plantLocked = displayedKpiType === "bulkloss";
  const [pView, setPView] = useState<"overall" | "plant">("overall");
  const [displayedPView, setDisplayedPView] = useState<"overall" | "plant">("overall");
  const overall = displayedPView === "overall" || plantLocked;
  useEffect(() => {
    setChartOpacity(0);
    const tid = setTimeout(() => { setDisplayedPView(pView); setChartOpacity(1); }, 180);
    return () => clearTimeout(tid);
  }, [pView]);

  useEffect(() => {
    // Ignore responses from a previous metric/filter: a slow Lead Time query must not overwrite the newly picked tab
    let stale = false;
    setLoading(true);
    // OPE is derived from OEE × 0.8 — fetch OEE data and scale client-side
    const fetchType = kpiType === "ope" ? "oee" : kpiType;
    const params = new URLSearchParams({
      plant:     filters.plant,
      startDate: filters.startDate,
      endDate:   filters.endDate,
      kpiType:   fetchType,
      grain,
    });
    fetch(`/api/dashboard/trends?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (stale) return;
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
        const fetchedIsPChart = kpiType === "leadtime" || kpiType === "rft";
        setPointStats(fetchedIsPChart ? d.pointStats ?? null : null);
      })
      .catch(console.error)
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.plant, filters.startDate, filters.endDate, kpiType, grain]);

  // Replays the line draw-in when the shown data changes (every fetch: metric, grain, filters) or the view — not on hover
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const drawKey = useMemo(() => ({}), [data, displayedPView]);

  const parseAnyDate = (s: string): Date => {
    const iso = parseISO(s);
    if (!isNaN(iso.getTime())) return iso;
    return new Date(s);
  };

  // Monthly labels carry the year only when the range spans more than one year
  const multiYear = useMemo(() => new Set(data.map((d) => String(d.date).slice(0, 4))).size > 1, [data]);

  const formatTick = useCallback((s: string) => {
    if (grain === "month") return monthLabel(s, multiYear);
    try {
      const d = parseAnyDate(s);
      if (isNaN(d.getTime())) return s;
      return `W${getISOWeek(d)}`;
    } catch { return s; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grain, multiYear]);

  // Weekly: ticks at every even ISO week (W2, W4, W6…). Monthly: every month.
  const axisTicks = useMemo(() => {
    if (!data.length) return undefined;
    if (grain === "month") return data.map((d) => String(d.date));
    const evenWeeks = data.filter((d) => {
      try {
        return getISOWeek(parseAnyDate(String(d.date))) % 2 === 0;
      } catch { return false; }
    });
    // For very dense datasets thin further (every 4th even week)
    const step = evenWeeks.length > 26 ? 2 : 1;
    return evenWeeks.filter((_, i) => i % step === 0).map((d) => String(d.date));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, grain]);

  // One series per id: P′ metrics plot x/n from effectivePointStats, XmR metrics plot the API value.
  const buildSeries = useCallback((id: string, color: string) => ({
    id,
    color,
    data: effectivePointStats
      ? data
          .filter((pt) => effectivePointStats[pt.date as string]?.[id]?.n)
          .map((pt) => {
            const st = effectivePointStats[pt.date as string][id];
            return { x: pt.date as string, y: Number(((st.late / st.n) * 100).toFixed(1)) };
          })
      : data
          .filter((pt) => typeof pt[id] === "number" && !isNaN(pt[id] as number))
          .map((pt) => ({ x: pt.date as string, y: pt[id] as number })),
  }), [data, effectivePointStats]);

  const plantIds = useMemo(() => plants.filter((p) => p !== OVERALL), [plants]);
  const overallSeries = useMemo(() => (plants.includes(OVERALL) ? buildSeries(OVERALL, "#1E4076") : null), [plants, buildSeries]);
  const nivoData = useMemo(
    () => (overall
      ? (overallSeries ? [overallSeries] : [])
      : plantIds.map((p, i) => buildSeries(p, PLANT_COLORS[i % PLANT_COLORS.length]))),
    [overall, overallSeries, plantIds, buildSeries]
  );

  const limitsOfSeries = useCallback(
    (series: { id: string; color: string; data: { x: string; y: number | null }[] }[]) =>
      effectivePointStats ? laneyPLimits(series, effectivePointStats) : xmrLimits(series, { min: 0, max: isPct ? 100 : undefined }),
    [effectivePointStats, isPct]
  );
  const limits = useMemo(() => limitsOfSeries(nivoData), [nivoData, limitsOfSeries]);
  // One band of limits on the chart: All plants, or in By plant the hovered plant's own limits
  const overallLimits = useMemo(() => (overallSeries ? limitsOfSeries([overallSeries])[OVERALL] ?? null : null), [overallSeries, limitsOfSeries]);
  const band = useMemo(() => {
    if (!overall && hovered && limits[hovered]) return { lim: limits[hovered], prefix: hovered };
    return overallLimits ? { lim: overallLimits, prefix: overall ? undefined : OVERALL } : null;
  }, [overall, hovered, limits, overallLimits]);
  const fmtValue = useCallback((v: number) => (isPct ? `${v.toFixed(1)}%` : formatCompact(v)), [isPct]);
  const ControlLayer = useMemo(
    () => makePChartLayer(nivoData, limits, band, hovered, { center: effectivePointStats ? "p̄" : "Mean", fmt: fmtValue }),
    [nivoData, limits, band, hovered, effectivePointStats, fmtValue]
  );

  // Red only on hover: out-of-limit points (each series' own limits) turn red at the crosshair
  const ActivePointsLayer = useMemo(
    () => makeActivePointsLayer(nivoData, () => activeXRef.current, outOfLimitColor(limits), () => activeSerieRef.current),
    [nivoData, limits]
  );

  const ActiveLineLayer = useMemo(
    () => makeActiveLineLayer(nivoData, hovered),
    [nivoData, hovered]
  );

  const isEmpty = nivoData.length === 0 || nivoData.every((s) => s.data.length === 0);

  // Nivo's yScale auto-fits to series data only — it doesn't know about UCL/LCL drawn by the custom
  // ControlLayer. For monthly grain the limits can extend well outside the data range and get clipped.
  // Compute explicit bounds that cover both the data values and all limit values.
  const yScaleBounds = useMemo(() => {
    const dataVals = nivoData.flatMap((s) => s.data.filter((p) => p.y != null).map((p) => p.y as number));
    const limVals = Object.values(limits).flatMap((lim) => Object.values(lim).flatMap((l) => [l.ucl, l.lcl]));
    const all = [...dataVals, ...limVals];
    if (all.length === 0) return { min: "auto" as const, max: "auto" as const };
    const lo = Math.min(...all), hi = Math.max(...all);
    const pad = (hi - lo) * 0.08 || 1;
    return { min: Math.max(0, lo - pad), max: hi + pad };
  }, [nivoData, limits]);

  return (
    <div className={cn("bg-white rounded-lg p-3 border border-[#EBEBEB] hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200", fillHeight && "h-full flex flex-col")}>
      {/* Header */}
      <div className={cn("flex items-center justify-between mb-2", fillHeight && "shrink-0")}>
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] font-bold text-slate-500 uppercase tracking-[0.08em] leading-none">
            {t("chart_metric_trend")}
          </span>
          {loading && (
            <span className="w-3 h-3 border border-[#1E4076] border-t-transparent rounded-full animate-spin inline-block" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Metric + grain are dropdowns in the same row as the Overall / By plant toggle (user request 2026-10-14) */}
          {!hideSelector && (
            <ToggleSelect
              options={TREND_KPI_OPTIONS.map((o) => ({
                key: o.value,
                label: KPI_TAB_LABELS[o.value] ? t(KPI_TAB_LABELS[o.value] as Parameters<typeof t>[0]) : o.label,
                locked: o.locked,
              }))}
              value={kpiType}
              onChange={onKpiChange}
              ariaLabel="Trend metric"
            />
          )}
          <SegmentedToggle
            options={[{ key: "overall", label: "Overall" }, { key: "plant", label: "By plant", locked: plantLocked }]}
            value={overall ? "overall" : "plant"}
            onChange={(v) => { setPView(v); setHovered(null); }}
            ariaLabel="Trend view"
          />
          <ToggleSelect options={GRAIN_OPTIONS} value={grain} onChange={setGrain} ariaLabel="Trend granularity" align="right" />
          <span className="text-[11px] bg-[#EEF4FB] text-[#16305C] px-2.5 py-0.5 rounded-full font-semibold tracking-tight whitespace-nowrap">
            {unitLabel}
          </span>
        </div>
      </div>

      {/* Chart */}
      {/* While new data loads (e.g. Weekly ↔ Monthly) the current chart stays, dimmed; the new lines then draw in */}
      <div className={fillHeight ? "flex-1 min-h-0" : ""} style={{ ...(fillHeight ? undefined : { height: chartHeight }), opacity: loading && data.length > 0 ? Math.min(chartOpacity, 0.45) : chartOpacity, transition: "opacity 0.18s ease" }}>
        {isEmpty ? (
          <div className="h-full flex items-center justify-center text-[11px] text-gray-300">No data available</div>
        ) : (
          <LineDraw drawKey={drawKey}>
            <ResponsiveLine
              {...LINE_DEFAULTS}
              data={nivoData}
              yScale={{ ...LINE_DEFAULTS.yScale, ...yScaleBounds }}
              axisLeft={isPct ? LINE_DEFAULTS.axisLeft : { ...LINE_DEFAULTS.axisLeft, format: (v: string | number | Date) => formatCompact(Number(v)) }}
              axisBottom={{
                format: (v) => formatTick(String(v)),
                tickSize: 0,
                tickPadding: 8,
                tickValues: axisTicks,
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onMouseMove={(point: any) => { activeXRef.current = String(point.data.x); activeSerieRef.current = point.seriesId != null ? String(point.seriesId) : null; }}
              onMouseLeave={() => { activeXRef.current = null; activeSerieRef.current = null; }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              colors={(serie: any) => isolatedColor(String(serie.color), String(serie.id), hovered)}
              layers={["grid", "axes", "lines", ControlLayer, "crosshair", ActivePointsLayer, ActiveLineLayer, "mesh"]}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              tooltip={({ point }: any) => {
                const x = String(point.data.x);
                const dateLabel = (() => {
                  try {
                    const d = parseAnyDate(x);
                    if (isNaN(d.getTime())) return x;
                    return grain === "month" ? format(d, "MMMM yyyy") : `Week of ${format(d, "dd MMM yyyy")}`;
                  } catch { return x; }
                })();
                const rows = rowsAtX(nivoData, x, isPct ? "%" : selectedKpi.unit).map((r) => {
                  const lim = limits[r.label]?.[x];
                  if (!lim) return r;
                  const st = effectivePointStats?.[x]?.[r.label];
                  return { ...r, sub: <>{effectivePointStats ? "p̄" : "Mean"} {fmtValue(lim.mean)} · UCL <span style={{ color: "#f5a39a" }}>{fmtValue(lim.ucl)}</span> · LCL <span style={{ color: "#f5a39a" }}>{fmtValue(lim.lcl)}</span>{st ? ` · ${st.late.toLocaleString("en-US")}/${st.n.toLocaleString("en-US")} ${countLabel}` : ""}</> };
                });
                return <LineTooltip title={dateLabel} rows={rows} />;
              }}
            />
          </LineDraw>
        )}
      </div>

      {/* Legend — below the plot (standard) */}
      {nivoData.length > 0 && (
        <div className={cn("mt-1.5", fillHeight && "shrink-0")}>
          <LineLegend series={nivoData} hovered={hovered} onHover={setHovered} />
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="text-[9.5px] text-slate-400 whitespace-nowrap">
              {effectivePointStats
                ? `P′ chart · limits move with the ${kpiType === "leadtime" ? "PO" : "activity"} count of each ${grain === "month" ? "month" : "week"}`
                : "XmR chart · limits from week-to-week variation"}
              {` · red dot = outside ${overall ? "limits" : "its plant's limits"}`}
              {!overall && plantIds.length > 1 ? " · hover a plant to see its limits" : ""}
              {plantLocked ? " · no plant column in the source, By plant unavailable" : ""}
            </div>
            {displayedKpiType === "leadtime" && (
              <div className="flex shrink-0 items-center gap-0.5 bg-[#f2f3f6] rounded-[5px] p-0.5">
                {(["pct", "avg"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setLtMode(m)}
                    className="text-[9.5px] font-semibold px-2 py-0.5 rounded-[4px] transition-colors duration-150"
                    style={{
                      background: ltMode === m ? "white" : "transparent",
                      color: ltMode === m ? "#101828" : "#667085",
                      boxShadow: ltMode === m ? "0 1px 2px rgba(16,24,40,.08)" : "none",
                      fontFamily: "Lato, sans-serif",
                    }}
                  >
                    {m === "pct" ? "% Late" : "Avg days"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
