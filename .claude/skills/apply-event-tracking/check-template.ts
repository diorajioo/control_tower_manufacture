// Self-check for events.ts AND its generated JavaScript copy (to-js.mjs).
// Run after editing either:  node check-template.ts   (Node >= 22.18)
// Swaps the SDK for a recording stub, then asserts init, the guards, identify,
// the vocabulary check, every event's shape, search debounce and scroll depth —
// once per language.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'op-template-'));
const here = (f: string) => fileURLToPath(new URL(f, import.meta.url));
execFileSync(process.execPath, [here('./to-js.mjs'), join(dir, 'generated.js')], { stdio: 'pipe' });
const sources = { ts: readFileSync(here('./events.ts'), 'utf8'), js: readFileSync(join(dir, 'generated.js'), 'utf8') };
writeFileSync(join(dir, 'stub.js'), `
export const sent = [];
export class OpenPanel {
  constructor(opts) { sent.push(['init', opts]); }
  setGlobalProperties(p) { sent.push(['global', p]); }
  identify(p) { sent.push(['identify', p]); return Promise.resolve(); }
  track(n, p) { sent.push([n, p]); return Promise.resolve(); }
  clear() { sent.push(['clear']); }
}`);
let copies = 0;
// Each load gets a fresh copy, i.e. fresh module state (op, timers), with a filled-in vocabulary.
async function fresh(lang: 'ts' | 'js') {
  const f = join(dir, `events-${copies++}.${lang}`);
  writeFileSync(f, sources[lang]
    .replace("from '@openpanel/web'", "from './stub.js'")
    // The generated JS spreads these arrays over several lines, hence \s*.
    .replace(/REPORTS = \[\s*'example_report'\s*\]/, "REPORTS = ['catalog', 'detail']")
    .replace(/ENTITY_TYPES = \[\s*'example_entity'\s*\]/, "ENTITY_TYPES = ['dashboard']")
    .replace(/FEATURES = \[\s*'example_feature'\s*\]/, "FEATURES = ['node_selected']"));
  return import(pathToFileURL(f).href);
}
const { sent } = await import(pathToFileURL(join(dir, 'stub.js')).href);
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const g = globalThis as any;
const warnings: string[] = [];
console.warn = (m: string) => { warnings.push(m); };

