import { expect, test } from 'bun:test';

// Real handler under test: handleAddBoardMember. The shared db module is faked
// with a recording Knex-style chain in a subprocess so this fixture cannot leak
// state into (or be replaced by) adjacent test files that mock
// '../../../../common/db' differently. Fake DB rows only — no live PostgreSQL.
test('handleAddBoardMember rejects duplicate members instead of rewriting their role, and validates the role', async () => {
  const child = Bun.spawn(
    [process.execPath, new URL('./fixtures/addBoardMember.ts', import.meta.url).pathname],
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
    'handleAddBoardMember conflict-on-existing-member, role validation, case-insensitive role, and workspace-membership gate verified',
  );
});
