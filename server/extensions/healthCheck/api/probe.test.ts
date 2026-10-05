import { expect, test } from 'bun:test';

test('real probe handler preserves authorization, scoped lookup, rate limit and response contract', async () => {
  const child = Bun.spawn([process.execPath, new URL('./fixtures/probeContract.ts', import.meta.url).pathname], {
    stdout: 'pipe', stderr: 'pipe',
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
  ]);
  expect(stderr).toBe('');
  expect(exitCode).toBe(0);
  expect(stdout).toContain('probe handler contract passed');
});
