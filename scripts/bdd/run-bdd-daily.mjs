#!/usr/bin/env node
// Runs the daily BDD subset: exactly the scenarios flagged daily=true in
// specs/bdd/bdd-playwright-map.json (spec pipeline rule 4). Playwright is
// invoked with a --grep-filter of the full mapped test titles so only those
// scenario titles execute, even inside files that also carry non-daily tests.
// Full pack: test:bdd-regression. Title/ID contract: validate-bdd.mjs.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();
const mapPath = path.join(repo, 'specs/bdd/bdd-playwright-map.json');
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

const entries = map.entries.filter(e => e.type === 'playwright' && e.daily === true);

if (!entries.length) {
  console.error('No daily-flagged Playwright BDD scenarios in bdd-playwright-map.json');
  process.exit(1);
}

// [why title filter, not file list alone] A file-level selection still runs every
// test inside the selected files (e.g. list-management.spec.ts carries unmapped
// non-daily tests) — that violates the "only scenarios flagged daily=true"
// contract. Playwright -g matches against the FULL title (describe chain +
// test name); the map's title field stores exactly the leaf test title, so
// build the filter from describe blocks + leaf title.
function fileSourceAndPrefix(file) {
  const src = fs.readFileSync(path.join(repo, file), 'utf8');
  const describes = [];
  const re = /test\.describe\(\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = re.exec(src)) !== null) describes.push(m[1]);
  // Single describe chain per spec file in this repo; full title = describe + ' ' + leaf.
  const prefix = describes.length ? describes.join(' ') + ' ' : '';
  return { src, prefix };
}

function hasMappedTitle(src, leafTitle) {
  // Same literal check as scripts/bdd/validate-bdd.mjs (`test('${e.title}'`).
  return src.includes(`test('${leafTitle}'`);
}

const fullTitles = [];
const files = [];
const stale = [];
const srcCache = new Map();
for (const e of entries) {
  if (!files.includes(e.file)) files.push(e.file);
  if (!srcCache.has(e.file)) {
    srcCache.set(e.file, fileSourceAndPrefix(e.file).src);
  }
  const src = srcCache.get(e.file);
  // [why] Copilot round-4 on PR #348: `prefix + title` is always truthy, so an
  // empty title check never catches a renamed/removed test — Playwright would
  // run the other matches and SILENTLY omit this daily scenario. Only add a
  // grep alternative when the mapped declaration actually exists; otherwise
  // fail loudly below.
  if (!hasMappedTitle(src, e.title)) {
    stale.push(e);
    continue;
  }
  const { prefix } = fileSourceAndPrefix(e.file);
  fullTitles.push(prefix + e.title);
}

if (stale.length) {
  console.error(
    `BDD daily map stale: ${stale.length} of ${entries.length} daily=true ${
      stale.length === 1 ? 'entry does' : 'entries do'
    } not match any test('...') declaration in its spec file — ` +
      stale.map((e) => `${e.id} "${e.title}" in ${e.file}`).join('; ')
  );
  process.exit(1);
}

console.log(`Running daily BDD subset: ${entries.length} daily=true scenarios across ${files.length} Playwright files (title-filtered).`);
console.log('Note: test:bdd-regression is the full pack; this daily run covers only daily=true scenarios.');

// Playwright treats --grep as a regex matched against the full test title. The
// mapped titles contain regex metacharacters (e.g. parenthesized expectations) —
// escape them so the pattern matches the mapped titles literally, then OR the
// alternatives. A test runs iff its full title matches ANY mapped daily title.
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const grep = fullTitles.map(escapeRegExp).join('|');

const args = [
  'playwright',
  'test',
  ...files,
  '--project=e2e',
  '--grep=' + grep,
  ...process.argv.slice(2),
];
const env = {
  ...process.env,
  TEST_BASE_URL: process.env.TEST_BASE_URL || 'http://127.0.0.1:3000',
  TEST_UI_URL: process.env.TEST_UI_URL || 'http://127.0.0.1:5173',
};
const r = spawnSync('bunx', args, { stdio: 'inherit', env });
process.exit(r.status ?? 1);