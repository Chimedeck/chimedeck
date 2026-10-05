import { expect, test } from 'bun:test';

// Real handler under test: handleGetArchivedLists. The shared db module is faked
// with a recording Knex-style chain in a subprocess so this fixture cannot leak
// state into (or be replaced by) adjacent test files that mock the shared db
// module differently. Fake DB rows only — no live PostgreSQL.
test('handleGetArchivedLists returns this board\'s archived lists behind the usual visibility gates', async () => {
  const child = Bun.spawn(
    [process.execPath, new URL('./fixtures/archivedLists.ts', import.meta.url).pathname],
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
    'handleGetArchivedLists board scoping, archived filter, empty result, visibility and membership gates verified',
  );
});
