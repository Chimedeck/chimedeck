import { expect, test } from 'bun:test';

// Exercise the real createNotificationsForMentions handler with fake DB reads
// isolated in a subprocess so this suite's mock.module calls cannot leak into
// (or be poisoned by) any other test file's shared db mock.
test('real createNotifications handler preserves guards, preference gating, insert payload shape and webhook fan-out', async () => {
  const child = Bun.spawn([process.execPath, new URL('./fixtures/createNotifications.ts', import.meta.url).pathname], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(stderr).toBe('');
  expect(exitCode).toBe(0);
  expect(stdout).toContain('guards, preferences, insert payload shape and webhook fan-out verified');
});
