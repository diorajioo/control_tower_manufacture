import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendTeamsAlerts } from "@/lib/alerts/teams";
import type { KPIAlert } from "@/lib/alerts";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.TEAMS_WEBHOOK_URL) {
    return NextResponse.json(
      { error: "TEAMS_WEBHOOK_URL belum dikonfigurasi di .env" },
      { status: 503 }
    );
  }

  const body = await req.json() as {
    alerts: KPIAlert[];
    plant?: string;
    period?: string;
    withRecommendation?: boolean;
  };

  if (!Array.isArray(body.alerts) || body.alerts.length === 0) {
    return NextResponse.json({ error: "Tidak ada alert untuk dikirim" }, { status: 400 });
  }

  const result = await sendTeamsAlerts(body.alerts, {
    plant:              body.plant,
    period:             body.period,
    withRecommendation: body.withRecommendation ?? false,
    dashboardUrl:       process.env.NEXTAUTH_URL,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sent: body.alerts.length });
}