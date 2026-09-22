"use client";

import { useState, useEffect, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────
type WasteClass = "VA" | "NNVA" | "UNVA";
interface Stage    { name: string; value: number; cls: WasteClass }
interface SkuRow   { name: string; ltPo: number; ltRel: number; vol: number }
interface ParetoRow{ sku: string; va: number; nnva: number; unva: number }

// ── Palette ───────────────────────────────────────────────────────────────
const P = {
  va:     "#3b82f6", nnva: "#f59e0b", unva: "#ef4444", ontgt: "#10b981",
  crit:   "#b42318", warn: "#b45309", good: "#067647", accent: "#2f5d8f",
  page:   "#eef1f5", surface: "#fff", border: "#e4e7ec", hair: "#f2f4f7",
  ink:    "#101828", body: "#344054", muted: "#667085", faint: "#98a2b3",
  toolbar:"#101828", tbDiv: "#344054",
} as const;
const MN = "ui-monospace,'Cascadia Code','Courier New',monospace";

function cls2color(c: WasteClass) {
  return c === "VA" ? P.va : c === "NNVA" ? P.nnva : P.unva;
}

// ── Single-source constants ───────────────────────────────────────────────
const TARGET       = 13.0;
const GROSS_LT     = 19.03;
const PRIOR_LT     = 18.4;
const N_BATCHES    = 412;
const VA_D         = 2.84;
const NNVA_D       = 0.60;
const UNVA_D       = 15.59;
const SAVINGS_D    = 10.91;
const ONTIME_TGT   = 90;
const PARETO_AXIS  = 32;

// ── Stage data ────────────────────────────────────────────────────────────
const STAGES_GROUP: Stage[] = [
  { name: "PO & Approval", value: 6.75, cls: "UNVA" },
  { name: "Produksi",      value: 2.84, cls: "VA"   },
  { name: "QC & NDC",      value: 0.60, cls: "NNVA" },
  { name: "WIP Waiting",   value: 8.84, cls: "UNVA" },
];
const STAGES_ACTIVITY: Stage[] = [
  { name: "PO issue",       value: 1.20, cls: "NNVA" },
  { name: "Approval wait",  value: 5.55, cls: "UNVA" },
  { name: "Mixing",         value: 1.62, cls: "VA"   },
  { name: "Filling & pack", value: 1.22, cls: "VA"   },
  { name: "QC test",        value: 0.60, cls: "NNVA" },
  { name: "WIP queue",      value: 8.84, cls: "UNVA" },
];

// ── On-time trend ─────────────────────────────────────────────────────────
const ONTIME = [
  { mo: "Jan", v: 72 }, { mo: "Feb", v: 70 }, { mo: "Mar", v: 76 },
  { mo: "Apr", v: 71 }, { mo: "May", v: 78 }, { mo: "Jun", v: 80 },
  { mo: "Jul", v: 77 },
];
const ONTIME_AVG = Math.round(ONTIME.reduce((s, d) => s + d.v, 0) / ONTIME.length);
const ONTIME_BEST = ONTIME.reduce((a, b) => a.v > b.v ? a : b);
const ONTIME_WRST = ONTIME.reduce((a, b) => a.v < b.v ? a : b);
const ONTIME_BELOW = ONTIME.filter(d => d.v < ONTIME_TGT).length;

// ── Pareto ────────────────────────────────────────────────────────────────
const PARETO: ParetoRow[] = [
  { sku: "OMG MATTELAST LIP CREAM 14 CAPPUCCINO", va:1.9, nnva:4.1,  unva:20.73 },
  { sku: "OMG MATTELAST LIP CREAM 15 ESPRESSO",   va:1.8, nnva:3.6,  unva:18.58 },
  { sku: "OMG MATTELAST LIP CREAM 13 LATTE",      va:1.7, nnva:3.4,  unva:18.62 },
  { sku: "OMG MATTELAST LIP CREAM 12 SCARLET",    va:1.6, nnva:2.9,  unva:14.97 },
  { sku: "WARDAH UV SHIELD BRIGHT-C SERUM",       va:1.5, nnva:2.4,  unva:12.16 },
  { sku: "KAHF TRIPLE ACTION FACE WASH 100",      va:1.4, nnva:2.0,  unva:9.79  },
  { sku: "EMINA SUN BATTLE SPF 35",               va:1.3, nnva:1.9,  unva:9.58  },
  { sku: "KAHF SKIN ENERGIZING FACE WASH 100ML",  va:1.3, nnva:1.8,  unva:9.55  },
  { sku: "EMINA BRIGHT STUFF NIACINAMIDE",        va:1.2, nnva:1.7,  unva:9.67  },
  { sku: "KAHF BRIGHTENING & DARK SPOT SCRUB",    va:1.2, nnva:1.6,  unva:9.39  },
];

// ── SKU tables ────────────────────────────────────────────────────────────
const TOP5: SkuRow[] = [
  { name: "KAHF SKIN ENERGIZING AND BRIGHTENING FACE WASH 100ML",  ltPo:12.65, ltRel:5.13,  vol:6412675 },
  { name: "OMG MATTELAST LIP CREAM 12 SCARLET 2.9G",               ltPo:19.47, ltRel:14.42, vol:6315600 },
  { name: "OMG MATTELAST LIP CREAM 15 ESPRESSO 2.9G",              ltPo:23.98, ltRel:15.30, vol:5873568 },
  { name: "OMG MATTELAST LIP CREAM 14 CAPPUCCINO 2.9G",            ltPo:26.73, ltRel:17.92, vol:5431440 },
  { name: "OMG MATTELAST LIP CREAM 13 LATTE 2.9G",                 ltPo:23.72, ltRel:16.76, vol:5100084 },
];
const BOT5: SkuRow[] = [
  { name: "WARDAH UV SHIELD BRIGHT-C HYDRATING SUNSCREEN SERUM SP", ltPo:16.06, ltRel:10.87, vol:3447164 },
  { name: "EMINA SUN BATTLE SPF 35 PA+++ BRIGHT GLOW AMINO + VIT C",ltPo:12.78, ltRel:5.89,  vol:2458750 },
  { name: "EMINA BRIGHT STUFF NIACINAMIDE OXY CERAMIDE",            ltPo:12.57, ltRel:5.41,  vol:2321820 },
  { name: "KAHF TRIPLE ACTION OIL AND COMEDO DEFENSE FACE WASH 100", ltPo:13.19, ltRel:6.07,  vol:2184495 },
  { name: "KAHF BRIGHTENING AND DARK SPOT SCRUB FACE WASH 100ML",   ltPo:12.19, ltRel:6.02,  vol:2104125 },
];

// ── Sparklines ────────────────────────────────────────────────────────────
const SPK = {
  grossLt: [18.2, 19.1, 18.8, 17.9, 19.4, 18.6, 19.0, 19.03],
  unvaWst: [79.1, 80.3, 79.8, 81.0, 82.1, 80.5, 81.7, 81.9 ],
  vaAdd:   [15.8, 14.9, 15.2, 14.7, 15.1, 14.5, 14.8, 14.9 ],
  wipWait: [8.2,  8.9,  8.5,  8.7,  9.1,  8.6,  8.9,  8.84 ],
  onTime:  [72,   70,   76,   71,   78,   80,   77,   75   ],
  savings: [10.3, 10.5, 10.6, 10.8, 10.7, 10.9, 11.0, 10.91],
};

// ── Computed ──────────────────────────────────────────────────────────────
const VA_PCT   = +(VA_D   / GROSS_LT * 100).toFixed(1);
const NNVA_PCT = +(NNVA_D / GROSS_LT * 100).toFixed(1);
const UNVA_PCT = +(UNVA_D / GROSS_LT * 100).toFixed(1);
const UNVA_OVER_PCT = +(UNVA_PCT - 40).toFixed(0); // over 40% limit

function paretoSavings() {
  const saved = PARETO.slice(0, 3).reduce((s, d) => s + Math.max(0, (d.va + d.nnva + d.unva) - TARGET), 0);
  return +(saved / PARETO.length).toFixed(1);
}
const PARETO_SAVINGS_D = paretoSavings();

function stageStats(stages: Stage[]) {
  const red = stages.filter(s => s.cls === "UNVA");
  return {
    redCount:    red.length,
    addressable: +red.reduce((s, d) => s + d.value, 0).toFixed(2),
    avgStage:    +(GROSS_LT / stages.length).toFixed(2),
  };
}

function vsTargetColor(delta: number) {
  return delta > 7 ? P.crit : delta > 0 ? P.warn : P.good;
}

function fmtVol(n: number) {
  return n.toLocaleString("en-US");
}

// ── useSize hook ──────────────────────────────────────────────────────────
function useSize(ref: React.RefObject<HTMLElement>) {
  const [size, setSize] = useState({ w: 400, h: 200 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect;
      if (r.width > 1 && r.height > 1) setSize({ w: r.width, h: r.height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

// ── Sparkline ─────────────────────────────────────────────────────────────
function Sparkline({ data, color, invert = false }: { data: number[]; color: string; invert?: boolean }) {
  const W = 52, H = 22;
  if (data.length < 2) return <svg width={W} height={H} />;
  const min = Math.min(...data), max = Math.max(...data);
  const rng = Math.max(max - min, 0.001);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = invert ? ((v - min) / rng) * H : (1 - (v - min) / rng) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={W} height={H} style={{ display:"block", overflow:"visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── StageBarChart ─────────────────────────────────────────────────────────
function StageBarChart({ stages, mode, onMode }: {
  stages: Stage[]; mode: "group" | "activity"; onMode: (m: "group" | "activity") => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(wrapRef as React.RefObject<HTMLElement>);

  const pT=28, pB=44, pL=36, pR=52;
  const cW = w - pL - pR;
  const cH = h - pT - pB;
  const maxVal = Math.max(...stages.map(s => s.value));
  const yMax   = maxVal * 1.22;
  const barW   = (cW / stages.length) * 0.58;
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];
  const yv     = (v: number) => pT + cH - (v / yMax) * cH;
  const xc     = (i: number) => pL + (i + 0.5) * (cW / stages.length);
  const { redCount, addressable, avgStage } = stageStats(stages);
  const avgY   = yv(avgStage);

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0, background:P.surface, borderRadius:10, border:`1px solid ${P.border}`, overflow:"hidden" }}>
      {/* Card header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 12px 6px", flexShrink:0 }}>
        <div>
          <span style={{ fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.09em", color:P.muted }}>Lead Time per Stage</span>
        </div>
        <div style={{ display:"flex", background:P.hair, borderRadius:7, padding:2, gap:2 }}>
          {(["group","activity"] as const).map(k => (
            <button key={k} onClick={() => onMode(k)} style={{
              fontSize:9, fontWeight:600, padding:"3px 10px", borderRadius:5, border:"none", cursor:"pointer",
              background: mode === k ? P.accent : "transparent",
              color: mode === k ? "white" : P.muted,
              transition:"background 0.15s",
            }}>
              {k === "group" ? "Per stage group" : "Per activity"}
            </button>
          ))}
        </div>
      </div>

      {/* SVG chart area */}
      <div ref={wrapRef} style={{ flex:1, minHeight:0 }}>
        <svg ref={svgRef} width={w} height={h} style={{ display:"block" }}>
          {/* Gridlines */}
          {yTicks.map((f, i) => {
            const val = yMax * f;
            const y   = yv(val);
            return (
              <g key={i}>
                <line x1={pL} x2={w - pR} y1={y} y2={y}
                  stroke={i === 0 ? P.border : P.hair} strokeWidth={1}
                  strokeDasharray={i === 0 ? "none" : "3 2"} />
                {i > 0 && (
                  <text x={pL - 4} y={y + 3} fontSize={8} textAnchor="end" fill={P.faint} fontFamily={MN}>
                    {val.toFixed(1)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Avg reference line */}
          <line x1={pL} x2={w - pR} y1={avgY} y2={avgY}
            stroke={P.faint} strokeWidth={1.5} strokeDasharray="5 3" />
          {/* Avg chip */}
          <rect x={w - pR + 3} y={avgY - 8} width={46} height={16} rx={3}
            fill="white" stroke={P.border} strokeWidth={1} />
          <text x={w - pR + 6} y={avgY + 4} fontSize={8} fill={P.faint} fontFamily={MN}>
            avg {avgStage} d
          </text>

          {/* Bars */}
          {stages.map((s, i) => {
            const bH  = (s.value / yMax) * cH;
            const xi  = xc(i);
            const yi  = yv(s.value);
            const col = cls2color(s.cls);
            const pct = (s.value / GROSS_LT * 100).toFixed(1);
            return (
              <g key={i}>
                {/* Bar */}
                <rect x={xi - barW / 2} y={yi} width={barW} height={bH}
                  fill={col} rx={3} ry={3} style={{ clipPath:`inset(0 0 ${bH > 6 ? 3 : 0}px 0)` }} />

                {/* Value label above bar */}
                <text x={xi} y={yi - 13} fontSize={9} textAnchor="middle" fill={P.body} fontFamily={MN}>
                  {s.value.toFixed(2)} d
                </text>
                <text x={xi} y={yi - 3} fontSize={8} textAnchor="middle" fill={col} fontFamily={MN}>
                  ({pct}%)
                </text>

                {/* Stage name + class below */}
                <text x={xi} y={pT + cH + 13} fontSize={9} textAnchor="middle" fill={P.muted}>
                  {s.name}
                </text>
                <text x={xi} y={pT + cH + 25} fontSize={8} textAnchor="middle" fill={col} fontWeight={700}>
                  {s.cls}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Footer */}
      <div style={{ flexShrink:0, padding:"4px 12px 8px", borderTop:`1px solid ${P.hair}`, display:"flex", gap:12, alignItems:"center" }}>
        <span style={{ fontSize:9, color:P.crit, fontFamily:MN }}>
          ▲ {redCount} red stage{redCount !== 1 ? "s" : ""} = {addressable} d addressable
        </span>
        <span style={{ color:P.border }}>|</span>
        <span style={{ fontSize:9, color:P.muted, fontFamily:MN }}>avg stage {avgStage} d</span>
      </div>
    </div>
  );
}

// ── OnTimeTrend ───────────────────────────────────────────────────────────
function OnTimeTrend() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(wrapRef as React.RefObject<HTMLElement>);

  const pT=16, pB=32, pL=30, pR=16;
  const cW = w - pL - pR;
  const cH = h - pT - pB;
  const Y_MIN = 60, Y_MAX = 100, Y_RNG = Y_MAX - Y_MIN;
  const xc = (i: number) => pL + (i / (ONTIME.length - 1)) * cW;
  const yv = (v: number) => pT + (1 - (v - Y_MIN) / Y_RNG) * cH;

  const tgtY = yv(ONTIME_TGT);
  const avgY = yv(ONTIME_AVG);

  const linePts = ONTIME.map((d, i) => `${xc(i).toFixed(1)},${yv(d.v).toFixed(1)}`).join(" ");
  const areaPath = [
    `M ${xc(0).toFixed(1)},${yv(ONTIME[0].v).toFixed(1)}`,
    ...ONTIME.slice(1).map((d, i) => `L ${xc(i+1).toFixed(1)},${yv(d.v).toFixed(1)}`),
    `L ${xc(ONTIME.length-1).toFixed(1)},${(pT+cH).toFixed(1)}`,
    `L ${pL.toFixed(1)},${(pT+cH).toFixed(1)} Z`,
  ].join(" ");

  function dotColor(v: number) { return v >= 90 ? P.good : v >= 75 ? P.warn : P.crit; }

  const yTicks = [60, 70, 80, 90, 100];

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0, background:P.surface, borderRadius:10, border:`1px solid ${P.border}`, overflow:"hidden" }}>
      {/* Header */}
      <div style={{ flexShrink:0, padding:"9px 12px 6px" }}>
        <span style={{ fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.09em", color:P.muted }}>On-Time PO Trend</span>
        <span style={{ fontSize:9, color:P.faint, marginLeft:8 }}>Monthly 2026</span>
      </div>

      {/* SVG */}
      <div ref={wrapRef} style={{ flex:1, minHeight:0 }}>
        <svg width={w} height={h} style={{ display:"block" }}>
          {/* Y gridlines */}
          {yTicks.map((v, i) => (
            <g key={i}>
              <line x1={pL} x2={w-pR} y1={yv(v)} y2={yv(v)}
                stroke={P.hair} strokeWidth={1} strokeDasharray={i > 0 ? "3 2" : "none"} />
              <text x={pL-4} y={yv(v)+3} fontSize={8} textAnchor="end" fill={P.faint} fontFamily={MN}>{v}</text>
            </g>
          ))}

          {/* Target line */}
          <line x1={pL} x2={w-pR} y1={tgtY} y2={tgtY}
            stroke={P.crit} strokeWidth={1.5} strokeDasharray="5 3" />
          <rect x={w-pR-56} y={tgtY-8} width={54} height={14} rx={3}
            fill="white" stroke={P.border} strokeWidth={1} />
          <text x={w-pR-3} y={tgtY+3} fontSize={8} textAnchor="end" fill={P.crit} fontFamily={MN}>target {ONTIME_TGT}%</text>

          {/* Avg line */}
          <line x1={pL} x2={w-pR} y1={avgY} y2={avgY}
            stroke={P.faint} strokeWidth={1} />
          <rect x={w-pR-46} y={avgY-8} width={44} height={14} rx={3}
            fill="white" stroke={P.border} strokeWidth={1} />
          <text x={w-pR-3} y={avgY+3} fontSize={8} textAnchor="end" fill={P.faint} fontFamily={MN}>avg {ONTIME_AVG}%</text>

          {/* Area fill */}
          <path d={areaPath} fill={P.va} opacity={0.08} />

          {/* Line */}
          <polyline points={linePts} fill="none" stroke={P.va} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* Dots */}
          {ONTIME.map((d, i) => (
            <g key={i}>
              <circle cx={xc(i)} cy={yv(d.v)} r={5} fill={dotColor(d.v)} stroke="white" strokeWidth={1.5} />
            </g>
          ))}

          {/* Month labels */}
          {ONTIME.map((d, i) => (
            <text key={i} x={xc(i)} y={h-pB+14} fontSize={9} textAnchor="middle" fill={P.muted}>{d.mo}</text>
          ))}
        </svg>
      </div>

      {/* Footer */}
      <div style={{ flexShrink:0, padding:"4px 12px 8px", borderTop:`1px solid ${P.hair}` }}>
        <span style={{ fontSize:9, color:P.muted, fontFamily:MN }}>
          best {ONTIME_BEST.mo} {ONTIME_BEST.v}% · worst {ONTIME_WRST.mo} {ONTIME_WRST.v}% · {ONTIME_BELOW} mo below target
        </span>
      </div>
    </div>
  );
}

// ── ParetoPanel ───────────────────────────────────────────────────────────
function ParetoPanel() {
  const SKU_W = 118;
  return (
    <div style={{ gridRow:"1 / 3", display:"flex", flexDirection:"column", background:P.surface, borderRadius:10, border:`1px solid ${P.border}`, overflow:"hidden", minHeight:0 }}>
      {/* Header */}
      <div style={{ flexShrink:0, padding:"9px 12px 6px", borderBottom:`1px solid ${P.hair}` }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.09em", color:P.muted }}>Lead Time Pareto</span>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {([["VA",P.va],["NNVA",P.nnva],["UNVA",P.unva]] as [string,string][]).map(([l,c]) => (
              <span key={l} style={{ display:"flex", alignItems:"center", gap:3, fontSize:9, color:P.muted }}>
                <span style={{ width:8, height:8, background:c, borderRadius:2, display:"inline-block" }} /> {l}
              </span>
            ))}
          </div>
        </div>
        <div style={{ fontSize:9, color:P.faint, marginTop:2 }}>Top 10 SKU · days per batch</div>
      </div>

      {/* Rows */}
      <div style={{ flex:1, minHeight:0, display:"flex", flexDirection:"column", padding:"6px 10px 2px" }}>
        {PARETO.map((row, i) => {
          const total = row.va + row.nnva + row.unva;
          const isOver = total > TARGET;
          const tgtPct = (TARGET / PARETO_AXIS * 100).toFixed(2);
          const totPct = (total  / PARETO_AXIS * 100).toFixed(2);
          return (
            <div key={i} style={{ flex:1, display:"flex", alignItems:"center", gap:6, minHeight:0 }}>
              {/* SKU name */}
              <div style={{ width:SKU_W, flexShrink:0, fontSize:9, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textAlign:"right", color:P.body, fontFamily:MN }}>
                {row.sku}
              </div>
              {/* Bar area */}
              <div style={{ flex:1, position:"relative", height:18, display:"flex", minWidth:0 }}>
                {/* VA segment */}
                <div style={{ width:`${(row.va / PARETO_AXIS * 100).toFixed(2)}%`, background:P.va, height:"100%", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }} />
                {/* NNVA segment */}
                <div style={{ width:`${(row.nnva / PARETO_AXIS * 100).toFixed(2)}%`, background:P.nnva, height:"100%", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {row.nnva >= 2 && <span style={{ fontSize:8, color:"white", fontFamily:MN, lineHeight:1 }}>{row.nnva.toFixed(1)}</span>}
                </div>
                {/* UNVA segment */}
                <div style={{ width:`${(row.unva / PARETO_AXIS * 100).toFixed(2)}%`, background:P.unva, height:"100%", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {row.unva >= 4 && <span style={{ fontSize:8, color:"white", fontFamily:MN, lineHeight:1 }}>{row.unva.toFixed(2)}</span>}
                </div>
                {/* Target dashed line */}
                <div style={{ position:"absolute", left:`${tgtPct}%`, top:0, bottom:0, borderLeft:`1.5px dashed ${P.crit}`, zIndex:2 }} />
                {/* Row total */}
                <span style={{ position:"absolute", left:`${totPct}%`, top:"50%", transform:"translateY(-50%)", marginLeft:3, fontSize:9, fontFamily:MN, fontWeight:700, color: isOver ? P.crit : P.good, whiteSpace:"nowrap" }}>
                  {total.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Axis */}
      <div style={{ flexShrink:0, display:"flex", justifyContent:"space-between", paddingLeft: SKU_W + 10 + 6, paddingRight:10, paddingBottom:2 }}>
        {[0,8,16,24,32].map(v => (
          <span key={v} style={{ fontSize:8, color:P.faint, fontFamily:MN }}>{v}{v===32?" d":""}</span>
        ))}
      </div>

      {/* Footer */}
      <div style={{ flexShrink:0, padding:"4px 10px 8px", borderTop:`1px solid ${P.hair}`, display:"flex", gap:10, alignItems:"center" }}>
        <span style={{ fontSize:9, color:P.crit, fontFamily:MN, display:"flex", alignItems:"center", gap:4 }}>
          <span style={{ display:"inline-block", width:16, borderTop:`1.5px dashed ${P.crit}` }} />
          target {TARGET.toFixed(1)} d
        </span>
        <span style={{ fontSize:9, color:P.muted, fontFamily:MN }}>
          · cutting top 3 to target saves {PARETO_SAVINGS_D} d avg
        </span>
      </div>
    </div>
  );
}

// ── SkuTable ──────────────────────────────────────────────────────────────
function SkuTable({ data, variant }: { data: SkuRow[]; variant: "top" | "bottom" }) {
  const above = data.filter(r => r.ltPo > TARGET).length;
  const total = data.length;
  const summaryText = above === 0 ? `all ${total} below target` : `${above} of ${total} above target`;
  return (
    <div style={{ display:"flex", flexDirection:"column", background:P.surface, borderRadius:10, border:`1px solid ${P.border}`, overflow:"hidden", minHeight:0 }}>
      {/* Header */}
      <div style={{ flexShrink:0, padding:"7px 10px 5px", borderBottom:`1px solid ${P.hair}`, display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.09em", color:P.muted }}>
          {variant === "top" ? "Top 5 SKU" : "Bottom 5 SKU"}
        </span>
        <span style={{ fontSize:9, color:P.faint, flex:1 }}>vs target · LT PO = PO→NDC · LT REL = release→NDC</span>
        <span style={{ fontSize:9, fontWeight:600, color: above === 0 ? P.good : P.warn,
          background: above === 0 ? "#ecfdf3" : "#fffbeb", padding:"2px 8px", borderRadius:999 }}>
          {summaryText}
        </span>
        <span style={{ fontSize:9, fontWeight:600, color:P.accent, background:P.hair, padding:"2px 8px", borderRadius:999 }}>
          {variant === "top" ? "Highest volume" : "Lowest volume"}
        </span>
      </div>

      {/* Rows */}
      <div style={{ flex:1, minHeight:0, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {data.map((row, i) => {
          const delta = +(row.ltPo - TARGET).toFixed(2);
          const dSign = delta > 0 ? "▲" : "▼";
          const dCol  = vsTargetColor(delta);
          return (
            <div key={i} style={{
              flex:1, display:"flex", alignItems:"center", gap:8, padding:"0 10px",
              borderTop: i > 0 ? `1px solid ${P.hair}` : "none",
              minHeight:0,
            }}>
              {/* Rank */}
              <span style={{ width:22, height:22, flexShrink:0, background:P.hair, borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:P.muted }}>
                {i + 1}
              </span>
              {/* Name + volume */}
              <div style={{ flex:1, minWidth:0, display:"flex", alignItems:"baseline", gap:6 }}>
                <span style={{ fontSize:10, color:P.ink, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{row.name}</span>
                <span style={{ fontSize:9, color:P.faint, fontFamily:MN, marginLeft:"auto", flexShrink:0, whiteSpace:"nowrap" }}>{fmtVol(row.vol)}</span>
              </div>
              {/* LT PO */}
              <span style={{ fontSize:10, fontFamily:MN, color:P.body, flexShrink:0, width:36, textAlign:"right" }}>{row.ltPo.toFixed(2)}</span>
              {/* LT REL */}
              <span style={{ fontSize:10, fontFamily:MN, color:P.body, flexShrink:0, width:32, textAlign:"right" }}>{row.ltRel.toFixed(2)}</span>
              {/* vs target */}
              <span style={{ fontSize:10, fontFamily:MN, fontWeight:700, color:dCol, flexShrink:0, width:52, textAlign:"right" }}>
                {dSign}{Math.abs(delta).toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SummaryStrip ──────────────────────────────────────────────────────────
const SUMMARY_FULL = "Lead Time rata-rata berada di 19.03 hari, melampaui target 13.0 hari sebesar 6.03 hari. Komponen UNVA mendominasi dengan 81.9% dari total waktu — WIP Waiting menjadi kontributor terbesar di 8.84 hari. Mengeliminasi 70% WIP Waiting berpotensi menurunkan Lead Time ke 10.91 hari, di bawah target.";
const SUMMARY_COLLAPSED = "Lead Time rata-rata berada di 19.03 hari, melampaui target 13.0 hari sebesar 6.03 hari. Komponen UNVA mendominasi dengan 81.9% dari total waktu.";

function SummaryStrip({ onExit }: { onExit?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ flexShrink:0, background:P.surface, border:`1px solid ${P.border}`, borderRadius:10, padding:"8px 12px", display:"flex", alignItems:"flex-start", gap:10 }}>
      <span style={{ flexShrink:0, background:"#f4f0fd", border:"1px solid #e0d6fa", color:"#5b3fa8", fontSize:9, fontWeight:700, padding:"2px 9px", borderRadius:999, letterSpacing:"0.05em", marginTop:1 }}>
        AI SUMMARY
      </span>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:11, color:P.body, margin:0, lineHeight:1.45 }}>
          {open ? SUMMARY_FULL : SUMMARY_COLLAPSED}
          <button onClick={() => setOpen(o => !o)} style={{ marginLeft:6, fontSize:10, color:P.accent, fontWeight:600, background:"none", border:"none", cursor:"pointer", padding:0 }}>
            {open ? "Show less ▴" : "Show full summary ▾"}
          </button>
        </p>
        <p style={{ fontSize:10, color:P.crit, margin:"3px 0 0", fontFamily:MN, fontWeight:600 }}>
          why: WIP Waiting = {(8.84).toFixed(2)} d of {UNVA_D.toFixed(2)} d UNVA
        </p>
      </div>
      <div style={{ flexShrink:0, display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:9, color:P.faint, fontFamily:MN }}>updated 1h ago</span>
        <button style={{ fontSize:9, color:P.accent, background:"none", border:`1px solid ${P.border}`, borderRadius:5, padding:"2px 8px", cursor:"pointer", display:"flex", alignItems:"center", gap:3 }}>
          ↻ Refresh
        </button>
        <div style={{ width:1, height:20, background:P.border }} />
        {onExit && (
          <button onClick={onExit} style={{ width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", background:"none", border:`1px solid ${P.border}`, borderRadius:7, cursor:"pointer", fontSize:13, color:P.muted }}>
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ── CriticalAlertBar ──────────────────────────────────────────────────────
function CriticalAlertBar({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div style={{ flexShrink:0, background:"#fef3f2", border:"1px solid #fbd5d1", borderLeft:`4px solid ${P.crit}`, borderRadius:10, padding:"7px 12px", display:"flex", alignItems:"center", gap:10 }}>
      {/* Left cluster */}
      <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
        <div style={{ width:18, height:18, borderRadius:"50%", background:P.crit, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <span style={{ fontSize:10, fontWeight:700, color:"white", lineHeight:1 }}>!</span>
        </div>
        <span style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.09em", color:P.crit }}>CRITICAL</span>
        <span style={{ fontSize:10, color:P.ink }}>Waste (UNVA)</span>
      </div>

      {/* Body */}
      <p style={{ flex:1, fontSize:10, color:P.body, margin:0 }}>
        Largest single driver is WIP Waiting — 8.84 d, 57% of all UNVA and 46% of gross lead time.
        Eliminating 70% lands lead time at {SAVINGS_D} d, under target {TARGET.toFixed(1)} d.
      </p>

      {/* Right cluster */}
      <div style={{ flexShrink:0, display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}>
        <span style={{ fontSize:9, fontWeight:600, color:P.muted, background:P.hair, padding:"2px 8px", borderRadius:999 }}>PPIC · Scheduling</span>
        <button style={{ fontSize:9, fontWeight:600, color:"white", background:P.accent, border:"none", padding:"3px 10px", borderRadius:5, cursor:"pointer", height:24 }}>
          Open stage drilldown
        </button>
        <button style={{ fontSize:9, fontWeight:600, color:P.body, background:"none", border:`1px solid ${P.border}`, padding:"3px 10px", borderRadius:5, cursor:"pointer", height:24 }}>
          Notify Teams
        </button>
        <button onClick={onDismiss} style={{ fontSize:13, color:P.faint, background:"none", border:"none", cursor:"pointer", padding:"0 2px", lineHeight:1 }}>✕</button>
      </div>
    </div>
  );
}

// ── HeroRow ───────────────────────────────────────────────────────────────
function HeroRow() {
  const compositionPcts = [
    { pct: VA_PCT,   color: P.va   },
    { pct: NNVA_PCT, color: P.nnva },
    { pct: UNVA_PCT, color: P.unva },
  ];
  return (
    <div style={{ flexShrink:0, background:P.surface, border:`1px solid ${P.border}`, borderRadius:10, display:"flex", overflow:"hidden", height:76 }}>
      {/* Zone A — Filter */}
      <div style={{ padding:"10px 16px", display:"flex", flexDirection:"column", justifyContent:"center", borderRight:`1px solid ${P.border}`, flexShrink:0 }}>
        <p style={{ fontSize:9, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.09em", color:P.muted, margin:"0 0 4px" }}>Filter</p>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background:"#34d399", flexShrink:0 }} />
          <span style={{ fontSize:13, fontWeight:600, color:P.ink, fontFamily:MN }}>All Plant</span>
        </div>
        <span style={{ fontSize:9, color:P.muted, fontFamily:MN, marginTop:2 }}>YTD 2026 · median</span>
      </div>

      {/* Zone B — Gross LT */}
      <div style={{ padding:"10px 20px", display:"flex", flexDirection:"column", justifyContent:"center", borderRight:`1px solid ${P.border}`, flexShrink:0 }}>
        <p style={{ fontSize:9, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.09em", color:P.muted, margin:"0 0 2px" }}>Gross Lead Time · PO → NDC Receipt</p>
        <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
          <span style={{ fontSize:38, fontWeight:800, color:P.crit, fontFamily:MN, letterSpacing:"-0.03em", lineHeight:1 }}>{GROSS_LT.toFixed(2)}</span>
          <span style={{ fontSize:16, fontWeight:600, color:P.crit }}>d</span>
          <span style={{ fontSize:10, color:P.crit, fontFamily:MN, marginLeft:4 }}>▲ {(GROSS_LT - TARGET).toFixed(2)} d vs target {TARGET.toFixed(1)} d</span>
        </div>
        <p style={{ fontSize:9, color:P.muted, fontFamily:MN, margin:"2px 0 0" }}>prior period {PRIOR_LT} d · n = {N_BATCHES} batches</p>
      </div>

      {/* Zone C — VA / NNVA / UNVA */}
      <div style={{ flex:1, padding:"10px 16px", display:"grid", gridTemplateColumns:"repeat(3, minmax(118px, 1fr))", gap:8, alignContent:"center", borderRight:`1px solid ${P.border}` }}>
        {[
          { label:"VA", days:VA_D,   pct:VA_PCT,   color:P.va,   target:"benchmark ≥25%", status:"⚠ Below bench.",  statusOk:VA_PCT  >=25  },
          { label:"NNVA",days:NNVA_D,pct:NNVA_PCT, color:P.nnva, target:"QC & release only",status:"ℹ Info only",  statusOk:true },
          { label:"UNVA",days:UNVA_D,pct:UNVA_PCT, color:P.unva, target:"limit ≤40%",     status:"⚠ Over limit",  statusOk:false },
        ].map(c => (
          <div key={c.label}>
            <p style={{ fontSize:9, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.09em", color:P.muted, margin:"0 0 1px" }}>{c.label}</p>
            <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
              <span style={{ fontSize:20, fontWeight:800, color:c.color, fontFamily:MN, lineHeight:1 }}>{c.days.toFixed(2)} d</span>
              <span style={{ fontSize:9, color:c.color, fontFamily:MN }}>({c.pct}%)</span>
            </div>
            <p style={{ fontSize:9, color:P.muted, margin:"2px 0 0" }}>{c.target}</p>
            <p style={{ fontSize:9, fontWeight:600, color: c.statusOk ? P.good : (c.label==="NNVA" ? P.accent : P.crit), margin:0 }}>{c.status}</p>
          </div>
        ))}
      </div>

      {/* Zone D — Composition */}
      <div style={{ padding:"10px 16px", display:"flex", flexDirection:"column", justifyContent:"center", flexShrink:0, minWidth:180 }}>
        <p style={{ fontSize:9, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.09em", color:P.muted, margin:"0 0 6px" }}>Composition</p>
        {/* Stacked bar */}
        <div style={{ display:"flex", height:12, borderRadius:3, overflow:"hidden", width:"100%" }}>
          {compositionPcts.map(({pct, color}) => (
            <div key={color} style={{ width:`${pct}%`, background:color, flexShrink:0 }} />
          ))}
        </div>
        <p style={{ fontSize:9, color:P.muted, fontFamily:MN, margin:"4px 0 4px" }}>VA {VA_PCT}% · NNVA {NNVA_PCT}% · UNVA {UNVA_PCT}%</p>
        <span style={{ fontSize:9, fontWeight:600, color:P.crit, background:"#fef3f2", border:"1px solid #fbd5d1", padding:"1px 8px", borderRadius:999, alignSelf:"flex-start" }}>
          ⚠ {UNVA_OVER_PCT}% over UNVA limit
        </span>
      </div>
    </div>
  );
}

// ── KpiStrip ──────────────────────────────────────────────────────────────
const KPI_CELLS = [
  { label:"GROSS LT",    value:"19.03", unit:"d",    delta:"▲ 0.63", dColor:P.crit, accent:P.crit,   spk:SPK.grossLt, inv:false, tip:`PO→NDC receipt · target ${TARGET} d · vs prior 13w` },
  { label:"UNVA WASTE",  value:"81.9",  unit:"%",    delta:"▲ 2.8 pts", dColor:P.crit, accent:P.unva, spk:SPK.unvaWst, inv:false, tip:`UNVA portion of gross LT · limit ≤40% · vs prior 13w` },
  { label:"VA VALUE ADD",value:"14.9",  unit:"%",    delta:"▼ 0.9 pts", dColor:P.crit, accent:P.nnva, spk:SPK.vaAdd,   inv:true,  tip:`VA portion of gross LT · benchmark ≥25% · vs prior 13w` },
  { label:"WIP WAIT",    value:"8.84",  unit:"d",    delta:"▲ 0.41", dColor:P.crit, accent:P.unva,  spk:SPK.wipWait, inv:false, tip:`WIP Waiting stage · 46% of gross LT · vs prior 13w` },
  { label:"ON-TIME PO",  value:"75",    unit:"%",    delta:"▲ 1.2 pts", dColor:P.good, accent:P.good, spk:SPK.onTime,  inv:false, tip:`PO on-time rate · target ≥${ONTIME_TGT}% · monthly avg` },
  { label:"SAVINGS",     value:SAVINGS_D.toFixed(2),unit:"d",delta:"▲ 0.31",dColor:P.good,accent:P.good,spk:SPK.savings,inv:false, tip:`Lead time if 70% WIP Waiting eliminated · scenario est.` },
] as const;

function KpiStrip() {
  return (
    <div style={{ flexShrink:0, background:P.surface, border:`1px solid ${P.border}`, borderRadius:10, display:"flex", overflow:"hidden" }}>
      {KPI_CELLS.map((cell, i) => (
        <div key={i} title={cell.tip} style={{
          flex:1, borderLeft: i === 0 ? `3px solid ${cell.accent}` : "none",
          borderRight: i < KPI_CELLS.length - 1 ? `1px solid ${P.border}` : "none",
          padding:"10px 12px", display:"flex", flexDirection:"column", gap:2, position:"relative",
        }}>
          {i > 0 && <div style={{ position:"absolute", left:0, top:0, bottom:0, width:3, background:cell.accent }} />}
          <p style={{ fontSize:9.5, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.09em", color:P.muted, margin:0 }}>{cell.label}</p>
          <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
            <span style={{ fontSize:22, fontWeight:800, color:cell.accent, fontFamily:MN, letterSpacing:"-0.02em", lineHeight:1 }}>{cell.value}</span>
            <span style={{ fontSize:11, color:P.muted }}>{cell.unit}</span>
            <span style={{ fontSize:9, color:cell.dColor, fontFamily:MN, marginLeft:2 }}>{cell.delta}</span>
            <div style={{ marginLeft:"auto" }}>
              <Sparkline data={[...cell.spk]} color={cell.accent} invert={cell.inv} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Live WIB clock ────────────────────────────────────────────────────────
function LiveClock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      const wib = new Date(n.getTime() + 7 * 3600 * 1000);
      const hh = String(wib.getUTCHours()).padStart(2, "0");
      const mm = String(wib.getUTCMinutes()).padStart(2, "0");
      const ss = String(wib.getUTCSeconds()).padStart(2, "0");
      setT(`${hh}:${mm}:${ss} WIB`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.8)", fontFamily:MN }}>{t}</span>;
}

// ── Toolbar ───────────────────────────────────────────────────────────────
function MonToolbar({ onExit }: { onExit?: () => void }) {
  return (
    <div style={{ position:"sticky", bottom:0, alignSelf:"center", padding:"6px 0", zIndex:10, flexShrink:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", background:P.toolbar, borderRadius:999, boxShadow:"0 8px 32px rgba(0,0,0,0.32)" }}>
        <LiveClock />
        <span style={{ fontSize:10, color:P.muted, marginLeft:2 }}>All Plant · YTD 2026</span>
        <div style={{ width:1, height:16, background:P.tbDiv, margin:"0 4px" }} />
        <button onClick={onExit} style={{ fontSize:13, color:"rgba(255,255,255,0.4)", background:"none", border:"none", cursor:"pointer", padding:"0 2px", lineHeight:1 }}>✕</button>
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────
export function LeadTimeMonitor({ onExit }: { onExit?: () => void }) {
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [stageMode, setStageMode] = useState<"group" | "activity">("group");
  const activeStages = stageMode === "group" ? STAGES_GROUP : STAGES_ACTIVITY;

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", overflow:"hidden", padding:"12px 14px", gap:8, background:P.page, boxSizing:"border-box" }}>

      {/* ① AI Summary */}
      <SummaryStrip onExit={onExit} />

      {/* ② Critical alert */}
      {!alertDismissed && <CriticalAlertBar onDismiss={() => setAlertDismissed(true)} />}

      {/* ③ Hero row */}
      <HeroRow />

      {/* ④ KPI strip */}
      <KpiStrip />

      {/* ⑤ Content grid */}
      <div style={{
        flex:1, minHeight:0, display:"grid",
        gridTemplateColumns:"1fr 1fr minmax(330px, 0.95fr)",
        gridTemplateRows:"minmax(190px, 1fr) minmax(206px, 1.05fr)",
        gap:8,
      }}>
        <StageBarChart stages={activeStages} mode={stageMode} onMode={setStageMode} />
        <OnTimeTrend />
        <ParetoPanel />
        <SkuTable data={TOP5} variant="top" />
        <SkuTable data={BOT5} variant="bottom" />
      </div>

      {/* ⑥ Sticky toolbar */}
      <MonToolbar onExit={onExit} />
    </div>
  );
}
