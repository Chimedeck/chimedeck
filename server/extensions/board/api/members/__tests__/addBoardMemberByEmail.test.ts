import { expect, test } from 'bun:test';

// Real handler under test: handleAddBoardMember, email branch. The shared db
// module is faked with a recording Knex-style chain in a subprocess so this
// fixture cannot leak state into (or be replaced by) adjacent test files that
// mock the shared db module differently. Fake DB rows only — no live PostgreSQL.
test('handleAddBoardMember accepts an email as well as a userId', async () => {
  const child = Bun.spawn(
    [process.execPath, new URL('./fixtures/addBoardMemberByEmail.ts', import.meta.url).pathname],
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
    'handleAddBoardMember email lookup, normalisation, userId precedence, unknown-account 404, and workspace/duplicate gates verified',
  );
});
