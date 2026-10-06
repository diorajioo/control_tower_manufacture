import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runScheduledNotifications } from "@/lib/notifications/run";

// Snowflake (cold warehouse) + AI per plant/range
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Scheduled Teams runner — sends whatever is due (lib/notifications/run.ts). No user session:
 * callers authenticate with `Authorization: Bearer <CRON_SECRET>`.
 *   Vercel: vercel.json cron, once a day at 00:00 UTC = 07:00 WIB (Hobby plan limit); Vercel adds the header.
 *   Kubernetes: a CronJob every 15 minutes — see docs/ARCHITECTURE.md → Scheduled notifications.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });

  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  if (got.length !== want.length || !timingSafeEqual(got, want)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await runScheduledNotifications();
  if (report.errors.length > 0) console.error("[cron/notifications]", report.errors);
  return NextResponse.json(report, { status: report.errors.length > 0 && report.sent.length === 0 ? 502 : 200 });
}
