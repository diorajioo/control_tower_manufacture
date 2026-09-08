import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";

/**
 * GET /api/auth/teams/token
 *
 * Returns the current user's refresh token so it can be stored as
 * TEAMS_REFRESH_TOKEN in .env / Vercel env vars for background cron jobs.
 *
 * Only call this once while logged in, then save the value.
 * Protected — only accessible while authenticated.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jwt = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!jwt?.refreshToken) {
    return NextResponse.json(
      {
        error:  "No refresh token in session",
        hint:   "Sign out and sign back in — the new scopes (Chat.Create, ChatMessage.Send) must be consented first",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    refreshToken: jwt.refreshToken,
    expiresAt:    jwt.expiresAt,
    instruction:  "Copy refreshToken → set as TEAMS_REFRESH_TOKEN in .env.local and Vercel env vars",
  });
}