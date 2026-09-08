import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendTeamsAlerts } from "@/lib/alerts/teams";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.TEAMS_WEBHOOK_URL) {
    return NextResponse.json({ error: "TEAMS_WEBHOOK_URL not configured" }, { status: 503 });
  }

  const result = await sendTeamsAlerts(
    [
      {
        id: "test-001",
        severity: "warning",
        kpi: "Test Connection",
        message: "Pesan test dari Control Tower dashboard. Jika ini muncul di Teams, integrasi berhasil!",
        value: null,
        threshold: "—",
        trend: null,
      },
    ],
    {
      plant: session.user?.name ?? "Dashboard",
      period: "Test",
      withRecommendation: false,
      dashboardUrl: process.env.NEXTAUTH_URL,
    }
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}