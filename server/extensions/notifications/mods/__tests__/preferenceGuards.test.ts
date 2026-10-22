import { expect, test } from 'bun:test';

// Shared DB mocks stay in a child process; these imports exercise the real guards.
test('real preference guards preserve opt-out defaults and user/type query scope', async () => {
  const child = Bun.spawn([process.execPath, new URL('./fixtures/preferenceGuards.ts', import.meta.url).pathname], {
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
