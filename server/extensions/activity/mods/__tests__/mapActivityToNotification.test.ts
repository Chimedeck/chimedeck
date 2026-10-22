import { expect, test } from 'bun:test';

// Isolate shared DB/notification-guard mocks while exercising the real
// mapActivityToNotification handler in a subprocess so this fixture cannot
// leak state into (or be replaced by) adjacent tests.
test('mapActivityToNotification resolves board/actor reads, excludes actor, notifies recipients, and respects opt-out guards', async () => {
  const child = Bun.spawn(
    [process.execPath, new URL('./fixtures/mapActivityToNotification.ts', import.meta.url).pathname],
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
    'mapActivityToNotification real board/user/notification reads, recipient exclusion, insert payload and opt-out guard verified',
  );
});
