import { expect, test } from 'bun:test';

// Isolate shared DB/auth mocks in a subprocess while exercising real handlers.
test('real profile get/update handlers preserve auth, nickname validation and projection', async () => {
  const child = Bun.spawn(
    [process.execPath, new URL('./fixtures/profileHandlers.ts', import.meta.url).pathname],
    { stdout: 'pipe', stderr: 'pipe' },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(stderr).toBe('');
  expect(exitCode).toBe(0);
  expect(stdout).toContain('profile get/update auth guards, nickname validation, uniqueness');
});
