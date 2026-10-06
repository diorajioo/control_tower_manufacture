// PO Lead Time Risk Score — step 2: build snapshots, train logistic regression, backtest.
//
//   npx tsx scripts/risk-score/train.ts <out-dir>      (reads <out-dir>/po_steps.json from extract.ts)
//
// Label  : PO Released → Receive NDC > 13 days (LEAD_TIME_TARGET_DAYS).
// Snapshot: each PO on day 2, 4, 6, 8 after release, using only what was known at that moment.
// Route  : ACTIVITY_SEQUENCE. Each product has a usual route; optional steps (cleaning, premix…) are
//          handled as a probability per step, learned from the training period.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv[2];
if (!outDir) throw new Error("usage: train.ts <out-dir>");

const TARGET_DAYS = 13;
const SNAP_DAYS = [2, 4, 6, 8];
const H = 3600e3, D = 24 * H;
const TRAIN_FROM = Date.parse("2026-01-01"), TEST_FROM = Date.parse("2026-07-01"), TEST_TO = Date.parse("2026-09-10");
const START_SEQ = 1, END_SEQ = 45;

type Row = { PO: string; PLANT: string; PRODUCT: string; SKU_GROUP: string; SEDIAAN: string; SEQ: number; ACTIVITY: string; LINE?: string | null; START_AT: string | null; STOP_AT: string | null };
type Step = { seq: number; start: number; stop: number; line: string | null };
type PO = {
  id: string; plant: string; product: string; group: string; sediaan: string;
  release: number; ndc: number | null; steps: Step[];           // process steps only, sorted by seq
  lt: number | null; late: 0 | 1 | null; split: "train" | "test" | "other";
};

// ── Load ────────────────────────────────────────────────────────────────────
const rows: Row[] = JSON.parse(readFileSync(join(outDir, "po_steps.json"), "utf8"));
const t = (s: string | null) => (s ? Date.parse(s) : NaN);
const asOf = rows.reduce((m, r) => Math.max(m, t(r.STOP_AT) || 0, t(r.START_AT) || 0), 0);

const byPo = new Map<string, Row[]>();
for (const r of rows) (byPo.get(r.PO) ?? byPo.set(r.PO, []).get(r.PO)!).push(r);

const pos: PO[] = [];
const r0Plant = (rs: Row[]) => rs[0].PLANT;
for (const [id, rs] of byPo) {
  const po = rs.find((r) => r.SEQ === START_SEQ);
  const release = t(po?.STOP_AT ?? null);
  if (!Number.isFinite(release) || release < TRAIN_FROM) continue;
  const ndcRow = rs.find((r) => r.SEQ === END_SEQ);
  const ndc = Number.isFinite(t(ndcRow?.STOP_AT ?? null)) ? t(ndcRow!.STOP_AT) : null;
  const steps = rs
    .filter((r) => r.SEQ !== START_SEQ && r.SEQ !== END_SEQ && !r.ACTIVITY.startsWith("WIP"))
    .map((r) => ({ seq: r.SEQ, start: t(r.START_AT), stop: t(r.STOP_AT), line: r.LINE ? `${r0Plant(rs)}|${r.LINE}` : null }))
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.stop))
    .sort((a, b) => a.seq - b.seq);
  const lt = ndc != null ? (ndc - release) / D : null;
  const late: 0 | 1 | null = lt != null ? (lt > TARGET_DAYS ? 1 : 0) : (asOf - release) / D > TARGET_DAYS ? 1 : null;
  const split = release < TEST_FROM ? "train" : release < TEST_TO ? "test" : "other";
  const r0 = rs[0];
  pos.push({ id, plant: r0.PLANT, product: r0.PRODUCT, group: `${r0.SKU_GROUP}|${r0.SEDIAAN}`, sediaan: r0.SEDIAAN, release, ndc, steps, lt, late, split });
}
const train = pos.filter((p) => p.split === "train" && p.late != null);
const test = pos.filter((p) => p.split === "test" && p.late != null);
const rate = (ps: PO[]) => ps.reduce((s, p) => s + p.late!, 0) / ps.length;

