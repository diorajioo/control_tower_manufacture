---
name: apply-event-tracking
description: >-
  Instrument a web dashboard with the team's shared, self-hosted OpenPanel
  analytics, the same way in every dashboard: automatic page tracking, user
  identity from Microsoft SSO, login/logout,
  filters, detail views, exports, scroll depth, search and errors, using one
  decision-linked event taxonomy so data is comparable across dashboards. Any
  npm-built frontend, TypeScript or JavaScript (Next.js, Vite, an SPA served by its
  own backend). Use whenever adding, wiring, reviewing or fixing analytics / event
  tracking in one of our web dashboards — "add OpenPanel", "add tracking",
  "instrument this dashboard", "pasang tracking", "tambahkan analytics", "mau tahu
  dashboard ini dipakai siapa saja", "kenapa event-nya tidak masuk OpenPanel". Not
  for Streamlit or other apps without an npm-built browser bundle, and not for
  standing up the OpenPanel server itself.
---

# Event tracking for web dashboards (OpenPanel)

Wire a dashboard to the shared OpenPanel service the same way every time. One
service, many dashboards: the API URL is shared, each dashboard has its own project
and client ID, and OpenPanel's `project_id` separates them.

Answer in the language the user asked in, unless the user's own instructions say otherwise.

| File | Role |
|---|---|
| `references/tracking-plan.md` | The contract: the questions, **the only event names and properties**, the vocabulary, identity and privacy rules. Read it first |
| `references/stacks.md` | Where config, boot, login/logout, server rendering and CSP live, per stack |
| `events.ts` | The template: the only module that talks to OpenPanel. Identical in every dashboard except its vocabulary |
| `to-js.mjs` | Generates the JavaScript copy for apps without TypeScript |
| `check-template.ts` | Tests the template and its JavaScript copy |

## Scope — where this stops

**In scope:** the SDK, `events.ts`, startup/login/logout hooks, instrumenting the pages per
the plan, the CSP entry, and the config plumbing inside the repo (Dockerfile `ARG`, or
the app's config endpoint and `.env.example`).

**Out of scope, stop and say so:**
- No browser code built with npm (Streamlit, server-rendered Python, plain HTML).
- Server-side tracking (API routes, server actions): those events get no device and no
  session in OpenPanel. Track in the browser.
- Creating the OpenPanel project or client ID, allowed origins (CORS), CI/CD variables,
  Ingress: list them at the end (Handover).
- Events or properties not in the plan. New needs become a vocabulary value.
- **New UI without the user's OK.** The plan expects filter bars with Apply/Reset and
  clickable rows that open a detail popup. Where the dashboard lacks them, **propose** the
  change in the Phase 3 mapping; build it only when the user agrees.

---

## Phase 1 — discover, do not ask

Discover everything from the repo. Ask only what is genuinely undiscoverable.

1. **Stack.** Answer the four questions in `references/stacks.md` (config source, boot
   point, server rendering, CSP location) and the language. Name the recipe (A, B, C) or
   say "no recipe matches, wiring from the four questions, unverified".
2. **Existing tracking.** Search for `openpanel`, `gtag`, `analytics`, `track(`,
   `useOpenPanel`, `OpenPanelComponent`.
   - Already on OpenPanel: **upgrade in place** to this template, mapping existing calls
     to the plan's events. Keep what is app-specific and correct (where it starts, how it
     finds the user); never change the template's signatures, adapt the call sites.
   - On `@openpanel/nextjs`: replace it with `@openpanel/web` (stacks.md, recipe C).
   - Google Analytics / other: ask before replacing or running both.
3. **Login and logout.** Where the login redirect is handled, where an *interactive* login
   is distinguishable from a silent resume, where the user becomes known, any
   session-expiry check at startup, and the logout function.
4. **Vocabulary.** `REPORTS` from routes and in-page panels; `ENTITY_TYPES` from tables
   whose rows open details; `EXPORT_FORMATS` from export buttons; filter dimensions from
   filter bars and controls.
5. **Interactions.** Every filter control (bar with Apply/Reset, or instant), panel/tab,
   clickable table row, export/download, search box, error state, scrollable report, and
   notable feature. For each search box: **sensitive?** For each filter: options from
   data about people or customers? For each search box and filter: does it write its value
   to the URL (query string), and per keystroke? A sensitive box or a people/customer
   filter must not write to the URL: the first page view of a path sends the full URL, so
   `{ sensitive: true }` cannot hide a term that is in the URL.
