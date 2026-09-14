import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const FILE = path.join(process.cwd(), "data", "teams-settings.json");

// How long before the same alert ID can be re-sent (20 hours).
// Prevents multiple open browser sessions from each triggering the same alert.
const DEDUP_WINDOW_MS = 20 * 60 * 60 * 1000;

export interface RecipientConfig {
  email: string;
  kpis: Record<string, boolean>;
}

export interface TeamsSettings {
  enabled: boolean;
  recipients: RecipientConfig[];
  sentAlerts: Record<string, number>; // alertId → sent-at timestamp (ms)
}

const DEFAULT: TeamsSettings = { enabled: false, recipients: [], sentAlerts: {} };

async function read(): Promise<TeamsSettings> {
  try {
    const raw = await readFile(FILE, "utf-8");
    const p = JSON.parse(raw) as Partial<TeamsSettings>;
    return {
      enabled:    p.enabled    ?? false,
      recipients: Array.isArray(p.recipients) ? p.recipients : [],
      sentAlerts: p.sentAlerts && typeof p.sentAlerts === "object" ? p.sentAlerts : {},
    };
  } catch {
    return { ...DEFAULT };
  }
}

async function write(settings: TeamsSettings): Promise<void> {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(settings, null, 2), "utf-8");
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getTeamsSettings(): Promise<Omit<TeamsSettings, "sentAlerts">> {
  const { enabled, recipients } = await read();
  return { enabled, recipients };
}

export async function saveTeamsSettings(settings: Pick<TeamsSettings, "enabled" | "recipients">): Promise<void> {
  const current = await read();
  await write({ ...current, ...settings });
}

/**
 * Filter out alert IDs that were already sent within DEDUP_WINDOW_MS.
 * Returns only the IDs that should actually be sent now.
 */
export async function filterUnsentAlerts(alertIds: string[]): Promise<string[]> {
  const settings = await read();
  const now = Date.now();
  return alertIds.filter((id) => {
    const ts = settings.sentAlerts[id];
    return !ts || now - ts > DEDUP_WINDOW_MS;
  });
}

/**
 * Record that these alert IDs were sent now.
 * Also prunes stale entries older than DEDUP_WINDOW_MS.
 */
export async function markAlertsSent(alertIds: string[]): Promise<void> {
  const settings = await read();
  const now = Date.now();

  // Prune expired entries
  for (const [id, ts] of Object.entries(settings.sentAlerts)) {
    if (now - ts > DEDUP_WINDOW_MS) delete settings.sentAlerts[id];
  }

  for (const id of alertIds) {
    settings.sentAlerts[id] = now;
  }

  await write(settings);
}