// ── Route: P(step | product), shrunk to product group, then to all POs ──────
const ALL_SEQS = [...new Set(pos.flatMap((p) => p.steps.map((s) => s.seq)))].sort((a, b) => a - b);
const doneTrain = train.filter((p) => p.ndc != null);
function presence(key: (p: PO) => string) {
  const n = new Map<string, number>(), has = new Map<string, Map<number, number>>();
  for (const p of doneTrain) {
    const k = key(p);
    n.set(k, (n.get(k) ?? 0) + 1);
    const m = has.get(k) ?? has.set(k, new Map()).get(k)!;
    for (const s of new Set(p.steps.map((x) => x.seq))) m.set(s, (m.get(s) ?? 0) + 1);
  }
  return { n, has };
}
const prodP = presence((p) => p.product), groupP = presence((p) => p.group), allP = presence(() => "*");
const K_ROUTE = 3;
const routeCache = new Map<string, Map<number, number>>();
function route(p: PO): Map<number, number> {
  const ck = `${p.product}|${p.group}`;
  const hit = routeCache.get(ck);
  if (hit) return hit;
  const out = new Map<number, number>();
  const nA = allP.n.get("*")!, nG = groupP.n.get(p.group) ?? 0, nP = prodP.n.get(p.product) ?? 0;
  for (const s of ALL_SEQS) {
    const pa = (allP.has.get("*")!.get(s) ?? 0) / nA;
    const pg = ((groupP.has.get(p.group)?.get(s) ?? 0) + K_ROUTE * pa) / (nG + K_ROUTE);
    const pp = ((prodP.has.get(p.product)?.get(s) ?? 0) + K_ROUTE * pg) / (nP + K_ROUTE);
    out.set(s, pp);
  }
  routeCache.set(ck, out);
  return out;
}
const nextExpected = (p: PO, afterSeq: number) => ALL_SEQS.find((s) => s > afterSeq && route(p).get(s)! >= 0.5) ?? END_SEQ;

// Typical hours from the start of a step to the start of the next one (process + the wait after it), per plant.
const cycle = new Map<string, number>();
{
  const acc = new Map<string, number[]>();
  for (const p of doneTrain) {
    const pts = [...p.steps.map((s) => ({ seq: s.seq, at: s.start })), { seq: END_SEQ, at: p.ndc! }];
    for (let i = 0; i < pts.length - 1; i++) {
      const k = `${p.plant}|${pts[i].seq}`;
      (acc.get(k) ?? acc.set(k, []).get(k)!).push(Math.max(0, pts[i + 1].at - pts[i].at) / H);
    }
  }
  for (const [k, v] of acc) { v.sort((a, b) => a - b); cycle.set(k, v[Math.floor(v.length / 2)]); }
}

// ── Product history: late rate, shrunk product → group → all (leave-one-out for training POs) ──
function lateStats(key: (p: PO) => string) {
  const m = new Map<string, { n: number; late: number }>();
  for (const p of train) { const e = m.get(key(p)) ?? m.set(key(p), { n: 0, late: 0 }).get(key(p))!; e.n++; e.late += p.late!; }
  return m;
}
const prodL = lateStats((p) => p.product), groupL = lateStats((p) => p.group);
const baseRate = rate(train);
function history(p: PO, level: "group" | "product") {
  const self = p.split === "train" ? p.late! : 0, selfN = p.split === "train" ? 1 : 0;
  const g = groupL.get(p.group) ?? { n: 0, late: 0 };
  const pg = (g.late - self + 10 * baseRate) / (g.n - selfN + 10);
  if (level === "group") return pg;
  const pr = prodL.get(p.product) ?? { n: 0, late: 0 };
  return (pr.late - (prodL.has(p.product) ? self : 0) + 10 * pg) / (pr.n - (prodL.has(p.product) ? selfN : 0) + 10);
}

