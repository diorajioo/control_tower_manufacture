// Self-check for the sign-in redirect guard on the shared host (lib/basePath.ts → safeRedirect).
//   npx tsx scripts/check-base-path.ts
import assert from "node:assert/strict";

// BASE_PATH is read when the module loads, so set it before the import.
process.env.NEXT_PUBLIC_BASE_PATH = "/ct-manuf";

async function main() {
  const { safeRedirect, withBase } = await import("../lib/basePath");

  const BASE = "https://poros-staging.paradev.io";
  const HOME = `${BASE}/ct-manuf/dashboard`;

  // Inside the app: allowed, relative or absolute
  assert.equal(safeRedirect("/ct-manuf/lead-time?tab=pareto", BASE), `${BASE}/ct-manuf/lead-time?tab=pareto`);
  assert.equal(safeRedirect(`${BASE}/ct-manuf/dashboard`, BASE), HOME);
  assert.equal(safeRedirect("/ct-manuf", BASE), `${BASE}/ct-manuf`);
  // baseUrl may carry next-auth's path; only its origin counts
  assert.equal(safeRedirect("/ct-manuf/monitor", `${BASE}/ct-manuf/api/auth`), `${BASE}/ct-manuf/monitor`);

  // Another dashboard on the same host, look-alike prefixes, traversal, other origins, schemes
  for (const evil of [
    "/affiliate/dashboard",
    "/ct-manufacture",
    "/ct-manuf/../affiliate",
    "/ct-manuf/%2e%2e/affiliate",
    "/ct-manuf\\..\\affiliate",
    "//evil.example.com/ct-manuf",
    "https://evil.example.com/ct-manuf/dashboard",
    "javascript:alert(1)",
    "http://[",
  ]) {
    assert.equal(safeRedirect(evil, BASE), HOME, evil);
  }

  assert.equal(withBase("/api/chat"), "/ct-manuf/api/chat");
  console.log("check-base-path: ok");
}

main();
