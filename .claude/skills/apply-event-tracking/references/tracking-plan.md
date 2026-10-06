# Tracking plan (v3)

The one list of events every web dashboard sends to OpenPanel. It merges the lead's
`apply_event_tracking` requirements (the taxonomy, the questions) with the DAI
platform's findings (guards, privacy, SSO identity, search, errors). Rationale and the
GA4 comparison: `infra/OpenPanel/TRACKING-ASSESSMENT.md`.

**Every event exists to answer a question. If it does not feed a metric anyone will
look at, do not add it.**

One OpenPanel service, many dashboards: each dashboard has its own project and
client ID, and OpenPanel's `project_id` separates them natively. So there is no
`app` property; compare dashboards in ClickHouse by `project_id`.

---

## The questions

| Question | Metric | Event |
|---|---|---|
| Which reports are used most? | report opens / week | `screen_view` (auto, by path) + `report_viewed` (in-page panels) |
| How deeply do users read? | % of page views reaching each scroll threshold | `scroll_depth` |
| How are filters used? | applies / session, by filter value | `filter_applied` |
| What is the activation rate? | % of users doing the value action within 7 days | the dashboard's **value event** (below) |
| What entities draw attention? | detail opens by `entity_type` | `detail_opened` |
| How many users are active? | DAU / WAU | `session_start` (auto) |
| Do users return after login? | retention cohorts | `user_logged_in` |
| What do people look for, and not find? | searches; % with `results_count = 0` | `search` |
| Where does it fail for users? | error rate by report | `error_shown` |
| Is a specific feature adopted? | users of the feature / week | `feature_used` |

**Value event.** Every dashboard names at least one "aha" action, the reason it exists.
Usually `report_exported`. If the dashboard has no exports, pick the action that is
(for a catalog: opening the dashboard it found, i.e. `link_out`), and write it down in
the dashboard's `CLAUDE.md` under "Project specifics", so the activation metric is
defined, not guessed.

---

## Automatic — confirm on, do not hand-roll

| Event / field | Notes |
|---|---|
| `screen_view` (`__path` = full URL incl. query string, `__title` = `document.title`) | One per **path** change, incl. SPA navigation. A change of only the query string (`?tab=cards`) is not a new page view: the template filters it out. **Never call `screenView()` yourself** |
| `session_start`, `session_end` | Server-side. **Never fire your own** |
| `link_out` (`href`, `text`) | Clicks on `<a>` to other hosts. Sends the visible link text. `window.open()` → `trackLinkOut` |
| Device, OS, browser, referrer, UTM | Columns on every event |
| Global property `viewport` | On every event, e.g. `1366x768`, set once at startup |
| Environments | **Not a property**: staging and production are separate OpenPanel projects with separate client IDs, so their data never mixes. Local runs use the staging client ID |

---

## The events

Event names `object_action`, snake_case, past tense. **Property keys snake_case.**
Every custom event carries `report`. Dynamic data (IDs, values) goes into properties,
never into the event name. Only through the typed functions in `events.ts`.

| Event | Function | When | Properties |
|---|---|---|---|
| `user_logged_in` | `trackUserLoggedIn()` | An interactive login completed (not a silent session resume) | `{}` — identity comes from identify, which runs first |
| `user_logged_out` | `await trackUserLoggedOut()` | Before logout. **Await it**, then log out; it calls `clear()` | `{}` |
| `filter_applied` | `trackFilterApplied(report, trigger, filters)` | Apply or Reset of a filter bar; an instant control (chip, select) counts as an apply | `report`, `trigger: 'apply' \| 'reset'`, **all** active filter values flat |
| `report_viewed` | `trackReportViewed(report)` | An in-page tab or panel switch. **Not** for a report that is its own route | `report` |
| `detail_opened` | `trackDetailOpened({...})` | A table row opens a detail view **in the page** (popup, drawer). A detail that is its own route is a `screen_view` | `report`, `entity_type`, `entity_id` (left out for people, customers, employees, transactions) |
| `report_exported` | `trackReportExported({...})` | Any export or download. One event, not one per format | `report`, `format` |
| `scroll_depth` | `startScrollTracking(getReport, getContainer?)` | 25 / 50 / 75 / 100 % of the content in view, once per page view. Pages with nothing to scroll send none | `report`, `threshold` |
| `search` | `trackSearch(term, report, searchBox, count, { sensitive })` | The user searches; debounced, one event after typing stops | `report`, `search_box`, `search_term` (left out when sensitive), `search_term_length`, `results_count` |
| `error_shown` | `trackErrorShown({...})` | The user hits a failure: an error message, **or** a failed load that leaves an empty view or an endless spinner | `report`, `error_type` (a short code, never the message) |
| `feature_used` | `trackFeatureUsed({...})` | Any other deliberate action worth counting | `report`, `feature` |
| `link_out` | `trackLinkOut(href, text?)` | Opening another site with `window.open()` | `href`, `text` |

