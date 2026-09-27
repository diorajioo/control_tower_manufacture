import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { unstable_cache } from "next/cache";
import { authOptions } from "@/lib/auth";
import { getLeadTimeStageVsStd, getLeadTimeByPlant } from "@/lib/queries";

// On-time = gross lead time within the Lead Time target (same ≤ 13 days as the Tactical KPI table).
const LEAD_TIME_TARGET_DAYS = 13;

// Allow up to 60 s on Vercel — needed when Snowflake warehouse auto-resumes from suspension.
export const maxDuration = 60;

// Lead time per stage, actual vs standard + breakdown per plant (Overview → Tactical view).
async function runStageQuery(plant: string, startDate: string, endDate: string, period?: string) {
  const filters = { plant, startDate, endDate, period };
  const [rows, byPlant] = await Promise.all([getLeadTimeStageVsStd(filters), getLeadTimeByPlant(filters, LEAD_TIME_TARGET_DAYS)]);
  const d2 = (n: number | null) => (n == null ? null : Number(n.toFixed(2)));

  // Stage days per PO per plant; the network row sums all plants over the network PO count.
  const poCount = new Map<string, number>();
  for (const p of byPlant.plants) poCount.set(p.IS_NETWORK ? "" : String(p.PLANT), Number(p.PO_COUNT));
  const stageDays = new Map<string, Record<string, number>>();
  const add = (key: string, stage: string, minutes: number) => {
    const n = poCount.get(key);
    if (!n) return;
    const rec = stageDays.get(key) ?? {};
    rec[stage] = (rec[stage] ?? 0) + minutes / 1440 / n;
    stageDays.set(key, rec);
  };
  for (const s of byPlant.stages) {
    add(String(s.PLANT), s.STAGE, Number(s.MINUTES ?? 0));
    add("", s.STAGE, Number(s.MINUTES ?? 0));
  }

  return {
    targetDays: LEAD_TIME_TARGET_DAYS,
    plants: byPlant.plants
      .map((p) => {
        const key = p.IS_NETWORK ? "" : String(p.PLANT);
        const stages = Object.fromEntries(Object.entries(stageDays.get(key) ?? {}).map(([k, v]) => [k, Number(v.toFixed(3))]));
        return { plant: p.IS_NETWORK ? null : p.PLANT, poCount: Number(p.PO_COUNT), gross: d2(p.GROSS_DAYS), nett: d2(p.NETT_DAYS), onTimePct: d2(p.ONTIME_PCT), stages };
      })
      .sort((a, b) => (a.plant == null ? -1 : b.plant == null ? 1 : a.plant.localeCompare(b.plant))),
    stages: rows.map((r) => ({
      stage:  r.STAGE,
      actual: Number((r.ACTUAL_DAYS ?? 0).toFixed(3)),
      std:    Number((r.STD_DAYS ?? 0).toFixed(3)),
    })),
  };
}

const cached = unstable_cache(runStageQuery, ["lead-time-stages-v2"], { revalidate: 3600, tags: ["kpi"] });

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const plant     = searchParams.get("plant")     ?? "All Plant";
  const startDate = searchParams.get("startDate") ?? `${new Date().getFullYear()}-01-01`;
  const endDate   = searchParams.get("endDate")   ?? new Date().toISOString().split("T")[0];
  const period    = searchParams.get("period")    ?? undefined;

  try {
    return NextResponse.json(await cached(plant, startDate, endDate, period));
  } catch (e) {
    console.error("Lead time stages failed:", (e as Error).message);
    return NextResponse.json({ stages: [], plants: [], error: "query_failed" }, { status: 500 });
  }
}
