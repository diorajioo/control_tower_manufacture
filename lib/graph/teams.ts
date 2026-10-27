/**
 * lib/graph/teams.ts — Microsoft Graph API client for Teams messaging
 *
 * Supports two auth modes (selected automatically via env vars):
 *
 *   DELEGATED (default)
 *     Sends messages "as" the logged-in user.
 *     Requires: user to log in with new scopes (Chat.Create, ChatMessage.Send).
 *     No admin consent needed.
 *     Recipients: TEAMS_RECIPIENTS env var (comma-separated emails).
 *
 *   APPLICATION (future — requires admin)
 *     Sends messages "as the app" using client credentials.
 *     Activate: set TEAMS_USE_APP_TOKEN=true after admin has granted
 *     Application permissions (ChannelMessage.Send or Chat.ReadWrite.All).
 *
 * Token priority in resolveToken():
 *   1. App token   (if TEAMS_USE_APP_TOKEN=true + admin granted permissions)
 *   2. Stored refresh token  (TEAMS_REFRESH_TOKEN env var — for background/cron jobs)
 *   3. Session access token  (passed in from the caller — for real-time alerts)
 */

import type { KPIAlert } from "@/lib/alerts";
import { buildAlertCard, alertSummary, type AdaptiveCard } from "@/lib/alerts/teams";
import { getSenderRefreshToken, saveSenderRefreshToken } from "@/lib/settings";

const GRAPH    = "https://graph.microsoft.com/v1.0";
const TOKEN_EP = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;

// ── Token helpers ──────────────────────────────────────────────────────────────

/**
 * Exchange a stored refresh token for a new access token.
 * Used for background jobs where no active user session exists.
 * Populate TEAMS_REFRESH_TOKEN once by calling GET /api/auth/teams/token
 * while logged in.
 */
export async function getTokenFromRefresh(refreshToken: string): Promise<string | null> {
  return (await redeemRefreshToken(refreshToken))?.accessToken ?? null;
}

/** Refresh-token grant; Azure AD also returns a rotated refresh token to keep. */
async function redeemRefreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string } | null> {
  const res = await fetch(TOKEN_EP, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      client_id:     process.env.AZURE_AD_CLIENT_ID!,
      client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
      refresh_token: refreshToken,
      scope:         "openid profile email User.Read User.ReadBasic.All Chat.Create ChatMessage.Send offline_access",
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { access_token?: string; refresh_token?: string };
  return data.access_token ? { accessToken: data.access_token, refreshToken: data.refresh_token } : null;
}

/**
 * Get an app-level access token via client credentials flow.
 *
 * APPLICATION PERMISSIONS needed in Azure portal (API permissions → Application):
 *   For channels:  ChannelMessage.Send
 *   For DMs:       Chat.ReadWrite.All + ChatMessage.Send  ← restricted API,
 *                  requires a support ticket to Microsoft to unlock
 *
 * Only active when TEAMS_USE_APP_TOKEN=true.
 */
export async function getAppToken(): Promise<string | null> {
  if (process.env.TEAMS_USE_APP_TOKEN !== "true") return null;
  const res = await fetch(TOKEN_EP, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     process.env.AZURE_AD_CLIENT_ID!,
      client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
      scope:         "https://graph.microsoft.com/.default",
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { access_token?: string };
  return data.access_token ?? null;
}

/**
 * Resolve the best available token:
 *   1. app token (TEAMS_USE_APP_TOKEN)
 *   2. connected sender (Settings → Teams → Sender; refresh token in the notification store, rotated on use)
 *   3. TEAMS_REFRESH_TOKEN env
 *   4. sessionAccessToken from getToken(req) — interactive sends only; the scheduled runner has none
 */
export async function resolveToken(sessionAccessToken?: string): Promise<string | null> {
  const appToken = await getAppToken();
  if (appToken) return appToken;

  const stored = await getSenderRefreshToken().catch(() => null);
  if (stored) {
    const t = await redeemRefreshToken(stored);
    if (t) {
      if (t.refreshToken && t.refreshToken !== stored) await saveSenderRefreshToken(t.refreshToken).catch(() => {});
      return t.accessToken;
    }
    console.error("[teams] connected sender token could not be refreshed — reconnect the sender in Settings");
  }

  if (process.env.TEAMS_REFRESH_TOKEN) {
    const t = await getTokenFromRefresh(process.env.TEAMS_REFRESH_TOKEN);
    if (t) return t;
  }

  return sessionAccessToken ?? null;
}

// ── Graph API wrappers ────────────────────────────────────────────────────────

async function gGet<T>(token: string, path: string): Promise<T | null> {
  const res = await fetch(`${GRAPH}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

async function gPost<T>(token: string, path: string, body: unknown): Promise<{ data: T | null; status: number; errorBody?: unknown }> {
  const res = await fetch(`${GRAPH}${path}`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  let parsed: unknown;
  try { parsed = await res.json(); } catch { /* ignore */ }
  if (!res.ok) {
    console.error(`[teams] POST ${path} → ${res.status}`, JSON.stringify(parsed));
    return { data: null, status: res.status, errorBody: parsed };
  }
  return { data: parsed as T, status: res.status };
}

// ── Chat helpers ──────────────────────────────────────────────────────────────

/**
 * Find or create a 1:1 chat between the authenticated user and a recipient.
 * Teams automatically deduplicates — calling POST /chats with the same two
 * members returns the existing chat rather than creating a duplicate.
 *
 * Requires: Chat.Create + User.ReadBasic.All (delegated).
 * User.ReadBasic.All is needed to resolve the recipient's object ID.
 * The sender's ID is resolved via GET /me (always available).
 */
export async function findOrCreateChat(
  token: string,
  recipientEmail: string
): Promise<{ chatId: string | null; graphError?: unknown }> {
  // Resolve sender GUID from /me (User.Read — always available)
  const me = await gGet<{ id?: string }>(token, "/me");
  if (!me?.id) {
    return { chatId: null, graphError: { message: "Could not resolve sender identity from /me" } };
  }

  // Resolve recipient GUID (requires User.ReadBasic.All delegated permission)
  const recipientUser = await gGet<{ id?: string }>(token, `/users/${recipientEmail}`);
  if (!recipientUser?.id) {
    return {
      chatId: null,
      graphError: {
        message: `User ${recipientEmail} not found. Add the User.ReadBasic.All (Delegated) permission to the Azure AD app registration, then sign in again to generate a new token.`,
      },
    };
  }

  if (recipientUser.id === me.id) {
    return { chatId: null, graphError: { message: `${recipientEmail} is the sender account — Teams cannot send a DM to itself` } };
  }

  const { data: chat, errorBody } = await gPost<{ id?: string }>(token, "/chats", {
    chatType: "oneOnOne",
    members: [
      {
        "@odata.type": "#microsoft.graph.aadUserConversationMember",
        roles: ["owner"],
        "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${recipientUser.id}')`,
      },
      {
        "@odata.type": "#microsoft.graph.aadUserConversationMember",
        roles: ["owner"],
        "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${me.id}')`,
      },
    ],
  });
  return { chatId: chat?.id ?? null, graphError: errorBody };
}

