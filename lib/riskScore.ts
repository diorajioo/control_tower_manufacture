// Runtime prediction engine for PO lead-time risk.
// Loads the deployment model written by scripts/risk-score/train.ts → model.json.
// Ports the feature computation and scoring from train.ts so results are comparable.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const H = 3600e3, D = 24 * H;
const K_ROUTE = 3;
const MODEL_PATH = join(process.cwd(), "data", "risk-score", "model.json");

// ── Types ─────────────────────────────────────────────────────────────────────

interface RouteEntry { n: number; steps: Record<string, number> }
interface StatEntry  { n: number; late: number }

export interface DeployModel {
  model: { feats: string[]; w: number[]; dayIntercepts: number[] };
  ref: Record<string, number[]>;
  snapDays: number[];
  features: string[];
  allSeqs: number[];
  startSeq: number;
  endSeq: number;
  baseLateRate: number;
  productStats: Record<string, StatEntry>;
  groupStats: Record<string, StatEntry>;
  routeAll: RouteEntry;
  routeByProduct: Record<string, RouteEntry>;
  routeByGroup: Record<string, RouteEntry>;
  cycleTime: Record<string, number>;
  asOf: string;
}

export interface ActivePoRow {
  PO: string;
  RELEASED_AT: string | null;
  PLANT: string;
  PRODUCT: string;
  GROUP: string;   // SKU_GROUP|SEDIAAN
  SEDIAAN: string;
  SEQ: number;
  ACTIVITY: string;
  START_AT: string | null;
  STOP_AT: string | null;
}

export interface RiskPoResult {
  po: string;
  plant: string;
  product: string;
  group: string;
  daysSinceRelease: number;
  snapDay: number;
  score: number;
  lastSeq: number;
  lastActivity: string;
  nextSeq: number;
}

// ── Model loading ─────────────────────────────────────────────────────────────

let _model: DeployModel | null = null;

export function loadModel(): DeployModel | null {
  if (_model) return _model;
  if (!existsSync(MODEL_PATH)) return null;
  try {
    _model = JSON.parse(readFileSync(MODEL_PATH, "utf8")) as DeployModel;
    return _model;
  } catch {
    return null;
  }
}

// ── Prediction helpers (ported from train.ts) ─────────────────────────────────

function routeProbs(dm: DeployModel, product: string, group: string): Map<number, number> {
  const nA = dm.routeAll.n;
  const nG = dm.routeByGroup[group]?.n ?? 0;
  const nP = dm.routeByProduct[product]?.n ?? 0;
  const out = new Map<number, number>();
  for (const s of dm.allSeqs) {
    const pa = (Number(dm.routeAll.steps[s]) || 0) / nA;
    const pg = ((Number(dm.routeByGroup[group]?.steps[s]) || 0) + K_ROUTE * pa) / (nG + K_ROUTE);
    const pp = ((Number(dm.routeByProduct[product]?.steps[s]) || 0) + K_ROUTE * pg) / (nP + K_ROUTE);
    out.set(s, pp);
  }
  return out;
}

function nextExpected(dm: DeployModel, route: Map<number, number>, afterSeq: number): number {
  return dm.allSeqs.find((s) => s > afterSeq && (route.get(s) ?? 0) >= 0.5) ?? dm.endSeq;
}

// Shrinkage-estimated late rate for a product (self excluded — runtime POs are never in training).
function historyRate(dm: DeployModel, product: string, group: string): number {
  const g = dm.groupStats[group] ?? { n: 0, late: 0 };
  const pg = (g.late + 10 * dm.baseLateRate) / (g.n + 10);
  const pr = dm.productStats[product] ?? { n: 0, late: 0 };
  return (pr.late + 10 * pg) / (pr.n + 10);
}

function pct(dm: DeployModel, day: number, f: string, v: number): number {
  const a = dm.ref[`${day}|${f}`];
  if (!a || a.length === 0) return 0.5;
  let lo = 0, hi = a.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; }
  let lo2 = lo, hi2 = a.length;
  while (lo2 < hi2) { const m = (lo2 + hi2) >> 1; if (a[m] <= v) lo2 = m + 1; else hi2 = m; }
  return (lo + lo2) / 2 / a.length;
}

function predict(dm: DeployModel, day: number, f: Record<string, number>): number {
  const dayIdx = dm.snapDays.indexOf(day);
  if (dayIdx === -1) return 0.5;
  const x = [
    ...dm.snapDays.map((_, i) => (i === dayIdx ? 1 : 0)),
    ...dm.model.feats.map((feat) => pct(dm, day, feat, f[feat] ?? 0)),
  ];
  const z = x.reduce((s, xi, j) => s + xi * dm.model.w[j], 0);
  return 1 / (1 + Math.exp(-z));
}

// ── Main scoring function ─────────────────────────────────────────────────────

