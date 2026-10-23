# Wiring per stack

`events.ts` is the same everywhere. What differs between apps is only **where things
live**. Answer the four questions for the app in front of you, then use the matching
recipe. The recipes come from real DAI repos; a stack that matches none of them is
handled by the questions alone, and you **say in your summary that its wiring is
unverified**.

## The four questions

| # | Question | Where to look | Possible answers |
|---|---|---|---|
| 1 | **Where does the browser get its config?** | `import.meta.env`, `process.env.NEXT_PUBLIC_`, a `fetch('/api/config')` or `config.js` at startup | Build-time env (baked in, needs a rebuild to change) or runtime endpoint (a ConfigMap change). **No config mechanism yet → runtime (recipe B)**: the platform workbook requires one image for staging and production (Container Contract rule 5), and the client ID differs per environment (separate OpenPanel projects) |
| 2 | **Where does the app boot in the browser, where is the user known, and where are login and logout?** | `main.tsx`/`main.jsx`, a root `"use client"` providers component, the auth module (`msal*`, `auth-provider`), the logout button/function | Boot: right after the login redirect is handled and any session-expiry check. Login: where an *interactive* login is distinguishable from a silent resume |
| 3 | **Does it render on the server?** | Next.js (`next` in package.json), `app/` or `pages/` directory | Yes → start only from a client component's effect. No (SPA) → start from the entry file |
| 4 | **Where is the Content-Security-Policy set?** | `nginx.conf`, Express `helmet(...)`, `next.config.*` `headers()`, `middleware.ts`, `<meta http-equiv>` | Add `https://openpanel.pti-cosmetics.com` to `connect-src` there. No CSP anywhere → nothing to add |

Plus the language: TypeScript → copy `events.ts`. JavaScript → generate the copy:
`node <this skill>/to-js.mjs <path>/events.js` (never convert by hand).

**The one config value** is the client ID. Staging and production are separate
OpenPanel projects with separate client IDs, so that is what keeps their data apart: no
environment or version property.

**The user** comes from the SSO account: `{ id, email, name }`. MSAL:
`{ id: account.localAccountId, email: account.username, name: account.name }` (`username`
is the UPN, usually but not always the email). Never the email as the `id`.

**MSAL login detection.** `handleRedirectPromise()` resolves to a result (not `null`) only
when the page is returning from an interactive login redirect. That is the moment for
`trackUserLoggedIn()`. A silent resume (`ssoSilent`, cached account) is not a login.

---

## Recipe A — Vite SPA, static server, build-time config
*Reference: `dai/atlas` (React + TypeScript, nginx, MSAL).* **Only for apps that already
take their frontend config as build args.** It bakes per-environment values into the
bundle, so staging and production need separate images (workbook rule 5). A new app,
or an app with no frontend config yet, uses recipe B.

| | |
|---|---|
| Config | `VITE_OPENPANEL_CLIENT_ID`. Dockerfile, before `npm run build`: `ARG` + `ENV`. CI passes `--build-arg` (infra). The name passes the pipeline's build-arg guard; don't add `KEY`, `TOKEN` or `SECRET` to it. |
| Boot, login | Entry file, after the auth redirect and the session-expiry check: |
| Logout | The one logout function that **every** sign-out path uses (button, idle timeout, 401 handler): `await trackUserLoggedOut()` first, then the existing logout, ending in a full document load |
| CSP | `nginx.conf` → `add_header Content-Security-Policy "... connect-src 'self' ... https://openpanel.pti-cosmetics.com; ..."` |

```ts
// main.tsx
const loginResult = await initializeMsal(); // let it return handleRedirectPromise()'s result
await expireSessionIfIdle();                // and any startup sign-out has happened
const account = msalInstance.getActiveAccount();
startAnalytics({
  clientId: import.meta.env.VITE_OPENPANEL_CLIENT_ID,
  user: account && { id: account.localAccountId, email: account.username, name: account.name },
});
if (loginResult) trackUserLoggedIn(); // returning from an interactive login, identify already ran
startScrollTracking(reportFromPath, () => document.querySelector('main')); // the app's own scroller, if not the page

// lib/analytics/report-from-path.ts: one place that maps routes to REPORTS
export const reportFromPath = (): Report | undefined =>
  location.pathname === '/' ? 'catalog' : location.pathname.startsWith('/dashboard/') ? 'dashboard_detail' : undefined;

// msal.ts
export async function logout() {
  await trackUserLoggedOut();
  // ...existing logout (clear cache, reload)
}
```

## Recipe B — SPA + its own backend, runtime config (the default)
*Reference: `dai/web-dashboard/shipment-tracking-my` (React + **JavaScript**, Express + helmet, MSAL, `GET /api/config`).*
Fits every workbook Tier 2 app: the backend already sits on the same origin under `/api`.
If it has no config endpoint yet, add one (Express below; FastAPI:
`@app.get("/api/config")` returning the same fields from `os.environ`). It must answer
**without** login: the browser needs it before the user is known. Public values only.

