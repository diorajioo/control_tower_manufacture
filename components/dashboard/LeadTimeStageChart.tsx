"use client";

import { useMemo, useState } from "react";
import { ResponsiveBar, type BarCustomLayerProps, type BarDatum } from "@nivo/bar";
import { ChartCard, EmptyState, type LeadTimeChartData } from "@/components/dashboard/LeadTimeCharts";
import { LINE_THEME, LineTooltip } from "@/components/charts/StandardLine";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { STAGE_ORDER, stageLabel } from "@/lib/leadTimeStages";

// ─────────────────────────────────────────────────────────────────────────────
// Lead time per stage (/lead-time, Strategic) — Pareto: stacked VA / NNVA / UNVA bars per
// CT_MANUF_LEADTIME.POSITION, sorted descending, with a cumulative-% line on the right axis.
// Data: /api/lead-time/charts → stages (days per PO, so bars add up to the total per PO).
// ─────────────────────────────────────────────────────────────────────────────

type Category = "VA" | "NNVA" | "UNVA";
type CategoryFilter = Category | "ALL";
type ViewMode = "stage" | "stageWip";

// Same entity colors as the VA / NNVA / Waste cards above (LeadTimeCategoryCard)
const CATEGORY_COLORS: Record<Category, string> = {
  VA:   "#067647",
  NNVA: "#d97706",
  UNVA: "#d92d20",
};
const CATEGORY_LABELS: Record<Category, string> = { VA: "VA", NNVA: "NNVA", UNVA: "UNVA" };
const CUMULATIVE_COLOR = "#143665";

interface StageRow extends BarDatum {
  stage: string;
  label: string;
  VA: number;
  NNVA: number;
  UNVA: number;
  total: number;
  cumPct: number;
}

const CHART_MARGIN = { top: 10, right: 48, bottom: 28, left: 40 };

const fmt = (n: number) => n.toFixed(1);

