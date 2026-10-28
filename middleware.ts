import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { SESSION_COOKIE } from "@/lib/basePath";

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
  store.forEach((v, k) => {
    if (v.windowStart < cutoff) store.delete(k);
  });
}, WINDOW_MS);

// ── Middleware ─────────────────────────────────────────────────────────────────

// req.nextUrl.pathname has the base path (/ct-manuf on Kubernetes) stripped; a clone keeps it
// when serialised, so the redirect stays inside this app on the shared host.
function loginRedirect(req: NextRequest, param: string, value: string) {
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set(param, value);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── 1. Protect the app pages — redirect to login if unauthenticated ──────────
  if (["/dashboard", "/lead-time", "/monitor"].some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: SESSION_COOKIE });
    // Relative: behind the ingress the server only knows its own bind address (0.0.0.0:3000)
    if (!token) return loginRedirect(req, "callbackUrl", `${req.nextUrl.basePath}${pathname}${req.nextUrl.search}`);

    // Reject sessions with a failed token refresh — force re-login
    if (token.error === "RefreshAccessTokenError") return loginRedirect(req, "error", "SessionExpired");
  }

  // ── 2. CSRF: state-changing API calls must come from this host ───────────────
  // SameSite=lax does not help here: paradev.io is not a public suffix, so every *.paradev.io
  // site counts as same-site and gets our cookies sent, and req.json() parses a text/plain form
  // body. Browsers always send Origin on non-GET requests. next-auth has its own CSRF token.
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/") && req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    let sameHost = false;
    try { sameHost = !!origin && new URL(origin).host === host; } catch { /* malformed Origin */ }
    if (!sameHost) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── 3. Rate limiting on API routes ────────────────────────────────────────────
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

  // ── 4. Block direct access to debug endpoints in production ───────────────────
  if (pathname.startsWith("/api/debug") && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // JSON only; next.config.mjs gives /api its own locked-down policy.
  if (pathname.startsWith("/api/")) return NextResponse.next();
  return withCsp(req);
}

// ── 5. Per-request nonce CSP on every page ──────────────────────────────────────
// The hostname is shared with other dashboards (poros-staging.paradev.io/<app>): one origin, so a
// script injected here could call every other dashboard's API with the user's cookies. A nonce
// replaces 'unsafe-inline' — only scripts Next.js (or the root layout) stamped with it run.
// Next.js reads the nonce from the request's CSP header and puts it on its own scripts; the root
// layout reads x-nonce for its inline one. Requires dynamic rendering (the layout calls headers()).
function withCsp(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = [
    "default-src 'self'",
    // 'unsafe-eval' only for webpack HMR in dev; production never evals
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    // Nivo, framer-motion and React style props write style attributes, which a nonce cannot cover
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    // Groq, Graph and Entra are called by the server only; the browser talks to us and OpenPanel
    "connect-src 'self' https://openpanel.pti-cosmetics.com",
    "object-src 'none'",
    // 'self' would be any app on the shared host; the app never uses <base>
    "base-uri 'none'",
    "form-action 'self' https://login.microsoftonline.com",
    "frame-ancestors 'none'",
  ].join("; ");

  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("content-security-policy", csp);
  return res;
}

export const config = {
  // Paths are relative to the base path. Static assets and /healthz (the probe has no session)
  // skip it; "/" is listed on its own because the pattern never matches the bare /ct-manuf.
  matcher: ["/", "/((?!_next/static|_next/image|healthz|favicon.ico|icon|.*\\.png$).*)"],
};