### Controlled vocabulary

Dimension values are **lists in `events.ts`, not free text**: `"push_rank"` vs
`"Push Rank"` fragments every metric. TypeScript rejects a wrong value at compile time;
in a JavaScript app the event is dropped at runtime with a console warning.

| List | Fill with | Example |
|---|---|---|
| `REPORTS` | one per dashboard section/route, and per in-page panel | `'commercial' \| 'marketing' \| 'finance'` |
| `ENTITY_TYPES` | one per clickable table entity | `'campaign' \| 'supplier'` |
| `EXPORT_FORMATS` | the formats the dashboard offers | `'csv' \| 'pdf'` |
| `FEATURES` | other counted actions, `object_action` past tense | `'chat_opened' \| 'lineage_node_selected'` |

`trigger` is always `'apply' | 'reset'`; `threshold` is always 25 / 50 / 75 / 100.
Filter keys are snake_case and must not be named `report`, `trigger`, `entity_type`,
`format`, `feature` or `groups`: rename them (`store_format`), or the event is dropped. A
multi-select is sent as its codes joined with `,`. The template drops the whole event if
a value looks like an email (`@`) or is longer than 300 characters, so a multi-select that
can get that long is sent as its count instead (`brands_count: 12`).

### Which event? Tab, filter, detail or feature

| The control… | Event |
|---|---|
| narrows or re-scopes **the same** list, chart or graph (even if styled as tabs or chips) | `filter_applied` |
| sorts a table (header click) | nothing |
| swaps which panel or section is shown, without changing the URL path | `report_viewed` |
| opens one row's details in the page | `detail_opened` |
| picks one result from a search dropdown | `feature_used`, not a second `search` |
| navigates to another URL path | nothing (`screen_view`) |

Decide by **what it does**, not what the code calls it. Fire filters and panels only
when the **applied** value changes: re-clicking the active option, Apply with the same
values, or Reset when already at the defaults sends nothing.

---

## Identity

`startAnalytics({ user })` / `identifyUser(user)` with `user = { id, email, name, properties }`,
all from the Microsoft SSO account. Knowing **who** uses a dashboard is a requirement (these
are internal apps, used by employees):

- `id` = the SSO's stable object ID (MSAL `account.localAccountId`, Entra claim `oid`).
  Never the email: an email can change, the object ID does not.
- `email`, `name` = from the SSO account (MSAL `account.username`, `account.name`).
- `properties` = what the auth system knows about the role, if anything: only `role`,
  `division`, `squad` (the type allows nothing else). Never token claims, the account
  object or tokens.
- **Identity goes only here.** Never an email or a name in an event property, a filter
  value, a URL or a page title: those are visible on every event, not just on the profile.

---

## Value conventions

- `report`, `entity_type`, `format`, `feature`: only values from the vocabulary lists.
- Filter values: the option's code or label (`All`, `Finance`, dates as `YYYY-MM-DD`).
  **If the options come from data about people or customers** (sales rep, customer,
  store owner, employee), send `'selected'`, never the name **or the ID**.
- A free-text filter input ("name contains…", notes) is a search box: `trackSearch` with
  `sensitive` decided. In `filter_applied` it is only `'set'` or `''`.
- `entity_id`: catalog or business entity IDs (supplier, campaign, dashboard). **Leave it
  out** when the row is a customer, employee, person or transaction.
- `error_type`: a short code you choose (`load_failed`, `timeout`, `forbidden`).
  **Never the error message**: it can contain SQL, IDs or customer data. The template
  drops anything that is not a snake_case code of up to 40 characters.
- `search_box`: **unique per search box** (`catalog_search`, `lineage_table`), a snake_case
  code: `trackSearch` debounces per box, so two boxes sharing one cancel each other.