6. **Value event.** Which action is this dashboard's "aha"? (tracking-plan, "Value event").

## Phase 2 — wire it in

1. `npm install --save-exact @openpanel/web@1.4.1` (exact: `^`/`~` is not pinned). Never
   `@openpanel/nextjs`: it loads the SDK from the vendor's CDN.
2. The module at `src/lib/analytics/events.ts` (Next.js: `lib/analytics/events.ts`), or the
   app's existing analytics module path when upgrading:
   - TypeScript: copy `events.ts`.
   - JavaScript: `node <this skill>/to-js.mjs <path>/events.js`. Never convert by hand.
   Edit **only** the vocabulary lists. Not `OPENPANEL_API_URL`, the guards, the functions.
3. Config, per the recipe: the client ID only (staging and production are separate
   OpenPanel projects, so no environment property). Optional: empty = tracking off, and the
   app must start and work.
4. `startAnalytics({ clientId, user })` once, in the browser,
   **after** any login redirect is handled **and after any session-expiry check**. Pass the
   already signed-in user (`{ id, email, name }` from the SSO account, stacks.md "The user"),
   so the landing page view is attributed.
5. `trackUserLoggedIn()` right after an **interactive** login completes (after identify,
   i.e. after `startAnalytics` with the user). Not on a silent session resume.
6. `identifyUser(user)` where a user becomes known later in the visit (silent resume).
7. Logout: **every** sign-out path (button, idle timeout, 401 handler, server action) goes
   through the one logout function, which runs `await trackUserLoggedOut()` (it clears the
   profile) and then ends in a **full document load** (`window.location.assign(...)`,
   `location.reload()`, MSAL `logoutRedirect`). A Next.js `redirect()` or `router.push` is not
   a reload: without one, the next person on that browser inherits the profile.
8. `startScrollTracking(getReport, getContainer?)` next to `startAnalytics` (further calls do
   nothing): `getReport` maps `location.pathname` to a `REPORTS` value. If the page itself
   does not scroll but a layout element does (`overflow: auto` on the main area), pass
   `getContainer`, e.g. `() => document.querySelector('main')`; it is looked up on each
   scroll, so the element may mount later.
9. CSP, where the recipe says: `https://openpanel.pti-cosmetics.com` in `connect-src`.
   Nothing in `script-src`: the SDK is bundled.

## Phase 3 — instrument per the plan

Map every interaction from Phase 1.5 to the plan and **show the user the mapping table
before writing code**, including any proposed UI change. It is the decision they own.

| Interaction | Do |
|---|---|
| Another page (the URL **path** changes) | Nothing. `screen_view` |
| `<a href>` to another site | Nothing. `link_out` (sends the link text) |
| `window.open()` to another site | `trackLinkOut(href, text)` |
| Filter bar | Draft state inside; `trackFilterApplied(report, 'apply' \| 'reset', allValues)` on Apply / Reset, with `allValues` built explicitly (plan: "Calling it"): snake_case keys, reserved keys renamed, multi-select joined with `,`, people's names → `'selected'`. A bar that reloads on every dropdown change: **propose** Apply/Reset |
| Instant control that narrows the same view (chip, select) | `trackFilterApplied(report, 'apply', allValues)` on change |
| Tab or filter kept in the query string (`?tab=…`) | Its event as above. No extra page view is counted: the template counts paths. The query string still reaches OpenPanel on the first page view of a path: never a sensitive value there |
| Panel/tab swap, URL path unchanged | `trackReportViewed(report)` |
| Table row → detail in the page | `trackDetailOpened({ report, entity_type, entity_id })`. `entity_id` only for catalog or business entities (supplier, campaign, dashboard); **leave it out** when the row is a person, customer, employee or transaction. Rows with entity data but no detail view: **propose** one |
| Export / download | `trackReportExported({ report, format })` |
| Search box | `trackSearch(term, report, searchBox, count, { sensitive })`: unique `searchBox`; `count` undefined while loading, `null` if the box has none; `sensitive` always decided; in an effect keyed on the term and the count (plan: "Calling it") |
| Picking a result from a search dropdown | `trackFeatureUsed` |
| The user hits a failure (message, or empty view / endless spinner after a failed load) | `trackErrorShown({ report, error_type })` in the `catch`; no catch yet → add one that tracks and **re-throws** |
| Other action worth counting | `trackFeatureUsed` + a `FEATURES` value |
| Pagination, hover, every sort click | Skip, unless someone will act on the number |
| Search/filter state written to the URL per keystroke | Fix first: on submit or debounced |

