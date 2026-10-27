import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { unstable_cache } from "next/cache";
import { authOptions } from "@/lib/auth";
import { getEtlTimestamp } from "@/lib/queries";

// Header live indicator: when the lead time data was last loaded (MAX(LOAD_TIMESTAMP) of CT_MANUF_LEADTIME).
// ETL_BATCH_TIMESTAMP is date-only (00:00), so it cannot drive a timer. Cached 5 min.

/** Snowflake "2026-10-14 23:14:11.350 +0700" (or a Date) → ISO string; null when unparseable. */
function toIso(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim().replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d+)?) ?([+-]\d{2}):?(\d{2})$/, "$1T$2$3:$4");
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

const cached = unstable_cache(async () => toIso(await getEtlTimestamp()), ["etl-timestamp-v1"], { revalidate: 300, tags: ["kpi"] });

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ etlAt: await cached() });
  } catch (e) {
    console.error("ETL timestamp failed:", (e as Error).message);
    return NextResponse.json({ etlAt: null, error: "query_failed" }, { status: 500 });
  }
}
