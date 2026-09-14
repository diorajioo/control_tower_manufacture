import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const FILE = path.join(process.cwd(), "data", "teams-settings.json");

export interface RecipientConfig {
  email: string;
  kpis: Record<string, boolean>;
}

export interface TeamsSettings {
  enabled: boolean;
  recipients: RecipientConfig[];
}

const DEFAULT: TeamsSettings = { enabled: false, recipients: [] };

export async function getTeamsSettings(): Promise<TeamsSettings> {
  try {
    const raw = await readFile(FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<TeamsSettings>;
    return {
      enabled: parsed.enabled ?? false,
      recipients: Array.isArray(parsed.recipients) ? parsed.recipients : [],
    };
  } catch {
    return DEFAULT;
  }
}

export async function saveTeamsSettings(settings: TeamsSettings): Promise<void> {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(settings, null, 2), "utf-8");
}
