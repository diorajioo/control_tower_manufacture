// Dashboard access (Settings → Admin): who may open the dashboard and who is admin.
//   Admins  = ADMIN_EMAILS (env, server config — not removable in the page) ∪ admins added in Settings.
//             No admin anywhere → every signed-in account is admin (the behaviour before this list existed).
//   Access  = mode "everyone": any account that signs in with Microsoft (the Entra tenant);
//             mode "list": admins + `users` only. Admins always have access, so nobody locks the page.
// Checked at sign-in (signIn callback, lib/auth.ts) and on every session read (jwt callback), so a removed person
// loses access within CACHE_MS on each pod. Stored in the notification store (Vercel Blob or JSON file).

import { readNotifState, updateNotifState, type AccessEntry, type AccessState } from "@/lib/notifications/store";

export type { AccessEntry, AccessState };

const CACHE_MS = 30_000;
const MAX_ENTRIES = 2000;
const EMPTY: AccessState = { mode: "everyone", users: [], admins: [] };
let cache: { at: number; state: AccessState } | null = null;

export const normEmail = (e: string) => e.trim().toLowerCase();
export const isEmail = (e: string) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/** Admins from ADMIN_EMAILS (comma-separated). */
export function envAdmins(): string[] {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map(normEmail).filter(Boolean);
}

/** Access state, cached CACHE_MS per server instance. A failed read keeps the last known state. */
export async function getAccess(fresh = false): Promise<AccessState> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.state;
  try {
    const state = (await readNotifState()).access ?? EMPTY;
    cache = { at: Date.now(), state };
    return state;
  } catch (err) {
    console.error("[access] reading the access list failed:", err);
    return cache?.state ?? EMPTY;
  }
}

const adminSet = (s: AccessState) => new Set([...envAdmins(), ...s.admins.map((a) => a.email)]);

export async function isAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const admins = adminSet(await getAccess());
  return admins.size === 0 || admins.has(normEmail(email));
}

export async function canAccess(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const s = await getAccess();
  if (s.mode === "everyone") return true;
  const e = normEmail(email), admins = adminSet(s);
  return admins.size === 0 || admins.has(e) || s.users.some((u) => u.email === e);
}

/**
 * Saves the access settings. The person saving always stays admin (another admin can remove them), so the list
 * can never lock out the last admin; switching to "list" with no admin makes the person saving the first one.
 */
export async function saveAccess(input: { mode: AccessState["mode"]; users: string[]; admins: string[] }, by: string): Promise<AccessState> {
  const me = normEmail(by), env = new Set(envAdmins()), now = Date.now();
  const keep = (prev: AccessEntry[], emails: string[], skip: Set<string>) => {
    const seen = new Set<string>();
    return emails.map(normEmail).filter((e) => isEmail(e) && !skip.has(e) && !seen.has(e) && seen.add(e)).slice(0, MAX_ENTRIES)
      .map((email) => prev.find((p) => p.email === email) ?? { email, addedBy: me, addedAt: now });
  };
  const next = await updateNotifState((s) => {
    const prev = s.access ?? EMPTY;
    let admins = keep(prev.admins, input.admins, env);
    const restricted = env.size + admins.length > 0 || input.mode === "list";
    if (restricted && !env.has(me) && !admins.some((a) => a.email === me)) {
      admins = [...admins, prev.admins.find((p) => p.email === me) ?? { email: me, addedBy: me, addedAt: now }];
    }
    s.access = { mode: input.mode === "list" ? "list" : "everyone", users: keep(prev.users, input.users, new Set()), admins };
  });
  cache = { at: Date.now(), state: next.access ?? EMPTY };
  return cache.state;
}
