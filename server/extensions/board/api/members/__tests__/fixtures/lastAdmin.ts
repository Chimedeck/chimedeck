import { strict as assert } from 'node:assert';
import { mock } from 'bun:test';

// Real wouldRemoveLastBoardAdmin under test, plus the two native routes that
// consume it. The shared db module is mocked here in a subprocess so this
// fixture cannot leak a fake Knex chain into (or be replaced by) adjacent test
// files that mock the shared db module differently. Fake DB rows only — no
// live PostgreSQL.

type Row = Record<string, unknown>;

const boardMembers: Row[] = [];
const users: Row[] = [];
const deleted: Row[] = [];
const updated: Row[] = [];

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, value]) => row[key.replace(/^bm\./, '')] === value);
}

// Minimal Knex-style chain covering only the calls these handlers make.
function dbStub(table: string) {
  const state: { where: Row } = { where: {} };
  const rows = () => {
    const source = table.startsWith('board_members') ? boardMembers : users;
    return source.filter((row) => matches(row, state.where));
  };
  const builder: Record<string, unknown> = {
    where(w: Row) {
      Object.assign(state.where, w);
      return builder;
    },
    join: () => builder,
    select: () => builder,
    count: () => builder,
    first() {
      // `.count('id as count').first()` resolves to a count row.
      if (Object.prototype.hasOwnProperty.call(state.where, 'role') && countMode) {
        return Promise.resolve({ count: rows().length });
      }
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
        boardMembers.splice(boardMembers.indexOf(row), 1);
      }
      return Promise.resolve(targets.length);
    },
  };
  return builder;
}

// `.count()` is only ever chained for the admin tally, so flag it there.
let countMode = false;
const countingDb = (table: string) => {
  const builder = dbStub(table);
  const originalCount = builder.count as () => unknown;
  builder.count = () => {
    countMode = true;
    return originalCount();
  };
  return builder;
};

const db = Object.assign(countingDb, { raw: (sql: string) => sql });

await mock.module('../../../../../../common/db', () => ({ db }));
await mock.module('../../../../../../middlewares/permissionManager', () => ({
  requireRole: () => null, // caller is a workspace ADMIN throughout this fixture
}));
await mock.module('../../../../../../mods/events/index', () => ({
  writeEvent: () => Promise.resolve(),
}));

const { wouldRemoveLastBoardAdmin } = await import('../../lastAdmin');
const { handleUpdateBoardMember } = await import('../../update');
const { handleRemoveBoardMember } = await import('../../remove');

function request(body?: unknown): Request {
  const init: RequestInit =
    body === undefined
      ? { method: 'DELETE' }
      : { method: 'PATCH', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } };
  const req = new Request('https://example.test/api/v1/boards/board-1/members/user-1', init);
  Object.assign(req, {
    board: { id: 'board-1', workspace_id: 'ws-1' },
    currentUser: { id: 'user-1' },
  });
  return req;
}

function reset(members: Row[]): void {
  boardMembers.length = 0;
  users.length = 0;
  deleted.length = 0;
  updated.length = 0;
  countMode = false;
  boardMembers.push(...members);
  users.push({ id: 'user-1', email: 'a@example.com', name: 'A', nickname: null });
}

const soleAdmin = () => [{ board_id: 'board-1', user_id: 'user-1', role: 'ADMIN' }];
const twoAdmins = () => [
  { board_id: 'board-1', user_id: 'user-1', role: 'ADMIN' },
  { board_id: 'board-1', user_id: 'user-2', role: 'ADMIN' },
];

async function run(): Promise<void> {
  // --- the helper itself -------------------------------------------------

  // 1. Demoting or removing the only admin is refused.
  reset(soleAdmin());
  assert.equal(await wouldRemoveLastBoardAdmin('board-1', 'user-1', 'MEMBER'), true);
  reset(soleAdmin());
  assert.equal(await wouldRemoveLastBoardAdmin('board-1', 'user-1', null), true);

  // 2. With a second admin present, both are allowed.
  reset(twoAdmins());
  assert.equal(await wouldRemoveLastBoardAdmin('board-1', 'user-1', 'MEMBER'), false);
  reset(twoAdmins());
  assert.equal(await wouldRemoveLastBoardAdmin('board-1', 'user-1', null), false);

  // 3. Keeping the role, touching a non-admin, or an unknown member: never blocked.
  reset(soleAdmin());
  assert.equal(await wouldRemoveLastBoardAdmin('board-1', 'user-1', 'ADMIN'), false);
  reset([{ board_id: 'board-1', user_id: 'user-1', role: 'MEMBER' }]);
  assert.equal(await wouldRemoveLastBoardAdmin('board-1', 'user-1', 'MEMBER'), false);
  reset([]);
  assert.equal(await wouldRemoveLastBoardAdmin('board-1', 'user-1', null), false);

  // --- the native routes still enforce it through the helper -------------

  // 4. PATCH demoting the last admin.
  reset(soleAdmin());
  let res = await handleUpdateBoardMember(request({ role: 'MEMBER' }), 'board-1', 'user-1');
  assert.equal(res.status, 409);
  assert.equal(((await res.json()) as { name?: string }).name, 'last-board-admin');
  assert.equal(updated.length, 0);

  // 5. DELETE removing the last admin.
  reset(soleAdmin());
  res = await handleRemoveBoardMember(request(), 'board-1', 'user-1');
  assert.equal(res.status, 409);
  assert.equal(((await res.json()) as { name?: string }).name, 'last-board-admin');
  assert.equal(deleted.length, 0);

  // 6. Both succeed when another admin remains.
  reset(twoAdmins());
  res = await handleUpdateBoardMember(request({ role: 'MEMBER' }), 'board-1', 'user-1');
  assert.equal(res.status, 200);
  assert.equal(updated.length, 1);

  reset(twoAdmins());
  res = await handleRemoveBoardMember(request(), 'board-1', 'user-1');
  assert.equal(res.status, 200);
  assert.equal(deleted.length, 1);

  console.info(
    'wouldRemoveLastBoardAdmin helper semantics and native PATCH/DELETE enforcement verified',
  );
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
