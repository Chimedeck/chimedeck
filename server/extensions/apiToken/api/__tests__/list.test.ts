import { expect, test } from 'bun:test';

// Isolate shared db/authenticate mocks while exercising the real
// handleListTokens handler in a subprocess so this fixture cannot leak
// state into (or be replaced by) adjacent tests.
test('handleListTokens scopes to current user, excludes revoked tokens, orders by created_at desc, and never leaks raw token/hash', async () => {
  const child = Bun.spawn(
    [process.execPath, new URL('./fixtures/list.ts', import.meta.url).pathname],
    { stdout: 'pipe', stderr: 'pipe' },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(stderr).toBe('');
  expect(exitCode).toBe(0);
  expect(stdout).toContain(
    'handleListTokens real user-scope filter, revoked exclusion, ordering, and public-field-only response verified',
  );
});
