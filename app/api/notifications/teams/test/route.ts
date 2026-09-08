import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import { sendGraphAlerts } from "@/lib/graph/teams";
import { sendTeamsAlerts } from "@/lib/alerts/teams";

const TEST_ALERT = {
  id:        "test-001",
  severity:  "warning" as const,
  kpi:       "Test Connection",
  message:   "Pesan test dari Control Tower dashboard. Jika ini muncul di Teams, integrasi berhasil!",
  value:     null,
  threshold: "—",
  trend:     null,
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const opts = {
    plant:        session.user?.name ?? "Dashboard",
    period:       "Test",
    dashboardUrl: process.env.NEXTAUTH_URL,
  };

  // ── Graph API path ──────────────────────────────────────────────────────────
  if (process.env.TEAMS_RECIPIENTS) {
    const jwt    = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const result = await sendGraphAlerts([TEST_ALERT], {
      ...opts,
      accessToken: jwt?.accessToken,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.errors.join("; "), hint: result.errors[0]?.includes("token") ? "sign-out-signin" : undefined },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, sent: result.sent, mode: "graph" });
  }

  // ── Webhook fallback ────────────────────────────────────────────────────────
  if (process.env.TEAMS_WEBHOOK_URL) {
    const result = await sendTeamsAlerts([TEST_ALERT], { ...opts, withRecommendation: false });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true, mode: "webhook" });
  }

  return NextResponse.json(
    { error: "Set TEAMS_RECIPIENTS (Graph API) atau TEAMS_WEBHOOK_URL (webhook) di .env" },
    { status: 503 }
  );
}