import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./forgotPassword.fixture.ts', import.meta.url));

// Real db/email modules are mocked inside the child process only, so this
// suite's shared DB mocks can never leak into (or be leaked into by) adjacent tests.
test.each([
  'rate-limited', 'bad-json', 'missing-email', 'missing-user', 'known-user',
])('forgot password boundary: %s', (scenario) => {
  const result = spawnSync(process.execPath, [fixture, scenario], { encoding: 'utf8' });
  expect(result.error).toBeUndefined();
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
});
