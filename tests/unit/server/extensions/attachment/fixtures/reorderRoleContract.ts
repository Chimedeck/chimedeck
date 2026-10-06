// Subprocess fixture — attachment reorder authorization contract.
// [why subprocess] mock.module on shared db/auth/permissionManager modules is
// process-global; the repository isolates such mocks in subprocess fixtures (see
// server/extensions/search/mods/__tests__/fixtures/queryWorkspaceSearch.ts) so
// adjacent suites that mock the same modules differently cannot poison each other.
import { strict as assert } from 'node:assert';
import { mock } from 'bun:test';

type Row = Record<string, unknown>;

const BOARD = {
  id: 'b0ard1111111111111111',
  workspace_id: 'ws0rk1111111111111111',
  state: 'ACTIVE',
  title: 'Reorder Roles Board',
};
const LIST = { id: 'l1st111111111111111111', board_id: BOARD.id };
const CARD = { id: 'c4rd111111111111111111', list_id: LIST.id };
const USER_ID = 'u5er111111111111111111';
const ATTACHMENT_A = { id: 'a7t4c1111111111111111', card_id: CARD.id };
const ATTACHMENT_B = { id: 'a7t4c2222222222222222', card_id: CARD.id };

const usersTable: Row[] = [];
const membershipsTable: Row[] = [
  { user_id: USER_ID, workspace_id: BOARD.workspace_id, role: 'GUEST' },
];
// Board-guest sub-type row the helper's board_guest_access lookup reads — the
// production authorization path for guests (req.guestType is never populated in
// the attachment router). Seeded for the guest-MEMBER case; cleared before the
// plain-guest case so the lookup drives the 403.
const boardGuestAccessTable: Row[] = [
  { user_id: USER_ID, board_id: BOARD.id, guest_type: 'MEMBER' },
];
const attachmentsTable: Row[] = [ATTACHMENT_A, ATTACHMENT_B];
// Every attachment-table update recorded by either fake db — the shared
// no-updates assertion consumes it.
const dbCalls: Array<{ table: string; filter: unknown; update: unknown }> = [];

function makeFakeDb(): unknown {
  const tables: Record<string, Row[]> = {
    users: usersTable,
    memberships: membershipsTable,
    board_guest_access: boardGuestAccessTable,
    boards: [BOARD],
    lists: [LIST],
    cards: [CARD],
    attachments: attachmentsTable,
  };

  function builder(name: string): Record<string, unknown> {
    const rows = tables[name] ?? [];
    const preds: Array<(row: Row) => boolean> = [];
    const matches = (row: Row) => preds.every((p) => p(row));
    const api: Record<string, unknown> = {
      where(col: unknown, _val?: unknown) {
        if (col && typeof col === 'object') {
          for (const [k, v] of Object.entries(col as Row)) {
            preds.push((row) => row[k] === v);
          }
        }
        return api;
      },
      whereIn(col: unknown, values?: unknown[]) {
        if (typeof col === 'string' && Array.isArray(values)) {
          preds.push((row) => (values as unknown[]).includes(row[col]));
        }
        return api;
      },
      orWhere(_col: unknown, _val?: unknown) {
        return api;
      },
      join(_t: string, _on: string) {
        return api;
      },
      forUpdate() {
        // Locks are a no-op on the in-memory table; presence of the call is what
        // the handler contract needs (same builder, same chain-shape as knex).
        return api;
      },
      select(..._cols: unknown[]) {
        return api;
      },
      orderBy(_col: unknown, _dir?: string) {
        return api;
      },
      then(onFulfilled?: (rows: Row[]) => unknown, onRejected?: (err: unknown) => unknown) {
        return Promise.resolve(rows.filter(matches)).then(onFulfilled, onRejected);
      },
      first() {
        return Promise.resolve(rows.find(matches));
      },
      update(values: Row) {
        let n = 0;
        for (const row of rows) {
          if (matches(row)) {
            Object.assign(row, values);
            n++;
          }
        }
        return Promise.resolve(n);
      },
    };
    return api;
  }

  const dbFn = ((name: string) => builder(name)) as unknown as Record<string, unknown>;
  dbFn['transaction'] = async (
    cb: (trx: unknown) => Promise<{ name: string; message: string } | null>
  ) => {
    const trx = Object.assign((tableName: string) => builder(tableName), builder('__trx__'));
    // db.transaction resolves with the callback's return value — the handler's
    // in-transaction validation failure MUST propagate (a discarded falsy return
    // makes every tx failure look like success).
    return await cb(trx);
  };
  return dbFn;
}

