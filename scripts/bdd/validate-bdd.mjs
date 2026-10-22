#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();
const specPath = path.join(repo, 'specs/bdd/chimedeck-bdd-spec-generated.md');
const mapPath = path.join(repo, 'specs/bdd/bdd-playwright-map.json');

const spec = fs.readFileSync(specPath, 'utf8');
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

const scenarioIds = new Set([...spec.matchAll(/#### Scenario\s+(BDD-[A-Z]+-\d{4})\s+—/g)].map(m => m[1]));
const autoIds = new Set([...spec.matchAll(/#### Scenario\s+(BDD-AUTO-\d{4})\s+—/g)].map(m => m[1]));

const mapIds = new Set(map.entries.map(e => e.id));

const errors = [];

// AUTO scenarios must be mapped
for (const id of autoIds) {
  if (!mapIds.has(id)) errors.push(`AUTO scenario missing mapping: ${id}`);
}

// mapped IDs must exist in spec
for (const id of mapIds) {
  if (!scenarioIds.has(id)) errors.push(`Mapping references missing scenario in spec: ${id}`);
}

// file + title checks
for (const e of map.entries) {
  const filePath = path.join(repo, e.file);
  if (!fs.existsSync(filePath)) {
    errors.push(`Mapped file not found for ${e.id}: ${e.file}`);
    continue;
  }
  const txt = fs.readFileSync(filePath, 'utf8');
  if (!txt.includes(`test('${e.title}'`)) {
    errors.push(`Mapped title not found for ${e.id}: ${e.title} in ${e.file}`);
  }
}

const dailyCount = map.entries.filter(e => e.daily).length;
const playwrightCount = map.entries.filter(e => e.type === 'playwright').length;

if (playwrightCount !== autoIds.size) {
  errors.push(`Automated BDD count mismatch: spec has ${autoIds.size}, mapping has ${playwrightCount}`);
}

if (errors.length) {
  console.error('BDD validation failed:');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log(`BDD validation OK. scenarios=${scenarioIds.size} auto=${autoIds.size} mapped=${map.entries.length} regression=${playwrightCount} dailyFlagged=${dailyCount}`);
