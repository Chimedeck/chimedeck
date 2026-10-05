import { strict as assert } from 'node:assert';
import { mock } from 'bun:test';

// Real handleGetArchivedLists under test. The shared db module is mocked here in
// a subprocess so this fixture cannot leak a fake Knex chain into (or be
// replaced by) adjacent test files that mock the shared db module differently.
// Fake DB rows only — no live PostgreSQL.

type Row = Record<string, unknown>;

const lists: Row[] = [];
const calls: string[] = [];

// Minimal Knex-style chain covering only the calls this handler makes.
function dbStub(table: string) {
  const state: { where: Row } = { where: {} };
  const builder: Record<string, unknown> = {
    where(column: string | Row, value?: unknown) {
      if (typeof column === 'string') {
        calls.push(`${table}.where(${column},${JSON.stringify(value)})`);
        state.where[column.replace(/^lists\./, '')] = value;
      } else {
        calls.push(`${table}.where(obj)`);
        Object.assign(state.where, column);
      }
      return builder;
    },
    orderBy(column: string, dir: string) {
      calls.push(`${table}.orderBy(${column},${dir})`);
      return builder;
    },
    select(...cols: string[]) {
      calls.push(`${table}.select(${cols.length.toString()})`);
      return Promise.resolve(
        lists.filter((row) =>
          Object.entries(state.where).every(([key, value]) => row[key] === value),
        ),
      );
    },
  };
  return builder;
}

const db = Object.assign(dbStub, { raw: (sql: string) => sql });

let visibilityError: Response | null = null;
let membershipError: Response | null = null;

await mock.module('../../../../../common/db', () => ({ db }));
await mock.module('../../../../../middlewares/boardVisibility', () => ({
  applyBoardVisibility: (req: Request) => {
    Object.assign(req, {
      board: { id: 'board-1', workspace_id: 'ws-1', visibility: boardVisibility },
    });
    return Promise.resolve(visibilityError);
  },
}));
await mock.module('../../../../../middlewares/permissionManager', () => ({
  requireWorkspaceMembership: () => Promise.resolve(membershipError),
}));

let boardVisibility = 'PRIVATE';

const { handleGetArchivedLists } = await import('../../archived-lists');

function request(): Request {
  return new Request('https://example.test/api/v1/boards/board-1/archived-lists');
}

function reset(): void {
  lists.length = 0;
  calls.length = 0;
  visibilityError = null;
  membershipError = null;
  boardVisibility = 'PRIVATE';
  lists.push(
    { id: 'list-1', board_id: 'board-1', title: 'Archived A', archived: true, position: 'a' },
    { id: 'list-2', board_id: 'board-1', title: 'Open', archived: false, position: 'b' },
    { id: 'list-3', board_id: 'board-2', title: 'Other board', archived: true, position: 'c' },
  );
}

async function run(): Promise<void> {
  // 1. Only archived lists, only from this board.
  reset();
  let res = await handleGetArchivedLists(request(), 'board-1');
  assert.equal(res.status, 200);
  let body = (await res.json()) as { data: Array<{ id: string }> };
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0]?.id, 'list-1');
  assert.ok(calls.some((c) => c === 'lists.where(lists.archived,true)'));

  // 2. An empty result is an empty array, not an error.
  reset();
  lists.length = 0;
  res = await handleGetArchivedLists(request(), 'board-1');
  assert.equal(res.status, 200);
  body = (await res.json()) as { data: Array<{ id: string }> };
  assert.equal(body.data.length, 0);

  // 3. A visibility failure short-circuits before any query runs.
  reset();
  visibilityError = Response.json({ name: 'board-not-found' }, { status: 404 });
  res = await handleGetArchivedLists(request(), 'board-1');
  assert.equal(res.status, 404);
  assert.equal(calls.length, 0);

  // 4. A non-PUBLIC board requires workspace membership.
  reset();
  membershipError = Response.json({ name: 'forbidden' }, { status: 403 });
  res = await handleGetArchivedLists(request(), 'board-1');
  assert.equal(res.status, 403);
  assert.equal(calls.length, 0);

  // 5. A PUBLIC board skips the membership check, like archived-cards.
  reset();
  boardVisibility = 'PUBLIC';
  membershipError = Response.json({ name: 'forbidden' }, { status: 403 });
  res = await handleGetArchivedLists(request(), 'board-1');
  assert.equal(res.status, 200);

  console.info(
    'handleGetArchivedLists board scoping, archived filter, empty result, visibility and membership gates verified',
  );
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
