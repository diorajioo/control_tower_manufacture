import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// ── In-memory rate limiter ────────────────────────────────────────────────────
// Per-serverless-instance; Vercel also applies edge-level DDoS protection.
// Limits: 60 req/min on /api/chat, 120 req/min on other /api/* routes.

interface RateEntry { count: number; windowStart: number }
const store = new Map<string, RateEntry>();
const WINDOW_MS = 60_000;

function rateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// Clean up stale entries periodically to prevent memory leak
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS * 2;
  for (const [k, v] of store.entries()) {
    if (v.windowStart < cutoff) store.delete(k);
  }
}, WINDOW_MS);

// ── Middleware ─────────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── 1. Protect all /dashboard routes — redirect to login if unauthenticated ──
  if (pathname.startsWith("/dashboard")) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", req.url);
      return NextResponse.redirect(loginUrl);
    }

    // Reject sessions with a failed token refresh — force re-login
    if (token.error === "RefreshAccessTokenError") {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("error", "SessionExpired");
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── 2. Rate limiting on API routes ────────────────────────────────────────────
  if (pathname.startsWith("/api/")) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? "unknown";

    // Chat endpoint: 30 req/min (Groq + Snowflake cost control)
    if (pathname.startsWith("/api/chat")) {
      if (!rateLimit(`chat:${ip}`, 30)) {
        return NextResponse.json(
          { error: "Terlalu banyak permintaan. Coba lagi dalam satu menit." },
          { status: 429, headers: { "Retry-After": "60" } }
        );
      }
    }

    // AI summary endpoint: 10 req/min (cached 5 hours, so this should never be hit in practice)
    else if (pathname.startsWith("/api/dashboard/summary")) {
      if (!rateLimit(`summary:${ip}`, 10)) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429, headers: { "Retry-After": "60" } }
        );
      }
    }

    // General API: 120 req/min
    else {
      if (!rateLimit(`api:${ip}`, 120)) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429, headers: { "Retry-After": "60" } }
        );
      }
    }
  }

  // ── 3. Block direct access to debug endpoints in production ───────────────────
  if (pathname.startsWith("/api/debug") && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/:path*",
  ],
};