/** Send an Adaptive Card to an existing chat; `summary` is the push-notification / chat-list preview. */
export async function sendCardToChat(token: string, chatId: string, card: AdaptiveCard, summary: string): Promise<boolean> {
  const id = crypto.randomUUID();
  const { status } = await gPost(token, `/chats/${chatId}/messages`, {
    summary,
    body: { contentType: "html", content: `<attachment id="${id}"></attachment>` },
    attachments: [{ id, contentType: "application/vnd.microsoft.card.adaptive", contentUrl: null, content: JSON.stringify(card) }],
  });
  return status === 201;
}

/** One card to one person: find/create the 1:1 chat, then send. Returns an error text or null. */
export async function sendCardTo(token: string, email: string, card: AdaptiveCard, summary: string): Promise<string | null> {
  const { chatId, graphError } = await findOrCreateChat(token, email);
  if (!chatId) return `${email}: could not find or create chat${graphError ? ` — ${JSON.stringify(graphError)}` : ""}`;
  return (await sendCardToChat(token, chatId, card, summary)) ? null : `${email}: message delivery failed`;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface SendGraphAlertsOptions {
  plant?:          string;
  period?:         string;
  dashboardUrl?:   string;
  /** KPI snapshot for the card's facts block */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kpi?:            any;
  /** 2-sentence why + action (generateAlertNarrative) */
  narrative?:      string;
  /** Access token from the current user session (falls back to stored refresh token) */
  accessToken?:    string;
}

/**
 * Send an alert message to every address in TEAMS_RECIPIENTS as a personal DM.
 * Returns { ok, sent, errors } — never throws.
 */
export async function sendGraphAlerts(
  alerts: KPIAlert[],
  opts: SendGraphAlertsOptions = {}
): Promise<{ ok: boolean; sent: number; errors: string[] }> {
  if (alerts.length === 0) return { ok: true, sent: 0, errors: [] };

  const token = await resolveToken(opts.accessToken);
  if (!token) {
    return {
      ok:     false,
      sent:   0,
      errors: ["No token available — user must sign out and sign back in to grant Teams permissions"],
    };
  }

  const recipients = (process.env.TEAMS_RECIPIENTS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    return { ok: false, sent: 0, errors: ["TEAMS_RECIPIENTS is not configured"] };
  }

  const card    = buildAlertCard(alerts, opts);
  const summary = alertSummary(alerts);
  const errors: string[] = [];
  let sent = 0;

  for (const email of recipients) {
    const { chatId, graphError } = await findOrCreateChat(token, email);
    if (!chatId) {
      const detail = graphError ? ` — ${JSON.stringify(graphError)}` : "";
      errors.push(`${email}: could not find or create chat${detail}`);
      continue;
    }
    const ok = await sendCardToChat(token, chatId, card, summary);
    if (ok) sent++;
    else errors.push(`${email}: message delivery failed`);
  }

  return { ok: sent > 0, sent, errors };
}