// ── Line history: late rate of training POs that ran on each line (plant|LINE_NAME), shrunk to the plant rate.
// At a snapshot the PO is scored on the worst line it has started so far (lines of later steps are not known yet).
const lineL = new Map<string, { n: number; late: number }>(), plantL = new Map<string, { n: number; late: number }>();
for (const p of train) {
  const pe = plantL.get(p.plant) ?? plantL.set(p.plant, { n: 0, late: 0 }).get(p.plant)!; pe.n++; pe.late += p.late!;
  for (const l of new Set(p.steps.map((s) => s.line).filter(Boolean) as string[])) {
    const e = lineL.get(l) ?? lineL.set(l, { n: 0, late: 0 }).get(l)!; e.n++; e.late += p.late!;
  }
}
function lineRisk(p: PO, line: string) {
  const own = p.split === "train" ? 1 : 0, self = own ? p.late! : 0;
  const pl = plantL.get(p.plant) ?? { n: 0, late: 0 };
  const pr = pl.n - own > 0 ? (pl.late - self) / (pl.n - own) : baseRate;
  const e = lineL.get(line) ?? { n: 0, late: 0 };
  const inLine = lineL.has(line) && p.steps.some((s) => s.line === line) ? own : 0;
  return (e.late - (inLine ? self : 0) + 20 * pr) / (e.n - inLine + 20);
}

// Line vs. its peers: late rate of training POs per (line, step), shrunk to the step's plant-wide rate,
// minus that step rate. > 0 = this line runs later than other lines doing the same step.
const lineStepL = new Map<string, { n: number; late: number }>(), stepL = new Map<string, { n: number; late: number }>();
for (const p of train) for (const st of p.steps) {
  if (!st.line) continue;
  for (const [m, k] of [[lineStepL, `${st.line}|${st.seq}`], [stepL, `${p.plant}|${st.seq}`]] as const) {
    const e = m.get(k) ?? m.set(k, { n: 0, late: 0 }).get(k)!; e.n++; e.late += p.late!;
  }
}
function lineExcess(p: PO, st: Step) {
  if (!st.line) return 0;
  const own = p.split === "train" ? 1 : 0, self = own ? p.late! : 0;
  const sr = stepL.get(`${p.plant}|${st.seq}`) ?? { n: 0, late: 0 };
  const stepRate = sr.n - own > 0 ? (sr.late - self) / (sr.n - own) : baseRate;
  const lr = lineStepL.get(`${st.line}|${st.seq}`) ?? { n: 0, late: 0 };
  return (lr.late - (lr.n ? self : 0) + 20 * stepRate) / (lr.n - (lr.n ? own : 0) + 20) - stepRate;
}

// ── Queue timelines (hourly): open POs per plant, POs waiting for each step, step starts ──
const T0 = TRAIN_FROM - 30 * D, NH = Math.ceil((asOf - T0) / H) + 2;
const hr = (ms: number) => Math.max(0, Math.min(NH - 1, Math.floor((ms - T0) / H)));
const timeline = new Map<string, Int32Array>();
const tl = (k: string) => timeline.get(k) ?? timeline.set(k, new Int32Array(NH + 1)).get(k)!;
const addInterval = (k: string, a: number, b: number) => { if (b <= a) return; const x = tl(k); x[hr(a)]++; x[hr(b)]--; };
for (const p of pos) {
  addInterval(`open|${p.plant}`, p.release, p.ndc ?? asOf);
  // waiting intervals: between release / end of a step and the start of the next step, tagged with the expected next step
  let freeAt = p.release, lastSeq = START_SEQ;
  for (const s of p.steps) {
    addInterval(`wait|${p.plant}|${nextExpected(p, lastSeq)}`, freeAt, s.start);
    freeAt = Math.max(freeAt, s.stop); lastSeq = s.seq;
  }
  if (p.ndc == null) addInterval(`wait|${p.plant}|${nextExpected(p, lastSeq)}`, freeAt, asOf);
  for (const s of p.steps) tl(`start|${p.plant}|${s.seq}`)[hr(s.start)]++;
}
// prefix sums: interval keys → count at that hour; start keys → cumulative starts
for (const x of timeline.values()) for (let i = 1; i < x.length; i++) x[i] += x[i - 1];
const at = (k: string, ms: number) => timeline.get(k)?.[hr(ms)] ?? 0;

