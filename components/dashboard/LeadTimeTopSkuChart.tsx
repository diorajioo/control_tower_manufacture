"use client";

import { useMemo, useState } from "react";
import { ResponsiveBar, type BarCustomLayerProps, type BarDatum } from "@nivo/bar";
import { ChartCard, EmptyState, type LeadTimeChartData } from "@/components/dashboard/LeadTimeCharts";
import { LINE_THEME, LineTooltip } from "@/components/charts/StandardLine";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";

// ─────────────────────────────────────────────────────────────────────────────
// Top 10 SKU by lead time (/lead-time, Strategic) — below "Lead time per stage".
// Composition: horizontal bars = average gross lead time, split by the SKU's VA / NNVA / UNVA share
//   (category sums overlap because activities run in parallel, so the split is proportional).
// Range: P10–P90 of gross lead time per PO with an average marker.
// Data: /api/lead-time/charts → topSkus (SKUs with ≥5 POs in the period).
// ─────────────────────────────────────────────────────────────────────────────

type Category = "VA" | "NNVA" | "UNVA";
type ViewMode = "composition" | "range";

// Same entity colors as the stage chart and the VA / NNVA / Waste cards
const CATEGORY_COLORS: Record<Category, string> = { VA: "#067647", NNVA: "#d97706", UNVA: "#d92d20" };
const CATEGORY_LABELS: Record<Category, string> = { VA: "Value-added", NNVA: "Necessary non-VA", UNVA: "Waste" };
const RANGE_COLOR = "#b9c0cc";
const MEAN_COLOR = "#143665";
const KEYS: Category[] = ["VA", "NNVA", "UNVA"];

interface SkuRow extends BarDatum {
  label: string;
  name: string;
  code: string;
  poCount: number;
  avg: number;
  p10: number;
  p90: number;
  VA: number;
  NNVA: number;
  UNVA: number;
  vaPct: number;
  nnvaPct: number;
  unvaPct: number;
  /** Invisible bar for the Range view (hover target up to P90) */
  span: number;
}

