import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTeamsSettings, saveTeamsSettings, type TeamsSettings } from "@/lib/settings";
import { storeBackend } from "@/lib/notifications/store";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getTeamsSettings();
  return NextResponse.json({
    ...settings,
    // How often /api/cron/notifications runs: "daily" (Vercel Hobby, 07:00 WIB) or "frequent" (every 15 min on Kubernetes)
    runner: process.env.NOTIF_RUNNER === "frequent" ? "frequent" : "daily",
    // A file store on Vercel is not persistent — Settings shows a warning until a Blob store is connected
    persistent: !(process.env.VERCEL && storeBackend() === "file"),
  });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Partial<TeamsSettings>;
  try {
    await saveTeamsSettings({
      enabled:    typeof body.enabled === "boolean" ? body.enabled : false,
      recipients: Array.isArray(body.recipients) ? body.recipients.filter((r) => typeof r?.email === "string") : [],
    });
  } catch (err) {
    console.error("[settings/teams] save failed:", err);
    return NextResponse.json({ error: "Settings could not be saved on the server" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
