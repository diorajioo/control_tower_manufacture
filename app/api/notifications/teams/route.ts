import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import { sendTeamsAlerts } from "@/lib/alerts/teams";
import { sendGraphAlerts, sendGraphAlertsRouted, type TeamsRecipientConfig } from "@/lib/graph/teams";
import type { KPIAlert } from "@/lib/alerts";
import { getTeamsSettings, filterUnsentAlerts, markAlertsSent } from "@/lib/settings";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    alerts:              KPIAlert[];
    plant?:              string;
    period?:             string;
    withRecommendation?: boolean;
    /** Recipients from UI settings (client-sent, used as fallback) */
    recipients?:         TeamsRecipientConfig[];
    /** Set true to skip deduplication (e.g. manual "Send to Teams" button) */
    force?:              boolean;
  };

  if (!Array.isArray(body.alerts) || body.alerts.length === 0) {
    return NextResponse.json({ error: "Tidak ada alert untuk dikirim" }, { status: 400 });
  }

  const opts = {
    plant:              body.plant,
    period:             body.period,
    withRecommendation: body.withRecommendation ?? false,
    dashboardUrl:       process.env.NEXTAUTH_URL,
  };

  // ── Deduplication ─────────────────────────────────────────────────────────
  // Skip for manual sends (force=true); enforce for auto-sends so multiple
  // open sessions don't each trigger the same alert.
  let alertsToSend = body.alerts;
  if (!body.force) {
    const unsentIds = await filterUnsentAlerts(body.alerts.map((a) => a.id));
    if (unsentIds.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, skipped: body.alerts.length, reason: "dedup" });
    }
    alertsToSend = body.alerts.filter((a) => unsentIds.includes(a.id));
  }

  const jwt = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // ── Resolve recipients: server settings > client-sent > env var ───────────
  const serverSettings = await getTeamsSettings();
  const recipients: TeamsRecipientConfig[] =
    serverSettings.enabled && serverSettings.recipients.length > 0
      ? serverSettings.recipients
      : Array.isArray(body.recipients) && body.recipients.length > 0
        ? body.recipients
        : [];

  // ── Send ──────────────────────────────────────────────────────────────────

  if (recipients.length > 0) {
    const result = await sendGraphAlertsRouted(alertsToSend, recipients, {
      ...opts,
      accessToken: jwt?.accessToken as string | undefined,
    });

    if (result.sent > 0) await markAlertsSent(alertsToSend.map((a) => a.id));

    if (!result.ok) {
      return NextResponse.json(
        { error: result.errors.join("; "), sent: result.sent },
        { status: result.sent > 0 ? 207 : 502 }
      );
    }
    return NextResponse.json({ ok: true, sent: result.sent });
  }

  // ── Env-var fallback (all alerts → all recipients) ────────────────────────
  if (process.env.TEAMS_RECIPIENTS) {
    const result = await sendGraphAlerts(alertsToSend, {
      ...opts,
      accessToken: jwt?.accessToken as string | undefined,
    });

    if (result.sent > 0) await markAlertsSent(alertsToSend.map((a) => a.id));

    if (!result.ok) {
      return NextResponse.json(
        { error: result.errors.join("; "), sent: result.sent },
        { status: result.sent > 0 ? 207 : 502 }
      );
    }
    return NextResponse.json({ ok: true, sent: result.sent });
  }

  // ── Webhook fallback (legacy) ─────────────────────────────────────────────
  if (process.env.TEAMS_WEBHOOK_URL) {
    const result = await sendTeamsAlerts(alertsToSend, opts);
    if (result.ok) await markAlertsSent(alertsToSend.map((a) => a.id));
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true, sent: alertsToSend.length });
  }

  return NextResponse.json(
    { error: "Konfigurasi Teams belum ada. Set TEAMS_RECIPIENTS atau konfigurasikan penerima di Settings." },
    { status: 503 }
  );
}
