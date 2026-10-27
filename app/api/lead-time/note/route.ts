import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { unstable_cache } from "next/cache";
import { authOptions } from "@/lib/auth";
import { draftLeadTimeNote, type NoteFacts } from "@/lib/leadTimeNote";

export const maxDuration = 30;

// Lead Time page → note under the Lead Time card, AI draft (2026-10-13).
// The browser sends the variables it already shows (numbers formatted in the chosen unit). The AI only turns them
// into a sentence; every number in its answer must be one of those variables, otherwise the page keeps the
// code-written note. Cached per set of variables.

const cached = unstable_cache(draftLeadTimeNote, ["lead-time-note-v1"], { revalidate: 3600, tags: ["kpi"] });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const f = (await req.json().catch(() => null)) as NoteFacts | null;
  if (!f || !f.avg || !f.median) return NextResponse.json({ note: null });
  // Canonical key: only the known fields, in a fixed order
  const key = JSON.stringify({
    basis: f.basis, scope: f.scope, unit: f.unit, avg: f.avg, median: f.median, p25: f.p25, p75: f.p75, max: f.max, poCount: f.poCount,
    target: f.target, gap: f.gap, trendPct: f.trendPct, onTime: f.onTime, atRisk: f.atRisk, late: f.late, largest: f.largest,
  });
  try {
    return NextResponse.json({ note: await cached(key) });
  } catch (e) {
    console.error("[lead-time/note] failed:", (e as Error).message);
    return NextResponse.json({ note: null });
  }
}