const fmt = (n: number) => n.toFixed(1);
const short = (s: string, n = 30) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export function LeadTimeTopSkuChart({ data, loading }: { data: LeadTimeChartData | null; loading: boolean }) {
  const [view, setView] = useState<ViewMode>("composition");
  // Composition: click a VA / NNVA / UNVA segment to sort by that category; click it again to reset
  const [sortBy, setSortBy] = useState<Category | null>(null);

  const rows = useMemo((): SkuRow[] => {
    const src = data?.topSkus ?? [];
    return src.map((s) => {
      const parts = s.va + s.nnva + s.unva;
      const share = (v: number) => (parts > 0 ? v / parts : 0);
      const name = titleCase(s.name);
      return {
        label: short(name), name, code: s.code, poCount: s.poCount,
        avg: s.avg, p10: s.p10, p90: s.p90,
        VA: s.avg * share(s.va), NNVA: s.avg * share(s.nnva), UNVA: s.avg * share(s.unva),
        vaPct: share(s.va) * 100, nnvaPct: share(s.nnva) * 100, unvaPct: share(s.unva) * 100,
        span: s.p90,
      };
    })
      .sort((a, b) => (sortBy && view === "composition" ? b[sortBy] - a[sortBy] : b.avg - a.avg))
      // Nivo draws horizontal bars bottom-up — reverse so the highest value is on top
      .reverse();
  }, [data, sortBy, view]);

  const top = [...rows].sort((a, b) => b.avg - a.avg)[0];
  const insight = useMemo(() => {
    if (!top) return "";
    if (view === "composition") {
      return `${top.name} has the longest lead time at ${fmt(top.avg)} days per PO, of which ${Math.round(top.unvaPct)}% is waste.`;
    }
    const bySpread = [...rows].sort((a, b) => (a.p90 - a.p10) - (b.p90 - b.p10));
    const tight = bySpread[0], wide = bySpread[bySpread.length - 1];
    if (tight === wide) return "";
    return `Similar averages can hide different consistency. ${tight.name} ranges ${fmt(tight.p10)} to ${fmt(tight.p90)} days, while ${wide.name} ranges ${fmt(wide.p10)} to ${fmt(wide.p90)} days (P10–P90).`;
  }, [rows, top, view]);

  // Range view: P10–P90 whisker + average marker, drawn over invisible hover bars
  const RangeLayer = ({ bars, xScale }: BarCustomLayerProps<SkuRow>) => {
    const x = xScale as unknown as (v: number) => number;
    return (
      <g style={{ pointerEvents: "none" }}>
        {bars.map((b) => {
          const d = b.data.data;
          const cy = b.y + b.height / 2;
          return (
            <g key={b.key}>
              <line x1={x(d.p10)} x2={x(d.p90)} y1={cy} y2={cy} stroke={RANGE_COLOR} strokeWidth={1.5} />
              <line x1={x(d.p10)} x2={x(d.p10)} y1={cy - 5} y2={cy + 5} stroke={RANGE_COLOR} strokeWidth={1.5} />
              <line x1={x(d.p90)} x2={x(d.p90)} y1={cy - 5} y2={cy + 5} stroke={RANGE_COLOR} strokeWidth={1.5} />
              <rect x={x(d.avg) - 1.5} y={cy - 8} width={3} height={16} rx={1} fill={MEAN_COLOR} />
            </g>
          );
        })}
      </g>
    );
  };

  const isRange = view === "range";
  // Sorted category is stacked first (left) so the bars line up on the value being sorted
  const stackKeys: Category[] = sortBy ? [sortBy, ...KEYS.filter((k) => k !== sortBy)] : KEYS;

  return (
    <ChartCard
      title="Top 10 SKU by lead time"
      subtitle={isRange
        ? "P10, average and P90 of gross lead time across the POs of each SKU."
        : `Average gross lead time per PO, split by the SKU's VA, NNVA and UNVA share. ${sortBy
            ? `Sorted by ${CATEGORY_LABELS[sortBy]} (${sortBy}) · click it again to sort by lead time.`
            : "Sorted by lead time · click a segment to sort by that category."}`}
      info="Only SKUs with at least 5 completed POs in the selected period are included, so a single slow PO cannot put a SKU in the top 10. Range uses P10–P90 so one extreme PO does not stretch the axis."
      actions={
        <SegmentedToggle<ViewMode>
          options={[{ key: "composition", label: "Composition" }, { key: "range", label: "Range" }]}
          value={view}
          onChange={setView}
          ariaLabel="Chart view"
        />
      }
    >
      <div style={{ height: 300 }} className={isRange ? undefined : "[&_rect]:cursor-pointer"}>
        {rows.length === 0 ? (
          <EmptyState loading={loading} />
        ) : (
          <ResponsiveBar<SkuRow>
            data={rows}
            keys={isRange ? ["span"] : stackKeys}
            indexBy="label"
            layout="horizontal"
            theme={LINE_THEME}
            margin={{ top: 4, right: 16, bottom: 36, left: 200 }}
            padding={0.38}
            groupMode="stacked"
            colors={({ id }) => (isRange ? "transparent" : CATEGORY_COLORS[id as Category])}
            borderRadius={2}
            enableLabel={false}
            enableGridY={false}
            enableGridX
            axisLeft={{
              tickSize: 0,
              renderTick: (t) => (
                <g transform={`translate(${t.x - 10},${t.y})`}>
                  <text textAnchor="end" dominantBaseline="middle" style={{ fontSize: 10.5, fill: "#101828", fontFamily: "inherit" }}>
                    {String(t.value)}
                  </text>
                </g>
              ),
            }}
            axisBottom={{
              tickSize: 0, tickPadding: 8, tickValues: 6,
              legend: "Lead time (days)", legendOffset: 30, legendPosition: "middle",
            }}
            layers={isRange ? ["grid", "axes", "bars", RangeLayer] : ["grid", "axes", "bars"]}
            tooltip={({ id, data: d }) => (
              isRange ? (
                <LineTooltip
                  title={d.name}
                  subtitle={`${d.code} · ${d.poCount} POs`}
                  nowrap
                  rows={[
                    { label: "P10", color: RANGE_COLOR, value: fmt(d.p10), unit: "days" },
                    { label: "Average", color: MEAN_COLOR, value: fmt(d.avg), unit: "days" },
                    { label: "P90", color: RANGE_COLOR, value: fmt(d.p90), unit: "days" },
                  ]}
                  footer={{ label: "Spread (P90 − P10)", value: `${fmt(d.p90 - d.p10)} days` }}
                />
              ) : (
                <LineTooltip
                  title={d.name}
                  subtitle={`${d.code} · ${d.poCount} POs`}
                  nowrap
                  rows={KEYS.map((k) => ({
                    label: CATEGORY_LABELS[k], color: CATEGORY_COLORS[k],
                    value: `${fmt(Number(d[k]))} · ${Math.round(Number(d[`${k.toLowerCase()}Pct`]))}%`,
                    unit: "days", strong: k === id,
                  }))}
                  footer={{ label: "Average lead time", value: `${fmt(d.avg)} days` }}
                />
              )
            )}
            onClick={(bar) => {
              if (isRange) return;
              const k = bar.id as Category;
              setSortBy((cur) => (cur === k ? null : k));
            }}
            animate={false}
            role="img"
            ariaLabel={isRange ? "Top 10 SKU by lead time, P10 to P90 range with average" : "Top 10 SKU by lead time, split by VA, NNVA and UNVA"}
          />
        )}
      </div>

      {/* Legend */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 mt-1">
          {isRange ? (
            <>
              <span className="flex items-center gap-1.5 text-[9.5px] text-slate-500">
                <span className="w-3 h-[1.5px]" style={{ background: RANGE_COLOR }} />P10 to P90
              </span>
              <span className="flex items-center gap-1.5 text-[9.5px] text-slate-500">
                <span className="w-[3px] h-2 rounded-[1px]" style={{ background: MEAN_COLOR }} />Average
              </span>
            </>
          ) : stackKeys.map((k) => (
            <span key={k} className="flex items-center gap-1.5 text-[9.5px] text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORY_COLORS[k] }} />
              {k}
            </span>
          ))}
        </div>
      )}

      {insight && (
        <p className="mt-3 pt-3 border-t border-[#f0f1f4] text-[11px] text-slate-500">{insight}</p>
      )}
    </ChartCard>
  );
}
