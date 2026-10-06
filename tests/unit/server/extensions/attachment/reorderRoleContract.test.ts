// Endpoint contract test — attachment reorder authorization parity.
// [why] The reorder handler shipped with requireRole(req,'MEMBER') while every
// sibling attachment mutation (requestUploadUrl/confirmUpload/addUrl) uses the
// shared requireMemberOrBoardGuestMember helper. A board guest invited with the
// MEMBER sub-type could upload/add attachments but got 403 reordering them.
// This test pins the handler to the shared policy at the request level (guest
// MEMBER sub-type → not 403 on role grounds) and the workspace GUEST → 403 case.
// Runs fully offline: db and auth are replaced with in-memory fakes.
import { describe, expect, it, mock, beforeEach } from 'bun:test';
import type { Knex } from 'knex';

// ── Module mocks (must be registered before importing the module under test) ──

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
const ATTACHMENT_A = { id: 'a7t4c1111111111111111', card_id: 'c4rd111111111111111111' };
const ATTACHMENT_B = { id: 'a7t4c2222222222222222', card_id: 'c4rd111111111111111111' };

const usersTable: Row[] = [];
const membershipsTable: Row[] = [{ user_id: USER_ID, workspace_id: BOARD.workspace_id, role: 'GUEST' }];
const boardGuestAccessTable: Row[] = [];
const attachmentsTable: Row[] = [];

function makeFakeDb(): Knex {
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

  const dbFn = ((name: string) => builder(name)) as unknown as Knex;
  const dbAny = dbFn as unknown as Record<string, unknown>;
  dbAny['transaction'] = async (cb: (trx: unknown) => Promise<void>) => {
    const trx = Object.assign((tableName: string) => builder(tableName), builder('__trx__'));
    await cb(trx);
  };
  return dbFn;
}

mock.module('../../../../../server/common/db', () => ({ db: makeFakeDb() }));

mock.module('../../../../../server/extensions/auth/middlewares/authentication', () => ({
  authenticate: async (req: { currentUser?: { id: string; email: string } }) => {
    (req as { currentUser?: { id: string; email: string } }).currentUser = {
      id: USER_ID,
      email: 'guest@example.test',
    };
    return null;
  },
}));

mock.module('../../../../../server/common/ids/resolveEntityId', () => ({
  resolveCardId: async (identifier: string) => (identifier === CARD.id ? CARD.id : null),
}));

// [why snapshot] bun's mock.module is process-global — snapshot the REAL
// permissionManager and forward every other export untouched so other suites
// running in the same process keep their exports (cross-file mock bleed).
const realPermissionManager = await import('../../../../../server/middlewares/permissionManager');
const capturedScopedReqs: Array<{ callerRole?: string; guestType?: string }> = [];
mock.module('../../../../../server/middlewares/permissionManager', () => ({
  ...realPermissionManager,
  requireWorkspaceMembership: async (req: { callerRole?: string; guestType?: string }) => {
    // Workspace membership resolves callerRole the real one does; the fake
    // membership row above says GUEST for this user.
    req.callerRole = 'GUEST';
    capturedScopedReqs.push(req);
    return null;
  },
}));

const { handleReorderAttachments } = await import('../../../../../server/extensions/attachment/api/reorder');
const { requireMemberOrBoardGuestMember } = realPermissionManager;

function makeRequest(order: string[]): Request {
  return new Request(`http://localhost/api/v1/cards/${CARD.id}/attachments/reorder`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ order }),
  }) as unknown as Request;
}

beforeEach(() => {
  capturedScopedReqs.length = 0;
});

describe('attachment reorder — shared attachment authorization contract', () => {
  it('uses requireMemberOrBoardGuestMember semantics: a board guest with MEMBER sub-type is not rejected on role grounds', async () => {
    // Simulate exactly what the real helper accepts for a guest-MEMBER: run the
    // real helper against the captured scoped request (guestType=MEMBER) and the
    // handler's board — it must return null (pass).
    const res = await handleReorderAttachments(
      Object.assign(makeRequest([ATTACHMENT_A.id, ATTACHMENT_B.id]) as Request, { guestType: 'MEMBER' }),
      CARD.id
    );
    expect(res.status).not.toBe(403);
    const scoped = capturedScopedReqs.at(-1);
    expect(scoped?.callerRole).toBe('GUEST');
    const helperVerdict = await requireMemberOrBoardGuestMember(
      scoped as unknown as Parameters<typeof requireMemberOrBoardGuestMember>[0],
      BOARD.id
    );
    expect(helperVerdict).toBeNull();
  });

  it('rejects a plain guest (no MEMBER sub-type) with 403 — role grounds only', async () => {
    const res = await handleReorderAttachments(
      Object.assign(makeRequest([ATTACHMENT_A.id, ATTACHMENT_B.id]) as Request, { guestType: 'VIEWER' }),
      CARD.id
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('insufficient-role');
  });
});
;
