import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import { connectSender, disconnectSender } from "@/lib/settings";

/**
 * POST: make the signed-in account the sender of Teams notifications (its refresh token is stored,
 * encrypted, and rotated on use). A service account later signs in and does the same.
 * DELETE: disconnect — scheduled sends stop until someone connects again.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jwt = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const refreshToken = jwt?.refreshToken as string | undefined;
  if (!refreshToken) {
    return NextResponse.json({ error: "No Teams permission in this session — sign out and sign back in, then try again" }, { status: 409 });
  }
  try {
    await connectSender({ email: session.user.email, name: session.user.name ?? undefined, refreshToken });
  } catch (err) {
    console.error("[settings/teams/sender] connect failed:", err);
    return NextResponse.json({ error: "Sender could not be saved on the server" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await disconnectSender();
  return NextResponse.json({ ok: true });
}
