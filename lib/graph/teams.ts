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
  const data = await res.json() as { access_token?: string };
  return data.access_token ?? null;
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
 * Resolve the best available token.
 * Callers pass sessionAccessToken from getToken(req) — it's the final fallback.
 */
export async function resolveToken(sessionAccessToken?: string): Promise<string | null> {
  const appToken = await getAppToken();
  if (appToken) return appToken;

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
        message: `User ${recipientEmail} tidak ditemukan. Tambahkan izin User.ReadBasic.All (Delegated) di Azure AD app registration, lalu login ulang untuk generate token baru.`,
      },
    };
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

/** Send an HTML message to an existing chat. */
export async function sendMessageToChat(token: string, chatId: string, html: string): Promise<boolean> {
  const { status } = await gPost(token, `/chats/${chatId}/messages`, {
    body: { contentType: "html", content: html },
  });
  return status === 201;
}

// ── Message builder ────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export function buildAlertHtml(
  alerts: KPIAlert[],
  opts: { plant?: string; period?: string; dashboardUrl?: string; recommendation?: string }
): string {
  const now = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short",
  });

  const rows = alerts
    .map((a) => {
      const icon  = a.severity === "critical" ? "🔴" : a.severity === "warning" ? "🟡" : "🔵";
      const trend = a.trend != null
        ? ` <span style="color:${a.trend < 0 ? "#dc2626" : "#16a34a"}">(${a.trend > 0 ? "+" : ""}${a.trend.toFixed(1)}%)</span>`
        : "";
      return `<li>${icon} <b>${escHtml(a.kpi)}</b>: ${escHtml(a.message)}${trend}</li>`;
    })
    .join("");

  const rec  = opts.recommendation
    ? `<p>💡 <b>Rekomendasi AI:</b> ${escHtml(opts.recommendation)}</p>`
    : "";
  const link = opts.dashboardUrl
    ? `<p><a href="${escHtml(opts.dashboardUrl)}">Buka Dashboard →</a></p>`
    : "";

  return [
    `<p><b>⚠️ Control Tower Manufacturing — KPI Alert</b></p>`,
    `<p style="color:#6b7280;font-size:13px">${opts.plant ?? "All Plant"} · ${opts.period ?? ""} · ${now} WIB</p>`,
    `<ul>${rows}</ul>`,
    rec,
    link,
  ].join("");
}

// ── Per-recipient routing ─────────────────────────────────────────────────────

const KPI_LABEL_TO_KEY: Record<string, string> = {
  "Lead Time":        "leadTime",
  "Bulk Loss":        "bulkLoss",
  "Pack Loss":        "packLoss",
  "Right First Time": "rft",
  "OEE":              "oee",
};

export interface TeamsRecipientConfig {
  email: string;
  kpis: Record<string, boolean>;
}

/**
 * Send alerts to explicit UI-configured recipients, filtered per their KPI subscription.
 * Each recipient only receives a message if at least one of their subscribed KPIs triggered.
 */
export async function sendGraphAlertsRouted(
  alerts: KPIAlert[],
  recipients: TeamsRecipientConfig[],
  opts: SendGraphAlertsOptions = {}
): Promise<{ ok: boolean; sent: number; errors: string[] }> {
  if (alerts.length === 0 || recipients.length === 0) return { ok: true, sent: 0, errors: [] };

  const token = await resolveToken(opts.accessToken);
  if (!token) {
    return {
      ok:     false,
      sent:   0,
      errors: ["No token available — user must sign out and sign back in to grant Teams permissions"],
    };
  }

  const errors: string[] = [];
  let sent = 0;

  for (const recipient of recipients) {
    const filtered = alerts.filter((a) => {
      const key = KPI_LABEL_TO_KEY[a.kpi];
      return !key || recipient.kpis[key] !== false;
    });
    if (filtered.length === 0) continue;

    const { chatId, graphError } = await findOrCreateChat(token, recipient.email);
    if (!chatId) {
      const detail = graphError ? ` — ${JSON.stringify(graphError)}` : "";
      errors.push(`${recipient.email}: could not find or create chat${detail}`);
      continue;
    }
    const html = buildAlertHtml(filtered, opts);
    const ok = await sendMessageToChat(token, chatId, html);
    if (ok) sent++;
    else errors.push(`${recipient.email}: message delivery failed`);
  }

  return { ok: sent > 0, sent, errors };
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface SendGraphAlertsOptions {
  plant?:          string;
  period?:         string;
  dashboardUrl?:   string;
  recommendation?: string;
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

  const html   = buildAlertHtml(alerts, opts);
  const errors: string[] = [];
  let sent = 0;

  for (const email of recipients) {
    const { chatId, graphError } = await findOrCreateChat(token, email);
    if (!chatId) {
      const detail = graphError ? ` — ${JSON.stringify(graphError)}` : "";
      errors.push(`${email}: could not find or create chat${detail}`);
      continue;
    }
    const ok = await sendMessageToChat(token, chatId, html);
    if (ok) sent++;
    else errors.push(`${email}: message delivery failed`);
  }

  return { ok: sent > 0, sent, errors };
}