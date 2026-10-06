import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';

test('writeEvent real handler preserves insert payload, guard, snapshot and publish contracts', () => {
  // Shared DB mock stays in a child process, away from other suites' mock.module state.
  const fixture = fileURLToPath(new URL('./fixtures/writeEvent.fixture.ts', import.meta.url));
  const result = Bun.spawnSync([process.execPath, fixture], { stdout: 'pipe', stderr: 'pipe' });
  expect(result.stderr.toString()).toBe('');
  expect(result.exitCode).toBe(0);
});
