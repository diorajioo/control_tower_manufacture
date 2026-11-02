// Value of the "connect the Teams sender" marker cookie (CONNECT_SENDER_COOKIE): an expiry plus an
// HMAC bound to the admin who clicked Connect. A constant value could be planted by another app on
// the shared host or any *.paradev.io site, and the next admin sign-in would silently become the
// sender. Server-only (node:crypto). Check: npx tsx scripts/check-session.ts
import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 10 * 60_000;

function sign(sub: string, exp: number, secret: string): string {
  return createHmac("sha256", secret).update(`connect-sender:${sub}:${exp}`).digest("base64url");
}

export function senderMarker(sub: string, secret = process.env.NEXTAUTH_SECRET ?? "", now = Date.now()): string {
  const exp = now + TTL_MS;
  return `${exp}.${sign(sub, exp, secret)}`;
}

/** True only for an unexpired marker made for this same account (`sub` of the sign-in). */
export function isSenderMarkerValid(
  value: string | undefined, sub: string | undefined, secret = process.env.NEXTAUTH_SECRET ?? "", now = Date.now(),
): boolean {
  if (!value || !sub || !secret) return false;
  const [expRaw, sig] = value.split(".");
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < now || !sig) return false;
  const want = Buffer.from(sign(sub, exp, secret));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
