// Server-side admin check: ADMIN_EMAILS (env) ∪ admins added in Settings → Admin (lib/access.ts).
// No admin configured anywhere → every authenticated user is admin (backwards-compat).
// Async: always `await isServerAdmin(...)` — an un-awaited Promise is truthy.

export { isAdmin as isServerAdmin } from "@/lib/access";