| | |
|---|---|
| Config | Backend env `OPENPANEL_CLIENT_ID` (a ConfigMap value, not a Secret), returned by the config endpoint as `openpanelClientId`. **Optional**: it must never make the server refuse to start; empty = tracking off. Add it to `.env.example`. No rebuild to change it, and one image serves staging and production |
| Boot, login | Where the SPA has fetched its config and handled the auth redirect: |
| Logout | As recipe A: one logout function for every sign-out path, `await trackUserLoggedOut()` first, ending in a full document load |
| CSP | `helmet({ contentSecurityPolicy: { directives: { connectSrc: ["'self'", ..., 'https://openpanel.pti-cosmetics.com'] } } })` |
| Language | JavaScript: `node <this skill>/to-js.mjs frontend/src/lib/analytics/events.js` |

```js
// backend: the existing GET /api/config handler
res.json({ ...existingFields, openpanelClientId: process.env.OPENPANEL_CLIENT_ID || '' });

// frontend: after the config fetch and handleRedirectPromise() have resolved
startAnalytics({
  clientId: config.openpanelClientId,
  user: account && { id: account.localAccountId, email: account.username, name: account.name },
});
if (loginResult) trackUserLoggedIn();
startScrollTracking(reportFromPath); // as in recipe A
```

## Recipe C — Next.js (App Router)
*Reference: `dai/multi-agent-web-platform/kinetic-frontend` (Next 16, MSAL in a client
`AuthProvider` with `useAuth()`); same shape in `dai/consumer-dashboard/frontend` (Next 15).*

| | |
|---|---|
| Config | **App already builds per environment with `NEXT_PUBLIC_*` (kinetic does):** add `NEXT_PUBLIC_OPENPANEL_CLIENT_ID` the same way (Dockerfile `ARG` + `ENV` before `next build`, CI `--build-arg`); write it **literally** as `process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID`, Next.js only inlines literal references. Same caveat as recipe A: one image per environment. **Otherwise (one image for all environments):** a route handler `app/api/config/route.ts` returns `OPENPANEL_CLIENT_ID` from the server's environment, and `AnalyticsBoot` fetches it before `startAnalytics`, as in recipe B |
| Boot | A small client component inside the auth provider, rendered once from the root providers (below) |
| Login (server-side auth) | A server action cannot fire a browser event, and a URL flag (`?login=success`) is lost if it is read before tracking has started. Instead the login form's submit handler sets `sessionStorage.setItem('op_login', '1')` before calling the action; `AnalyticsBoot`, right after `startAnalytics` and identify, reads and removes it and calls `trackUserLoggedIn()` |
| Login (client-side MSAL) | As recipe A: when `handleRedirectPromise()` returned a result |
| Logout | A client `LogoutButton` (and every other sign-out path): `await trackUserLoggedOut()`, then the logout server action / `logout()`, then `window.location.assign('/')`. A server-action `redirect()` or `router.push` is not a reload: the profile would stay in memory. So the logout action must **not** call `redirect()` itself; the client's `window.location.assign` does the navigation |
| CSP | `next.config.*` `headers()` or `middleware.ts`, if a CSP is set there (kinetic sets none today) |
| Rules | Tracking only in `"use client"` components: on the server it is a silent no-op. **`@openpanel/web` (this template), not `@openpanel/nextjs`**: that one injects `<script src="https://openpanel.dev/op1.js">` from the vendor's CDN by default (a strict CSP blocks it, and it runs the vendor's current code on every page). Keep `reactStrictMode` as it is: its double effects happen in development only |

```tsx
// components/analytics-boot.tsx
'use client';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-provider'; // the app's own auth hook
import { identifyUser, startAnalytics, startScrollTracking, trackUserLoggedIn } from '@/lib/analytics/events';
import { reportFromPath } from '@/lib/analytics/report-from-path';

export function AnalyticsBoot() {
  const { initialized, user } = useAuth(); // kinetic's fields; other apps: their hook's "ready" flag
  const userId = user?.id;                 // VERIFY it is the Entra `oid`, never an email or a database ID
  const email = user?.email ?? '';
  const name = user?.name ?? '';
  const role = user?.roles?.join(',') ?? '';
  useEffect(() => {
    if (!initialized) return; // wait until the login redirect is handled
    startAnalytics({ clientId: process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID }); // no-op after the first call
    startScrollTracking(reportFromPath); // no-op after the first call
    // Same tick as the start, so it still lands before the first screen_view.
    if (userId) identifyUser({ id: userId, email, name, properties: { role } });
    if (userId && sessionStorage.getItem('op_login')) {   // server-side login: set by the login form
      sessionStorage.removeItem('op_login');
      trackUserLoggedIn();
    }
  }, [initialized, userId, email, name, role]); // strings: a new user object with the same values re-identifies nothing
  return null;
}
// components/providers.tsx: <AuthProvider><AnalyticsBoot />{children}</AuthProvider>
```

Page views: the App Router navigates with `history.pushState`, which the SDK listens
to. **Not yet verified in a running Next.js app**: on the first Next.js integration,
confirm one `screen_view` per navigation in DevTools before reporting done.
