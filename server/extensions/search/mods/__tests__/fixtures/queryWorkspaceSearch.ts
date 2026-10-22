import { strict as assert } from 'node:assert';
import { mock } from 'bun:test';

// Real queryWorkspaceSearch under test. The shared db module is mocked here in a
// subprocess so this fixture cannot leak fake Knex chains into (or be replaced by)
// adjacent test files that mock '../../../common/db' differently.
const calls: string[] = [];

interface FakeRow {
  [key: string]: unknown;
}

// Minimal permissive chain recorder: every method returns `this` (or a nested fake
// for callback-based .where(fn)) so the real applyBoardAccessFilter/queryWorkspaceSearch
// control flow executes unmodified, while every clause actually applied is logged.
class FakeQueryBuilder {
  constructor(
    private readonly table: string,
    private readonly rows: FakeRow[],
  ) {}

  select(..._args: unknown[]): this {
    calls.push(`${this.table}.select`);
    return this;
  }

  join(..._args: unknown[]): this {
    calls.push(`${this.table}.join`);
    return this;
  }

  where(colOrFn: unknown, op?: unknown, val?: unknown): this {
    if (typeof colOrFn === 'function') {
      calls.push(`${this.table}.where(fn)`);
      const inner = new FakeCondition(this.table, 'inner');
      (colOrFn as (i: FakeCondition) => void)(inner);
    } else if (val !== undefined) {
      calls.push(`${this.table}.where(${String(colOrFn)},${String(op)},${JSON.stringify(val)})`);
    } else {
      calls.push(`${this.table}.where(${String(colOrFn)},${String(op)})`);
    }
    return this;
  }

  whereRaw(..._args: unknown[]): this {
    calls.push(`${this.table}.whereRaw`);
    return this;
  }

  orderBy(col: string, dir: string): this {
    calls.push(`${this.table}.orderBy(${col},${dir})`);
    return this;
  }

  limit(n: number): Promise<FakeRow[]> {
    calls.push(`${this.table}.limit(${String(n)})`);
    return Promise.resolve(this.rows);
  }
}

// Fake for the inner/priv/sub condition objects passed to .where(fn) callbacks —
// records which access-control branch actually ran without needing a real SQL engine.
class FakeCondition {
  constructor(
    private readonly table: string,
    private readonly label: string,
  ) {}

  where(...args: unknown[]): this {
    calls.push(`${this.table}.${this.label}.where(${args.map(String).join(',')})`);
    return this;
  }

  whereIn(col: string, vals: unknown[]): this {
    calls.push(`${this.table}.${this.label}.whereIn(${col},${vals.join('|')})`);
    return this;
  }

  orWhere(fn: (c: FakeCondition) => void): this {
    calls.push(`${this.table}.${this.label}.orWhere`);
    fn(new FakeCondition(this.table, `${this.label}.priv`));
    return this;
  }

  whereExists(fn: (sub: FakeSub) => void): this {
    calls.push(`${this.table}.${this.label}.whereExists`);
    fn(new FakeSub(this.table));
    return this;
  }
}

class FakeSub {
  constructor(private readonly table: string) {}
  select(..._args: unknown[]): this {
    calls.push(`${this.table}.sub.select`);
    return this;
  }
  from(name: string): this {
    calls.push(`${this.table}.sub.from(${name})`);
    return this;
  }
  whereRaw(..._args: unknown[]): this {
    calls.push(`${this.table}.sub.whereRaw`);
    return this;
  }
  where(...args: unknown[]): this {
    calls.push(`${this.table}.sub.where(${args.map(String).join(',')})`);
    return this;
  }
}

const state: {
  boardRows: FakeRow[];
  cardRows: FakeRow[];
} = {
  boardRows: [
    {
      id: 'board-1',
      short_id: 'bshort1',
      title: 'Roadmap',
      workspace_id: 'ws-1',
      state: 'ACTIVE',
      background: 'https://cdn.example.com/bucket-name/backgrounds/board-1.png',
      type: 'board',
      rank: 0.5,
    },
  ],
  cardRows: [
    {
      id: 'card-1',
      short_id: 'cshort1',
      title: 'Fix login bug',
      list_id: 'list-1',
      board_id: 'board-1',
      board_short_id: 'bshort1',
      workspace_id: 'ws-1',
      archived: false,
      type: 'card',
      rank: 0.9,
    },
  ],
};