// ── Snapshots ───────────────────────────────────────────────────────────────
type Snap = { po: PO; day: number; f: Record<string, number>; info: { lastSeq: number; next: number; queue: number; perDay: number } };
function snapshot(p: PO, day: number): Snap | null {
  const ts = p.release + day * D;
  if (ts > asOf || (p.ndc != null && p.ndc <= ts)) return null;   // already received → nothing to predict
  const started = p.steps.filter((s) => s.start <= ts);
  const lastSeq = started.length ? started[started.length - 1].seq : START_SEQ;
  const inProcess = started.some((s) => s.stop > ts);
  // active hours = union of process intervals inside [release, ts]
  let active = 0, cur = -Infinity;
  for (const s of [...started].sort((a, b) => a.start - b.start)) {
    const a = Math.max(s.start, cur, p.release), b = Math.min(s.stop, ts);
    if (b > a) { active += b - a; cur = b; }
  }
  const r = route(p);
  const total = ALL_SEQS.reduce((s, q) => s + r.get(q)!, 0);
  const remainingSteps = ALL_SEQS.filter((q) => q > lastSeq).reduce((s, q) => s + r.get(q)!, 0);
  const remainingHours = ALL_SEQS.filter((q) => q > lastSeq).reduce((s, q) => s + r.get(q)! * (cycle.get(`${p.plant}|${q}`) ?? 24), 0);
  const next = inProcess ? nextExpected(p, lastSeq) : nextExpected(p, lastSeq);
  const queue = Math.max(0, at(`wait|${p.plant}|${next}`, ts) - (inProcess ? 0 : 1));
  const startsKey = `start|${p.plant}|${next}`;
  const perDay = (at(startsKey, ts) - at(startsKey, ts - 14 * D)) / 14;
  return {
    po: p, day,
    info: { lastSeq, next, queue, perDay },
    f: {
      SP_old: -p.steps.filter((s) => s.stop <= ts).length,                // fewer steps done = worse
      SP_new: remainingSteps / total,                                     // share of this product's route still ahead
      REM: remainingHours,                                                // expected hours of work + waiting still ahead
      WT: (ts - p.release - active) / H,                                  // hours not in a process step since release
      WT_cur: inProcess ? 0 : (ts - Math.max(p.release, ...started.map((x) => x.stop))) / H, // hours idle since the last step ended
      PH_group: history(p, "group"),
      PH_product: history(p, "product"),
      QL_old: at(`open|${p.plant}`, ts) - 1,                              // other open POs in the plant
      QL_new: queue / Math.max(perDay, 1 / 14),                           // days of backlog in front of the next step
      LN_step: started.length ? lineExcess(p, started[started.length - 1]) : 0, // line of the current step vs. other lines on that step
      LN: Math.max(lineRisk(p, ""), ...started.map((s) => (s.line ? lineRisk(p, s.line) : 0))), // worst line started so far ("" = plant rate)
    },
  };
}
const snaps = (ps: PO[]) => ps.flatMap((p) => SNAP_DAYS.map((d) => snapshot(p, d)).filter(Boolean) as Snap[]);
const trainS = snaps(train), testS = snaps(test);

