"use client";

import { useMemo, useRef, useState } from "react";
import { ResponsiveLine } from "@nivo/line";
import { SERIES_OVERFLOW_COLOR, SERIES_TOTAL_COLOR } from "@/lib/chartConfig";
import {
  LINE_DEFAULTS, LineChartCard, LineLegend, LineTooltip,
  evenWeekTicks, isolatedColor, rowsAtX, seriesColor,
  makeActivePointsLayer, makeActiveLineLayer, type StandardSeries,
} from "@/components/charts/StandardLine";
import type { LeadTimeChartData } from "@/components/dashboard/LeadTimeCharts";
import { stageLabel } from "@/lib/leadTimeStages";

// ─────────────────────────────────────────────────────────────────────────────
// Lead Time Trend (/lead-time, Strategic) — built on the Standard Line Chart
// (components/charts/StandardLine.tsx · docs/UI_UX.md → Standard Line Chart).
// Series: Total (gross lead time) + one line per CT_MANUF_LEADTIME.POSITION, weekly.
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

export function LeadTimeTrendChart({ data, loading }: { data: LeadTimeChartData | null; loading: boolean }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const activeXRef = useRef<string | null>(null);

  const series = useMemo((): StandardSeries[] => {
    if (!data) return [];
    const byPos = new Map<string, { x: string; y: number }[]>();
    for (const r of data.trend.positions) {
      if (!byPos.has(r.position)) byPos.set(r.position, []);
      byPos.get(r.position)!.push({ x: isoWeekLabel(r.week), y: r.days });
    }
    const positions = Array.from(byPos.keys()).sort((a, b) => {
      const ia = POSITION_ORDER.indexOf(a), ib = POSITION_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return [
      { id: "Total", color: SERIES_TOTAL_COLOR, data: data.trend.total.map((r) => ({ x: isoWeekLabel(r.week), y: r.days })) },
      // id = English display name (legend/tooltip); color still keyed on the POSITION code
      ...positions.map((p) => ({ id: stageLabel(p), color: positionColor(p), data: byPos.get(p)! })),
    ];
  }, [data]);

  const ActivePointsLayer = useMemo(() => makeActivePointsLayer(series, () => activeXRef.current), [series]);
  const ActiveLineLayer   = useMemo(() => makeActiveLineLayer(series, hovered), [series, hovered]);

  const weeks   = series[0]?.data.map((d) => d.x) ?? [];
  const isEmpty = series.length === 0 || series.every((s) => s.data.length === 0);

  return (
    <LineChartCard
      label="Lead Time Trend"
      unitBadge="Total & per position · days"
      loading={loading}
      legend={!isEmpty && <LineLegend series={series} hovered={hovered} onHover={setHovered} />}
      height={300}
      empty={isEmpty}
      emptyText="No data for the selected filters"
    >
      <ResponsiveLine
        {...LINE_DEFAULTS}
        data={series}
        axisBottom={{ tickSize: 0, tickPadding: 8, tickValues: evenWeekTicks(weeks) }}
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
