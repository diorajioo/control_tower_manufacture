"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ResponsiveBar, type BarCustomLayerProps, type BarDatum } from "@nivo/bar";
import { ChartCard, EmptyState } from "@/components/dashboard/LeadTimeCharts";
import { LINE_THEME, LineTooltip } from "@/components/charts/StandardLine";
import { SERIES_COLORS } from "@/lib/chartConfig";
import { STAGE_ORDER, stageLabel } from "@/lib/leadTimeStages";

// ─────────────────────────────────────────────────────────────────────────────
// Lead time per stage, actual vs standard (Overview → Tactical view).
// Horizontal bars = actual days per PO per CT_MANUF_LEADTIME.POSITION; tick = standard
// (ACTIVITY_LEADTIME_STD). Sorted by process sequence (STAGE_ORDER), first stage on top.
// Data: /api/lead-time/stages.
// ─────────────────────────────────────────────────────────────────────────────

export interface StageStdPoint { stage: string; actual: number; std: number }

// ACTIVITY_LEADTIME_STD is minutes per activity only for these stages. PO / WIP / RECEIVE NDC carry 0,
// and KEMAS 1 / KEMAS 2 / CUCI KEMAS hold near-zero values (per-unit rates), so they get no standard marker.
const STD_STAGES = new Set(["TIMBANG", "OLAH", "CUCI OLAH"]);

const ACTUAL_COLOR = SERIES_COLORS[0];
const STD_COLOR = "#143665";
const CHART_MARGIN = { top: 4, right: 16, bottom: 24, left: 128 };
const ROW_HEIGHT = 26;

interface Row extends BarDatum {
  stage: string;
  label: string;
  actual: number;
  std: number;   // 0 = no standard
  gap: number;
}

const fmt = (n: number) => n.toFixed(2);
// Chart-specific rule: WIP always sits last (after NDC Receiving), unknown stages just before it
const seq = (stage: string) => {
  if (stage === "WIP") return STAGE_ORDER.length + 1;
  const i = (STAGE_ORDER as readonly string[]).indexOf(stage);
  return i === -1 ? STAGE_ORDER.length : i;
};

export function LeadTimeStageStdChart({ data, loading }: { data: StageStdPoint[] | null; loading: boolean }) {
  const router = useRouter();

  const rows = useMemo((): Row[] => (data ?? [])
    .filter((d) => d.actual > 0.005)
    .map((d) => {
      const std = STD_STAGES.has(d.stage) ? d.std : 0;
      return { stage: d.stage, label: stageLabel(d.stage), actual: d.actual, std, gap: d.actual - std };
    })
    // Nivo draws horizontal bars bottom-up, so descending sequence here = first stage on top.
    .sort((a, b) => seq(b.stage) - seq(a.stage)), [data]);

  const StdLayer = ({ bars, xScale }: BarCustomLayerProps<Row>) => (
    <g style={{ pointerEvents: "none" }}>
      {bars.filter((b) => b.data.data.std > 0).map((b) => {
        const x = (xScale as (v: number) => number)(b.data.data.std);
        return <line key={b.key} x1={x} x2={x} y1={b.y - 3} y2={b.y + b.height + 3} stroke={STD_COLOR} strokeWidth={2} strokeLinecap="round" />;
      })}
    </g>
  );

  const top = rows.reduce<Row | undefined>((m, r) => (!m || r.gap > m.gap ? r : m), undefined);

  return (
    <ChartCard
      title="Lead time per stage"
      subtitle="Days per PO, actual vs standard, in process sequence."
      info="Standard comes from ACTIVITY_LEADTIME_STD and is shown only for Weighing, Processing and Processing Cleaning. PO, WIP, Packing, Packing Cleaning and NDC Receiving have no usable standard, so their full actual counts as the gap."
      actions={
        <button
          onClick={() => router.push("/lead-time")}
          className="px-2.5 py-1 rounded-md border border-[#EBEBEB] text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Open stage detail
        </button>
      }
    >
      <div style={{ height: Math.max(rows.length, 4) * ROW_HEIGHT + CHART_MARGIN.top + CHART_MARGIN.bottom }}>
        {rows.length === 0 ? (
          <EmptyState loading={loading} />
        ) : (
          <ResponsiveBar<Row>
            data={rows}
            keys={["actual"]}
            indexBy="label"
            layout="horizontal"
            theme={LINE_THEME}
            margin={CHART_MARGIN}
            padding={0.5}
            colors={ACTUAL_COLOR}
            borderRadius={2}
            enableLabel={false}
            enableGridY={false}
            enableGridX
            valueScale={{ type: "linear", min: 0, max: "auto" }}
            axisBottom={{ tickSize: 0, tickPadding: 6, tickValues: 6, format: (v) => `${v}d` }}
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
            layers={["grid", "axes", "bars", StdLayer]}
            tooltip={({ data: d }) => (
              <LineTooltip
                title={d.label}
                subtitle={d.stage}
                rows={[
                  { label: "Actual", color: ACTUAL_COLOR, value: fmt(d.actual), unit: "days" },
                  { label: "Standard", color: STD_COLOR, value: d.std > 0 ? fmt(d.std) : "—", unit: d.std > 0 ? "days" : undefined },
                ]}
                footer={{ label: "Gap", value: `${d.gap >= 0 ? "+" : ""}${fmt(d.gap)} days` }}
              />
            )}
            animate={false}
            role="img"
            ariaLabel="Lead time per stage, actual versus standard"
          />
        )}
      </div>

      {rows.length > 0 && (
        <div className="flex items-center justify-center gap-x-3 mt-1">
          <span className="flex items-center gap-1.5 text-[9.5px] text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACTUAL_COLOR }} />
            Actual
          </span>
          <span className="flex items-center gap-1.5 text-[9.5px] text-slate-500">
            <span className="w-0.5 h-2.5 rounded-full" style={{ background: STD_COLOR }} />
            Standard
          </span>
        </div>
      )}

      {top && (
        <p className="mt-3 pt-3 border-t border-[#f0f1f4] text-[11px] text-slate-500">
          {top.label} has the largest gap: {fmt(top.actual)} days per PO{top.std > 0 ? ` against a standard of ${fmt(top.std)}` : ", with no standard set"}.
        </p>
      )}
    </ChartCard>
  );
}
