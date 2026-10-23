// Writes the JavaScript copy of events.ts, for apps without TypeScript.
// Usage: node <skill>/to-js.mjs src/lib/analytics/events.js        (Node >= 22.13)
// Mechanical type stripping, so the JS copy cannot drift from the tested template.
import { stripTypeScriptTypes } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

const out = process.argv[2];
if (!out?.endsWith('.js')) {
  console.error('usage: node to-js.mjs <output.js>');
  process.exit(1);
}
const ts = readFileSync(new URL('./events.ts', import.meta.url), 'utf8');
writeFileSync(out,
  '// Generated from the apply-event-tracking skill (events.ts) by to-js.mjs.\n' +
  '// Edit only the vocabulary (REPORTS, ENTITY_TYPES, EXPORT_FORMATS, FEATURES).\n' +
  '// To pick up a newer template: regenerate, then re-add the vocabulary.\n' +
  stripTypeScriptTypes(ts, { mode: 'transform' }));
console.log(`wrote ${out}`);