await mock.module('../../../../../common/db', () => {
  const dbFn = (table: string) => {
    calls.push(`db(${table})`);
    if (table === 'boards') return new FakeQueryBuilder('boards', state.boardRows);
    if (table === 'cards') return new FakeQueryBuilder('cards', state.cardRows);
    throw new Error(`unexpected table: ${table}`);
  };
  dbFn.raw = (sql: string, params?: unknown[]) => {
    calls.push(`db.raw(${sql.slice(0, 20)}...)`);
    return { __raw: sql, params };
  };
  return { db: dbFn };
});

await mock.module('../../../../board/common/resolveBackgroundUrl', () => ({
  // Real module proxies S3-backed backgrounds; stubbed here since S3 config/env is
  // out of scope for this query-boundary test — covered separately in its own suite.
  resolveBackgroundUrl: ({ boardId }: { boardId: string; backgroundUrl: string | null }) =>
    `/api/v1/boards/${boardId}/background`,
}));

async function run(): Promise<void> {
  const { queryWorkspaceSearch } = await import('../../queryWorkspaceSearch');

  // 1. Query too short is rejected before touching the database at all.
  calls.length = 0;
  const tooShort = await queryWorkspaceSearch({
    workspaceId: 'ws-1',
    userId: 'user-1',
    callerRole: 'MEMBER',
    q: 'a',
  });
  assert.equal(tooShort.status, 400);
  assert.equal(tooShort.name, 'search-query-too-short');
  assert.ok(!calls.some((c) => c.startsWith('db(')));

  // 2. OWNER role: no extra board-access where(fn) clause is applied (sees everything).
  calls.length = 0;
  const ownerResult = await queryWorkspaceSearch({
    workspaceId: 'ws-1',
    userId: 'owner-1',
    callerRole: 'OWNER',
    q: 'login',
  });
  assert.equal(ownerResult.status, 200);
  assert.ok(!calls.some((c) => c.includes('where(fn)')));

  // 3. GUEST role: the guest-specific PUBLIC/PRIVATE+guest-access branch runs for
  // both the board query and the card query (joined to boards).
  calls.length = 0;
  const guestResult = await queryWorkspaceSearch({
    workspaceId: 'ws-1',
    userId: 'guest-1',
    callerRole: 'GUEST',
    q: 'login',
  });
  assert.equal(guestResult.status, 200);
  const boardWhereFn = calls.filter((c) => c === 'boards.where(fn)');
  const cardWhereFn = calls.filter((c) => c === 'cards.where(fn)');
  assert.equal(boardWhereFn.length, 1);
  assert.equal(cardWhereFn.length, 1);
  assert.ok(calls.includes('boards.inner.where(boards.visibility,PUBLIC)'));
  assert.ok(!calls.includes('boards.inner.whereExists'));
  assert.ok(calls.includes('boards.inner.orWhere'));
  assert.ok(calls.includes('boards.sub.from(board_guest_access)'));
  // GUEST must never reach the MEMBER/VIEWER whereIn(['PUBLIC','WORKSPACE']) branch.
  assert.ok(!calls.some((c) => c.includes('whereIn')));

  // 4. Combined board+card results are merged, sorted by rank desc, and each result
  // preserves its original numeric rank type without coercion loss (0.9 before 0.5).
  assert.ok(guestResult.data);
  const guestData = guestResult.data;
  const titles = guestData.map((r: { title: string }) => r.title);
  assert.deepEqual(titles, ['Fix login bug', 'Roadmap']);

  // 5. Board background is proxied, never the raw S3 URL, for every returned board row.
  const boardRow = guestData.find((r: { type: string }) => r.type === 'board');
  assert.ok(boardRow);
  assert.equal(boardRow.background, '/api/v1/boards/board-1/background');

  // 6. `rank` is excluded from the public response shape (Omit<..., 'rank'>).
  for (const row of guestData) {
    assert.equal(Object.prototype.hasOwnProperty.call(row, 'rank'), false);
  }

  // 7. type=card scopes the query to cards only — no boards() call at all.
  calls.length = 0;
  const cardOnly = await queryWorkspaceSearch({
    workspaceId: 'ws-1',
    userId: 'member-1',
    callerRole: 'MEMBER',
    q: 'login',
    type: 'card',
  });
  assert.equal(cardOnly.status, 200);
  assert.ok(!calls.some((c) => c === 'db(boards)'));
  assert.ok(calls.some((c) => c === 'db(cards)'));
  assert.ok(cardOnly.data);
  assert.equal(cardOnly.data.length, 1);

  console.info(
    'queryWorkspaceSearch real board/card access-filter branching, rank-sort merge, and background/rank projection verified',
  );
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
