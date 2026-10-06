import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import { sendGraphAlerts, resolveToken, sendCardTo } from "@/lib/graph/teams";
import { sendTeamsAlerts, buildAlertCard, alertSummary } from "@/lib/alerts/teams";
import { getTeamsSettings } from "@/lib/settings";
import { normalizeRecipient, type RecipientConfig } from "@/lib/notifications/store";
import { sendTestSummaries, dashboardUrl } from "@/lib/notifications/run";

// A summary test reads the KPI snapshot and calls the AI
export const maxDuration = 60;

const TEST_ALERT = {
  id:        "test-001",
  severity:  "info" as const,
  kpi:       "Test",
  message:   "Test message from the Control Tower dashboard — Teams delivery works",
  value:     null,
  threshold: "—",
  trend:     null,
};

/**
 * Settings → "Send test alert" / "Send test summary".
 * kind=alert sends a sample alert card; kind=summary sends each recipient's real summary now (their plant and range).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    kind?: "alert" | "summary";
    recipients?: Array<Partial<RecipientConfig> & { email: string }>;
  };
  const jwt = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const sessionToken = jwt?.accessToken as string | undefined;

  // Recipients being edited in Settings (may be unsaved) > saved ones
  const recipients: RecipientConfig[] = Array.isArray(body.recipients) && body.recipients.length > 0
    ? body.recipients.filter((r) => typeof r?.email === "string").map(normalizeRecipient)
    : (await getTeamsSettings()).recipients;

  const fail = (errors: string[]) => NextResponse.json(
    { error: errors.join("; "), hint: errors[0]?.includes("token") ? "sign-out-signin" : undefined },
    { status: 502 },
  );

  if (recipients.length > 0) {
    if (body.kind === "summary") {
      const result = await sendTestSummaries(recipients, sessionToken);
      if (result.sent.length === 0) return fail(result.errors);
      return NextResponse.json({ ok: true, sent: result.sent.length, errors: result.errors });
    }
    const token = await resolveToken(sessionToken);
    if (!token) return fail(["No token available — connect a sender, or sign out and back in"]);
    const card = buildAlertCard([TEST_ALERT], { plant: "All Plant", period: "Test", dashboardUrl: dashboardUrl() });
    const errors: string[] = [];
    let sent = 0;
    for (const r of recipients) {
      const err = await sendCardTo(token, r.email, card, alertSummary([TEST_ALERT]));
      if (err) errors.push(err); else sent++;
    }
    if (sent === 0) return fail(errors);
    return NextResponse.json({ ok: true, sent, errors });
  }

  // ── Legacy env paths ────────────────────────────────────────────────────────
  const opts = { plant: "All Plant", period: "Test", dashboardUrl: dashboardUrl() };
  if (process.env.TEAMS_RECIPIENTS) {
    const result = await sendGraphAlerts([TEST_ALERT], { ...opts, accessToken: sessionToken });
    if (!result.ok) return fail(result.errors);
    return NextResponse.json({ ok: true, sent: result.sent, mode: "graph" });
  }
  if (process.env.TEAMS_WEBHOOK_URL) {
    const result = await sendTeamsAlerts([TEST_ALERT], opts);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true, mode: "webhook" });
  }

  return NextResponse.json({ error: "Add a recipient first" }, { status: 400 });
}
