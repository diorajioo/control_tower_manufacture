"use client";

import { withBase } from "@/lib/basePath";
import { prodToday, prodYearStart } from "@/lib/productionDay";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { FloatingChat } from "@/components/dashboard/FloatingChat";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { Fade } from "@/components/ui/Fade";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { MultiSelectField } from "@/components/ui/FilterField";
import { LineTooltip, LINE_THEME, hexToRgba } from "@/components/charts/StandardLine";
import { PLANT_COLORS } from "@/lib/chartConfig";
import { trackFilterApplied, trackReportViewed } from "@/lib/analytics/events";
import {
  OutputFGCard, OutputCountCard,
  TacticalOutputTrendChart, TopLineByOutputTable,
  useOutputStats,
  type TacticalFilters,
} from "@/components/dashboard/TacticalView";
import { OutputMixRow } from "@/components/dashboard/OutputMixRow";
import { outputParams, togglePick, pickOpacity, type OutputPick } from "@/components/dashboard/outputPick";
import { ResponsiveBar } from "@nivo/bar";

type BaseFilters = { plant: string; startDate: string; endDate: string; period: string };

const DEFAULT_FILTERS: BaseFilters = {
  plant:     "All Plant",
  startDate: prodYearStart(),
  endDate:   prodToday(),
  period:    "YTD",
};

// ── OutputPlantBar ────────────────────────────────────────────────────────────
// Horizontal bar: output qty per plant, follows the FG/Bulk toggle and cross-filter.
// Clicking a bar picks that plant; every other Output chart on the page filters to it.

