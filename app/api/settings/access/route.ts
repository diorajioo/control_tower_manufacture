import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { envAdmins, getAccess, isAdmin, saveAccess, type AccessState } from "@/lib/access";
import { storeBackend } from "@/lib/notifications/store";

// Settings → Admin → Dashboard access. Admins only. Rules: lib/access.ts.

async function guard() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await isAdmin(session.user?.email))) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { email: session.user?.email ?? "" };
}

const view = (s: AccessState) => ({
  ...s,
  // ADMIN_EMAILS: shown as admins that can only be changed in the server config
  envAdmins: envAdmins(),
  // A file store on Vercel is not persistent — the page warns until a Blob store is connected
  persistent: !(process.env.VERCEL && storeBackend() === "file"),
});

export async function GET() {
  const g = await guard();
  if (g.error) return g.error;
  return NextResponse.json(view(await getAccess(true)));
}

export async function PUT(req: Request) {
  const g = await guard();
  if (g.error) return g.error;
  const body = await req.json().catch(() => null) as { mode?: unknown; users?: unknown; admins?: unknown } | null;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((e): e is string => typeof e === "string") : []);
  try {
    const saved = await saveAccess({ mode: body?.mode === "list" ? "list" : "everyone", users: list(body?.users), admins: list(body?.admins) }, g.email);
    return NextResponse.json(view(saved));
  } catch (err) {
    console.error("[settings/access] save failed:", err);
    return NextResponse.json({ error: "Access settings could not be saved on the server" }, { status: 500 });
  }
}