// Percentile score 0–1 (1 = worst) vs. training snapshots on the same day.
const FEATURES = Object.keys(trainS[0].f);
const ref = new Map<string, Float64Array>();
for (const d of SNAP_DAYS) for (const f of FEATURES)
  ref.set(`${d}|${f}`, Float64Array.from(trainS.filter((s) => s.day === d).map((s) => s.f[f])).sort());
function pct(day: number, f: string, v: number) {
  const a = ref.get(`${day}|${f}`)!;
  let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; }
  let lo2 = lo, hi2 = a.length; while (lo2 < hi2) { const m = (lo2 + hi2) >> 1; if (a[m] <= v) lo2 = m + 1; else hi2 = m; }
  return (lo + lo2) / 2 / a.length;
}

// ── Logistic regression (IRLS, tiny L2), one intercept per snapshot day ────────
type Model = { feats: string[]; w: number[] };
const design = (s: Snap, feats: string[]) => [...SNAP_DAYS.map((d) => (s.day === d ? 1 : 0)), ...feats.map((f) => pct(s.day, f, s.f[f]))];
function fit(S: Snap[], feats: string[], label: (s: Snap) => number = (s) => s.po.late!): Model {
  const X = S.map((s) => design(s, feats)), y = S.map(label), k = X[0].length;
  let w = new Array(k).fill(0);
  for (let it = 0; it < 25; it++) {
    const Hm = Array.from({ length: k }, () => new Array(k).fill(0)), g = new Array(k).fill(0);
    for (let i = 0; i < X.length; i++) {
      const z = X[i].reduce((s, x, j) => s + x * w[j], 0), p = 1 / (1 + Math.exp(-z)), v = p * (1 - p);
      for (let a = 0; a < k; a++) { g[a] += (y[i] - p) * X[i][a]; for (let b = 0; b < k; b++) Hm[a][b] += v * X[i][a] * X[i][b]; }
    }
    for (let a = 0; a < k; a++) { Hm[a][a] += 1e-3; g[a] -= 1e-3 * w[a]; }
    const step = solve(Hm, g);
    w = w.map((x, i) => x + step[i]);
    if (Math.max(...step.map(Math.abs)) < 1e-8) break;
  }
  return { feats, w };
}
function solve(A: number[][], b: number[]) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}
const predict = (m: Model, s: Snap, shift = 0) => 1 / (1 + Math.exp(-(design(s, m.feats).reduce((a, x, j) => a + x * m.w[j], 0) + shift)));

