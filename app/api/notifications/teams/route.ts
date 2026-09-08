import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import { sendTeamsAlerts } from "@/lib/alerts/teams";
import { sendGraphAlerts } from "@/lib/graph/teams";
import type { KPIAlert } from "@/lib/alerts";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    alerts:              KPIAlert[];
    plant?:              string;
    period?:             string;
    withRecommendation?: boolean;
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

  // ── Graph API path (preferred) ─────────────────────────────────────────────
  // Used when TEAMS_RECIPIENTS is configured.
  // Sends personal DMs directly to each recipient via Microsoft Graph.
  if (process.env.TEAMS_RECIPIENTS) {
    const jwt        = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const result     = await sendGraphAlerts(body.alerts, {
      ...opts,
      accessToken: jwt?.accessToken,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.errors.join("; "), sent: result.sent },
        { status: result.sent > 0 ? 207 : 502 }
      );
    }
    return NextResponse.json({ ok: true, sent: result.sent });
  }

  // ── Webhook fallback (legacy) ──────────────────────────────────────────────
  // Used when only TEAMS_WEBHOOK_URL is set (Incoming Webhook / Power Automate).
  if (process.env.TEAMS_WEBHOOK_URL) {
    const result = await sendTeamsAlerts(body.alerts, opts);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    return NextResponse.json({ ok: true, sent: body.alerts.length });
  }

  return NextResponse.json(
    { error: "Konfigurasi Teams belum ada. Set TEAMS_RECIPIENTS (Graph API) atau TEAMS_WEBHOOK_URL (webhook)." },
    { status: 503 }
  );
}