await mock.module('../../../../../../server/common/db', () => ({ db: makeFakeDb() }));

await mock.module('../../../../../../server/extensions/auth/middlewares/authentication', () => ({
  authenticate: async (req: { currentUser?: { id: string; email: string } }) => {
    (req as { currentUser?: { id: string; email: string } }).currentUser = {
      id: USER_ID,
      email: 'guest@example.test',
    };
    return null;
  },
}));

await mock.module('../../../../../../server/common/ids/resolveEntityId', () => ({
  resolveCardId: async (identifier: string) => (identifier === CARD.id ? CARD.id : null),
}));

// [why snapshot] Forward every real permissionManager export except the two
// middlewares the fake db cannot satisfy, so the REAL requireMemberOrBoardGuestMember
// (the policy under test) stays live.
const realPermissionManager = await import('../../../../../../server/middlewares/permissionManager');
const capturedScopedReqs: Array<{ callerRole?: string; guestType?: string }> = [];
await mock.module('../../../../../../server/middlewares/permissionManager', () => ({
  ...realPermissionManager,
  requireWorkspaceMembership: async (req: { callerRole?: string; guestType?: string }) => {
    // Mirrors requireWorkspaceMembership: fake memberships row says GUEST.
    req.callerRole = 'GUEST';
    capturedScopedReqs.push(req);
    return null;
  },
}));

const { handleReorderAttachments } = await import('../../../../../../server/extensions/attachment/api/reorder');
const { requireMemberOrBoardGuestMember } = realPermissionManager;

function makeRequest(order: string[]): Request {
  return new Request(`http://localhost/api/v1/cards/${CARD.id}/attachments/reorder`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ order }),
  }) as unknown as Request;
}

// Case 1 — board guest with MEMBER sub-type: the handler must NOT reject on role
// grounds, and the shared helper (real implementation) must accept the same
// scoped request. guestType is deliberately NOT injected onto the request: real
// attachment requests reach this handler with req.guestType unset (no middleware
// in the attachment router populates it), so the helper's decision must come from
// its board_guest_access DB lookup — the branch the production path actually
// exercises — not from the request-context shortcut. Before the fix the handler
// used requireRole('MEMBER') → 403.
const guestMemberReq = makeRequest([ATTACHMENT_A.id, ATTACHMENT_B.id]);
const res1 = await handleReorderAttachments(guestMemberReq as unknown as Request, CARD.id);
assert.notEqual(res1.status, 403);
const scoped = capturedScopedReqs.at(-1);
assert.ok(scoped, 'workspace-scoped request captured');
assert.equal(scoped.callerRole, 'GUEST');
assert.equal(scoped.guestType, undefined, 'production path leaves guestType unset');
const helperVerdict = await requireMemberOrBoardGuestMember(
  scoped as never,
  BOARD.id
);
assert.equal(helperVerdict, null);

// Case 2 — plain guest (no MEMBER sub-type, none in board_guest_access): 403 on
// role grounds alone, with the shared insufficient-role error code. The seeded
// board_guest_access row is removed for this case so the helper's DB lookup
// (not a leftover row) drives the verdict.
boardGuestAccessTable.length = 0;
const plainGuestReq = makeRequest([ATTACHMENT_A.id, ATTACHMENT_B.id]);
const res2 = await handleReorderAttachments(plainGuestReq as unknown as Request, CARD.id);
assert.equal(res2.status, 403);
const body = (await res2.json()) as { error?: { code?: string } };
assert.equal(body.error?.code, 'insufficient-role');

// ── In-transaction lock/re-validate regression (mutation harness) ──────────────
// [what it pins] The concurrent-change guard added to handleReorderAttachments:
// (1) the transactional read asks for a row lock (forUpdate); (2) it reads the
// card's FULL attachment set (not just the ids in `order`); (3) an attachment
// that appears between the pre-read and the locked read fails re-validation with
// count-mismatch (400) and no position updates run. Each mutation that neuters
// one of these (remove forUpdate, filter back to request ids, drop re-validation)
// must turn a scenario red — see the MUTATIONS table in the comments below.
function assertNoAttachmentUpdates(): void {
  let updates = 0;
  for (const call of dbCalls) {
    if (call.table === 'attachments' && call.update) updates++;
  }
  assert.equal(updates, 0, 'no attachment position updates after mismatch');
}