// ── Metrics ─────────────────────────────────────────────────────────────────
function auc(p: number[], y: number[]) {
  const idx = p.map((_, i) => i).sort((a, b) => p[a] - p[b]);
  let rank = 0, sumPos = 0, nPos = 0;
  for (let i = 0; i < idx.length;) {
    let j = i; while (j < idx.length && p[idx[j]] === p[idx[i]]) j++;
    const avg = (i + j + 1) / 2;
    for (let q = i; q < j; q++) if (y[idx[q]]) { sumPos += avg; nPos++; }
    rank = j; i = j;
  }
  const nNeg = idx.length - nPos;
  return (sumPos - nPos * (nPos + 1) / 2) / (nPos * nNeg);
}
function evaluate(m: Model, S: Snap[], label: (s: Snap) => number = (s) => s.po.late!, shift = 0) {
  const p = S.map((s) => predict(m, s, shift)), y = S.map(label);
  const byPo = new Map<PO, { late: number; first50: number | null; max: number }>();
  S.forEach((s, i) => {
    const e = byPo.get(s.po) ?? byPo.set(s.po, { late: y[i], first50: null, max: 0 }).get(s.po)!;
    if (p[i] >= 0.5 && e.first50 == null) e.first50 = s.day;
    e.max = Math.max(e.max, p[i]);
  });
  const lates = [...byPo.values()].filter((e) => e.late), ons = [...byPo.values()].filter((e) => !e.late);
  const flagged = lates.filter((e) => e.first50 != null);
  const hi = [...byPo.values()].filter((e) => e.max >= 0.7);
  const bins = [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1.01].slice(0, -1).map((lo, i, a) => {
    const hiB = [0.1, 0.3, 0.5, 0.7, 0.9, 1.01][i];
    const ix = p.map((v, j) => j).filter((j) => p[j] >= lo && p[j] < hiB);
    return { bin: `${Math.round(lo * 100)}–${Math.round(Math.min(hiB, 1) * 100)}`, n: ix.length, predicted: ix.length ? avg(ix.map((j) => p[j])) : NaN, actual: ix.length ? avg(ix.map((j) => y[j])) : NaN };
  });
  return {
    auc: auc(p, y),
    aucByDay: Object.fromEntries(SNAP_DAYS.map((d) => { const ix = S.map((s, i) => i).filter((i) => S[i].day === d); return [d, auc(ix.map((i) => p[i]), ix.map((i) => y[i]))]; })),
    recall: flagged.length / lates.length,
    warnDays: avg(flagged.map((e) => TARGET_DAYS - e.first50!)),
    precisionHigh: hi.length ? hi.filter((e) => e.late).length / hi.length : NaN,
    falseAlarm: ons.filter((e) => e.first50 != null).length / ons.length,
    meanPred: avg(p), actualRate: avg(y),
    brier: avg(p.map((v, i) => (v - y[i]) ** 2)),
    pos: byPo.size, latePos: lates.length,
    bins,
  };
}
const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const weights = (m: Model) => {
  const w = m.w.slice(SNAP_DAYS.length), tot = w.reduce((s, x) => s + Math.abs(x), 0);
  return Object.fromEntries(m.feats.map((f, i) => [f, { coef: +w[i].toFixed(3), share: +(Math.abs(w[i]) / tot * 100).toFixed(1) }]));
};

// ── Variants ────────────────────────────────────────────────────────────────
const VARIANTS: Record<string, string[]> = {
  "V0 old-like (steps done, wait, group history, plant open POs)": ["SP_old", "WT", "PH_group", "QL_old"],
  "V1 + route-aware progress":                                    ["SP_new", "WT", "PH_group", "QL_old"],
  "V2 + route progress + product history":                         ["SP_new", "WT", "PH_product", "QL_old"],
  "V3 + backlog at next step":                                     ["SP_new", "WT", "PH_product", "QL_new"],
  "V4 V3 without queue":                                           ["SP_new", "WT", "PH_product"],
  "V5 remaining hours instead of progress":                        ["REM", "WT", "PH_product", "QL_new"],
  "V6 V3 without waiting":                                         ["SP_new", "PH_product", "QL_new"],
  "V7 V3 with waiting at current position":                        ["SP_new", "WT_cur", "PH_product", "QL_new"],
  "V8 V7 + line history":                                          ["SP_new", "WT_cur", "PH_product", "QL_new", "LN"],
  "V9 V7 + line vs peers on current step":                         ["SP_new", "WT_cur", "PH_product", "QL_new", "LN_step"],
};
const report: Record<string, unknown> = {
  asOf: new Date(asOf).toISOString(),
  data: { trainPOs: train.length, trainLateRate: baseRate, testPOs: test.length, testLateRate: rate(test), trainSnaps: trainS.length, testSnaps: testS.length },
  variants: {} as Record<string, unknown>,
};
const models: Record<string, Model> = {};
for (const [name, feats] of Object.entries(VARIANTS)) {
  const m = fit(trainS, feats); models[name] = m;
  const e = evaluate(m, testS);
  (report.variants as Record<string, unknown>)[name] = { weights: weights(m), ...e, bins: undefined };
  console.log(`${name.padEnd(64)} AUC ${e.auc.toFixed(3)}  recall ${(e.recall * 100).toFixed(1)}%  warn ${e.warnDays.toFixed(1)}d  prec≥70 ${(e.precisionHigh * 100).toFixed(1)}%  falseAlarm ${(e.falseAlarm * 100).toFixed(1)}%  meanPred ${(e.meanPred * 100).toFixed(1)}% vs ${(e.actualRate * 100).toFixed(1)}%`);
}

