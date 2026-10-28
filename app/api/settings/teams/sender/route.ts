import { CONNECT_SENDER_COOKIE } from "@/lib/basePath";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { disconnectSender } from "@/lib/settings";
import { isServerAdmin } from "@/lib/serverAdmin";

/**
 * POST: start connecting the signed-in admin as the sender of Teams notifications. The session
 * cookie carries no Microsoft tokens (too large for the ingress), so this only marks the next
 * Microsoft sign-in; the client then calls signIn() and lib/auth.ts stores that sign-in's refresh
 * token (encrypted, rotated on use). A service account later signs in and does the same.
 * DELETE: disconnect — scheduled sends stop until someone connects again.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isServerAdmin(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const res = NextResponse.json({ signIn: true });
  res.cookies.set(CONNECT_SENDER_COOKIE.name, "1", { ...CONNECT_SENDER_COOKIE.options, maxAge: 600 });
  return res;
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isServerAdmin(session.user?.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await disconnectSender();
  return NextResponse.json({ ok: true });
}