- Every props object is built field by field. Never spread a table row, an API response
  or the app's state into a `track…()` call: every field in it would be sent.

### Sensitive search boxes

A search box is **sensitive** if what users type can be a person, customer, store, phone
number or transaction (`{ sensitive: true }`): the term is not sent, only its length and
the result count. Catalog searches (dashboard names, table names) are not sensitive.
When unsure, it is sensitive.

---

## Calling it

```tsx
import {
  trackFilterApplied, trackReportViewed, trackDetailOpened, trackReportExported,
  trackErrorShown, trackSearch,
} from '../lib/analytics/events';

// Filter bar: draft state inside, the page receives values only on Apply / Reset.
// Build the tracked object explicitly: snake_case keys, plain values, no people's names.
const filterProps = (f: Filters) => ({
  region: f.region,
  store_format: f.format,                       // `format` is reserved: renamed
  brands: f.brands.join(','),                   // multi-select
  sales_rep: f.salesRep === 'All' ? 'All' : 'selected', // options are people
  start_date: f.startDate, end_date: f.endDate, // YYYY-MM-DD
});
<FilterBar onApply={values => { setFilters(values); trackFilterApplied('commercial', 'apply', filterProps(values)); }}
           onReset={() => { setFilters(DEFAULTS); trackFilterApplied('commercial', 'reset', filterProps(DEFAULTS)); }} />

// Clicks: in the handler.
<button onClick={() => { setPanel('cards'); trackReportViewed('dashboard_cards'); }}>Cards</button>
<tr onClick={() => { setSelected(row); trackDetailOpened({ report: 'supply_chain', entity_type: 'supplier', entity_id: row.supplier_id }); }}>
<button onClick={() => { exportCsv(); trackReportExported({ report: 'commercial', format: 'csv' }); }}>Export</button>

// Client-side search: in an effect keyed on the term, AFTER the results for that term exist.
const results = useMemo(() => rows.filter(r => matches(r, query)), [rows, query]);
// The count: a number; undefined while loading (nothing is sent until the count arrives);
// null if the box has no count. `sensitive` is a required decision.
useEffect(() => trackSearch(query, 'catalog', 'catalog_search', loading ? undefined : results.length, { sensitive: false }),
  [query, loading, results.length]);

// Errors: where the error is caught (re-throw if you added the catch), or keyed on the error.
fetchData().catch(err => { trackErrorShown({ report: 'commercial', error_type: 'load_failed' }); throw err; });
useEffect(() => { if (isError) trackErrorShown({ report: 'commercial', error_type: 'load_failed' }); }, [isError]);

// Logout: await, then log out.
async function onLogout() { await trackUserLoggedOut(); logout(); }
```

Search edge cases:

- **No loading flag:** use the data itself, `data.length ? results.length : undefined`.
  An `undefined` count is fine; a false `0` is not (it fakes "searched, found nothing").
- **Server-side search:** call it in the response's `.then`, with that response's count.
- **Type-ahead that writes the picked value back into the box** (or clears/restores it on
  focus/blur): call `trackSearch` only while the user is typing, e.g. gate the effect on
  the dropdown being open. Otherwise every pick records a second search.
- **Results list capped** (e.g. top 30): send the count shown. "0 results" stays exact.

---

## Hard rules

1. **Only through `events.ts`.** No `op.track(` and no event-name string anywhere else.
2. **Call sites:** an event handler, the `then`/`catch` of an async call, or a `useEffect`
   keyed on the one value that changed. Never a component body or an unkeyed effect:
   that is how one dashboard floods the server with thousands of events.
3. **No data in properties.** No query results, amounts, customer or employee names,
   emails, phone numbers, error messages, or free text typed by the user (except
   `search_term` on a non-sensitive box). External `<a>` links send their visible text,
   so label such links generically.
4. **No personal data in the URL or the page title, and no URL writes per keystroke.**
   Every `screen_view` sends the full URL (query string included) and `document.title`.
   A detail page titled with a customer's or employee's name leaks it on every view.
5. **No double counting.** A report or detail that is its own route is a `screen_view`;
   one export event with `format`, not one per format; never fire `session_start`.
6. **Only names and values from this plan.** New needs: a vocabulary value; a new event
   only with a question and a metric, agreed with the plan's owners.