// ── Calibration fixes on the chosen variant ─────────────────────────────────
const BEST = process.env.RISK_BEST ?? "V3 + backlog at next step";
const best = models[BEST];
const logit = (p: number) => Math.log(p / (1 - p));
// Prior known on 1 Jul: POs released 18 May – 17 Jun (old enough to have a 13-day outcome).
const recent = train.filter((p) => p.release >= Date.parse("2026-05-18") && p.release < Date.parse("2026-06-17"));
const shift = logit(rate(recent)) - logit(baseRate);
const rolling = fit(trainS.filter((s) => s.po.release >= Date.parse("2026-04-01")), best.feats);
const calib = {
  "A. as trained (Jan–Jun)":                         evaluate(best, testS),
  [`B. intercept shift to recent late rate (${(rate(recent) * 100).toFixed(1)}%)`]: evaluate(best, testS, undefined, shift),
  "C. retrain on last 3 months (Apr–Jun)":            evaluate(rolling, testS),
};
report.calibration = Object.fromEntries(Object.entries(calib).map(([k, e]) => [k, { brier: e.brier, meanPred: e.meanPred, actual: e.actualRate, auc: e.auc, recall: e.recall, precisionHigh: e.precisionHigh, falseAlarm: e.falseAlarm, bins: e.bins }]));
console.log(`\nCalibration (${BEST}), shift ${shift.toFixed(2)}`);
for (const [k, e] of Object.entries(calib)) console.log(`  ${k.padEnd(52)} Brier ${e.brier.toFixed(4)}  meanPred ${(e.meanPred * 100).toFixed(1)}% vs actual ${(e.actualRate * 100).toFixed(1)}%  recall ${(e.recall * 100).toFixed(1)}%  prec≥70 ${(e.precisionHigh * 100).toFixed(1)}%  falseAlarm ${(e.falseAlarm * 100).toFixed(1)}%`);
for (const [k, e] of Object.entries(calib)) { console.log(`  bins ${k}`); console.table(e.bins.map((b) => ({ bin: b.bin, n: b.n, predicted: (b.predicted * 100).toFixed(1), actual: (b.actual * 100).toFixed(1) }))); }

// ── Option A: per-product-group standard (P75 of training lead time) ────────
const std = new Map<string, number>();
{
  const acc = new Map<string, number[]>();
  for (const p of doneTrain) for (const k of [`${p.group}|${p.plant}`, `${p.sediaan}|${p.plant}`, "*"]) (acc.get(k) ?? acc.set(k, []).get(k)!).push(p.lt!);
  for (const [k, v] of acc) if (v.length >= 20) { v.sort((a, b) => a - b); std.set(k, v[Math.floor(v.length * 0.75)]); }
}
const stdOf = (p: PO) => std.get(`${p.group}|${p.plant}`) ?? std.get(`${p.sediaan}|${p.plant}`) ?? std.get("*")!;
const lateA = (p: PO) => (p.lt != null ? (p.lt > stdOf(p) ? 1 : 0) : (asOf - p.release) / D > stdOf(p) ? 1 : null);
const trainA = trainS.filter((s) => lateA(s.po) != null), testA = testS.filter((s) => lateA(s.po) != null);
const mA = fit(trainA, best.feats, (s) => lateA(s.po)!);
const eA = evaluate(mA, testA, (s) => lateA(s.po)!);
const stdVals = [...new Set(doneTrain.map(stdOf))].sort((a, b) => a - b);
const both = test.filter((p) => lateA(p) != null);
report.optionA = {
  stdRangeDays: [stdVals[0], stdVals[stdVals.length - 1]],
  lateRateTrain: avg(train.filter((p) => lateA(p) != null).map((p) => lateA(p)!)),
  lateRateTest: avg(both.map((p) => lateA(p)!)),
  agreeWith13d: avg(both.map((p) => (lateA(p) === p.late ? 1 : 0))),
  lateBy13NotByStd: both.filter((p) => p.late === 1 && lateA(p) === 0).length,
  lateByStdNotBy13: both.filter((p) => p.late === 0 && lateA(p) === 1).length,
  weights: weights(mA), ...eA, bins: undefined,
};
console.log(`\nOption A (P75 per group×plant, ${stdVals[0].toFixed(1)}–${stdVals[stdVals.length - 1].toFixed(1)} days): late rate test ${(eA.actualRate * 100).toFixed(1)}%  AUC ${eA.auc.toFixed(3)}  recall ${(eA.recall * 100).toFixed(1)}%  prec≥70 ${(eA.precisionHigh * 100).toFixed(1)}%  falseAlarm ${(eA.falseAlarm * 100).toFixed(1)}%`);
console.log(`  agrees with 13-day label on ${(report.optionA as any).agreeWith13d * 100}% of test POs; late by 13d but not by std: ${(report.optionA as any).lateBy13NotByStd}; late by std but not by 13d: ${(report.optionA as any).lateByStdNotBy13}`);