function OutputPlantBar({ data, loading, metric, pick, onPick }: {
  data: { name: string; qty: number }[];
  loading: boolean;
  metric: "fg" | "bulk";
  pick: OutputPick | null;
  onPick: (p: OutputPick) => void;
}) {
  const unit = metric === "bulk" ? "kg" : "pcs";
  const sorted = useMemo(
    () => [...data].filter((d) => d.qty > 0).sort((a, b) => b.qty - a.qty),
    [data],
  );
  const colorMap = useMemo(
    () => new Map(sorted.map((d, i) => [d.name, PLANT_COLORS[i % PLANT_COLORS.length] as string])),
    [sorted],
  );
  const fmtVal = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000   ? `${(v / 1_000).toFixed(0)}K`
    : String(Math.round(v));
  const chartHeight = Math.max(sorted.length * 44 + 48, 120);
  const maxQty = sorted.reduce((m, d) => Math.max(m, d.qty), 1);

  return (
    <div className="rounded-lg border border-[#EBEBEB] bg-white p-4" style={{ fontFamily: "Lato, sans-serif" }}>
      <div className="flex items-center gap-1.5 mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 flex-1">Output per Plant</p>
        <InfoTooltip
          text={`${metric === "bulk" ? "Bulk accepted (kg)" : "FG released (pcs)"} per plant in the selected period. Click a bar to filter all charts to that plant.`}
          size={13} width={240}
        />
      </div>
      {loading ? (
        <div style={{ height: chartHeight }} className="rounded bg-[#f9fafb] animate-pulse" />
      ) : sorted.length === 0 ? (
        <div style={{ height: chartHeight }} className="flex items-center justify-center">
          <p className="text-[11px] text-[#98a2b3]">No plant data for the selected period</p>
        </div>
      ) : (
        <Fade depKey={`${metric}|${sorted.map((d) => d.name + d.qty).join(",")}|${pick?.dim}:${pick?.value}`}>
          <div style={{ height: chartHeight }}>
            <ResponsiveBar
              data={sorted.map((d) => ({ plant: d.name, Qty: d.qty }))}
              keys={["Qty"]}
              indexBy="plant"
              layout="horizontal"
              theme={LINE_THEME}
              margin={{ top: 4, right: 70, bottom: 24, left: 60 }}
              padding={0.3}
              colors={(bar) => hexToRgba(
                colorMap.get(bar.indexValue as string) ?? "#1E4076",
                pickOpacity(pick, "plant", bar.indexValue as string),
              )}
              onClick={(bar) => onPick({ dim: "plant", value: bar.indexValue as string, label: `Plant: ${bar.indexValue}` })}
              borderRadius={2}
              enableLabel={false}
              enableGridY={false}
              valueScale={{ type: "linear", min: 0, max: maxQty * 1.3 }}
              axisLeft={{
                tickSize: 0, tickPadding: 8,
                renderTick: (tick) => (
                  <g transform={`translate(${tick.x},${tick.y})`}>
                    <text textAnchor="end" dominantBaseline="middle"
                      style={{ fontSize: 10.5, fill: "#667085", fontFamily: "inherit" }}>
                      {String(tick.value)}
                    </text>
                  </g>
                ),
              }}
              axisBottom={{ tickSize: 0, tickPadding: 6, format: (v) => fmtVal(Number(v)) }}
              layers={["grid", "axes", "bars", ({ bars: nivoBar }) => (
                <g>
                  {nivoBar.filter((b) => String(b.key).endsWith("Qty")).map((b, i) => {
                    const d = sorted[i];
                    if (!d) return null;
                    return (
                      <text
                        key={i}
                        x={b.x + b.width + 6}
                        y={b.y + b.height / 2}
                        dominantBaseline="middle"
                        style={{ fontSize: 10.5, fill: "#667085", fontFamily: "inherit", fontVariantNumeric: "tabular-nums" }}
                      >
                        {fmtVal(d.qty)}
                      </text>
                    );
                  })}
                </g>
              )]}
              tooltip={({ indexValue, data: d }) => (
                <LineTooltip
                  title={String(indexValue)}
                  rows={[{ label: "Output", value: Math.round(d.Qty as number).toLocaleString("en-US"), unit }]}
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

// ── OutputPoTable ─────────────────────────────────────────────────────────────
// Per-PO output table: sortable columns, plant multi-select filter, follows
// header filters + FG/Bulk toggle. Max 300 rows, newest first.

interface PoRow {
  po: string; skuCode: string; skuName: string; plant: string;
  qty: number; theoQty: number | null; gap: number | null; date: string; line: string;
}

function OutputPoTable({ filters, metric, pick }: {
  filters: TacticalFilters;
  metric: "fg" | "bulk";
  pick: OutputPick | null;
}) {
  const [rows, setRows]       = useState<PoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState<keyof PoRow>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [plantSel, setPlantSel] = useState<string[]>([]);
  useEffect(() => { setPlantSel([]); }, [metric]);

  useEffect(() => {
    setLoading(true);
    // PO table follows the global filters and pick, but owns nothing (always passes pick through)
    const params = outputParams(filters, pick, []);
    params.set("metric", metric);
    fetch(withBase(`/api/output/po-list?${params}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setRows(
        (d?.pos ?? []).map((r: { qty: number; theoQty: number | null } & Record<string, unknown>) => ({
          ...r,
          gap: r.theoQty != null ? r.qty - r.theoQty : null,
        } as PoRow)),
      ))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [filters.plant, filters.startDate, filters.endDate, filters.period, metric, pick]);

  const plantOptions = useMemo(
    () => [...new Set(rows.map((r) => r.plant))].filter(Boolean).sort().map((p) => ({ value: p, label: p })),
    [rows],
  );

  const sorted = useMemo(() => {
    const shown = plantSel.length ? rows.filter((r) => plantSel.includes(r.plant)) : rows;
    return [...shown].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      const na = Number(av), nb = Number(bv);
      const isNum = av != null && bv != null && !isNaN(na) && !isNaN(nb);
      if (isNum) return sortDir === "asc" ? na - nb : nb - na;
      return sortDir === "asc"
        ? String(av ?? "").localeCompare(String(bv ?? ""))
        : String(bv ?? "").localeCompare(String(av ?? ""));
    });
  }, [rows, plantSel, sortCol, sortDir]);

  const toggleSort = (col: keyof PoRow) => {
    if (col === sortCol) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("desc"); }
  };

  const TH = ({ col, label, right }: { col: keyof PoRow; label: string; right?: boolean }) => (
    <th
      onClick={() => toggleSort(col)}
      style={{
        padding: "7px 10px", fontSize: 10.5, fontWeight: 700, color: "white",
        textAlign: right ? "right" : "left", cursor: "pointer",
        background: "#1E4076", whiteSpace: "nowrap", userSelect: "none",
      }}
    >
      {label}{" "}
      <span style={{ opacity: sortCol === col ? 1 : 0.4 }}>
        {sortCol === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </th>
  );

  const unit = metric === "bulk" ? "kg" : "pcs";

  return (
    // No overflow-hidden on the card: the Plant dropdown must not be clipped (CLAUDE.md → Tooltips)
    <div className="rounded-lg border border-[#EBEBEB] bg-white" style={{ fontFamily: "Lato, sans-serif" }}>
      <div style={{ padding: "8px 13px", display: "flex", alignItems: "center", gap: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", flex: 1 }}>
          {metric === "bulk" ? "Output by PO (Bulk)" : "Output by PO (FG)"}
        </p>
        <div className="[&_[role=listbox]]:left-auto [&_[role=listbox]]:right-0">
          <MultiSelectField
            label="Plant" value={plantSel} options={plantOptions} onChange={setPlantSel}
            allLabel="All plants" width={130} loading={loading} hideLabel
          />
        </div>
        <InfoTooltip
          text={`Individual process orders with ${unit} output in the selected period. Max 300 rows, newest first.`}
          size={13} width={260}
        />
      </div>

      {loading ? (
        <div style={{ height: 300, background: "#f9fafb" }} className="animate-pulse rounded-b-lg" />
      ) : rows.length === 0 ? (
        <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#98a2b3", fontSize: 11 }}>
          No process orders in the selected period
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#98a2b3", fontSize: 11 }}>
          No process orders for the selected plants
        </div>
      ) : (
        <div className="rounded-b-lg" style={{ overflowX: "auto", overflowY: "auto", maxHeight: 320 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr>
                <TH col="po"      label="Process Order" />
                <TH col="skuName" label="SKU" />
                <TH col="plant"   label="Plant" />
                <TH col="qty"     label={metric === "bulk" ? "Realized (kg)" : "Released (pcs)"} right />
                {metric === "bulk" && <TH col="theoQty" label="Theoretical (kg)" right />}
                {metric === "bulk" && <TH col="gap"     label="Gap (kg)" right />}
                <TH col="date"    label="Date" />
                <TH col="line"    label="Line" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr key={`${row.po}-${i}`} style={{ background: i % 2 === 0 ? "white" : "#fafafa", borderBottom: "1px solid #f0f1f3" }}>
                  <td style={{ padding: "6px 10px", fontWeight: 700, color: "#1E4076", whiteSpace: "nowrap" }}>{row.po}</td>
                  <td style={{ padding: "6px 10px", color: "#344054", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      title={`${row.skuCode} · ${row.skuName}`}>
                    {row.skuName || row.skuCode}
                  </td>
                  <td style={{ padding: "6px 10px", color: "#344054" }}>{row.plant}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", color: "#344054", fontVariantNumeric: "tabular-nums" }}>
                    {Math.round(row.qty).toLocaleString("en-US")}
                  </td>
                  {metric === "bulk" && (
                    <td style={{ padding: "6px 10px", textAlign: "right", color: row.theoQty == null ? "#98a2b3" : "#344054", fontVariantNumeric: "tabular-nums" }}>
                      {row.theoQty == null ? "—" : Math.round(row.theoQty).toLocaleString("en-US")}
                    </td>
                  )}
                  {metric === "bulk" && (
                    <td style={{ padding: "6px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums",
                      color: row.gap == null ? "#98a2b3" : row.gap < 0 ? "#d92d20" : "#344054" }}>
                      {row.gap == null ? "—"
                        : row.gap >= 0 ? `+${Math.round(row.gap).toLocaleString("en-US")}`
                        : `−${Math.round(Math.abs(row.gap)).toLocaleString("en-US")}`}
                    </td>
                  )}
                  <td style={{ padding: "6px 10px", color: "#344054", whiteSpace: "nowrap" }}>{row.date}</td>
                  <td style={{ padding: "6px 10px", color: "#667085", whiteSpace: "nowrap" }}>{row.line}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OutputPage() {
  const { status } = useSession();
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = useState<Date>();
  const [filters, setFilters] = useState<BaseFilters>(() => {
    try {
      const stored = typeof window === "undefined" ? null : localStorage.getItem("ct-filters");
      if (!stored) return DEFAULT_FILTERS;
      const s = JSON.parse(stored) as Partial<BaseFilters>;
      return {
        plant:     s.plant     ?? DEFAULT_FILTERS.plant,
        startDate: s.startDate ?? DEFAULT_FILTERS.startDate,
        endDate:   s.endDate   ?? DEFAULT_FILTERS.endDate,
        period:    s.period    ?? DEFAULT_FILTERS.period,
      };
    } catch { return DEFAULT_FILTERS; }
  });
  const [plants, setPlants]   = useState<string[]>(["All Plant"]);
  const [metric, setMetric]   = useState<"fg" | "bulk">("fg");
  const [pick,   setPick]     = useState<OutputPick | null>(null);
  const onPick = useCallback((p: OutputPick) => setPick((cur) => togglePick(cur, p)), []);

  // Clear pick when header filters or metric change; Esc also clears
  useEffect(() => { setPick(null); }, [filters.plant, filters.startDate, filters.endDate, filters.period, metric]);
  useEffect(() => {
    if (!pick) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setPick(null); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [pick]);

  useEffect(() => { if (status === "unauthenticated") router.replace(withBase("/login")); }, [status, router]);
  useEffect(() => { setLastUpdated(new Date()); }, []);
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(withBase("/api/dashboard/plants"))
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d?.plants)) setPlants(d.plants); })
      .catch(() => {});
  }, [status]);
  useEffect(() => {
    if (status === "authenticated") trackReportViewed({ report: "output" });
  }, [status]);

  // KPI summary cards: always fetch both FG and Bulk totals (not filtered by pick)
  const fgStats   = useOutputStats(filters, "fg",   null, []);
  const bulkStats = useOutputStats(filters, "bulk", null, []);
  // Per-plant bar: follows the FG/Bulk toggle + pick; the bar itself owns "plant" picks so it stays full
  const plantStats = useOutputStats(filters, metric, pick, "plant");

  const tf: TacticalFilters = filters;

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA]">
        <div className="w-6 h-6 border-2 border-[#1E4076] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const cardsLoading = (fgStats.loading && !fgStats.data) || (bulkStats.loading && !bulkStats.data);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F8FA]">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          plants={plants}
          initialFilters={filters}
          onFilterChange={({ plant, startDate, endDate, period }) => {
            const next = { plant, startDate, endDate, period: period ?? "" };
            setFilters(next);
            try {
              const prev = JSON.parse(localStorage.getItem("ct-filters") ?? "{}");
              localStorage.setItem("ct-filters", JSON.stringify({ ...prev, ...next }));
            } catch { /* ignore */ }
            setLastUpdated(new Date());
            trackFilterApplied("output", "apply", { period: period ?? "", plant: plant ?? "All" });
          }}
          views={[]}
          activeView=""
          onViewChange={() => {}}
          onRefresh={() => setLastUpdated(new Date())}
          isLoading={false}
          lastUpdated={lastUpdated}
          alertCount={0}
          alerts={[]}
          pageTitle="Output"
        />

        <main className="flex-1 overflow-y-auto min-h-0 px-5 py-4 flex flex-col gap-4">

          {/* ── 4 KPI summary cards (always both FG and Bulk, no pick influence) ── */}
          <div className="grid grid-cols-4 gap-3">
            {cardsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-[#EBEBEB] bg-white h-[150px] animate-pulse" />
              ))
            ) : (
              <>
                <OutputFGCard
                  metric="fg"
                  qty={fgStats.data?.total ?? 0}
                  trend={fgStats.data?.trend ?? null}
                  theoretical={null}
                  noData={!fgStats.data}
                />
                <OutputFGCard
                  metric="bulk"
                  qty={bulkStats.data?.total ?? 0}
                  trend={bulkStats.data?.trend ?? null}
                  theoretical={bulkStats.data?.theoretical}
                  noData={!bulkStats.data}
                />
                <OutputCountCard
                  metric="fg"
                  skuCount={fgStats.data?.skuCount}
                  poCount={fgStats.data?.poCount}
                  noData={!fgStats.data}
                />
                <OutputCountCard
                  metric="bulk"
                  skuCount={bulkStats.data?.skuCount}
                  poCount={bulkStats.data?.poCount}
                  noData={!bulkStats.data}
                />
              </>
            )}
          </div>

          {/* ── FG / Bulk toggle + active pick chip ───────────────────────────── */}
          <div className="flex items-center gap-3 flex-wrap">
            <SegmentedToggle<"fg" | "bulk">
              ariaLabel="Output metric"
              options={[{ key: "fg", label: "Finished Goods" }, { key: "bulk", label: "Bulk" }]}
              value={metric}
              onChange={setMetric}
            />
            {pick && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-[#C3CEE3] bg-[#EEF4FB] pl-2.5 pr-1 py-0.5 text-[11px] text-[#16305C]"
                style={{ fontFamily: "Lato, sans-serif" }}
              >
                <span className="text-slate-500">Filtered by</span>
                <span className="font-bold max-w-[320px] truncate">{pick.label}</span>
                <button
                  type="button"
                  onClick={() => setPick(null)}
                  aria-label="Clear filter"
                  title="Clear filter"
                  className="rounded-full w-4 h-4 inline-flex items-center justify-center hover:bg-[#C3CEE3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1E4076]"
                >
                  ×
                </button>
              </span>
            )}
          </div>

          {/* ── Trend chart · per-plant horizontal bar ────────────────────────── */}
          <div className="grid grid-cols-[3fr_2fr] gap-4">
            <TacticalOutputTrendChart filters={tf} metric={metric} pick={pick} onPick={onPick} />
            <OutputPlantBar
              data={plantStats.data?.byPlant ?? []}
              loading={plantStats.loading && !plantStats.data}
              metric={metric}
              pick={pick}
              onPick={onPick}
            />
          </div>

          {/* ── Brand / variant treemap · top SKU table ───────────────────────── */}
          <OutputMixRow filters={tf} metric={metric} pick={pick} onPick={onPick} hideSku />

          {/* ── Output by line · Output by PO ─────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 pb-4">
            <TopLineByOutputTable filters={tf} metric={metric} pick={pick} onPick={onPick} />
            <OutputPoTable filters={tf} metric={metric} pick={pick} />
          </div>

        </main>
      </div>

      <FloatingChat filters={filters} />
    </div>
  );
}
