import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getKpiSnapshot } from "@/lib/kpiData";

// Allow up to 60 s on Vercel — needed when Snowflake warehouse auto-resumes from suspension.
export const maxDuration = 60;

// Queries + cache layer live in lib/kpiData.ts.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const plant     = searchParams.get("plant")     ?? "All Plant";
  const startDate = searchParams.get("startDate") ?? "2024-01-01";
  const endDate   = searchParams.get("endDate")   ?? new Date().toISOString().split("T")[0];
  const period    = searchParams.get("period")    ?? "";

  return NextResponse.json(await getKpiSnapshot(plant, period, startDate, endDate));
}
