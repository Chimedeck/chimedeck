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
const boardGuestAccessTable: Row[] = [];
const attachmentsTable: Row[] = [ATTACHMENT_A, ATTACHMENT_B];

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
    const api: Record<string, unknown> = {
      where(_col: unknown, _val?: unknown) {
        return api;
      },
      whereIn(_col: unknown, _values?: unknown[]) {
        return api;
      },
      orWhere(_col: unknown, _val?: unknown) {
        return api;
      },
      join(_t: string, _on: string) {
        return api;
      },
      select(..._cols: unknown[]) {
        return api;
      },
      orderBy(_col: unknown, _dir?: string) {
        return api;
      },
      then(onFulfilled?: (rows: Row[]) => unknown, onRejected?: (err: unknown) => unknown) {
        return Promise.resolve([...rows]).then(onFulfilled, onRejected);
      },
      first() {
        return Promise.resolve(rows[0]);
      },
      update(_values: Row) {
        return Promise.resolve(1);
      },
    };
    return api;
  }

  const dbFn = ((name: string) => builder(name)) as unknown as Record<string, unknown>;
  dbFn['transaction'] = async (cb: (trx: unknown) => Promise<void>) => {
    const trx = Object.assign((tableName: string) => builder(tableName), builder('__trx__'));
    await cb(trx);
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
// scoped request. Before the fix the handler used requireRole('MEMBER') → 403.
const guestMemberReq = Object.assign(makeRequest([ATTACHMENT_A.id, ATTACHMENT_B.id]), {
  guestType: 'MEMBER',
});
const res1 = await handleReorderAttachments(guestMemberReq as unknown as Request, CARD.id);
assert.notEqual(res1.status, 403);
const scoped = capturedScopedReqs.at(-1);
assert.ok(scoped, 'workspace-scoped request captured');
assert.equal(scoped.callerRole, 'GUEST');
const helperVerdict = await requireMemberOrBoardGuestMember(
  scoped as never,
  BOARD.id
);
assert.equal(helperVerdict, null);

// Case 2 — plain guest (no MEMBER sub-type, none in board_guest_access): 403 on
// role grounds alone, with the shared insufficient-role error code.
const plainGuestReq = Object.assign(makeRequest([ATTACHMENT_A.id, ATTACHMENT_B.id]), {
  guestType: 'VIEWER',
});
const res2 = await handleReorderAttachments(plainGuestReq as unknown as Request, CARD.id);
assert.equal(res2.status, 403);
const body = (await res2.json()) as { error?: { code?: string } };
assert.equal(body.error?.code, 'insufficient-role');

console.info(
  'reorder authorization verified: guest-MEMBER passes the shared attachment policy, plain guest 403 insufficient-role'
);
