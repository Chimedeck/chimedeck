import { strict as assert } from 'node:assert';
import { mock } from 'bun:test';

// Real trelloCompat boardsRouter under test, exercising the two member routes
// that could strip a board of its last ADMIN. The shared db module is mocked
// here in a subprocess so this fixture cannot leak a fake Knex chain into (or
// be replaced by) adjacent test files that mock the shared db module
// differently. Fake DB rows only — no live PostgreSQL.

type Row = Record<string, unknown>;

const boardMembers: Row[] = [];
const memberships: Row[] = [];
const users: Row[] = [];
const guestAccess: Row[] = [];
const boards: Row[] = [];
const deleted: Row[] = [];
const updated: Row[] = [];

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, value]) => row[key] === value);
}

function tableRows(table: string): Row[] {
  if (table === 'board_members') return boardMembers;
  if (table === 'memberships') return memberships;
  if (table === 'board_guest_access') return guestAccess;
  if (table === 'users') return users;
  if (table === 'boards') return boards;
  return [];
}

function dbStub(table: string) {
  const state: { where: Row; counting: boolean } = { where: {}, counting: false };
  const rows = () => tableRows(table).filter((row) => matches(row, state.where));
  const builder: Record<string, unknown> = {
    where(w: Row) {
      Object.assign(state.where, w);
      return builder;
    },
    orderBy: () => builder,
    join: () => builder,
    select: () => Promise.resolve(rows()),
    count() {
      state.counting = true;
      return builder;
    },
    first() {
      if (state.counting) return Promise.resolve({ count: rows().length });
      return Promise.resolve(rows()[0]);
    },
    update(patch: Row) {
      updated.push({ ...state.where, ...patch });
      for (const row of rows()) Object.assign(row, patch);
      return Promise.resolve(1);
    },
    delete() {
      const targets = rows();
      for (const row of targets) {
        deleted.push(row);
        const source = tableRows(table);
        source.splice(source.indexOf(row), 1);
      }
      return Promise.resolve(targets.length);
    },
    insert: (row: Row) => {
      tableRows(table).push(row);
      return Promise.resolve([row]);
    },
  };
  return builder;
}

const db = Object.assign(dbStub, { raw: (sql: string) => sql });

await mock.module('../../../../../common/db', () => ({ db }));
await mock.module('../../../../../common/ids/resolveEntityId', () => ({
  resolveBoardId: (id: string) => Promise.resolve(id),
  resolveCardId: (id: string) => Promise.resolve(id),
  resolveListId: (id: string) => Promise.resolve(id),
}));

const { boardsRouter } = await import('../../../api/boards/index');

function request(method: string, path: string): Request {
  const req = new Request(`https://example.test/1/${path}`, { method });
  Object.assign(req, { currentUser: { id: 'admin-1' } });
  return req;
}

function reset(members: Row[]): void {
  boardMembers.length = 0;
  memberships.length = 0;
  users.length = 0;
  guestAccess.length = 0;
  boards.length = 0;
  boards.push({ id: 'board-1', workspace_id: 'ws-1', visibility: 'PRIVATE' });
  deleted.length = 0;
  updated.length = 0;
  boardMembers.push(...members);
  // The acting user is a workspace ADMIN, so canWriteBoard passes. The target
  // must also hold a workspace role, which PUT checks before touching the board.
  memberships.push(
    { user_id: 'admin-1', workspace_id: 'ws-1', role: 'ADMIN' },
    { user_id: 'user-1', workspace_id: 'ws-1', role: 'MEMBER' },
    { user_id: 'user-2', workspace_id: 'ws-1', role: 'MEMBER' },
  );
  users.push(
    { id: 'admin-1', email: 'admin@example.com', name: 'Admin', nickname: null },
    { id: 'user-1', email: 'a@example.com', name: 'A', nickname: null },
  );
}

const soleAdmin = () => [{ id: 'bm-1', board_id: 'board-1', user_id: 'user-1', role: 'ADMIN' }];
const twoAdmins = () => [
  { id: 'bm-1', board_id: 'board-1', user_id: 'user-1', role: 'ADMIN' },
  { id: 'bm-2', board_id: 'board-1', user_id: 'user-2', role: 'ADMIN' },
];

async function run(): Promise<void> {
  // 1. PUT demoting the last admin — memberType defaults to 'normal' (MEMBER),
  //    which is exactly how a caller strips a board of its last admin.
  reset(soleAdmin());
  let res = await boardsRouter(
    request('PUT', 'boards/board-1/members/user-1') as never,
    '/boards/board-1/members/user-1',
  );
  assert.ok(res);
  assert.equal(res.status, 409);
  assert.equal(updated.length, 0);
  assert.equal((boardMembers[0] as Row).role, 'ADMIN');

  // 2. DELETE removing the last admin.
  reset(soleAdmin());
  res = await boardsRouter(
    request('DELETE', 'boards/board-1/members/user-1') as never,
    '/boards/board-1/members/user-1',
  );
  assert.ok(res);
  assert.equal(res.status, 409);
  assert.equal(deleted.length, 0);
  assert.equal(boardMembers.length, 1);

  // 3. Both are allowed while a second admin remains.
  reset(twoAdmins());
  res = await boardsRouter(
    request('PUT', 'boards/board-1/members/user-1') as never,
    '/boards/board-1/members/user-1',
  );
  assert.ok(res);
  assert.equal(res.status, 200);
  assert.equal(updated.length, 1);

  reset(twoAdmins());
  res = await boardsRouter(
    request('DELETE', 'boards/board-1/members/user-1') as never,
    '/boards/board-1/members/user-1',
  );
  assert.ok(res);
  assert.equal(res.status, 200);
  assert.equal(deleted.length, 1);

  console.info(
    'trelloCompat PUT/DELETE board member routes enforce the last-board-admin invariant',
  );
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
