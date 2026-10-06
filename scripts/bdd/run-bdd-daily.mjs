#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();
const mapPath = path.join(repo, 'specs/bdd/bdd-playwright-map.json');
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

const entries = map.entries.filter(e => e.type === 'playwright' && e.daily === true);
const files = [...new Set(entries.map(e => e.file))];

if (!files.length) {
  console.error('No daily-flagged Playwright BDD scenarios in bdd-playwright-map.json');
  process.exit(1);
}

console.log(`Running daily BDD subset: ${entries.length} daily=true scenarios across ${files.length} Playwright files.`);
console.log('Note: test:bdd-regression is the full pack; this daily run covers only daily=true scenarios.');

const args = ['playwright', 'test', ...files, '--project=e2e', ...process.argv.slice(2)];
const env = {
  ...process.env,
  TEST_BASE_URL: process.env.TEST_BASE_URL || 'http://127.0.0.1:3000',
  TEST_UI_URL: process.env.TEST_UI_URL || 'http://127.0.0.1:5173',
};
const r = spawnSync('bunx', args, { stdio: 'inherit', env });
process.exit(r.status ?? 1);