// ── Numbers for the deck: flags per day, best single signal, one worked example ──
{
  const S = testS, P = S.map((s) => predict(best, s));
  const late = new Set(test.filter((p) => p.late).map((p) => p));
  const flaggedBy = (d: number) => new Set(S.filter((s, i) => s.day <= d && P[i] >= 0.5 && s.po.late).map((s) => s.po)).size;
  console.log(`\nlate test POs ${late.size} · flagged ≥50% by day 4: ${flaggedBy(4)} · by day 8: ${flaggedBy(8)}`);
  for (const f of best.feats) console.log(`  single-signal AUC ${f}: ${auc(S.map((s) => pct(s.day, f, s.f[f])), S.map((s) => s.po.late!)).toFixed(3)}`);
  const seqName = new Map(rows.map((r) => [r.SEQ, r.ACTIVITY]));
  const ex = S.map((s, i) => ({ s, p: P[i] })).filter(({ s, p }) => s.day === 4 && p >= 0.7 && p <= 0.8 && s.po.lt != null && s.po.lt > 18 && s.po.lt < 26).slice(0, 3);
  for (const { s, p } of ex) {
    const x = design(s, best.feats);
    console.log(`\nexample PO ${s.po.id} · ${s.po.plant} · ${s.po.group} · day ${s.day} · risk ${(p * 100).toFixed(0)} · actual LT ${s.po.lt!.toFixed(1)} d`);
    console.log(`  baseline (day ${s.day}) ${best.w[SNAP_DAYS.indexOf(s.day)].toFixed(2)}`);
    best.feats.forEach((f, j) => console.log(`  ${f.padEnd(11)} raw ${s.f[f].toFixed(3).padStart(9)} score ${(x[SNAP_DAYS.length + j] * 100).toFixed(0).padStart(3)} points ${(x[SNAP_DAYS.length + j] * best.w[SNAP_DAYS.length + j]).toFixed(2)}`));
    console.log(`  at ${seqName.get(s.info.lastSeq)} (seq ${s.info.lastSeq}) → next ${seqName.get(s.info.next)} (seq ${s.info.next}); ${s.info.queue} POs waiting, ${s.info.perDay.toFixed(1)} started/day`);
  }
}

report.model = { name: BEST, feats: best.feats, w: best.w, dayIntercepts: SNAP_DAYS };
writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(`\nreport → ${join(outDir, "report.json")}`);
console.log(JSON.stringify(report.data));
for (const [k, v] of Object.entries(report.variants as Record<string, any>)) console.log(k, JSON.stringify(v.weights), JSON.stringify(v.aucByDay));