export function scoreActivePOs(dm: DeployModel, rows: ActivePoRow[], now = Date.now()): RiskPoResult[] {
  // Group rows by PO
  const byPo = new Map<string, ActivePoRow[]>();
  for (const r of rows) {
    const arr = byPo.get(r.PO) ?? [];
    arr.push(r);
    byPo.set(r.PO, arr);
  }

  // First pass: determine each PO's next expected step (for queue computation)
  interface PoMeta { plant: string; lastSeq: number; nextSeq: number; inProcess: boolean }
  const meta = new Map<string, PoMeta>();
  for (const [po, steps] of Array.from(byPo.entries())) {
    const r0 = steps[0];
    const releasedAt = r0.RELEASED_AT ? Date.parse(r0.RELEASED_AT) : NaN;
    if (!Number.isFinite(releasedAt)) continue;
    const daysSince = (now - releasedAt) / D;
    const snapDay = dm.snapDays.slice().reverse().find((d) => d <= daysSince);
    if (!snapDay) continue;
    const ts = releasedAt + snapDay * D;
    const started = steps.filter((s: ActivePoRow) => s.START_AT && Date.parse(s.START_AT) <= ts);
    const lastSeq = started.length ? Math.max(...started.map((s: ActivePoRow) => s.SEQ)) : dm.startSeq;
    const inProcess = started.some((s: ActivePoRow) => s.STOP_AT && Date.parse(s.STOP_AT) > ts);
    const route = routeProbs(dm, r0.PRODUCT, r0.GROUP);
    const nextSeq = nextExpected(dm, route, lastSeq);
    meta.set(po, { plant: r0.PLANT, lastSeq, nextSeq, inProcess });
  }

  // Build simplified queue map: plant|nextSeq → count of waiting POs
  const queueMap = new Map<string, number>();
  for (const m of Array.from(meta.values())) {
    if (!m.inProcess) {
      const key = `${m.plant}|${m.nextSeq}`;
      queueMap.set(key, (queueMap.get(key) ?? 0) + 1);
    }
  }

  // Second pass: score each PO
  const results: RiskPoResult[] = [];
  for (const [po, steps] of Array.from(byPo.entries())) {
    const r0 = steps[0];
    const releasedAt = r0.RELEASED_AT ? Date.parse(r0.RELEASED_AT) : NaN;
    if (!Number.isFinite(releasedAt)) continue;
    const daysSince = (now - releasedAt) / D;
    const snapDay = [...dm.snapDays].reverse().find((d) => d <= daysSince);
    if (!snapDay) continue;
    const ts = releasedAt + snapDay * D;

    const route = routeProbs(dm, r0.PRODUCT, r0.GROUP);
    const total = dm.allSeqs.reduce((s, q) => s + (route.get(q) ?? 0), 0);
    const started = steps
      .filter((s: ActivePoRow) => s.START_AT && Date.parse(s.START_AT) <= ts)
      .sort((a: ActivePoRow, b: ActivePoRow) => a.SEQ - b.SEQ);
    const lastStep = started[started.length - 1];
    const lastSeq = lastStep?.SEQ ?? dm.startSeq;
    const inProcess = started.some((s: ActivePoRow) => s.STOP_AT && Date.parse(s.STOP_AT) > ts);

    // SP_new: share of expected route steps still ahead
    const remainingSteps = dm.allSeqs.filter((q) => q > lastSeq).reduce((s, q) => s + (route.get(q) ?? 0), 0);
    const SP_new = total > 0 ? remainingSteps / total : 0;

    // WT_cur: hours idle since last step ended (0 if in-process)
    const lastStop = lastStep?.STOP_AT ? Date.parse(lastStep.STOP_AT) : releasedAt;
    const WT_cur = inProcess ? 0 : Math.max(0, ts - Math.max(releasedAt, lastStop)) / H;

    // PH_product: shrinkage-estimated product late rate
    const PH_product = historyRate(dm, r0.PRODUCT, r0.GROUP);

    // QL_new: queue depth at next step / estimated starts per day
    const nextSeq = nextExpected(dm, route, lastSeq);
    const queueKey = `${r0.PLANT}|${nextSeq}`;
    const queue = Math.max(0, (queueMap.get(queueKey) ?? 0) - (inProcess ? 0 : 1));
    const cycleHours = dm.cycleTime[`${r0.PLANT}|${nextSeq}`] ?? 24;
    const perDay = 24 / Math.max(cycleHours, 1);
    const QL_new = queue / Math.max(perDay, 1 / 14);

    const f: Record<string, number> = { SP_new, WT_cur, PH_product, QL_new };
    const score = predict(dm, snapDay, f);

    results.push({
      po,
      plant: r0.PLANT,
      product: r0.PRODUCT,
      group: r0.GROUP,
      daysSinceRelease: Math.round(daysSince * 10) / 10,
      snapDay,
      score,
      lastSeq,
      lastActivity: lastStep?.ACTIVITY ?? "",
      nextSeq,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}
