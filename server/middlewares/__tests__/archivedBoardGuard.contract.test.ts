import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';

test('archivedBoardGuard real handlers preserve not-found, archived and pass-through contracts', () => {
  // Shared DB mock stays in a child process, away from other suites' mock.module state.
  const fixture = fileURLToPath(new URL('./fixtures/archivedBoardGuard.fixture.ts', import.meta.url));
  const result = Bun.spawnSync([process.execPath, fixture], { stdout: 'pipe', stderr: 'pipe' });
  expect(result.stderr.toString()).toBe('');
  expect(result.exitCode).toBe(0);
});