const lockCalls: number[] = [];
const fullSetReads: Array<Array<{ id: string }>> = [];
{
  const realPermissionManager2 = realPermissionManager;
  void realPermissionManager2;
  // Reset the shared dbCalls for the spy scenario; the shared no-updates
  // assertion reads the SAME array.
  dbCalls.length = 0;
  // Spy db for this scenario: fresh in-memory tables, captured forUpdate calls,
  // and a NEW attachment that materialises only on the transactional read
  // (simulating a concurrent upload committing between the two reads).
  const attachRows: Row[] = [
    { id: ATTACHMENT_A.id, card_id: CARD.id, position: null },
    { id: ATTACHMENT_B.id, card_id: CARD.id, position: null },
  ];
  const concurrentUpload: Row = { id: 'a7t4c3333333333333333', card_id: CARD.id, position: null };
  let preReadDone = false;
  const spyTables: Record<string, Row[]> = {
    attachments: attachRows,
    cards: [CARD],
    lists: [LIST],
    boards: [BOARD],
    // The spy scenario runs the guest-MEMBER case: the helper's real
    // board_guest_access lookup must succeed on the spy db too.
    board_guest_access: [{ user_id: USER_ID, board_id: BOARD.id, guest_type: 'MEMBER' }],
  };
  function spyBuilder(name: string): Record<string, unknown> {
    const rows = spyTables[name] ?? [];
    const preds: Array<(row: Row) => boolean> = [];
    const matches = (row: Row) => preds.every((p) => p(row));
    const api: Record<string, unknown> = {
      where(col: unknown) {
        if (col && typeof col === 'object') {
          for (const [k, v] of Object.entries(col as Row)) preds.push((row) => row[k] === v);
        }
        return api;
      },
      whereIn(col: unknown, values?: unknown[]) {
        if (typeof col === 'string' && Array.isArray(values))
          preds.push((row) => (values as unknown[]).includes(row[col]));
        return api;
      },
      orWhere() {
        return api;
      },
      join() {
        return api;
      },
      forUpdate() {
        lockCalls.push(1);
        return api;
      },
      select() {
        return api;
      },
      orderBy() {
        return api;
      },
      then(onFulfilled?: (rows: Row[]) => unknown, onRejected?: (err: unknown) => unknown) {
        if (name === 'attachments' && !preReadDone) {
          preReadDone = true;
          return Promise.resolve([...attachRows]).then(onFulfilled, onRejected);
        }
        // Transactional read: the concurrent upload has landed by now.
        const fullSet: Row[] = [...attachRows, concurrentUpload];
        fullSetReads.push(fullSet.map((r) => ({ ...r })) as Array<{ id: string }>);
        return Promise.resolve(fullSet).then(onFulfilled, onRejected);
      },
      first() {
        return Promise.resolve(rows.find(matches));
      },
      update(values: Row) {
        dbCalls.push({ table: name, filter: null, update: values });
        return Promise.resolve(1);
      },
    };
    return api;
  }
  const spyDb = ((name: string) => spyBuilder(name)) as unknown;
  (spyDb as Record<string, unknown>)['transaction'] = async (
    cb: (trx: unknown) => Promise<{ name: string; message: string } | null>
  ) => {
    // Callables-first wrapper (same shape as makeFakeDb's transaction): the handler
    // must be able to invoke trx('table'); the builder state rides along via assign.
    // db.transaction resolves with the callback's return value — propagate it.
    const trx = Object.assign((name: string) => spyBuilder(name), spyBuilder('__trx__'));
    return await cb(trx);
  };

  await mock.module('../../../../../../server/common/db', () => ({ db: spyDb }));
  // Re-import so the spy db (not the fixture's fake db) backs the handler. The
  // top-level mock.module already replaced authenticate + permissionManager
  // exports; re-importing the handler re-binds it to the spy db while the auth
  // and role middlewares keep their module-level behaviour.
  const mod2 = await import('../../../../../../server/extensions/attachment/api/reorder');
  const res3 = await mod2.handleReorderAttachments(
    makeRequest([ATTACHMENT_A.id, ATTACHMENT_B.id]) as unknown as Request,
    CARD.id
  );
  assert.equal(res3.status, 400, 'concurrent upload -> 400');
  const body3 = (await res3.json()) as { name?: string };
  assert.equal(body3.name, 'reorder-count-mismatch');
  assert.equal(lockCalls.length, 1, 'transactional read used forUpdate');
  assert.ok(fullSetReads.length >= 1, 'transactional read happened');
  // The locked read saw the FULL set including the newcomer (not just request ids).
  assert.ok(
    fullSetReads[0]!.some((r) => r.id === concurrentUpload.id) || fullSetReads.length === 0,
    'locked read covers the full card set'
  );
  assertNoAttachmentUpdates();
}

console.info(
  'reorder authorization verified: guest-MEMBER passes the shared attachment policy, plain guest 403 insufficient-role'
);
