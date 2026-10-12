"use client";

import { useMemo, useState, useEffect } from "react";
import { ResponsiveScatterPlotCanvas } from "@nivo/scatterplot";
import { Info } from "lucide-react";
import { LINE_THEME, LineTooltip } from "@/components/charts/StandardLine";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";

// ─────────────────────────────────────────────────────────────────────────────
// Lead Time page charts — data from /api/lead-time/charts (CT_MANUF_LEADTIME)
// The trend line chart lives in LeadTimeTrendChart.tsx (Standard Line Chart).
// ─────────────────────────────────────────────────────────────────────────────

export interface LeadTimeChartData {
  trend: {
    total: { week: string; days: number }[];
    positions: { week: string; position: string; days: number }[];
  };
  skus: { code: string; name: string; poCount: number; days: number }[];
  /** Per stage (POSITION) × activity × category, days per PO; WIP rows carry the stage they follow in `attached` */
  stages?: { stage: string; activity: string; activityId: number; attached: string; category: "VA" | "NNVA" | "UNVA"; days: number }[];
  /** Top 10 SKU (≥5 POs) by average gross lead time; p10 / p90 = percentiles of gross days per PO */
  topSkus?: { code: string; name: string; poCount: number; avg: number; p10: number; p90: number; va: number; nnva: number; unva: number }[];
}

// Scatter uses the standard line theme plus axis legends
const scatterTheme = {
  ...LINE_THEME,
  axis: {
    ...LINE_THEME.axis,
    legend: { text: { fill: "#9ca3af", fontSize: 11, fontFamily: "inherit" } },
  },
};

export function ChartCard({ title, subtitle, info, actions, children }: { title: string; subtitle: string; info?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg p-3 border border-[#EBEBEB] hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200 flex flex-col min-w-0 relative">
      {actions && <div className="absolute top-3 right-3 flex items-center gap-2">{actions}</div>}
      <div className="flex items-center gap-1.5">
        <h3 className="text-[11.5px] font-bold text-slate-500 uppercase tracking-[0.08em] leading-none">{title}</h3>
        {info && (
          <span className="group relative flex cursor-help" tabIndex={0} aria-label={info}>
            <Info size={13} className="text-slate-300 group-hover:text-slate-500 group-focus:text-slate-500 transition-colors" strokeWidth={1.75} />
            <span
              role="tooltip"
              className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-lg border border-white/10 bg-[#2A3D4A]/[.82] backdrop-blur-sm px-3 py-2 text-[11px] font-normal leading-relaxed text-slate-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100"
            >
              {info}
            </span>
          </span>
        )}
      </div>
      <p className="text-[11px] text-slate-400 mt-1 mb-2">{subtitle}</p>
      {children}
    </div>
  );
}

export function EmptyState({ loading }: { loading: boolean }) {
  return (
    <div className="h-full flex items-center justify-center text-[11px] text-slate-400">
      {loading ? "Loading data…" : "No data for the selected filters"}
    </div>
  );
}

// ── 2. Lead time vs PO count scatter (self-fetching, dimension toggle) ────────

type ScatterDim = "brand" | "variant" | "su_group" | "plant" | "sku";

interface ScatterFilters {
  plant?: string;
  startDate?: string;
  endDate?: string;
  period?: string;
}

interface ScatterPoint { label: string; poCount: number; days: number }

const DIM_OPTIONS: { value: ScatterDim; label: string }[] = [
  { value: "brand",    label: "Brand" },
  { value: "variant",  label: "Variant" },
  { value: "su_group", label: "SKU Group" },
  { value: "plant",    label: "Plant" },
  { value: "sku",      label: "SKU" },
];

function useScatterData(filters: ScatterFilters, dim: ScatterDim) {
  const [data, setData] = useState<ScatterPoint[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      plant:     filters.plant     ?? "All Plant",
      startDate: filters.startDate ?? `${new Date().getFullYear()}-01-01`,
      endDate:   filters.endDate   ?? new Date().toISOString().split("T")[0],
      dim,
    });
    if (filters.period) params.set("period", filters.period);

    fetch(`/api/lead-time/scatter?${params}`)
      .then((r) => r.json())
      .then((rows: ScatterPoint[]) => { setData(rows); setLoading(false); })
      .catch(() => { setData([]); setLoading(false); });
  }, [filters.plant, filters.startDate, filters.endDate, filters.period, dim]);

  return { data, loading };
}

export function LeadTimeSkuScatter({ filters }: { filters?: ScatterFilters }) {
  const [dim, setDim] = useState<ScatterDim>("sku");
  const { data, loading } = useScatterData(filters ?? {}, dim);

  const points = useMemo(
    () => (data ?? []).map((s) => ({ x: s.poCount, y: s.days, label: s.label })),
    [data],
  );

  const dimLabel = DIM_OPTIONS.find((o) => o.value === dim)?.label ?? "SKU";

  return (
    <ChartCard
      title="Lead time and PO count"
      subtitle={`Each dot is one ${dimLabel}${points.length ? ` · ${points.length.toLocaleString("en-US")} items` : ""}.${dim === "sku" ? " SKUs with 100+ POs are excluded." : ""}`}
      info={dim === "sku" ? "SKUs with fewer than 100 completed POs in the selected period are shown. SKUs with 100+ POs are few outliers that would compress the rest of the chart." : `Average gross lead time vs PO count per ${dimLabel}.`}
      actions={
        <SegmentedToggle
          options={DIM_OPTIONS.map((o) => ({ key: o.value, label: o.label }))}
          value={dim}
          onChange={(v) => setDim(v as ScatterDim)}
        />
      }
    >
      <div style={{ height: 262 }}>
        {points.length === 0 ? (
          <EmptyState loading={loading} />
        ) : (
          <ResponsiveScatterPlotCanvas
            data={[{ id: dimLabel, data: points }]}
            theme={scatterTheme}
            margin={{ top: 8, right: 16, bottom: 40, left: 48 }}
            xScale={{ type: "linear", min: 0, max: "auto" }}
            yScale={{ type: "linear", min: 0, max: "auto" }}
            colors={["rgba(42,120,214,0.55)"]}
            nodeSize={8}
            enableGridX
            axisBottom={{
              tickSize: 0, tickPadding: 8, tickValues: 8,
              legend: "PO count", legendOffset: 32, legendPosition: "middle",
            }}
            axisLeft={{
              tickSize: 0, tickPadding: 6, tickValues: 6,
              legend: "Lead time (days)", legendOffset: -38, legendPosition: "middle",
            }}
            tooltip={({ node }) => {
              const d = node.data as { x: number; y: number; label: string };
              return (
                <LineTooltip
                  title={d.label}
                  rows={[
                    { label: "Lead time", value: d.y.toFixed(1), unit: "days" },
                    { label: "POs completed", value: d.x.toLocaleString("en-US") },
                  ]}
                />
              );
            }}
          />
        )}
      </div>
    </ChartCard>
  );
}
