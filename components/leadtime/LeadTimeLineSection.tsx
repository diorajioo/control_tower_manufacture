"use client";

// Lead Time page → Analysis tab, bottom: "Lead Time per Line" bubble chart + "Lead Time SKU per Line" table.
// Agreed with the user (2026-10-14):
//   y      = process time at the line: span of the activity rows of that process on that line per PO, averaged
//            (Mixing = OLAH, Filling Packing = KEMAS 1 / KEMAS 2)
//   x      = POs completed through the line; bubble size = volume (Σ RELEASE_QTY, pcs)
//   quadrants split at the mean PO count and the mean lead time of the lines shown (dashed lines)
//   click  = a bubble selects its line → the SKU table shows that line (its Line dropdown follows); click again = all
// Chart shows lines with ≥ MIN_PO POs (fewer = noise); the table lists every line. Data: /api/lead-time/lines.

import { useEffect, useMemo, useRef, useState } from "react";
import { ResponsiveScatterPlot, type ScatterPlotLayerProps } from "@nivo/scatterplot";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Fade } from "@/components/ui/Fade";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { ToggleSelect } from "@/components/ui/ToggleSelect";
import { LINE_THEME, LineTooltip } from "@/components/charts/StandardLine";
import { dimsKey, dimsToParams, type LtDims } from "@/lib/leadTimeFilters";
import type { LtUnit } from "@/components/leadtime/LeadTimeFilterCard";
import { LEAD_TIME_TARGET_DAYS } from "@/lib/leadTimeDefinition";

type Activity = "mixing" | "filpac";
const ACTIVITY_OPTIONS: { key: Activity; label: string }[] = [
  { key: "mixing", label: "Mixing" },
  { key: "filpac", label: "Filling Packing" },
];
const MIN_PO = 10;
const PAGE = 200;
const HEIGHT = 300;

interface Filters { plant: string; startDate: string; endDate: string; period?: string; lt?: LtDims }
interface ApiResponse { skus: Record<string, string>; rows: [string, string | null, number, number | null, number | null, number | null][] }
interface LinePoint { line: string; poCount: number; avgDays: number; avgGrossDays: number; qty: number }
interface SkuRow { key: string; line: string; sku: string | null; name: string; poCount: number; avgDays: number; qty: number }

const NODE = "rgba(30,64,118,0.55)";
const NODE_FADED = "rgba(30,64,118,0.15)";
const NODE_STROKE = "#1E4076";