Fire filters and panels only when the **applied** value changes. Rules: tracking-plan,
"Hard rules".

## Phase 4 — prove it

Do not report done on "it compiles".

**4a. Self-review (you).** Until each is clean:
- `npm run build` passes. TypeScript: also the type check the project really uses —
  `npx tsc -b` when `tsconfig.json` has `references` (a bare `tsc --noEmit` checks
  nothing there). JavaScript: compare every call against the plan by hand.
- Lint: no **new** findings compared with the base branch.
- `git grep -nE "op\.track\(|useOpenPanel|new OpenPanel\(|window\.op\b|@openpanel/(nextjs|web)" -- ':!**/events.*' ':!package*.json'`
  → nothing. A second OpenPanel instance would bypass every guard in `events.ts`.
- No spread and no state object passed as-is into a `track…()` call: build every props
  object field by field. `git grep -n -A4 -E "track[A-Za-z]+\(" -- src app | grep -F "..."` and
  `git grep -nE "track[A-Za-z]+\(.*(email|username|\.name\b)" -- src app` → nothing.
- `git grep -n "screenView(" -- ':!**/events.*'` → nothing.
- Every `track…(` call: in a handler, a `then`/`catch`, or an effect keyed on one value.
- Every property value: vocabulary, code, label, catalog ID or count. Email and name only
  in identify, never in an event property. `id` is the SSO object ID, never the email.
  Sensitive search boxes pass `{ sensitive: true }`.
- Page titles: `git grep -nE "document\.title|<title>|title:" -- src app` → no title built
  from a person's or customer's name (`screen_view` sends `document.title`).
- The app's `events.ts` differs from the template only in the vocabulary lists
  (`check-template.ts` tests the template, not the app's copy).

**4b. In the browser (the user, or you if you can drive one).** Use the **production
build** (`npm run build` then `npm run preview` / `npm start` / the app's start command),
not the dev server: React StrictMode runs effects twice **in development only**, so
effect-based events and identify appear twice there. That is expected and is not a reason
to disable StrictMode. Client ID for local runs: the staging one, in `.env.local` / `.env`
(never committed). DevTools → Network, filter `track`:

| See | Means |
|---|---|
| `POST …/api/track` → **200**, every event exactly once | Working |
| The landing `screen_view` after an SSO login already carries the profile (OpenPanel → the user's profile shows email and name) | Identify wired before the first page view |
| **401** `Invalid cors or secret` | The exact origin (scheme + host + **port**) is not in the project's allowed origins |
| Request to `api.openpanel.dev` | `apiUrl` missing: events go to OpenPanel Cloud. Fix immediately |
| `blocked:csp` | `connect-src` misses the OpenPanel host |
| No request at all | Client ID empty (build-time variables need a rebuild) |
| Console: `not in the vocabulary, … not sent` | A value outside the lists in `events.ts` |
| `user_logged_out` missing after logout | Logout did not await `trackUserLoggedOut()` |
| Requests while idle, or one per keystroke | A `track…()` in a render path |

## Handover — what the data platform / infra team needs

- **OpenPanel project + client ID** per dashboard and environment (staging and production
  separate).
- **Allowed origins** per project: the exact origins, e.g. `https://atlas-data-staging.paradev.io`,
  plus the local origin with its port on the **staging** project only.
- **Where the client ID goes**, per the recipe: a build arg (`VITE_OPENPANEL_CLIENT_ID` /
  `NEXT_PUBLIC_OPENPANEL_CLIENT_ID`) or the runtime environment / ConfigMap
  (`OPENPANEL_CLIENT_ID`). Environment-scoped: the staging project's ID for staging, the
  production project's ID for production.
- Profiles hold employees' email and name: limit access to each OpenPanel project to named
  people, and set a data retention period.
- Every OpenPanel organization keeps **at least two admins**: one with none is deleted
  automatically, data included.

## Hard rules

- Event names, properties and values only from `references/tracking-plan.md`.
- `apiUrl` is always `https://openpanel.pti-cosmetics.com/api`.
- Identity (SSO id, email, name) only through identify. No personal or business data in
  event properties, filter values, URLs or page titles.
- Tracking never breaks the app: no client ID → silently off.
- Never print, log or commit a client secret; never put one in the browser
  (`NEXT_PUBLIC_`/`VITE_`) or the repo. Browser apps use the client ID only.
- Never enable `sessionReplay`: it records everything on screen.
- One OpenPanel instance per app, the one in `events.ts`.
