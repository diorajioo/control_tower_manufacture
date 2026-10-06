import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import { sendTeamsAlerts, generateAlertNarrative } from "@/lib/alerts/teams";
import { sendGraphAlerts } from "@/lib/graph/teams";
import type { KPIAlert } from "@/lib/alerts";
import { getTeamsSettings, alertKey, filterUnsentKeys, markSent } from "@/lib/settings";
import { normalizeRecipient, type RecipientConfig } from "@/lib/notifications/store";
import { sendAlertsToRecipients, dashboardUrl } from "@/lib/notifications/run";
import { getKpiSnapshot } from "@/lib/kpiData";

// KPI snapshot (cache miss → Snowflake) + AI narrative before sending
export const maxDuration = 60;

/**
 * Alerts computed in the browser (dashboard auto-send, alert panel, header button).
 * Routing, per-recipient dedup and the card: lib/notifications/run.ts. Scheduled sends: /api/cron/notifications.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    alerts:      KPIAlert[];
    plant?:      string;
    period?:     string;
    /** Needed for custom periods; presets resolve their own dates */
    startDate?:  string;
    endDate?:    string;
    /** Recipients cached in the browser — used only when the server has none */
    recipients?: Array<Partial<RecipientConfig> & { email: string }>;
    /** Manual send: skip dedup and include digest recipients */
    force?:      boolean;
  };

  if (!Array.isArray(body.alerts) || body.alerts.length === 0) {
    return NextResponse.json({ error: "No alerts to send" }, { status: 400 });
  }

  // ── Master switch: once configured in Settings, "off" blocks every send ──
  const server = await getTeamsSettings();
  if (!server.enabled && server.recipients.length > 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "disabled" });
  }

  const plant = body.plant || "All Plant";
  const jwt = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // ── Recipients: server settings > client-sent ─────────────────────────────
  const recipients: RecipientConfig[] =
    server.enabled && server.recipients.length > 0
      ? server.recipients
      : Array.isArray(body.recipients)
        ? body.recipients.filter((r) => typeof r?.email === "string").map(normalizeRecipient)
        : [];

  if (recipients.length > 0) {
    const result = await sendAlertsToRecipients(body.alerts, recipients, {
      plant, period: body.period, startDate: body.startDate, endDate: body.endDate,
      force: body.force, sessionAccessToken: jwt?.accessToken as string | undefined,
    });
    if (result.errors.length > 0) {
      return NextResponse.json(
        { error: result.errors.join("; "), sent: result.sent.length },
        { status: result.sent.length > 0 ? 207 : 502 },
      );
    }
    return NextResponse.json({ ok: true, sent: result.sent.length, reason: result.skipped });
  }

  // ── Legacy fallbacks: TEAMS_RECIPIENTS (all alerts → all) or webhook ─────
  if (process.env.TEAMS_RECIPIENTS || process.env.TEAMS_WEBHOOK_URL) {
    let alerts = body.alerts;
    if (!body.force) {
      const fresh = new Set(await filterUnsentKeys(alerts.map((a) => alertKey("env", plant, a.id))));
      alerts = alerts.filter((a) => fresh.has(alertKey("env", plant, a.id)));
      if (alerts.length === 0) return NextResponse.json({ ok: true, sent: 0, reason: "dedup" });
    }
    const keys = alerts.map((a) => alertKey("env", plant, a.id));
    const kpi = await getKpiSnapshot(plant, body.period ?? "", body.startDate ?? "", body.endDate ?? "").catch(() => undefined);
    const narrative = kpi ? await generateAlertNarrative(alerts, kpi, { plant, period: body.period }) : undefined;
    const opts = { plant, period: body.period, dashboardUrl: dashboardUrl(), kpi, narrative };

    if (process.env.TEAMS_RECIPIENTS) {
      const result = await sendGraphAlerts(alerts, { ...opts, accessToken: jwt?.accessToken as string | undefined });
      if (!result.ok) {
        return NextResponse.json({ error: result.errors.join("; "), sent: result.sent }, { status: result.sent > 0 ? 207 : 502 });
      }
      await markSent(keys);
      return NextResponse.json({ ok: true, sent: result.sent });
    }
    const result = await sendTeamsAlerts(alerts, opts);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    await markSent(keys);
    return NextResponse.json({ ok: true, sent: alerts.length });
  }

  return NextResponse.json(
    { error: "Teams is not configured yet. Add recipients in Settings → Microsoft Teams." },
    { status: 503 }
  );
}
