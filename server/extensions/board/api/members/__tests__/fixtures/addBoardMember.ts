import { strict as assert } from 'node:assert';
import { mock } from 'bun:test';

// Real handleAddBoardMember under test. The shared db module is mocked here in a
// subprocess so this fixture cannot leak a fake Knex chain into (or be replaced
// by) adjacent test files that mock '../../../../../../common/db' differently.
// Fake DB rows only — no live PostgreSQL coverage.

type Row = Record<string, unknown>;

const boardMembers: Row[] = [];
const memberships: Row[] = [];
const users: Row[] = [];
const inserted: Row[] = [];
const updated: Row[] = [];

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
    update(patch: Row) {
      updated.push({ ...state.where, ...patch });
      for (const row of rows()) Object.assign(row, patch);
      return Promise.resolve(1);
    },
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
  updated.length = 0;
  memberships.push({ user_id: 'user-2', workspace_id: 'ws-1', role: 'MEMBER' });
  users.push({ id: 'user-2', email: 'new@example.com', name: 'New User', nickname: null });
}

async function run(): Promise<void> {
  // 1. A workspace member who is not yet on the board is inserted as MEMBER.
  reset();
  let res = await handleAddBoardMember(request({ userId: 'user-2' }), 'board-1');
  assert.equal(res.status, 201);
  assert.equal(inserted.length, 1);
  const firstInsert = inserted[0] as Row;
  assert.equal(firstInsert.role, 'MEMBER');
  assert.equal(firstInsert.board_id, 'board-1');

  // 2. Re-adding an existing member is a conflict and never rewrites their role.
  //    This is the regression: it used to demote a board ADMIN to MEMBER.
  reset();
  boardMembers.push({ board_id: 'board-1', user_id: 'user-2', role: 'ADMIN' });
  res = await handleAddBoardMember(request({ userId: 'user-2' }), 'board-1');
  assert.equal(res.status, 409);
  assert.equal(((await res.json()) as { name?: string }).name, 'board-member-exists');
  assert.equal(updated.length, 0);
  assert.equal((boardMembers[0] as Row).role, 'ADMIN');

  // 3. An unrecognised role is rejected instead of silently becoming MEMBER.
  //    The MCP invite_to_board tool offers 'observer', which this route never supported.
  reset();
  res = await handleAddBoardMember(request({ userId: 'user-2', role: 'observer' }), 'board-1');
  assert.equal(res.status, 400);
  assert.equal(((await res.json()) as { name?: string }).name, 'invalid-role');
  assert.equal(inserted.length, 0);

  // 4. A valid role is accepted in any case — roles are stored uppercase.
  reset();
  res = await handleAddBoardMember(request({ userId: 'user-2', role: 'admin' }), 'board-1');
  assert.equal(res.status, 201);
  assert.equal((inserted[0] as Row).role, 'ADMIN');

  // 5. Unchanged: a non-workspace member still cannot be added to a board.
  reset();
  memberships.length = 0;
  res = await handleAddBoardMember(request({ userId: 'user-2' }), 'board-1');
  assert.equal(res.status, 422);
  assert.equal(((await res.json()) as { name?: string }).name, 'user-not-workspace-member');
  assert.equal(inserted.length, 0);

  console.info(
    'handleAddBoardMember conflict-on-existing-member, role validation, case-insensitive role, and workspace-membership gate verified',
  );
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
