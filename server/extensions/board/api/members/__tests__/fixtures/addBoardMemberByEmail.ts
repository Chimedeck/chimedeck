import { strict as assert } from 'node:assert';
import { mock } from 'bun:test';

// Real handleAddBoardMember under test, exercising the email-based lookup. The
// shared db module is mocked here in a subprocess so this fixture cannot leak a
// fake Knex chain into (or be replaced by) adjacent test files that mock the
// shared db module differently. Fake DB rows only — no live PostgreSQL.

type Row = Record<string, unknown>;

const boardMembers: Row[] = [];
const memberships: Row[] = [];
const users: Row[] = [];
const inserted: Row[] = [];

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, value]) => row[key.replace(/^bm\./, '')] === value);
}

// Minimal Knex-style chain covering only the calls this handler makes.
function dbStub(table: string) {
  const state: { where: Row; notRole?: string } = { where: {} };
  const rows = () => {
    const source = table.startsWith('board_members')
      ? boardMembers
      : table === 'memberships'
        ? memberships
        : users;
    return source.filter(
      (row) => matches(row, state.where) && (state.notRole === undefined || row.role !== state.notRole),
    );
  };
  const builder: Record<string, unknown> = {
    where(w: Row) {
      Object.assign(state.where, w);
      return builder;
    },
    whereNot(column: string, value: string) {
      if (column === 'role') state.notRole = value;
      return builder;
    },
    join: () => builder,
    select: () => builder,
    first: () => Promise.resolve(rows()[0]),
    insert(row: Row) {
      inserted.push(row);
      boardMembers.push(row);
      return Promise.resolve([row]);
    },
    update: () => Promise.resolve(1),
  };
  return builder;
}

const db = Object.assign(dbStub, { raw: (sql: string) => sql });

await mock.module('../../../../../../common/db', () => ({ db }));
await mock.module('../../../../../../middlewares/permissionManager', () => ({
  requireRole: () => null, // caller is a workspace ADMIN throughout this fixture
}));
await mock.module('../../../../../../mods/events/dispatch', () => ({
  dispatchEvent: () => Promise.resolve(),
}));

const { handleAddBoardMember } = await import('../../create');

function request(body: unknown): Request {
  const req = new Request('https://example.test/api/v1/boards/board-1/members', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
  Object.assign(req, {
    board: { id: 'board-1', workspace_id: 'ws-1' },
    currentUser: { id: 'user-1' },
  });
  return req;
}

function reset(): void {
  boardMembers.length = 0;
  memberships.length = 0;
  users.length = 0;
  inserted.length = 0;
  memberships.push({ user_id: 'user-2', workspace_id: 'ws-1', role: 'MEMBER' });
  users.push({ id: 'user-2', email: 'new@example.com', name: 'New User', nickname: null });
}

async function run(): Promise<void> {
  // 1. An email identifies the target user, so the MCP invite_to_board tool —
  //    which has only ever sent { email, role } — now works against this route.
  reset();
  let res = await handleAddBoardMember(request({ email: 'new@example.com' }), 'board-1');
  assert.equal(res.status, 201);
  assert.equal(inserted.length, 1);
  assert.equal((inserted[0] as Row).user_id, 'user-2');
  assert.equal((inserted[0] as Row).role, 'MEMBER');

  // 2. Email matching is case- and whitespace-insensitive, as in workspace invites.
  reset();
  res = await handleAddBoardMember(request({ email: '  NEW@Example.com ' }), 'board-1');
  assert.equal(res.status, 201);
  assert.equal((inserted[0] as Row).user_id, 'user-2');

  // 3. userId still works and wins when both are supplied.
  reset();
  users.push({ id: 'user-3', email: 'other@example.com', name: 'Other', nickname: null });
  memberships.push({ user_id: 'user-3', workspace_id: 'ws-1', role: 'MEMBER' });
  res = await handleAddBoardMember(
    request({ userId: 'user-3', email: 'new@example.com' }),
    'board-1',
  );
  assert.equal(res.status, 201);
  assert.equal((inserted[0] as Row).user_id, 'user-3');

  // 4. An email with no account is a 404, matching workspace member invites.
  reset();
  res = await handleAddBoardMember(request({ email: 'nobody@example.com' }), 'board-1');
  assert.equal(res.status, 404);
  assert.equal(((await res.json()) as { name?: string }).name, 'user-not-found');
  assert.equal(inserted.length, 0);

  // 5. An account that exists but is not in the workspace still cannot be added.
  reset();
  memberships.length = 0;
  res = await handleAddBoardMember(request({ email: 'new@example.com' }), 'board-1');
  assert.equal(res.status, 422);
  assert.equal(((await res.json()) as { name?: string }).name, 'user-not-workspace-member');
  assert.equal(inserted.length, 0);

  // 6. Neither identifier supplied is still a 400, with a message naming both.
  reset();
  res = await handleAddBoardMember(request({}), 'board-1');
  assert.equal(res.status, 400);
  const missing = (await res.json()) as { name?: string; data?: { message?: string } };
  assert.equal(missing.name, 'missing-user-id');
  assert.ok(missing.data?.message?.includes('email'));
  assert.equal(inserted.length, 0);

  // 7. An email that resolves to someone already on the board is still a conflict.
  reset();
  boardMembers.push({ board_id: 'board-1', user_id: 'user-2', role: 'ADMIN' });
  res = await handleAddBoardMember(request({ email: 'new@example.com' }), 'board-1');
  assert.equal(res.status, 409);
  assert.equal(((await res.json()) as { name?: string }).name, 'board-member-exists');
  assert.equal((boardMembers[0] as Row).role, 'ADMIN');

  console.info(
    'handleAddBoardMember email lookup, normalisation, userId precedence, unknown-account 404, and workspace/duplicate gates verified',
  );
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
