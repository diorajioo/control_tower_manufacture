import { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { cookies } from "next/headers";
import AzureADProvider from "next-auth/providers/azure-ad";
import { AUTH_COOKIES, CONNECT_SENDER_COOKIE, SESSION_MAX_AGE_S, isSessionFresh, safeRedirect, withBase } from "@/lib/basePath";
import { connectSender } from "@/lib/settings";
import { isServerAdmin } from "@/lib/serverAdmin";
import { isSenderMarkerValid } from "@/lib/senderMarker";

// Delegated Graph scopes for Teams DM notifications, requested at every sign-in so the account can be
// connected as the Teams sender (connectSenderIfRequested). Chat.Create + ChatMessage.Send do NOT
// require admin consent; offline_access gives the refresh token the sender needs.
const GRAPH_SCOPES = "User.Read User.ReadBasic.All Chat.Create ChatMessage.Send offline_access";

/**
 * Settings → Teams → Connect sets CONNECT_SENDER_COOKIE, then starts a Microsoft sign-in. On the way
 * back (here, inside /api/auth/callback) this account's refresh token is stored, encrypted, as the
 * Teams sender — server-side, so it never travels in the session cookie.
 */
async function connectSenderIfRequested(token: JWT, refreshToken: string) {
  const jar = await cookies();
  const marker = jar.get(CONNECT_SENDER_COOKIE.name)?.value;
  if (!marker) return;
  try { jar.set(CONNECT_SENDER_COOKIE.name, "", { ...CONNECT_SENDER_COOKIE.options, maxAge: 0 }); } catch { /* expires on its own */ }
  // Only the admin who clicked Connect, within 10 minutes (HMAC-bound marker, lib/senderMarker.ts)
  if (!isSenderMarkerValid(marker, token.sub) || !token.email || !isServerAdmin(token.email)) return;
  await connectSender({ email: token.email, name: token.name ?? undefined, refreshToken })
    .catch((err) => console.error("[auth] connecting the Teams sender failed:", err));
}

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId:     process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId:     process.env.AZURE_AD_TENANT_ID!,
      authorization: {
        params: { scope: `openid profile email ${GRAPH_SCOPES}` },
      },
      // The stock profile() also fetches the Graph profile photo during the OAuth callback. Nothing
      // shows it, it bloats the session cookie, and when graph.microsoft.com is slow or blocked
      // (cluster egress) the callback hangs: the ingress retries it, the code is redeemed twice,
      // and sign-in fails with AADSTS54005.
      profile(profile) {
        return {
          id:    profile.sub,
          name:  profile.name,
          email: profile.email ?? profile.preferred_username,
          image: null,
        };
      },
    }),
  ],
  // next-auth knows nothing of Next's basePath: its pages and redirects carry it explicitly.
  // Its own API path comes from NEXTAUTH_URL (…/ct-manuf/api/auth on Kubernetes).
  pages: {
    signIn: withBase("/login"),
    error:  withBase("/login"),
  },
  cookies: AUTH_COOKIES,
  callbacks: {
    redirect: ({ url, baseUrl }) => safeRedirect(url, baseUrl),
    async jwt({ token, account }) {
      // The token holds identity + sign-in time only. Microsoft's access + refresh tokens (~6 KB
      // encrypted) pushed the Set-Cookie headers past the ingress's response-header buffer: Kong
      // answered the sign-in callback with a 502, or retried it and Microsoft refused the reused code
      // (AADSTS54005).
      if (account) {
        token.authAt = Date.now();
        if (account.refresh_token) await connectSenderIfRequested(token, account.refresh_token);
      }
      // Absolute lifetime from sign-in; also rejects sessions issued before authAt existed (incl. the
      // old ones carrying Microsoft tokens or a failed-refresh flag). Throwing makes next-auth clear
      // the cookie and answer with no session, so getServerSession() returns null everywhere.
      if (!isSessionFresh(token)) throw new Error("Session expired or issued before 2026-10-28: sign in again");
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as typeof session.user & { id: string }).id = token.sub;
      }
      return session;
    },
  },
  // 7 days from sign-in, absolute (isSessionFresh), then sign in again — usually one click with
  // Microsoft SSO. With no refresh token in the session there is no hourly check with Microsoft, so
  // this is also the longest a disabled account keeps access (user decision 2026-10-28).
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_S },
};