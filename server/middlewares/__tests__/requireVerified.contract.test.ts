import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';

test('requireVerified real middleware preserves flag, identity, query, response and rejection contracts', () => {
  // Shared DB/flags mocks stay in a child process, away from other suites.
  const fixture = fileURLToPath(new URL('./fixtures/requireVerified.fixture.ts', import.meta.url));
  const result = Bun.spawnSync([process.execPath, fixture], { stdout: 'pipe', stderr: 'pipe' });
  expect(result.stderr.toString()).toBe('');
  expect(result.exitCode).toBe(0);
});
