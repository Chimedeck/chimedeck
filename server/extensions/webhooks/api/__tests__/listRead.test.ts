import { expect, test } from 'bun:test';

// Isolate shared auth/DB mocks while exercising the real handler.
test('real webhook list preserves authentication, global active query and secret-free response', async () => {
  const child = Bun.spawn([process.execPath, new URL('./fixtures/listRead.ts', import.meta.url).pathname], {
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
  expect(stdout).toContain('JSONB and rejection verified');
});