/** 63,200 → "63.2K"; 1,250,000 → "1.25M" */
function compact(n: number) {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

export function LeadTimeLineSection({ filters, unit, refreshKey = 0 }: { filters: Filters; unit: LtUnit; refreshKey?: number }) {
  const [activity, setActivity] = useState<Activity>("filpac");
  const [line, setLine] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const f = unit === "hours" ? 24 : 1;
  const unitLabel = unit === "hours" ? "hours" : "days";
  const lt = dimsKey(filters.lt);

  useEffect(() => {
    let cancelled = false;
    const params = dimsToParams(filters.lt, new URLSearchParams({ plant: filters.plant, startDate: filters.startDate, endDate: filters.endDate, lineActivity: activity }));
    if (filters.period) params.set("period", filters.period);
    setLoading(true);
    fetch(`/api/lead-time/lines?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setData(d && !d.error ? d : null); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.plant, filters.startDate, filters.endDate, filters.period, lt, activity, refreshKey]);

  // New data or another activity → no line selected
  useEffect(() => { setLine(null); }, [data]);

  const skuRows: SkuRow[] = useMemo(() => (data?.rows ?? []).map(([ln, sku, n, span, qty]) => ({
    key: `${ln}|${sku}`, line: ln, sku, name: sku ? data?.skus[sku] ?? sku : "—",
    poCount: n, avgDays: n > 0 ? (span ?? 0) / n : 0, qty: qty ?? 0,
  })), [data]);

  const lines: LinePoint[] = useMemo(() => {
    // Per-line: aggregate span/count from SKU rows; avgGrossDays comes directly (already per-PO avg from API).
    const m = new Map<string, { n: number; span: number; grossSum: number; qty: number }>();
    for (const [ln, , n, span, qty, avgGross] of data?.rows ?? []) {
      const x = m.get(ln) ?? { n: 0, span: 0, grossSum: 0, qty: 0 };
      x.n += n; x.span += span ?? 0; x.grossSum += (avgGross ?? 0) * n; x.qty += qty ?? 0;
      m.set(ln, x);
    }
    return Array.from(m, ([ln, x]) => ({
      line: ln, poCount: x.n,
      avgDays: x.n > 0 ? x.span / x.n : 0,
      avgGrossDays: x.n > 0 ? x.grossSum / x.n : 0,
      qty: x.qty,
    }));
  }, [data]);
  const shown = useMemo(() => lines.filter((l) => l.poCount >= MIN_PO), [lines]);

  return (
    <div className="grid grid-cols-2 gap-3.5">
      <LineBubbleCard
        points={shown} allLines={lines} totalLines={lines.length} loading={loading} f={f} unitLabel={unitLabel}
        activity={activity} onActivity={setActivity}
        selected={line} onSelect={(l) => setLine((cur) => (cur === l ? null : l))}
      />
      <SkuLineTable
        rows={skuRows} lines={lines} loading={loading} f={f} unitLabel={unitLabel}
        line={line} onLine={setLine} activityLabel={ACTIVITY_OPTIONS.find((o) => o.key === activity)!.label}
      />
    </div>
  );
}

// ── Bubble chart ────────────────────────────────────────────────────────────────

interface Datum { x: number; y: number; line: string; qty: number }

function LineBubbleCard({ points, allLines, totalLines, loading, f, unitLabel, activity, onActivity, selected, onSelect }: {
  points: LinePoint[]; allLines: LinePoint[]; totalLines: number; loading: boolean; f: number; unitLabel: string;
  activity: Activity; onActivity: (a: Activity) => void;
  selected: string | null; onSelect: (line: string) => void;
}) {
  const data = useMemo(() => [{
    id: "lines",
    data: points.map((p): Datum => ({ x: p.poCount, y: p.avgGrossDays * f, line: p.line, qty: p.qty })),
  }], [points, f]);
  const threshX = allLines.length ? allLines.reduce((s, p) => s + p.poCount, 0) / allLines.length : 0;
  const threshY = LEAD_TIME_TARGET_DAYS * f;
  const maxQty = Math.max(1, ...points.map((p) => p.qty));
  const size = (qty: number) => 8 + 26 * Math.sqrt(Math.max(qty, 0) / maxQty); // area ∝ volume, 8–34 px

  // Quadrant tints, threshold lines and corner labels — behind the bubbles
  const Quadrants = ({ xScale, yScale, innerWidth, innerHeight }: ScatterPlotLayerProps<Datum>) => {
    const mx = (xScale as (v: number) => number)(threshX);
    const my = (yScale as (v: number) => number)(threshY);
    const label = (x: number, y: number, anchor: "start" | "end", text: string, color: string) => (
      <text x={x} y={y} textAnchor={anchor} style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", fill: color }}>{text}</text>
    );
    return (
      <g style={{ pointerEvents: "none" }}>
        <rect x={mx} y={0} width={Math.max(0, innerWidth - mx)} height={Math.max(0, my)} fill="#FDECEC" opacity={0.6} />
        <rect x={mx} y={my} width={Math.max(0, innerWidth - mx)} height={Math.max(0, innerHeight - my)} fill="#EAF6EF" opacity={0.7} />
        <line x1={mx} x2={mx} y1={0} y2={innerHeight} stroke="#98a2b3" strokeWidth={1} strokeDasharray="4 3" />
        <line x1={0} x2={innerWidth} y1={my} y2={my} stroke="#98a2b3" strokeWidth={1} strokeDasharray="4 3" />
        {label(6, 12, "start", "LOW VOLUME · ABOVE TARGET", "#667085")}
        {label(innerWidth - 6, 12, "end", "HIGH VOLUME · ABOVE TARGET", "#d92d20")}
        {label(6, innerHeight - 6, "start", "LOW VOLUME · ON TARGET", "#667085")}
        {label(innerWidth - 6, innerHeight - 6, "end", "HIGH VOLUME · ON TARGET", "#067647")}
      </g>
    );
  };

  return (
    <div className="rounded-lg border border-[#EBEBEB] bg-white p-4 flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Lead Time per Line</p>
          <InfoTooltip size={13} width={300} rows={[
            { label: "Lead time", text: `Average gross lead time (PO Released → NDC) per PO that ran on this line. Horizontal line = ${LEAD_TIME_TARGET_DAYS}-day target.` },
            { label: "PO count", text: "POs completed in the period that ran on the line. Vertical line = avg across all lines." },
            { label: "Bubble size", text: "Volume = released quantity (pcs) of those POs." },
            { label: "Lines shown", text: `Lines with at least ${MIN_PO} POs (${points.length} of ${totalLines}). The table lists every line.` },
            { label: "Click", text: "Click a bubble to show its SKUs in the table; click it again for all lines." },
          ]} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] text-slate-500">Activity</span>
          <ToggleSelect options={ACTIVITY_OPTIONS} value={activity} onChange={onActivity} ariaLabel="Activity" align="right" />
        </div>
      </div>

      {loading ? (
        <div className="bg-gray-50 rounded animate-pulse" style={{ height: HEIGHT }} />
      ) : points.length === 0 ? (
        <div className="flex items-center justify-center text-[11px] text-slate-400" style={{ height: HEIGHT }}>No line with {MIN_PO}+ POs for the selected filters</div>
      ) : (
        <Fade depKey={`${activity}|${points.length}|${unitLabel}`}>
          <div style={{ height: HEIGHT }}>
            <ResponsiveScatterPlot<Datum>
              data={data}
              theme={{ ...LINE_THEME, axis: { ...LINE_THEME.axis, legend: { text: { fontSize: 10, fill: "#667085", fontWeight: 400, letterSpacing: 1 } } } }}
              margin={{ top: 8, right: 12, bottom: 40, left: 64 }}
              xScale={{ type: "linear", min: 0, max: "auto", nice: true }}
              yScale={{ type: "linear", min: 0, max: "auto", nice: true }}
              nodeSize={({ data: d }) => size(d.qty)}
              enableGridX
              enableGridY
              axisLeft={{ tickSize: 0, tickPadding: 6, tickValues: 5, legend: `Avg lead time (${unitLabel})`, legendPosition: "middle", legendOffset: -52 }}
              axisBottom={{ tickSize: 0, tickPadding: 6, tickValues: 6, legend: "PO count", legendPosition: "middle", legendOffset: 32 }}
              layers={["grid", Quadrants, "axes", "nodes", "mesh"]}
              nodeComponent={({ node, onMouseEnter, onMouseMove, onMouseLeave, onClick }) => {
                const on = selected === node.data.line;
                return (
                  <circle cx={node.x} cy={node.y} r={node.size / 2}
                    fill={selected == null || on ? NODE : NODE_FADED}
                    stroke={on ? "#16305C" : NODE_STROKE} strokeWidth={on ? 2 : 1} strokeOpacity={selected == null || on ? 0.9 : 0.3}
                    style={{ cursor: "pointer", transition: "fill 150ms ease-out" }}
                    onMouseEnter={(e) => onMouseEnter?.(node, e)} onMouseMove={(e) => onMouseMove?.(node, e)}
                    onMouseLeave={(e) => onMouseLeave?.(node, e)} onClick={(e) => onClick?.(node, e)} />
                );
              }}
              onClick={(node) => onSelect(node.data.line)}
              tooltip={({ node }) => (
                <LineTooltip
                  title={node.data.line}
                  rows={[
                    { label: "Avg lead time", value: node.data.y.toFixed(2), unit: unitLabel, strong: true },
                    { label: "POs completed", value: node.data.x.toLocaleString("en-US") },
                    { label: "Volume", value: compact(node.data.qty), unit: "pcs" },
                  ]}
                  footer={{ label: selected === node.data.line ? "Click to show all lines" : "Click to filter the SKU table", value: "" }}
                />
              )}
              animate={false}
            />
          </div>
        </Fade>
      )}
    </div>
  );
}

// ── SKU per line table ──────────────────────────────────────────────────────────

type SortKey = "name" | "line" | "poCount" | "avgDays" | "qty";

function SkuLineTable({ rows, lines, loading, f, unitLabel, line, onLine, activityLabel }: {
  rows: SkuRow[]; lines: LinePoint[]; loading: boolean; f: number; unitLabel: string;
  line: string | null; onLine: (l: string | null) => void; activityLabel: string;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "avgDays", dir: "desc" });
  const [shown, setShown] = useState(PAGE);
  const scroller = useRef<HTMLDivElement>(null);

  const lineOptions = useMemo(() => [
    { key: "__all", label: "All lines" },
    ...[...lines].sort((a, b) => a.line.localeCompare(b.line)).map((l) => ({ key: l.line, label: l.line })),
  ], [lines]);

  const sorted = useMemo(() => {
    const list = line ? rows.filter((r) => r.line === line) : rows;
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      return (typeof x === "string" ? x.localeCompare(String(y)) : (x as number) - (y as number)) * sign;
    });
  }, [rows, line, sort]);

  useEffect(() => { setShown(PAGE); scroller.current?.scrollTo({ top: 0 }); }, [line, sort, rows]);

  const onScroll = () => {
    const el = scroller.current;
    if (el && el.scrollTop + el.clientHeight > el.scrollHeight - 300 && shown < sorted.length) setShown((n) => n + PAGE);
  };
  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "name" || key === "line" ? "asc" : "desc" }));

  const cols: { key: SortKey; label: string; align: "left" | "right"; width?: number }[] = [
    { key: "name", label: "SKU", align: "left" },
    { key: "line", label: "Line", align: "left", width: 90 },
    { key: "poCount", label: "PO", align: "right", width: 64 },
    { key: "avgDays", label: "Avg", align: "right", width: 76 },
    { key: "qty", label: "Volume", align: "right", width: 84 },
  ];

  return (
    <div className="rounded-lg border border-[#EBEBEB] bg-white p-4 flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Lead Time SKU per Line <span className="normal-case font-normal tracking-normal text-slate-400">({unitLabel} · pcs)</span>
          </p>
          <InfoTooltip size={13} width={260}
            text={`${activityLabel}: per SKU on each line — POs completed, average process time at the line per PO, and volume (released pcs). Pick a line here or click a bubble in the chart.`} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] text-slate-500">Line</span>
          <ToggleSelect options={lineOptions} value={line ?? "__all"} onChange={(v) => onLine(v === "__all" ? null : v)} ariaLabel="Line" align="right" />
        </div>
      </div>

      {loading ? (
        <div className="bg-gray-50 rounded animate-pulse" style={{ height: HEIGHT }} />
      ) : sorted.length === 0 ? (
        <div className="flex items-center justify-center text-[11px] text-slate-400" style={{ height: HEIGHT }}>No SKUs for the selected filters</div>
      ) : (
        <div ref={scroller} onScroll={onScroll} className="overflow-auto rounded-md" style={{ maxHeight: HEIGHT }}>
          <table className="w-full border-separate border-spacing-0 text-[10.5px]" style={{ tableLayout: "fixed" }}>
            <thead className="sticky top-0 z-10">
              <tr>
                {cols.map((c) => {
                  const on = sort.key === c.key;
                  return (
                    <th key={c.key} style={{ width: c.width }} aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      className={cn("bg-[#1E4076] h-8 px-2.5 font-bold text-white text-[10px] whitespace-nowrap align-middle first:rounded-tl-md last:rounded-tr-md", c.align === "right" ? "text-right" : "text-left")}>
                      <button onClick={() => toggleSort(c.key)} title={`Sort by ${c.label}`}
                        className={cn("inline-flex items-center gap-1 hover:text-white/80 focus:outline-none focus-visible:underline", c.align === "right" && "flex-row-reverse")}>
                        <span>{c.label}</span>
                        <span className="w-[10px] inline-flex justify-center text-white/90">
                          {on && (sort.dir === "desc" ? <ArrowDown size={10} /> : <ArrowUp size={10} />)}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, shown).map((r) => (
                <tr key={r.key} className="hover:bg-[#F7F9FC] [&>td]:border-b [&>td]:border-[#EEF0F3]">
                  <td className="px-2.5 py-1.5 text-[#1E4076] truncate" title={r.sku ? `${r.sku} · ${r.name}` : undefined}>{r.name}</td>
                  <td className="px-2.5 py-1.5 text-slate-600 truncate">{r.line}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-700">{r.poCount.toLocaleString("en-US")}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums font-bold text-slate-900">{(r.avgDays * f).toFixed(2)}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-700" title={`${r.qty.toLocaleString("en-US")} pcs`}>{compact(r.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown < sorted.length && (
            <div className="py-2 text-center text-[10.5px] text-slate-400">Scroll for more · {shown.toLocaleString("en-US")} of {sorted.length.toLocaleString("en-US")} shown</div>
          )}
        </div>
      )}
    </div>
  );
}