for (const lang of ['ts', 'js'] as const) {
  sent.length = 0; warnings.length = 0;
  const names = () => sent.map(([n]: [string]) => n);
  const last = () => sent[sent.length - 1];

  // Server-side rendering: no window at all -> must not throw, must not init.
  delete g.window; delete g.document;
  const ssr = await fresh(lang);
  ssr.startAnalytics({ clientId: 'abc' });
  ssr.startScrollTracking(() => 'catalog');
  const w: any = { innerWidth: 1366, innerHeight: 768, location: { href: 'https://app.example/catalog', pathname: '/catalog' } };
  w.self = w; w.top = w; g.window = w;
  // A minimal DOM for scroll tracking: one capturing listener on document.
  class FakeElement { scrollTop = 0; clientHeight = 500; scrollHeight = 2000; }
  g.Element = FakeElement;
  let docScroll: (e: { target: unknown }) => void = () => undefined;
  let docListeners = 0;
  g.document = { documentElement: new FakeElement(),
    addEventListener: (_: string, fn: (e: { target: unknown }) => void, opts: any) => { assert.equal(opts.capture, true); docScroll = fn; docListeners++; } };

  // Tracking off, and the two guards: nothing may be initialised.
  (await fresh(lang)).startAnalytics({ clientId: '' });
  (await fresh(lang)).startAnalytics({});
  w.top = {}; (await fresh(lang)).startAnalytics({ clientId: 'abc' }); w.top = w;
  w.location.href = 'https://app.example/#code=SECRET&state=xyz'; (await fresh(lang)).startAnalytics({ clientId: 'abc' });
  w.location.href = 'https://app.example/catalog';
  assert.equal(sent.length, 0, `${lang}: SSR / no client id / iframe / OAuth response URL => nothing initialised`);

  const a = await fresh(lang);
  a.startAnalytics({ clientId: 'abc', user: { id: 'oid-1', email: 'a@pti.example', name: 'Ana', properties: { division: 'data' } } });
  a.startAnalytics({ clientId: 'abc' });
  assert.deepEqual(names(), ['init', 'global', 'identify'], `${lang}: init once; identify right after init`);
  const init = sent[0][1];
  assert.equal(init.apiUrl, 'https://openpanel.pti-cosmetics.com/api');
  assert.ok(init.trackScreenViews && init.trackOutgoingLinks);
  assert.equal(init.trackAttributes, false, `${lang}: data-* attributes must not be sent wholesale`);
  assert.deepEqual(sent[1][1], { viewport: '1366x768' }, `${lang}: the only global property is viewport`);
  assert.deepEqual(sent[2][1], { profileId: 'oid-1', email: 'a@pti.example', firstName: 'Ana', properties: { division: 'data' } },
    `${lang}: identify carries the SSO id, email and name`);

  // One page view per path: the SDK's filter drops query-only changes.
  const pv = (href: string) => init.filter({ type: 'track', payload: { name: 'screen_view', properties: { __path: href } } });
  assert.equal(pv('https://app.example/catalog'), true, `${lang}: first page view passes`);
  assert.equal(pv('https://app.example/catalog?tab=cards'), false, `${lang}: query-only change is not a page view`);
  assert.equal(pv('https://app.example/detail/42'), true, `${lang}: a new path is a page view`);
  assert.equal(pv('https://app.example/catalog'), true, `${lang}: back to an earlier path is a page view`);
  assert.equal(init.filter({ type: 'track', payload: { name: 'search', properties: {} } }), true, `${lang}: other events pass`);
  assert.equal(init.filter({ type: 'identify', payload: { profileId: 'x' } }), true, `${lang}: identify passes`);
  const custom = { type: 'track', payload: { name: 'search', properties: { __path: 'https://app.example/customers?q=budi+santoso' } } };
  assert.equal(init.filter(custom), true);
  assert.equal(custom.payload.properties.__path, 'https://app.example/customers', `${lang}: custom events carry the URL without its query string`);

  // Every event's shape.
  a.trackUserLoggedIn();
  assert.deepEqual(last(), ['user_logged_in', {}]);
  a.trackFilterApplied('catalog', 'apply', { region: 'All', start_date: '2026-01-01' });
  assert.deepEqual(last(), ['filter_applied', { region: 'All', start_date: '2026-01-01', report: 'catalog', trigger: 'apply' }], `${lang}: filters flat`);
  a.trackReportViewed('detail');
  assert.deepEqual(last(), ['report_viewed', { report: 'detail' }]);
  a.trackDetailOpened({ report: 'catalog', entity_type: 'dashboard', entity_id: '42' });
  assert.deepEqual(last(), ['detail_opened', { report: 'catalog', entity_type: 'dashboard', entity_id: '42' }]);
  a.trackReportExported({ report: 'catalog', format: 'csv' });
  assert.deepEqual(last(), ['report_exported', { report: 'catalog', format: 'csv' }]);
  a.trackErrorShown({ report: 'detail', error_type: 'load_failed' });
  assert.deepEqual(last(), ['error_shown', { report: 'detail', error_type: 'load_failed' }]);
  a.trackFeatureUsed({ report: 'detail', feature: 'node_selected' });
  assert.deepEqual(last(), ['feature_used', { report: 'detail', feature: 'node_selected' }]);
  a.trackLinkOut('https://metabase.example/d/1', 'Open');
  assert.deepEqual(last(), ['link_out', { href: 'https://metabase.example/d/1', text: 'Open' }]);

  // Vocabulary: what a JavaScript app could send by mistake.
  const before = sent.length;
  a.trackReportViewed('Catalog');
  a.trackFeatureUsed({ report: 'detail', feature: 'not_registered' });
  a.trackDetailOpened({ report: 'catalog', entity_type: 'customer', entity_id: '1' });
  a.trackReportExported({ report: 'catalog', format: 'docx' });
  a.trackFilterApplied('catalog', 'apply', { format: 'Modern Trade' });   // a store-format filter
  a.trackFilterApplied('catalog', 'apply', { report: 'x', region: 'All' });
  a.trackFilterApplied('catalog', 'apply', { profileId: 'someone-else' });  // would re-attribute the event
  a.trackFilterApplied('catalog', 'apply', { groups: 'a,b' });
  a.trackFilterApplied('catalog', 'apply', { sales_rep: 'budi@pti.example' });
  a.trackErrorShown({ report: 'detail', error_type: 'ORA-00942: table X does not exist' });
  assert.equal(sent.length, before, `${lang}: vocabulary, reserved/camelCase filter keys, emails and error text are dropped`);
  assert.equal(warnings.length, 10, `${lang}: each drop warns`);

  // Fields are taken one by one: a spread row cannot carry its other columns.
  a.trackDetailOpened({ report: 'catalog', entity_type: 'dashboard', entity_id: '7', contact_email: 'pic@x.example', name: 'Budi' } as any);
  assert.deepEqual(last(), ['detail_opened', { report: 'catalog', entity_type: 'dashboard', entity_id: '7' }], `${lang}: no extra fields`);
  a.trackDetailOpened({ report: 'catalog', entity_type: 'dashboard' });
  assert.deepEqual(last(), ['detail_opened', { report: 'catalog', entity_type: 'dashboard' }], `${lang}: entity_id can be left out`);
  a.trackErrorShown({ report: 'detail', error_type: 'load_failed', message: 'secret' } as any);
  assert.deepEqual(last(), ['error_shown', { report: 'detail', error_type: 'load_failed' }], `${lang}: error_shown has no extra fields`);

  // Logout: tracked, awaited, then the profile is cleared.
  await a.trackUserLoggedOut();
  assert.deepEqual(sent.slice(-2), [['user_logged_out', {}], ['clear']], `${lang}: logout tracked, then clear()`);

  // Search: debounce, dedupe, reset, per-box, cap, sensitive, loading vs no count.
  const searches = () => sent.filter(([n]: [string]) => n === 'search').map(([, p]: [string, any]) => p);
  const open = { sensitive: false };
  for (const t of ['d', 'di', 'dim', 'dim_', 'dim_store']) a.trackSearch(t, 'catalog', 'catalog_box', t.length, open); // keystrokes
  await wait(1100);
  assert.deepEqual(searches(), [{ report: 'catalog', search_box: 'catalog_box', search_term: 'dim_store', search_term_length: 9, results_count: 9 }],
    `${lang}: one event: last term, last count`);
  a.trackSearch('  DIM_STORE ', 'catalog', 'catalog_box', 9, open); await wait(1100);
  assert.equal(searches().length, 1, `${lang}: same term after normalising => no repeat`);
  a.trackSearch('', 'catalog', 'catalog_box', 0, open); a.trackSearch('dim_store', 'catalog', 'catalog_box', 9, open); await wait(1100);
  assert.equal(searches().length, 2, `${lang}: after the box is cleared, the same term again is a new search`);
  a.trackSearch('sales', 'catalog', 'catalog_box', 1, open); a.trackSearch('rev', 'detail', 'cards_box', 2, open); await wait(1100);
  assert.equal(searches().length, 4, `${lang}: boxes debounce independently`);
  a.trackSearch('budi santoso', 'catalog', 'catalog_box', 1, open); a.trackSearch('x', 'catalog', 'catalog_box', 5, open); await wait(1100);
  assert.equal(searches().length, 4, `${lang}: a 1-char term cancels the pending one and sends nothing`);
  a.trackSearch('x'.repeat(300), 'catalog', 'catalog_box', 0, open); await wait(1100);
  assert.equal(searches()[4].search_term.length, 100, `${lang}: term capped at 100 chars`);
  a.trackSearch('Budi Santoso', 'detail', 'customer_box', 3, { sensitive: true }); await wait(1100);
  assert.deepEqual(searches()[5], { report: 'detail', search_box: 'customer_box', search_term_length: 12, results_count: 3 }, `${lang}: sensitive: no term`);
  a.trackSearch('Siti', 'detail', 'customer_box2', 1, undefined as any); await wait(1100);
  assert.equal('search_term' in searches()[6], false, `${lang}: no decision (JS) => treated as sensitive`);
  a.trackSearch('slow term', 'catalog', 'slow_box', undefined, open); await wait(1100);
  assert.equal(searches().length, 7, `${lang}: still loading => nothing sent yet`);
  a.trackSearch('slow term', 'catalog', 'slow_box', 0, open); await wait(1100);
  assert.equal(searches()[7].results_count, 0, `${lang}: the late count is sent, not lost`);
  a.trackSearch('no count', 'catalog', 'plain_box', null, open); await wait(1100);
  assert.equal('results_count' in searches()[8], false, `${lang}: null => sent without a count`);
  a.trackSearch('anything', 'catalog', 'Customer Search Box', 1, open); await wait(1100);
  assert.equal(searches().length, 9, `${lang}: a search_box that is not a code is dropped`);

  // Scroll depth: one capturing listener on document; the page or a lazily found container.
  const depths = () => sent.filter(([n]: [string]) => n === 'scroll_depth').map(([, p]: [string, any]) => p.threshold);
  let main: any = null;                     // the layout's scroller, mounted later
  a.startScrollTracking(() => (w.location.pathname === '/untracked' ? undefined : 'catalog'), () => main);
  a.startScrollTracking(() => 'catalog');
  assert.equal(docListeners, 1, `${lang}: starts once, further calls do nothing`);
  main = new FakeElement();
  const dropdown = new FakeElement();
  dropdown.scrollTop = 1500; docScroll({ target: dropdown });
  assert.equal(depths().length, 0, `${lang}: scrolling a dropdown is not page depth`);
  main.scrollTop = 0; docScroll({ target: main });     // 25 % in view at the top
  main.scrollTop = 600; docScroll({ target: main });   // 55 %
  main.scrollTop = 600; docScroll({ target: main });   // same position: nothing new
  main.scrollTop = 1500; docScroll({ target: main });  // bottom: 75 and 100
  assert.deepEqual(depths(), [25, 50, 75, 100], `${lang}: each threshold once, in order`);
  main.scrollTop = 0; docScroll({ target: main });
  assert.equal(depths().length, 4, `${lang}: scrolling back up sends nothing`);
  main = new FakeElement();                            // layout re-mounted
  w.location.pathname = '/catalog/other'; main.scrollTop = 1500; docScroll({ target: main });
  assert.deepEqual(depths().slice(4), [25, 50, 75, 100], `${lang}: a new page view starts over, on the re-mounted element`);
  w.location.pathname = '/untracked'; main.scrollTop = 1500; docScroll({ target: main });
  assert.equal(depths().length, 8, `${lang}: a location without a report is not tracked`);
  // A route change while the new page still shows a short loading state: the browser
  // clamps the old scroll position and fires a scroll event. Nothing to scroll is not a
  // depth, or every threshold is spent before the content exists (seen in dai/atlas).
  w.location.pathname = '/catalog/loading';
  main.scrollHeight = main.clientHeight; main.scrollTop = 0; docScroll({ target: main });
  assert.equal(depths().length, 8, `${lang}: a page with nothing to scroll sends nothing`);
  main.scrollHeight = 2000; main.scrollTop = 1500; docScroll({ target: main });
  assert.deepEqual(depths().slice(8), [25, 50, 75, 100], `${lang}: thresholds still open once the content has loaded`);
  w.location.pathname = '/catalog';

  // Page scroll (no container): the document itself.
  const b = await fresh(lang);
  b.startAnalytics({ clientId: 'abc' });
  b.startScrollTracking(() => 'catalog');
  g.document.documentElement.scrollTop = 1500; docScroll({ target: g.document });
  assert.deepEqual(depths().slice(12), [25, 50, 75, 100], `${lang}: page scroll measured on documentElement`);
}
console.log('events.ts and its generated JavaScript copy: all checks passed');