export function LeadTimeStageChart({ data, loading }: { data: LeadTimeChartData | null; loading: boolean }) {
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [view, setView] = useState<ViewMode>("stage");
  // Hovered point on the cumulative (Pareto) line → HTML tooltip over the chart
  const [cumHover, setCumHover] = useState<{ row: StageRow; x: number; y: number } | null>(null);

  const rows = useMemo((): StageRow[] => {
    const src = data?.stages ?? [];
    const byStage = new Map<string, Record<Category, number>>();
    for (const r of src) {
      // "Stage": WIP folds into the stage it follows · "Stage + WIP": WIP is its own bar
      const key = view === "stage" ? r.attached : r.stage;
      if (!byStage.has(key)) byStage.set(key, { VA: 0, NNVA: 0, UNVA: 0 });
      byStage.get(key)![r.category] += r.days;
    }
    const keep = (c: Category) => category === "ALL" || category === c;
    const list = Array.from(byStage.entries()).map(([stage, v]) => {
      const VA = keep("VA") ? v.VA : 0;
      const NNVA = keep("NNVA") ? v.NNVA : 0;
      const UNVA = keep("UNVA") ? v.UNVA : 0;
      // Step numbers skip WIP (not a process step), so RECEIVE NDC = 8 in both views
      const step = (STAGE_ORDER.filter((s) => s !== "WIP") as string[]).indexOf(stage);
      const label = stage === "WIP" || step === -1 ? stageLabel(stage) : `${step + 1}. ${stageLabel(stage)}`;
      return { stage, label, VA, NNVA, UNVA, total: VA + NNVA + UNVA, cumPct: 0 };
    }).filter((r) => r.total > 0.005)
      .sort((a, b) => b.total - a.total);
    const grand = list.reduce((s, r) => s + r.total, 0);
    let run = 0;
    for (const r of list) { run += r.total; r.cumPct = grand > 0 ? (run / grand) * 100 : 0; }
    return list;
  }, [data, category, view]);

  const keys: Category[] = category === "ALL" ? ["VA", "NNVA", "UNVA"] : [category];
  const grand = rows.reduce((s, r) => s + r.total, 0);
  // Symlog value axis: compresses the top so the smallest stages are more than a hairline.
  // Ticks are fixed "nice" values up to the tallest bar (a symlog axis has no even spacing).
  const maxTotal = rows[0]?.total ?? 0;
  const yTicks = [0, 0.5, 1, 2, 5, 10, 20, 50, 100].filter((t) => t <= maxTotal * 1.05);

  // Footer insight — derived from the data shown
  const insight = useMemo(() => {
    if (rows.length === 0) return "";
    const top = rows[0];
    const scope = category === "ALL" ? "All categories shown." : `Showing ${CATEGORY_LABELS[category]} only.`;
    if (view === "stage") {
      const va = top.VA > 0 ? `, of which ${fmt(top.VA)} days is value-added` : "";
      return `WIP is folded into the stage it follows. ${stageLabel(top.stage)} accounts for ${fmt(top.total)} days per PO${va}. ${scope}`;
    }
    const wip = rows.find((r) => r.stage === "WIP");
    const wipText = wip ? `WIP is shown as its own bar: ${fmt(wip.total)} days per PO (${grand > 0 ? Math.round((wip.total / grand) * 100) : 0}% of the total).` : "No WIP in this view.";
    return `${wipText} ${scope}`;
  }, [rows, view, category, grand]);

  const CumulativeLayer = ({ bars, innerWidth, innerHeight }: BarCustomLayerProps<StageRow>) => {
    const centers = new Map<string, number>();
    for (const b of bars) centers.set(String(b.data.indexValue), b.x + b.width / 2);
    const pts = rows
      .map((r) => ({ row: r, x: centers.get(r.label), y: innerHeight * (1 - r.cumPct / 100) }))
      .filter((p): p is { row: StageRow; x: number; y: number } => p.x !== undefined);
    const ticks = [0, 25, 50, 75, 100];
    return (
      <g style={{ pointerEvents: "none" }}>
        {ticks.map((t) => (
          <text key={t} x={innerWidth + 8} y={innerHeight * (1 - t / 100)} dominantBaseline="middle"
            style={{ fontSize: 10, fill: "#a0a6b1", fontFamily: "inherit", fontVariantNumeric: "tabular-nums" }}>
            {t}%
          </text>
        ))}
        {pts.length > 1 && (
          <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={CUMULATIVE_COLOR} strokeWidth={1.75} strokeLinejoin="round" />
        )}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={cumHover?.row.label === p.row.label ? 4.5 : 3.5} fill="white" stroke={CUMULATIVE_COLOR} strokeWidth={1.75} />
        ))}
        {/* Larger invisible hit areas so the points are easy to hover */}
        {pts.map((p, i) => (
          <circle key={`hit-${i}`} cx={p.x} cy={p.y} r={9} fill="transparent" style={{ pointerEvents: "all", cursor: "default" }}
            onMouseEnter={() => setCumHover(p)} onMouseLeave={() => setCumHover(null)} />
        ))}
      </g>
    );
  };

  return (
    <ChartCard
      title="Lead time per stage"
      subtitle="Contribution of each stage to lead time per PO, sorted descending. Line = cumulative share. Compressed scale so small stages stay visible."
      actions={
        <>
          <SegmentedToggle<CategoryFilter>
            options={[{ key: "UNVA", label: "UNVA" }, { key: "NNVA", label: "NNVA" }, { key: "VA", label: "VA" }, { key: "ALL", label: "All" }]}
            value={category}
            onChange={setCategory}
          />
          <SegmentedToggle<ViewMode>
            options={[{ key: "stage", label: "Stage" }, { key: "stageWip", label: "Stage + WIP" }]}
            value={view}
            onChange={setView}
          />
        </>
      }
    >
      <div style={{ height: 280, position: "relative" }}>
        {rows.length === 0 ? (
          <EmptyState loading={loading} />
        ) : (
          <ResponsiveBar<StageRow>
            data={rows}
            keys={keys}
            indexBy="label"
            theme={LINE_THEME}
            margin={CHART_MARGIN}
            padding={0.32}
            groupMode="stacked"
            colors={({ id }) => CATEGORY_COLORS[id as Category]}
            borderRadius={2}
            enableLabel={false}
            enableGridX={false}
            valueScale={{ type: "symlog", constant: 1 }}
            gridYValues={yTicks}
            axisLeft={{ tickSize: 0, tickPadding: 8, tickValues: yTicks, format: (v) => Number(v).toFixed(1) }}
            axisBottom={{
              tickSize: 0,
              // Horizontal labels, dark text (X axis only; Y keeps the standard gray)
              renderTick: (t) => (
                <g transform={`translate(${t.x},${t.y + 14})`}>
                  <text textAnchor="middle" dominantBaseline="middle"
                    style={{ fontSize: 10.5, fill: "#101828", fontFamily: "inherit" }}>
                    {String(t.value)}
                  </text>
                </g>
              ),
            }}
            layers={["grid", "axes", "bars", CumulativeLayer]}
            tooltip={({ id, data: d }) => (
              <LineTooltip
                title={stageLabel(d.stage)}
                subtitle={d.stage}
                rows={keys.map((k) => ({ label: CATEGORY_LABELS[k], color: CATEGORY_COLORS[k], value: fmt(Number(d[k])), unit: "days", strong: k === id }))}
                footer={{ label: "Total · cumulative", value: `${fmt(d.total)} days · ${Math.round(d.cumPct)}%` }}
              />
            )}
            animate={false}
            role="img"
            ariaLabel="Lead time per stage, stacked by VA, NNVA and UNVA, with cumulative share"
          />
        )}
        {cumHover && (
          <div style={{
            position: "absolute", pointerEvents: "none", zIndex: 10,
            left: CHART_MARGIN.left + cumHover.x, top: CHART_MARGIN.top + cumHover.y,
            transform: "translate(-50%, calc(-100% - 12px))",
          }}>
            <LineTooltip
              title={stageLabel(cumHover.row.stage)}
              subtitle={cumHover.row.stage}
              rows={[
                { label: "Cumulative share", color: CUMULATIVE_COLOR, value: `${Math.round(cumHover.row.cumPct)}%` },
                { label: "Stage total", value: fmt(cumHover.row.total), unit: "days" },
              ]}
            />
          </div>
        )}
      </div>

      {/* Legend */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 mt-1">
          <span className="flex items-center gap-1.5 text-[9.5px] text-slate-500">
            <span className="w-2.5 h-2.5 rounded-full border-[1.75px] bg-white" style={{ borderColor: CUMULATIVE_COLOR }} />
            Cumulative
          </span>
          {keys.map((k) => (
            <span key={k} className="flex items-center gap-1.5 text-[9.5px] text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORY_COLORS[k] }} />
              {CATEGORY_LABELS[k]}
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
