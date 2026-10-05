import { expect, test } from 'bun:test';

// Isolate shared auth/DB/permissionManager mocks while exercising the real
// update/delete handlers in a subprocess.
test('real webhook update/delete preserve auth, membership call and ownership checks', async () => {
  const child = Bun.spawn(
    [process.execPath, new URL('./fixtures/updateDelete.ts', import.meta.url).pathname],
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
    'webhook update/delete auth, workspace-scoped and global membership calls, ownership and success paths verified',
  );
});
