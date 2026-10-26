// Server-side admin check — reads ADMIN_EMAILS env var (comma-separated email list).
// If ADMIN_EMAILS is unset, all authenticated users are treated as admin (backwards-compat).
// Set ADMIN_EMAILS in production to restrict sensitive routes.

export function isServerAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS ?? "";
  if (!raw.trim()) return true; // no list configured → open to any authenticated user
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .includes(email.toLowerCase());
}
