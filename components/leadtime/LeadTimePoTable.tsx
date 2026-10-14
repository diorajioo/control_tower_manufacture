"use client";

// Lead Time page → Analysis tab: "Lead time per PO" table under the distribution histogram.
// Default = every PO in the histogram; a clicked histogram bar (`bin`) narrows it to the POs in that bin
// (binned on the histogram's metric with the same rule as the SQL — binOf()). Sortable columns, gross desc by default.
// ~20k rows: rendered in pages of 200 as the user scrolls. Scroll area 280px = the histogram plot height. Data: /api/lead-time/po-list.

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { binLabel, binOf } from "@/components/leadtime/LeadTimeHistogram";
import type { LtUnit } from "@/components/leadtime/LeadTimeFilterCard";

/** API shape (app/api/lead-time/po-list): rows in `columns` order, SKU names in `skus`. */
export interface PoListResponse {
  columns: readonly string[];
  skus: Record<string, string>;
  rows: (string | number | null)[][];
}

type ColKey = "po" | "sku" | "gross" | "nett" | "g0" | "g1" | "g2" | "g3" | "g4" | "g5";
interface Row { po: string; sku: string | null; name: string; gross: number | null; nett: number | null; groups: (number | null)[] }

const GROUP_LABELS = ["PO", "Weighing", "Mixing", "Filpac", "Receive NDC", "WIP"];
const PAGE = 200;

