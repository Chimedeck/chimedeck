import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./get.fixture.ts', import.meta.url));

// Isolate shared DB/auth/membership mocks in a child process; exercise the real handler.
test.each([
  'ready',
  'no-replies',
  'unauthenticated',
  'missing-comment',
  'missing-board-chain',
  'not-member',
])('replies get boundary: %s', (scenario) => {
  const result = spawnSync(process.execPath, [fixture, scenario], { encoding: 'utf8' });
  expect(result.error).toBeUndefined();
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
});
