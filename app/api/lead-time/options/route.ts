import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { unstable_cache } from "next/cache";
import { authOptions } from "@/lib/auth";
import { getLeadTimeFilterOptions } from "@/lib/queries";
import { activityLabel, PROCESS_GROUPS } from "@/lib/leadTimeStages";

const posToGroup = (pos: string | null): string | undefined =>
  pos ? PROCESS_GROUPS.find((g) => (g.stages as readonly string[]).includes(pos))?.label : undefined;

export const maxDuration = 60;

// Dropdown values for the Lead Time page filters (period + plant only). Activities in process order with display names.
async function run(plant: string, startDate: string, endDate: string, period: string | undefined) {
  const o = await getLeadTimeFilterOptions({ plant, startDate, endDate, period });
  const plain = (rows: { V: string }[]) => rows.map((r) => ({ value: String(r.V), label: String(r.V) }));
  return {
    po:           plain(o.po),
    activity:     [...o.activity].sort((a, b) => (a.S ?? 999) - (b.S ?? 999)).map((r) => ({ value: String(r.V), label: activityLabel(String(r.V)), group: posToGroup(r.P ?? null) })),
    lineCategory: plain(o.lineCategory),
    line:         plain(o.line),
    skuGroup:     plain(o.skuGroup),
    sku:          o.sku.map((r) => ({ value: String(r.V), label: r.L ? `${r.V} · ${r.L}` : String(r.V) })),
    variant:      plain(o.variant),
  };
}

const cached = unstable_cache(run, ["lead-time-options-v2"], { revalidate: 3600, tags: ["kpi"] });

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  try {
    return NextResponse.json(await cached(
      sp.get("plant") ?? "All Plant",
      sp.get("startDate") ?? `${new Date().getFullYear()}-01-01`,
      sp.get("endDate") ?? new Date().toISOString().split("T")[0],
      sp.get("period") ?? undefined,
    ));
  } catch (e) {
    console.error("[lead-time/options] failed:", (e as Error).message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