export function LeadTimePoTable({ data, loading, unit, metric, bin, onClearBin }: {
  data: PoListResponse | null;
  loading: boolean;
  unit: LtUnit;
  /** Histogram metric — the bin filter uses this value */
  metric: "gross" | "nett";
  /** Selected histogram bin (start, days); null = all POs */
  bin: number | null;
  onClearBin: () => void;
}) {
  const [sort, setSort] = useState<{ key: ColKey; dir: "asc" | "desc" }>({ key: metric, dir: "desc" });
  const [shown, setShown] = useState(PAGE);
  const scroller = useRef<HTMLDivElement>(null);
  const f = unit === "hours" ? 24 : 1;
  const unitLabel = unit === "hours" ? "hours" : "days";

  useEffect(() => { setSort({ key: metric, dir: "desc" }); }, [metric]);

  const all: Row[] = useMemo(() => (data?.rows ?? []).map((r) => ({
    po: String(r[0]),
    sku: r[1] == null ? null : String(r[1]),
    name: r[1] != null ? data?.skus[String(r[1])] ?? String(r[1]) : "—",
    gross: r[2] as number | null,
    nett: r[3] as number | null,
    groups: r.slice(4, 10) as (number | null)[],
  })), [data]);

  // Population of the histogram (rows with a value for its metric), then the bin filter
  const filtered = useMemo(() => all.filter((r) => {
    const v = r[metric];
    return v != null && (bin == null || binOf(v) === bin);
  }), [all, metric, bin]);

  const sorted = useMemo(() => {
    const val = (r: Row): string | number | null => {
      switch (sort.key) {
        case "po": return r.po;
        case "sku": return r.name;
        case "gross": return r.gross;
        case "nett": return r.nett;
        default: return r.groups[Number(sort.key.slice(1))];
      }
    };
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const x = val(a), y = val(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;   // empty values last in both directions
      if (y == null) return -1;
      return (typeof x === "string" ? x.localeCompare(String(y)) : (x as number) - (y as number)) * sign;
    });
  }, [filtered, sort]);

  // Back to the top and the first page whenever the list changes
  useEffect(() => {
    setShown(PAGE);
    scroller.current?.scrollTo({ top: 0 });
  }, [bin, sort, metric, data]);

  const onScroll = () => {
    const el = scroller.current;
    if (el && el.scrollTop + el.clientHeight > el.scrollHeight - 300 && shown < sorted.length) setShown((n) => n + PAGE);
  };

  const fmt = (d: number | null) => (d == null ? "—" : (d * f).toFixed(2));
  const toggleSort = (key: ColKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "po" || key === "sku" ? "asc" : "desc" }));

  // One-line headers, same height for every column; unit once in the title. Text columns left, numbers right
  // (header aligned with its values). No. PO and SKU have fixed widths; the 8 number columns share the rest equally.
  const cols: { key: ColKey; label: string; align: "left" | "right"; width?: number }[] = [
    { key: "po", label: "No. PO", align: "left", width: 112 },
    { key: "sku", label: "SKU", align: "left", width: 240 },
    { key: "gross", label: "Gross", align: "right" },
    { key: "nett", label: "Nett", align: "right" },
    ...GROUP_LABELS.map((l, i) => ({ key: `g${i}` as ColKey, label: l, align: "right" as const })),
  ];

  return (
    <div className="rounded-lg border border-[#EBEBEB] bg-white p-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Lead Time per PO <span className="normal-case font-normal tracking-normal text-slate-400">({unitLabel})</span>
          </p>
          <InfoTooltip
            size={13}
            width={280}
            text={`Every PO in the distribution above. Click a bar in the chart to list only its POs. Gross = start (PO Created or Released) → Receive NDC; Nett = active time. Process columns = ${metric} time per process group (sum over its activities), so they can add up to more than the lead time when activities run in parallel.`}
          />
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          {bin != null && (
            <span className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1 rounded-md border border-[#C3CEE3] bg-[#EEF4FB] text-[#16305C] font-semibold">
              {metric === "gross" ? "Gross" : "Nett"} {binLabel(bin, unit)} {unitLabel}
              <button onClick={onClearBin} aria-label="Show all POs" title="Show all POs"
                className="w-5 h-5 inline-flex items-center justify-center rounded hover:bg-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4076]/40">
                <X size={11} />
              </button>
            </span>
          )}
          <span className="text-slate-500 tabular-nums">
            {loading ? "Loading…" : `${sorted.length.toLocaleString("en-US")} PO${bin != null ? ` of ${all.filter((r) => r[metric] != null).length.toLocaleString("en-US")}` : ""}`}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="h-[280px] bg-gray-50 rounded animate-pulse" />
      ) : sorted.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-[11px] text-slate-400">No POs for the selected filters</div>
      ) : (
        <div ref={scroller} onScroll={onScroll} className="max-h-[280px] overflow-auto rounded-md">
          <table className="w-full border-separate border-spacing-0 text-[10.5px]" style={{ tableLayout: "fixed", minWidth: 980 }}>
            <thead className="sticky top-0 z-10">
              <tr>
                {cols.map((c) => {
                  const on = sort.key === c.key;
                  return (
                    <th key={c.key} style={{ width: c.width }} aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      className={cn("bg-[#1E4076] h-8 px-2.5 first:rounded-tl-md last:rounded-tr-md font-bold text-white text-[10px] whitespace-nowrap align-middle", c.align === "right" ? "text-right" : "text-left")}>
                      <button onClick={() => toggleSort(c.key)} title={`Sort by ${c.label}`}
                        className={cn("inline-flex items-center gap-1 hover:text-white/80 focus:outline-none focus-visible:underline", c.align === "right" && "flex-row-reverse")}>
                        <span>{c.label}</span>
                        {/* Arrow slot always reserved so labels do not shift when the sort changes */}
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
                <tr key={r.po} className="hover:bg-[#F7F9FC] [&>td]:border-b [&>td]:border-[#EEF0F3]">
                  <td className="px-2.5 py-1.5 text-[#1E4076] tabular-nums whitespace-nowrap">{r.po}</td>
                  <td className="px-2.5 py-1.5 text-[#1E4076] truncate" title={r.sku ? `${r.sku} · ${r.name}` : undefined}>{r.name}</td>
                  <td className={cn("px-2.5 py-1.5 text-right tabular-nums", metric === "gross" ? "font-bold text-slate-900" : "text-slate-700")}>{fmt(r.gross)}</td>
                  <td className={cn("px-2.5 py-1.5 text-right tabular-nums", metric === "nett" ? "font-bold text-slate-900" : "text-slate-700")}>{fmt(r.nett)}</td>
                  {r.groups.map((g, i) => (
                    <td key={i} className="px-2.5 py-1.5 text-right tabular-nums text-slate-700">{fmt(g)}</td>
                  ))}
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
