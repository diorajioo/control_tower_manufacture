import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { unstable_cache } from "next/cache";
import { authOptions } from "@/lib/auth";
import { dimsFromParams, type LtDims } from "@/lib/leadTimeFilters";
import { getLeadTimeStageVsStd, getLeadTimeByPlant } from "@/lib/queries";
import { LEAD_TIME_TARGET_DAYS } from "@/lib/leadTimeDefinition";

// On-time = gross lead time within the Lead Time target (LEAD_TIME_TARGET_DAYS, lib/leadTimeDefinition.ts).

// Allow up to 60 s on Vercel — needed when Snowflake warehouse auto-resumes from suspension.
export const maxDuration = 60;

// Lead time per stage, actual vs standard + breakdown per plant (Overview → Tactical view).
async function runStageQuery(plant: string, startDate: string, endDate: string, period: string | undefined, basis: "created" | "released", dims: string) {
  const filters = { plant, startDate, endDate, period, lt: JSON.parse(dims) as LtDims };
  const [rows, byPlant] = await Promise.all([getLeadTimeStageVsStd(filters), getLeadTimeByPlant(filters, LEAD_TIME_TARGET_DAYS, basis)]);
  const d2 = (n: number | null) => (n == null ? null : Number(n.toFixed(2)));

  // Days per PO per plant, split so the process columns add up to the plant's gross / nett (ltSplitSql in lib/queries.ts):
  // gross minutes ÷ POs with a gross value, nett minutes ÷ POs with a nett value. The network row sums all plants.
  const poCount = { gross: new Map<string, number>(), nett: new Map<string, number>() };
  for (const p of byPlant.plants) {
    const key = p.IS_NETWORK ? "" : String(p.PLANT);
    poCount.gross.set(key, Number(p.GROSS_N));
    poCount.nett.set(key, Number(p.NETT_N));
  }
  type Split = Map<string, Record<string, number>>;
  const split = { stagesGross: new Map() as Split, stagesNett: new Map() as Split, actGross: new Map() as Split, actNett: new Map() as Split };
  const add = (into: Split, n: Map<string, number>, key: string, col: string, minutes: number | null) => {
    const po = n.get(key);
    if (!po || minutes == null) return;
    const rec = into.get(key) ?? {};
    rec[col] = (rec[col] ?? 0) + Number(minutes) / 1440 / po;
    into.set(key, rec);
  };
  const activityMeta = new Map<string, { activity: string; stage: string; sequence: number | null }>();
  for (const s of byPlant.stages) {
    for (const key of [String(s.PLANT), ""]) {
      add(split.stagesGross, poCount.gross, key, s.STAGE, s.GROSS_MIN);
      add(split.stagesNett, poCount.nett, key, s.STAGE, s.NETT_MIN);
      add(split.actGross, poCount.gross, key, s.ACTIVITY, s.GROSS_MIN);
      add(split.actNett, poCount.nett, key, s.ACTIVITY, s.NETT_MIN);
    }
    const seq = s.SEQ == null ? null : Number(s.SEQ);
    const prev = activityMeta.get(s.ACTIVITY);
    if (!prev || (seq != null && (prev.sequence == null || seq < prev.sequence))) activityMeta.set(s.ACTIVITY, { activity: s.ACTIVITY, stage: s.STAGE, sequence: seq });
  }
  const round3 = (rec?: Record<string, number>) => Object.fromEntries(Object.entries(rec ?? {}).map(([k, v]) => [k, Number(v.toFixed(3))]));

  return {
    targetDays: LEAD_TIME_TARGET_DAYS,
    plants: byPlant.plants
      .map((p) => {
        const key = p.IS_NETWORK ? "" : String(p.PLANT);
        return {
          plant: p.IS_NETWORK ? null : p.PLANT, poCount: Number(p.PO_COUNT), gross: d2(p.GROSS_DAYS), nett: d2(p.NETT_DAYS), onTimePct: d2(p.ONTIME_PCT),
          gauge: { onTime: Number(p.ONTIME_N ?? 0), atRisk: Number(p.ATRISK_N ?? 0), late: Number(p.LATE_N ?? 0) },
          stages: round3(split.stagesGross.get(key)), activities: round3(split.actGross.get(key)),
          stagesNett: round3(split.stagesNett.get(key)), activitiesNett: round3(split.actNett.get(key)),
        };
      })
      .sort((a, b) => (a.plant == null ? -1 : b.plant == null ? 1 : a.plant.localeCompare(b.plant))),
    activities: Array.from(activityMeta.values()).sort((a, b) => (a.sequence ?? 999) - (b.sequence ?? 999)),
    stages: rows.map((r) => ({
      stage:  r.STAGE,
      actual: Number((r.ACTUAL_DAYS ?? 0).toFixed(3)),
      std:    Number((r.STD_DAYS ?? 0).toFixed(3)),
    })),
  };
}

const cached = unstable_cache(runStageQuery, ["lead-time-stages-v9"], { revalidate: 3600, tags: ["kpi"] });

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const plant     = searchParams.get("plant")     ?? "All Plant";
  const startDate = searchParams.get("startDate") ?? `${new Date().getFullYear()}-01-01`;
  const endDate   = searchParams.get("endDate")   ?? new Date().toISOString().split("T")[0];
  const period    = searchParams.get("period")    ?? undefined;
  const basis     = searchParams.get("basis") === "released" ? "released" : "created";

  try {
    return NextResponse.json(await cached(plant, startDate, endDate, period, basis, JSON.stringify(dimsFromParams(searchParams))));
  } catch (e) {
    console.error("Lead time stages failed:", (e as Error).message);
    return NextResponse.json({ stages: [], plants: [], error: "query_failed" }, { status: 500 });
  }
}
