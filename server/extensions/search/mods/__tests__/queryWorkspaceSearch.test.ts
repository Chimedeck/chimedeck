import { expect, test } from 'bun:test';

// Real handler under test: queryWorkspaceSearch. The shared db module is faked
// with a recording Knex-style chain in a subprocess so this fixture cannot leak
// state into (or be replaced by) adjacent test files that mock '../../../common/db'
// differently. Fake DB rows only — no live PostgreSQL/full-text-search coverage.
test('queryWorkspaceSearch enforces board-access filtering by role, merges/ranks board+card results, and proxies backgrounds', async () => {
  const child = Bun.spawn(
    [process.execPath, new URL('./fixtures/queryWorkspaceSearch.ts', import.meta.url).pathname],
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
    'queryWorkspaceSearch real board/card access-filter branching, rank-sort merge, and background/rank projection verified',
  );
});
