import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';

test('board plugin allowed-domains handler preserves guard, validation, and config-merge contracts', () => {
  // Shared DB/auth mocks stay in a child process, away from other suites'
  // mock.module state (see server/mods/events/__tests__/writeEvent.contract.test.ts).
  const fixture = fileURLToPath(new URL('./fixtures/allowedDomains.fixture.ts', import.meta.url));
  const result = Bun.spawnSync([process.execPath, fixture], { stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode !== 0) {
    console.error(result.stderr.toString());
  }
  expect(result.stderr.toString()).toBe('');
  expect(result.exitCode).toBe(0);
});
