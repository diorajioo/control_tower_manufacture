import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTeamsSettings, saveTeamsSettings, type TeamsSettings } from "@/lib/settings";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getTeamsSettings();
  return NextResponse.json(settings);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Partial<TeamsSettings>;
  await saveTeamsSettings({
    enabled: typeof body.enabled === "boolean" ? body.enabled : false,
    recipients: Array.isArray(body.recipients) ? body.recipients : [],
  });
  return NextResponse.json({ ok: true });
}
