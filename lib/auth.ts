import { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import AzureADProvider from "next-auth/providers/azure-ad";

// Delegated Graph scopes for Teams DM notifications.
// Chat.Create + ChatMessage.Send do NOT require admin consent.
// offline_access gives us a refresh_token so sessions outlast the 1-hour access token.
const GRAPH_SCOPES = "Chat.Create ChatMessage.Send offline_access";

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const res = await fetch(
      `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type:    "refresh_token",
          client_id:     process.env.AZURE_AD_CLIENT_ID!,
          client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
          refresh_token: token.refreshToken as string,
          scope:         `openid profile email ${GRAPH_SCOPES}`,
        }),
      }
    );
    const data = await res.json() as {
      access_token?:  string;
      refresh_token?: string;
      expires_in?:    number;
    };
    if (!res.ok) throw data;
    return {
      ...token,
      accessToken:  data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      expiresAt:    Math.floor(Date.now() / 1000 + (data.expires_in ?? 3600)),
      error:        undefined,
    } as JWT;
  } catch {
    return { ...token, error: "RefreshAccessTokenError" as const } as JWT;
  }
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
    }),
  ],
  pages: {
    signIn: "/login",
    error:  "/login",
  },
  callbacks: {
    async jwt({ token, account }) {
      // First sign-in: persist tokens from Azure AD
      if (account) {
        return {
          ...token,
          accessToken:  account.access_token,
          refreshToken: account.refresh_token,
          expiresAt:    account.expires_at,
        };
      }
      // Token still valid (with 60s buffer)
      if (Date.now() < (token.expiresAt as number) * 1000 - 60_000) {
        return token;
      }
      // Silently refresh
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as typeof session.user & { id: string }).id = token.sub;
      }
      (session as unknown as Record<string, unknown>).accessToken = token.accessToken;
      (session as unknown as Record<string, unknown>).error       = token.error;
      // Expire the session immediately so middleware redirects to re-login
      if (token.error === "RefreshAccessTokenError") {
        (session as unknown as Record<string, unknown>).expires = new Date(0).toISOString();
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
};