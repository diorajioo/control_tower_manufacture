// Self-check for the absolute session lifetime (lib/basePath.ts → isSessionFresh) and the Teams
// sender marker (lib/senderMarker.ts).
//   npx tsx scripts/check-session.ts
import assert from "node:assert/strict";
import { SESSION_MAX_AGE_S, isSessionFresh } from "../lib/basePath";
import { isSenderMarkerValid, senderMarker } from "../lib/senderMarker";

const NOW = Date.UTC(2026, 9, 28, 12);
const DAY = 24 * 60 * 60 * 1000;

// Session: 7 days from sign-in, absolute; sessions without authAt (issued before) are expired
assert.equal(SESSION_MAX_AGE_S, 7 * 24 * 60 * 60);
assert.equal(isSessionFresh({ authAt: NOW - 6 * DAY }, NOW), true);
assert.equal(isSessionFresh({ authAt: NOW - 7 * DAY }, NOW), false);
assert.equal(isSessionFresh({}, NOW), false);
assert.equal(isSessionFresh({ authAt: String(NOW) }, NOW), false);
assert.equal(isSessionFresh(null, NOW), false);

// Marker: only the same account, unexpired, signed with the same secret
const SECRET = "test-secret";
const m = senderMarker("admin-sub", SECRET, NOW);
assert.equal(isSenderMarkerValid(m, "admin-sub", SECRET, NOW + 60_000), true);
assert.equal(isSenderMarkerValid(m, "other-admin-sub", SECRET, NOW), false, "another account");
assert.equal(isSenderMarkerValid(m, "admin-sub", SECRET, NOW + 11 * 60_000), false, "expired");
assert.equal(isSenderMarkerValid(m, "admin-sub", "other-secret", NOW), false, "other secret");
assert.equal(isSenderMarkerValid("1", "admin-sub", SECRET, NOW), false, "planted constant");
const [exp, sig] = m.split(".");
assert.equal(isSenderMarkerValid(`${Number(exp) + DAY}.${sig}`, "admin-sub", SECRET, NOW), false, "extended expiry");
assert.equal(isSenderMarkerValid(undefined, "admin-sub", SECRET, NOW), false);
assert.equal(isSenderMarkerValid(m, undefined, SECRET, NOW), false);
assert.equal(isSenderMarkerValid(m, "admin-sub", "", NOW), false, "no secret");

console.log("check-session: ok");
