"use client";

// Lead Time page → Analysis tab: "Group process and process" sunburst (custom SVG — two rings, no chart library needed).
// Rules (agreed with the user, shown in the info tooltip):
//   Formula      — time of each group process and process = sum of its time per PO (÷ all POs); slice width = that time.
//   Reading      — inner ring = group process, outer ring = the processes of that group.
//   Interaction  — click a group to zoom into its processes; click the centre or "All groups" to go back.
//   Small slices — merged into "Others" in the ring; the list on the right lists every process when zoomed.
//   Labels       — each slice shows its time with the unit (days / hours) on a second line inside the ring when the slice is wide enough for the text.
//   Scope        — follows Scope, Basis and Unit above. The PO group is left out when Scope = PO Released.
// Gross = span of the activity (first start → last stop); Nett = SUM(NET_LEADTIME). Data: /api/lead-time/analysis.

import { useEffect, useMemo, useRef, useState } from "react";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { LineTooltip } from "@/components/charts/StandardLine";
import { activityLabel, PROCESS_GROUPS, type ProcessGroupId } from "@/lib/leadTimeStages";
import { fmtLt } from "@/components/leadtime/LeadTimeSummaryCards";
import type { LtBasis, LtScope, LtUnit } from "@/components/leadtime/LeadTimeFilterCard";

export interface ActivityTime { stage: string; activity: string; sequence: number | null; gross: number; nett: number }

// Group colours: navy family for the production flow, slate for PO, brick for WIP (waiting)
const GROUP_COLOR: Record<ProcessGroupId, string> = {
  po: "#4B5A70", weighing: "#1E4076", mixing: "#3F6CB0", filpac: "#7E9FD1", ndc: "#AFC0DA", wip: "#A23B32",
};
const SMALL_SHARE = 0.015; // outer-ring slices below 1.5% of the ring merge into "Others"

