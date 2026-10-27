// Persistent notification state: Teams settings, per-recipient schedules, sent log and the sender connection.
//
// Backend is picked by env, like DATA_SOURCE for queries:
//   BLOB_STORE_ID (Vercel OIDC — what connecting a store adds today) or BLOB_READ_WRITE_TOKEN set
//                             → Vercel Blob, private, read without CDN cache, conditional writes (ETag)
//   otherwise                 → JSON file in NOTIF_STORE_DIR (default ./data) — local dev, or a volume on Kubernetes
// The sender's refresh token is encrypted at rest (AES-256-GCM, key = NOTIF_STORE_KEY, else NEXTAUTH_SECRET).

import { readFile, writeFile, mkdir, rename } from "fs/promises";
import path from "path";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export type AlertMode    = "off" | "instant" | "digest";
export type SummaryMode  = "off" | "daily" | "weekly";
export type SummaryRange = "7D" | "30D" | "YTD";

export interface RecipientConfig {
  email: string;
  /** "All Plant" or a plant code — alerts and summaries for this plant only */
  plant: string;
  /** Alert KPI subscription (keys from lib/aiScope.ts → ALERT_KPIS) */
  kpis: Record<string, boolean>;
  /** instant = when an alert fires; digest = once a day at `time` (WIB, "HH:MM") */
  alerts: { mode: AlertMode; time: string };
  /** weekday 1 = Monday … 7 = Sunday (weekly only); range = period the summary covers */
  summary: { mode: SummaryMode; time: string; weekday: number; range: SummaryRange };
}

export interface SenderConnection {
  email: string;
  name?: string;
  connectedAt: number;
  refreshToken: string;
}

export interface NotifState {
  enabled: boolean;
  recipients: RecipientConfig[];
  /** Alert dedup: `${email}|alert|${plant}|${alertId}` → sent at (ms) */
  sentAlerts: Record<string, number>;
  /** Schedules: `${email}|summary` / `${email}|digest` → last sent (ms) */
  lastSent: Record<string, number>;
  sender?: SenderConnection;
  lastRun?: number;
}

export const DEFAULT_TIME = "07:00";

export function normalizeRecipient(r: Partial<RecipientConfig> & { email: string }): RecipientConfig {
  const time = (t: unknown) => (typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : DEFAULT_TIME);
  const alertMode: AlertMode     = r.alerts?.mode === "off" || r.alerts?.mode === "digest" ? r.alerts.mode : "instant";
  const summaryMode: SummaryMode = r.summary?.mode === "daily" || r.summary?.mode === "weekly" ? r.summary.mode : "off";
  const range: SummaryRange      = r.summary?.range === "7D" || r.summary?.range === "YTD" ? r.summary.range : "30D";
  const weekday = Number(r.summary?.weekday);
  return {
    email:   r.email.trim().toLowerCase(),
    plant:   typeof r.plant === "string" && r.plant ? r.plant : "All Plant",
    kpis:    r.kpis && typeof r.kpis === "object" ? r.kpis : {},
    alerts:  { mode: alertMode, time: time(r.alerts?.time) },
    summary: { mode: summaryMode, time: time(r.summary?.time), weekday: weekday >= 1 && weekday <= 7 ? weekday : 1, range },
  };
}

const empty = (): NotifState => ({ enabled: false, recipients: [], sentAlerts: {}, lastSent: {} });

// ── Encryption (sender refresh token only) ────────────────────────────────────

function key(): Buffer {
  const secret = process.env.NOTIF_STORE_KEY ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NOTIF_STORE_KEY or NEXTAUTH_SECRET is required to store the sender token");
  return createHash("sha256").update(secret).digest();
}

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${data.toString("base64")}`;
}

function decrypt(box: string): string | null {
  try {
    const [v, iv, tag, data] = box.split(":");
    if (v !== "v1") return null;
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
  } catch {
    return null; // key changed → the sender has to connect again
  }
}

function parse(text: string): NotifState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = JSON.parse(text) as any;
  const token = typeof p.sender?.refreshToken === "string" ? decrypt(p.sender.refreshToken) : null;
  return {
    enabled:    p.enabled === true,
    recipients: Array.isArray(p.recipients) ? p.recipients.filter((r: { email?: unknown }) => typeof r?.email === "string").map(normalizeRecipient) : [],
    sentAlerts: p.sentAlerts && typeof p.sentAlerts === "object" ? p.sentAlerts : {},
    lastSent:   p.lastSent && typeof p.lastSent === "object" ? p.lastSent : {},
    sender:     p.sender && token ? { ...p.sender, refreshToken: token } : undefined,
    lastRun:    typeof p.lastRun === "number" ? p.lastRun : undefined,
  };
}

function serialize(s: NotifState): string {
  return JSON.stringify({ ...s, sender: s.sender ? { ...s.sender, refreshToken: encrypt(s.sender.refreshToken) } : undefined }, null, 2);
}

// ── Backends ──────────────────────────────────────────────────────────────────

const BLOB_PATH = "notifications/state.json";
// On Vercel, BLOB_STORE_ID + the runtime OIDC token authenticate; @vercel/blob resolves both itself
const useBlob = () => !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);

async function blobRead(): Promise<{ state: NotifState; etag?: string }> {
  const { get } = await import("@vercel/blob");
  const res = await get(BLOB_PATH, { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) return { state: empty() };
  return { state: parse(await new Response(res.stream).text()), etag: res.blob.etag };
}

async function blobWrite(state: NotifState, etag?: string): Promise<void> {
  const { put } = await import("@vercel/blob");
  await put(BLOB_PATH, serialize(state), {
    access: "private", addRandomSuffix: false, allowOverwrite: true,
    contentType: "application/json", cacheControlMaxAge: 60,
    ...(etag ? { ifMatch: etag } : {}),
  });
}

const dir = () => process.env.NOTIF_STORE_DIR ?? path.join(process.cwd(), "data");
const FILE = () => path.join(dir(), "notifications.json");
const LEGACY_FILE = () => path.join(dir(), "teams-settings.json"); // before 2026-10-06: { enabled, recipients, sentAlerts }

async function fileRead(): Promise<NotifState> {
  for (const f of [FILE(), LEGACY_FILE()]) {
    try { return parse(await readFile(f, "utf-8")); } catch { /* next */ }
  }
  return empty();
}

async function fileWrite(state: NotifState): Promise<void> {
  await mkdir(dir(), { recursive: true });
  const tmp = `${FILE()}.${process.pid}.tmp`;
  await writeFile(tmp, serialize(state), "utf-8");
  await rename(tmp, FILE());
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function readNotifState(): Promise<NotifState> {
  return useBlob() ? (await blobRead()).state : fileRead();
}

/** Read → change → write. On Blob a concurrent write makes the ETag stale; it then retries on fresh state. */
export async function updateNotifState(change: (s: NotifState) => void): Promise<NotifState> {
  for (let attempt = 0; ; attempt++) {
    const { state, etag } = useBlob() ? await blobRead() : { state: await fileRead(), etag: undefined };
    change(state);
    try {
      if (useBlob()) await blobWrite(state, etag);
      else await fileWrite(state);
      return state;
    } catch (err) {
      const stale = useBlob() && err instanceof (await import("@vercel/blob")).BlobPreconditionFailedError;
      if (!stale || attempt >= 3) throw err;
    }
  }
}

export const storeBackend = (): "blob" | "file" => (useBlob() ? "blob" : "file");
