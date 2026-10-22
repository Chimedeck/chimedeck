import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./cardWritable.fixture.ts', import.meta.url));

// Keep shared DB mocks out of the suite and import the real middleware in each child.
test.each([
  'active', 'missing-cards', 'missing-lists', 'missing-boards',
  'board-archived', 'card-archived', 'both-archived',
  'error-cards', 'error-lists', 'error-boards',
])('card writable boundary: %s', (scenario) => {
  const result = spawnSync(process.execPath, [fixture, scenario], { encoding: 'utf8' });
  expect(result.error).toBeUndefined();
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
});
