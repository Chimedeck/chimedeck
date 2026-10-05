import { test, expect } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('real avatar proxy preserves authentication, lookup, redirects and signing failures', () => {
  // Shared DB/auth mocks must not leak into the full Bun suite.
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./proxy.fixture.ts', import.meta.url))], {
    encoding: 'utf8',
    timeout: 20_000,
  });
  expect(result.error).toBeUndefined();
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
});
