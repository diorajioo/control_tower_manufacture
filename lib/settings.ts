// Teams notification settings, alert dedup and the sender connection — on top of lib/notifications/store.ts
// (Vercel Blob or a JSON file; the old data/teams-settings.json is read once as a fallback).

import { readNotifState, updateNotifState, normalizeRecipient, type RecipientConfig } from "@/lib/notifications/store";

export type { RecipientConfig } from "@/lib/notifications/store";

// How long before the same alert can be re-sent to the same recipient (20 hours).
// Prevents open browser sessions and the scheduled runner from sending the same alert twice.
const DEDUP_WINDOW_MS = 20 * 60 * 60 * 1000;

export interface TeamsSettings {
  enabled: boolean;
  recipients: RecipientConfig[];
}

/** Sender shown in Settings — never includes the token. */
export interface SenderInfo { email: string; name?: string; connectedAt: number }

export async function getTeamsSettings(): Promise<TeamsSettings & { sender?: SenderInfo; lastRun?: number }> {
  const { enabled, recipients, sender, lastRun } = await readNotifState();
  return {
    enabled,
    recipients,
    sender: sender ? { email: sender.email, name: sender.name, connectedAt: sender.connectedAt } : undefined,
    lastRun,
  };
}

export async function saveTeamsSettings(settings: { enabled: boolean; recipients: Array<Partial<RecipientConfig> & { email: string }> }): Promise<void> {
  const now = Date.now();
  await updateNotifState((s) => {
    s.enabled = settings.enabled;
    s.recipients = settings.recipients.map(normalizeRecipient);
    // A new schedule starts at its next occurrence, not at the one already passed today
    for (const r of s.recipients) {
      for (const k of [`${r.email}|summary`, `${r.email}|digest`]) s.lastSent[k] ??= now;
    }
  });
}

/** Dedup key for one alert to one recipient. */
export const alertKey = (email: string, plant: string, alertId: string) => `${email}|alert|${plant}|${alertId}`;

/** Keys not sent within DEDUP_WINDOW_MS. */
export async function filterUnsentKeys(keys: string[]): Promise<string[]> {
  const { sentAlerts } = await readNotifState();
  const now = Date.now();
  return keys.filter((k) => !sentAlerts[k] || now - sentAlerts[k] > DEDUP_WINDOW_MS);
}

/** Record sends: alert keys (dedup) and schedule keys (`email|summary`, `email|digest`). Prunes expired alert keys. */
export async function markSent(alertKeys: string[], scheduleKeys: string[] = [], lastRun?: number): Promise<void> {
  if (alertKeys.length === 0 && scheduleKeys.length === 0 && lastRun === undefined) return;
  const now = Date.now();
  await updateNotifState((s) => {
    for (const [k, ts] of Object.entries(s.sentAlerts)) if (now - ts > DEDUP_WINDOW_MS) delete s.sentAlerts[k];
    for (const k of alertKeys) s.sentAlerts[k] = now;
    for (const k of scheduleKeys) s.lastSent[k] = now;
    if (lastRun !== undefined) s.lastRun = lastRun;
  });
}

// ── Sender connection ─────────────────────────────────────────────────────────
// The account that scheduled messages are sent from. Today: whoever clicks "Use my account";
// later a service account signs in and does the same — no code change.

export async function connectSender(sender: { email: string; name?: string; refreshToken: string }): Promise<void> {
  await updateNotifState((s) => { s.sender = { ...sender, email: sender.email.toLowerCase(), connectedAt: Date.now() }; });
}

export async function disconnectSender(): Promise<void> {
  await updateNotifState((s) => { s.sender = undefined; });
}

export async function getSenderRefreshToken(): Promise<string | null> {
  return (await readNotifState()).sender?.refreshToken ?? null;
}

/** Azure AD rotates refresh tokens — keep the newest so the connection does not expire. */
export async function saveSenderRefreshToken(refreshToken: string): Promise<void> {
  await updateNotifState((s) => { if (s.sender) s.sender.refreshToken = refreshToken; });
}
