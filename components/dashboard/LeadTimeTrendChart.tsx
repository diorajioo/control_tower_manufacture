"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ResponsiveLine } from "@nivo/line";
import { SERIES_OVERFLOW_COLOR, SERIES_TOTAL_COLOR } from "@/lib/chartConfig";
import {
  LINE_DEFAULTS, LineChartCard, LineLegend, LineTooltip,
  evenWeekTicks, isolatedColor, rowsAtX, seriesColor, monthLabel, GRAIN_OPTIONS,
  makeActivePointsLayer, makeActiveLineLayer, type StandardSeries, type TrendGrain,
} from "@/components/charts/StandardLine";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import type { LeadTimeChartData } from "@/components/dashboard/LeadTimeCharts";
import { stageLabel } from "@/lib/leadTimeStages";

// ─────────────────────────────────────────────────────────────────────────────
// Lead Time Trend (/lead-time, Strategic) — built on the Standard Line Chart
// (components/charts/StandardLine.tsx · docs/UI_UX.md → Standard Line Chart).
// Series: Total (gross lead time) + one line per CT_MANUF_LEADTIME.POSITION, weekly or monthly.
// Weekly comes with the page's /api/lead-time/charts bundle; Monthly is fetched from /api/lead-time/trend.
// No SPC control zone / UCL · LCL (Overview only).
// ─────────────────────────────────────────────────────────────────────────────

// Color follows the POSITION in process-flow order → standard SERIES_COLORS slot.
// The 9th position (CUCI KEMAS, smallest) folds to the overflow gray.
const POSITION_ORDER = ["PO", "TIMBANG", "OLAH", "CUCI OLAH", "KEMAS 1", "KEMAS 2", "WIP", "RECEIVE NDC", "CUCI KEMAS"];

function positionColor(position: string) {
  const i = POSITION_ORDER.indexOf(position);
  return i === -1 ? SERIES_OVERFLOW_COLOR : seriesColor(i);
}

/** ISO week label, e.g. "W23" */
function isoWeekLabel(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `W${Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)}`;
}

type Trend = LeadTimeChartData["trend"];

export function LeadTimeTrendChart({ data, loading, filters }: {
  data: LeadTimeChartData | null;
  loading: boolean;
  /** Page filters (plant, startDate, endDate, period); enables the Weekly / Monthly toggle */
  filters?: Record<string, string>;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const activeXRef = useRef<string | null>(null);
  const [grain, setGrain] = useState<TrendGrain>("week");
  // Monthly data cached per filter set, so switching back and forth does not re-fetch
  const [monthly, setMonthly] = useState<{ key: string; trend: Trend } | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const filterKey = filters ? new URLSearchParams(filters).toString() : "";
  const monthlyReady = monthly?.key === filterKey ? monthly.trend : null;

  useEffect(() => {
    if (grain !== "month" || !filters || monthlyReady) return;
    let cancelled = false;
    setMonthlyLoading(true);
    fetch(`/api/lead-time/trend?${new URLSearchParams({ ...filters, grain: "month" })}`)
      .then((r) => r.json())
      .then((res) => { if (!cancelled && res?.total) setMonthly({ key: filterKey, trend: res }); })
      .catch(() => { /* keeps the previous lines */ })
      .finally(() => { if (!cancelled) setMonthlyLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grain, filterKey, monthlyReady]);

  // While monthly data loads, keep drawing the weekly lines so Nivo animates into the new shape
  // (same as Monthly → Weekly) instead of unmounting the chart.
  const showMonthly = grain === "month" && monthlyReady !== null;
  const trend: Trend | null = showMonthly ? monthlyReady : data?.trend ?? null;
  const isLoading = grain === "month" ? monthlyLoading : loading;

  const series = useMemo((): StandardSeries[] => {
    if (!trend) return [];
    const years = new Set(trend.total.map((r) => r.week.slice(0, 4)));
    const xLabel = (d: string) => (showMonthly ? monthLabel(d, years.size > 1) : isoWeekLabel(d));
    const byPos = new Map<string, { x: string; y: number }[]>();
    for (const r of trend.positions) {
      if (!byPos.has(r.position)) byPos.set(r.position, []);
      byPos.get(r.position)!.push({ x: xLabel(r.week), y: r.days });
    }
    const positions = Array.from(byPos.keys()).sort((a, b) => {
      const ia = POSITION_ORDER.indexOf(a), ib = POSITION_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return [
      { id: "Total", color: SERIES_TOTAL_COLOR, data: trend.total.map((r) => ({ x: xLabel(r.week), y: r.days })) },
      // id = English display name (legend/tooltip); color still keyed on the POSITION code
      ...positions.map((p) => ({ id: stageLabel(p), color: positionColor(p), data: byPos.get(p)! })),
    ];
  }, [trend, showMonthly]);

  const ActivePointsLayer = useMemo(() => makeActivePointsLayer(series, () => activeXRef.current), [series]);
  const ActiveLineLayer   = useMemo(() => makeActiveLineLayer(series, hovered), [series, hovered]);

  const xs      = series[0]?.data.map((d) => d.x) ?? [];
  const isEmpty = series.length === 0 || series.every((s) => s.data.length === 0);

  return (
    <LineChartCard
      label="Lead Time Trend"
      unitBadge="Total & per position · days"
      loading={isLoading}
      actions={filters && (
        <SegmentedToggle options={GRAIN_OPTIONS} value={grain} onChange={setGrain} ariaLabel="Trend granularity" />
      )}
      legend={!isEmpty && <LineLegend series={series} hovered={hovered} onHover={setHovered} />}
      height={300}
      empty={isEmpty}
      emptyText="No data for the selected filters"
    >
      <ResponsiveLine
        {...LINE_DEFAULTS}
        data={series}
        axisBottom={{ tickSize: 0, tickPadding: 8, tickValues: showMonthly ? xs : evenWeekTicks(xs) }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onMouseMove={(point: any) => { activeXRef.current = String(point.data.x); }}
        onMouseLeave={() => { activeXRef.current = null; }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        colors={(serie: any) => isolatedColor(String(serie.color), String(serie.id), hovered)}
        layers={["grid", "markers", "axes", "lines", "crosshair", ActivePointsLayer, ActiveLineLayer, "mesh"]}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tooltip={({ point }: any) => {
          const x = String(point.data.x);
          const rows = rowsAtX(series, x, "days").sort((a, b) => Number(b.value) - Number(a.value));
          return <LineTooltip title={`${x} · average per PO`} rows={rows} />;
        }}
      />
    </LineChartCard>
  );
}