/** Mix a hex colour with white (t = 0 … 1). */
function tint(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

/** Readable text colour on a slice fill (hex or rgb()): white on dark fills, navy-black on light ones. */
function labelColor(fill: string) {
  const [r, g, b] = fill.startsWith("#")
    ? [0, 8, 16].map((sh) => (parseInt(fill.slice(1), 16) >> (16 - sh)) & 255)
    : (fill.match(/\d+/g) ?? ["0", "0", "0"]).map(Number);
  return 0.299 * r + 0.587 * g + 0.114 * b > 165 ? "#16305C" : "#ffffff";
}

// Value labels inside the rings: only on slices wide enough to hold the text (arc length at mid-radius)
const MIN_LABEL_ARC = 44;

function SliceLabel({ s, r0, r1, unit }: { s: Slice; r0: number; r1: number; unit: LtUnit }) {
  const mid = (s.a0 + s.a1) / 2, rm = (r0 + r1) / 2;
  if ((s.a1 - s.a0) * rm < MIN_LABEL_ARC) return null;
  const x = C + rm * Math.sin(mid), y = C - rm * Math.cos(mid), fill = labelColor(s.color);
  return (
    <text x={x} y={y} textAnchor="middle" style={{ fill, pointerEvents: "none", fontVariantNumeric: "tabular-nums" }}>
      <tspan x={x} dy={-1} style={{ fontSize: 10, fontWeight: 700 }}>{fmtLt(s.value, unit)}</tspan>
      <tspan x={x} dy={10} style={{ fontSize: 8, fontWeight: 400 }}>{unit}</tspan>
    </text>
  );
}

function arc(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  // A (near-)full circle is drawn as two halves: an SVG arc whose start and end almost meet renders unreliably
  // (it flipped for a frame at the end of the drill-down tween)
  if (a1 - a0 >= Math.PI * 2 - 0.02) {
    return `${arc(cx, cy, r0, r1, a0, a0 + Math.PI)} ${arc(cx, cy, r0, r1, a0 + Math.PI, a0 + Math.PI * 2)}`;
  }
  const p = (r: number, a: number) => `${(cx + r * Math.sin(a)).toFixed(2)} ${(cy - r * Math.cos(a)).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 ${large} 0 ${p(r0, a0)} Z`;
}

interface Slice { key: string; label: string; value: number; color: string; group: ProcessGroupId; a0: number; a1: number; members?: string[] }

const SIZE = 320, C = SIZE / 2, R_IN0 = 72, R_IN1 = 112, R_OUT0 = 115, R_OUT1 = 156;

export function ProcessSunburst({ activities, basis, scope, unit, onlyActivity, loading }: {
  activities: ActivityTime[]; basis: LtBasis; scope: LtScope; unit: LtUnit; onlyActivity?: string; loading: boolean;
}) {
  const [zoom, setZoom] = useState<ProcessGroupId | null>(null);
  const [hover, setHover] = useState<{ clientX: number; clientY: number; slice: Slice } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // Groups with their processes (process order), values in days for the chosen basis
  const groups = useMemo(() => PROCESS_GROUPS
    .filter((g) => !(scope === "released" && g.id === "po"))
    .map((g) => {
      const procs = activities
        .filter((a) => (g.stages as readonly string[]).includes(a.stage) && (!onlyActivity || a.activity === onlyActivity))
        .map((a) => ({ activity: a.activity, label: activityLabel(a.activity), sequence: a.sequence ?? 999, value: Math.max(0, basis === "gross" ? a.gross : a.nett) }))
        .filter((p) => p.value > 0)
        .sort((a, b) => a.sequence - b.sequence);
      return { id: g.id, label: g.label, procs, value: procs.reduce((s, p) => s + p.value, 0) };
    })
    .filter((g) => g.value > 0), [activities, basis, scope, onlyActivity]);

  const total = groups.reduce((s, g) => s + g.value, 0);
  const zoomed = zoom ? groups.find((g) => g.id === zoom) ?? null : null;
  const shown = zoomed ? [zoomed] : groups;
  const ringTotal = zoomed ? zoomed.value : total;

  // Inner + outer slices; colorOf = activity → colour of the slice it is drawn in (its own, or its group's "Others")
  const { inner, outer, colorOf } = useMemo(() => {
    const inner: Slice[] = [], outer: Slice[] = [];
    const colorOf = new Map<string, string>();
    let a = 0;
    for (const g of shown) {
      const span = ringTotal > 0 ? (g.value / ringTotal) * Math.PI * 2 : 0;
      inner.push({ key: g.id, label: g.label, value: g.value, color: GROUP_COLOR[g.id], group: g.id, a0: a, a1: a + span });
      let b = a;
      const small = g.procs.filter((p) => p.value / ringTotal < SMALL_SHARE);
      const big = g.procs.filter((p) => p.value / ringTotal >= SMALL_SHARE);
      const list = [...big.map((p) => ({ key: p.activity, label: p.label, value: p.value }))];
      if (small.length > 0) list.push({ key: `${g.id}__others`, label: small.length === 1 ? small[0].label : `Others (${small.length} processes)`, value: small.reduce((s, p) => s + p.value, 0) });
      list.forEach((p, i) => {
        const s = (p.value / ringTotal) * Math.PI * 2;
        const color = tint(GROUP_COLOR[g.id], Math.min(0.15 + (i / Math.max(list.length, 1)) * 0.6, 0.75));
        const isOthers = p.key.endsWith("__others");
        outer.push({
          key: p.key, label: p.label, value: p.value, group: g.id, a0: b, a1: b + s, color,
          members: isOthers ? small.map((x) => x.label) : undefined,
        });
        if (isOthers) small.forEach((x) => colorOf.set(x.activity, color));
        else colorOf.set(p.key, color);
        b += s;
      });
      a += span;
    }
    return { inner, outer, colorOf };
  }, [shown, ringTotal]);

  // Drill-down / back: slice angles tween from the current layout to the new one (zoomed group opens to the full
  // circle, the others close up), 450 ms ease-in-out. New slices grow from zero width, removed ones shrink to zero.
  const drawnInner = useAngleTween(inner);
  const drawnOuter = useAngleTween(outer);

  const onMove = (e: React.MouseEvent, slice: Slice) => {
    setHover({ clientX: e.clientX, clientY: e.clientY, slice });
  };
  const pct = (v: number, of: number) => (of > 0 ? `${((v / of) * 100).toFixed(0)}%` : "—");
  const legendRows = zoomed
    ? zoomed.procs.map((p) => ({ key: p.activity, label: p.label, value: p.value, of: zoomed.value, color: colorOf.get(p.activity) ?? GROUP_COLOR[zoomed.id], click: undefined as undefined | (() => void) }))
    : groups.map((g) => ({ key: g.id, label: g.label, value: g.value, of: total, color: GROUP_COLOR[g.id], click: () => setZoom(g.id) }));

  return (
    <div className="rounded-lg border border-[#EBEBEB] bg-white h-full flex flex-col">
      <div className="px-4 pt-3 flex items-center gap-1.5">
        <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-slate-500">Group process and process</span>
        <InfoTooltip size={12} width={340} rows={[
          { label: "Formula", text: "Time of each group process and process = sum of its time per PO. Slice width = that time." },
          { label: "Reading", text: "Inner ring = group process. Outer ring = the processes in that group." },
          { label: "Interaction", text: "Click a group to zoom into its processes; click the centre or \"All groups\" to go back." },
          { label: "Small slices", text: "Merged into \"Others\" in the ring; the list on the right shows every process when zoomed." },
          { label: "Scope", text: "Follows Scope, Basis and Unit above. The PO group is left out for PO Released." },
          { label: "Gross / Nett", text: "Gross = span of each activity (first start → last stop). Nett = active time. Parallel activities make the total larger than the lead time." },
        ]} />
      </div>

      {loading ? (
        <div className="flex-1 min-h-[280px] flex items-center justify-center"><div className="w-[240px] h-[240px] rounded-full bg-slate-50 animate-pulse" /></div>
      ) : total <= 0 ? (
        <div className="flex-1 min-h-[280px] flex items-center justify-center text-[11px] text-slate-400">No process time for the selected filters</div>
      ) : (
        <div className="flex-1 flex items-center justify-center gap-10 px-8 py-4">
          {/* Donut and legend as one centred block: the donut grows with the card (up to 380px), the legend keeps a
              readable width — balanced margins left/right and less empty space above/below */}
          <div ref={box} className="relative shrink-0 w-[clamp(240px,46%,380px)] aspect-square" onMouseLeave={() => setHover(null)}>
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full" role="img" aria-label="Lead time by group process and process">
              {drawnInner.map((s) => (
                <path key={s.key} d={arc(C, C, R_IN0, R_IN1, s.a0, s.a1)} fill={s.color} stroke="white" strokeWidth={1.5}
                  className={zoomed ? "cursor-pointer" : "cursor-zoom-in"}
                  onClick={() => setZoom(zoomed ? null : s.group)} onMouseMove={(e) => onMove(e, s)} />
              ))}
              {drawnOuter.map((s) => (
                <path key={s.key} d={arc(C, C, R_OUT0, R_OUT1, s.a0, s.a1)} fill={s.color} stroke="white" strokeWidth={1}
                  className={zoomed ? "" : "cursor-zoom-in"}
                  onClick={() => { if (!zoomed) setZoom(s.group); }} onMouseMove={(e) => onMove(e, s)} />
              ))}
              {/* Value of each slice inside the ring (time in the chosen unit); hidden on slices too narrow for the text */}
              {drawnInner.map((s) => <SliceLabel key={`l-${s.key}`} s={s} r0={R_IN0} r1={R_IN1} unit={unit} />)}
              {drawnOuter.map((s) => <SliceLabel key={`l-${s.key}`} s={s} r0={R_OUT0} r1={R_OUT1} unit={unit} />)}
              {/* Centre: total (or the zoomed group); click to go back */}
              <g key={zoom ?? "all"} onClick={() => setZoom(null)} className={`ui-fade-in ${zoomed ? "cursor-pointer" : ""}`}>
                <circle cx={C} cy={C} r={R_IN0 - 3} fill="white" />
                <text x={C} y={C - 4} textAnchor="middle" style={{ fontSize: 26, fontWeight: 700, fill: "#101828" }}>{fmtLt(ringTotal, unit)}</text>
                <text x={C} y={C + 14} textAnchor="middle" style={{ fontSize: 11, fill: "#475467", fontWeight: 700 }}>{unit}</text>
                <text x={C} y={C + 28} textAnchor="middle" style={{ fontSize: 9.5, fill: "#98a2b3" }}>{zoomed ? `${zoomed.label} · back` : "total time"}</text>
              </g>
            </svg>
            {hover && (
              <div className="pointer-events-none fixed z-[9999]" style={{ left: hover.clientX + 12, top: hover.clientY + 12 }}>
                <LineTooltip
                  title={hover.slice.label}
                  subtitle={PROCESS_GROUPS.find((g) => g.id === hover.slice.group)?.label}
                  rows={[
                    { label: basis === "gross" ? "Gross time" : "Nett time", color: hover.slice.color, value: fmtLt(hover.slice.value, unit), unit, strong: true },
                    { label: zoomed ? "Share of group" : "Share of total", value: pct(hover.slice.value, ringTotal) },
                    ...(hover.slice.members ? [{ label: "Includes", value: hover.slice.members.slice(0, 4).join(", ") + (hover.slice.members.length > 4 ? "…" : "") }] : []),
                  ]}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 min-w-[220px] flex-1 max-w-[340px]">
            {zoomed && (
              <div className="flex items-center gap-1 text-[11px]">
                <button onClick={() => setZoom(null)} className="font-semibold text-[#1E4076] hover:underline">All groups</button>
                <span className="text-slate-300">›</span>
                <span className="font-semibold text-slate-700">{zoomed.label}</span>
              </div>
            )}
            {/* Compact and scrollable, so a long group (WIP has ~22 processes) never grows the card */}
            <div key={zoom ?? "all"} className="ui-fade-in flex flex-col max-h-[300px] overflow-y-auto pr-1">
              {legendRows.map((r, i) => (
                <button key={r.key} onClick={r.click} disabled={!r.click}
                  className={`flex items-center gap-2 py-1 text-left shrink-0 ${i > 0 ? "border-t border-slate-100" : ""} ${r.click ? "hover:bg-slate-50 cursor-zoom-in" : "cursor-default"}`}>
                  <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: r.color }} />
                  <span className="flex-1 min-w-0 truncate text-[11px] text-slate-700" title={r.label}>{r.label}</span>
                  <span className="text-[11px] font-bold text-slate-900 tabular-nums">{fmtLt(r.value, unit)}</span>
                  <span className="w-9 text-right text-[10.5px] text-slate-400 tabular-nums">{pct(r.value, r.of)}</span>
                </button>
              ))}
            </div>
            <p className="rounded-md bg-slate-50 px-2.5 py-1.5 text-[10.5px] text-slate-500 leading-snug">
              {zoomed
                ? "Every process of this group is listed. Click the centre or All groups to go back."
                : "Click a group to zoom into its processes. Hover a slice to see its time."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const TWEEN_MS = 450;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Animate slice angles between layouts; returns the slices to draw for the current frame. */
function useAngleTween(target: Slice[]): Slice[] {
  const [drawn, setDrawn] = useState<Slice[]>(target);
  const drawnRef = useRef<Slice[]>(target);
  const mounted = useRef(false);
  const sig = target.map((t) => `${t.key}:${t.a0.toFixed(4)}:${t.a1.toFixed(4)}`).join("|");

  useEffect(() => {
    const from = new Map(drawnRef.current.map((s) => [s.key, s]));
    const to = new Map(target.map((s) => [s.key, s]));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // First paint: no tween (the card itself fades in); later changes animate
    if (!mounted.current || reduce || drawnRef.current.length === 0) {
      mounted.current = true;
      drawnRef.current = target; setDrawn(target); return;
    }

    // Pairs of start → end angles over the union of keys
    const pairs: { start: Slice; end: Slice }[] = [];
    for (const t of target) {
      const f = from.get(t.key);
      pairs.push({ start: f ?? { ...t, a1: t.a0 }, end: t });
    }
    for (const f of drawnRef.current) {
      if (!to.has(f.key) && f.a1 - f.a0 > 1e-4) pairs.push({ start: f, end: { ...f, a1: f.a0 } });
    }

    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = easeInOut(Math.min(1, (now - t0) / TWEEN_MS));
      const frame = pairs.map(({ start, end }) => ({
        ...end,
        color: end === start ? end.color : (to.has(end.key) ? end.color : start.color),
        a0: start.a0 + (end.a0 - start.a0) * k,
        a1: start.a1 + (end.a1 - start.a1) * k,
      }));
      drawnRef.current = frame;
      setDrawn(frame);
      if (k < 1) raf = requestAnimationFrame(step);
      else { drawnRef.current = target; setDrawn(target); }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return drawn.filter((s) => s.a1 - s.a0 > 1e-4);
}
