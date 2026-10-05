import { expect, test } from 'bun:test';

// Exercise the real guards with fake DB reads isolated from other suites.
test('real board preference guard preserves scope, participant defaults and channel precedence', async () => {
  const child = Bun.spawn([process.execPath, new URL('./fixtures/boardPreferenceGuard.ts', import.meta.url).pathname], {
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
  expect(stdout).toContain('rejection propagation verified');
});
