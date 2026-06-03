// server/extensions/board/api/__tests__/chatPermissions.test.ts
// Sprint 165 — tests for board chat permission GET/PATCH endpoints.
import { beforeEach, describe, expect, it, mock } from 'bun:test';

type Row = Record<string, unknown>;
type DataStore = {
  boards: Row[];
  memberships: Row[];
  board_chat_permissions: Row[];
};

class QueryBuilder {
  private filters: Array<(row: Row) => boolean> = [];
  private _insert: Row | Row[] | null = null;
  private _update: Row | null = null;
  private _limit: number | null = null;
  private _onConflictIgnore = false;

  constructor(private readonly store: DataStore, private readonly tableName: keyof DataStore) {}

  where(criteria: Row): QueryBuilder {
    this.filters.push((row) =>
      Object.entries(criteria).every(([key, value]) => row[key] === value),
    );
    return this;
  }

  async first(): Promise<Row | undefined> {
    return this.executeSync()[0];
  }

  insert(payload: Row | Row[]): QueryBuilder {
    this._insert = payload;
    return this;
  }

  onConflict(_cols: string | string[]): QueryBuilder {
    return this;
  }

  ignore(): Promise<void> {
    this._onConflictIgnore = true;
    if (this._insert !== null) {
      const rows = Array.isArray(this._insert) ? this._insert : [this._insert];
      for (const row of rows) {
        const table = this.store[this.tableName] as Row[];
        const conflict = this.filters.some((f) => table.some((r) => f(r)));
        if (!conflict) table.push({ ...row });
      }
    }
    return Promise.resolve();
  }

  async update(patch: Row): Promise<number> {
    const rows = this.executeSync(false);
    for (const row of rows) Object.assign(row, patch);
    return rows.length;
  }

  then<TResult1 = Row[], TResult2 = never>(
    onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    // Handle insert with no chained method
    if (this._insert !== null && !this._onConflictIgnore) {
      const rows = Array.isArray(this._insert) ? this._insert : [this._insert];
      for (const row of rows) (this.store[this.tableName] as Row[]).push({ ...row });
      this._insert = null;
    }
    return Promise.resolve(this.executeSync()).then(onfulfilled, onrejected);
  }

  private executeSync(clone = true): Row[] {
    let rows = (this.store[this.tableName] as Row[]).filter((row) =>
      this.filters.every((predicate) => predicate(row)),
    );
    return clone ? rows.map((row) => ({ ...row })) : rows;
  }
}

// ─── Shared mutable state ──────────────────────────────────────────────────
let dataStore: DataStore;
let callerRole: string = 'ADMIN';
let authenticated: boolean = true;

function resetStore(): DataStore {
  return {
    boards: [{ id: 'board-1', workspace_id: 'ws-1', title: 'Test', state: 'ACTIVE', created_at: '2026-01-01' }],
    memberships: [{ user_id: 'user-1', workspace_id: 'ws-1', role: 'ADMIN' }],
    board_chat_permissions: [],
  };
}

// ─── Mocks ─────────────────────────────────────────────────────────────────
mock.module('../../../../common/db', () => ({
  db: ((tableName: keyof DataStore) => new QueryBuilder(dataStore, tableName)) as unknown as typeof import('../../../../common/db').db,
}));

mock.module('../../../auth/middlewares/authentication', () => ({
  authenticate: async (req: Request & { currentUser?: { id: string; email: string } }) => {
    if (!authenticated) {
      return Response.json({ name: 'unauthorized' }, { status: 401 });
    }
    req.currentUser = { id: 'user-1', email: 'user@example.com' };
    return null;
  },
}));

mock.module('../../../board/middlewares/requireBoardAccess', () => ({
  requireBoardAccess: async (req: Request & { board?: Row }, boardId: string) => {
    const board = dataStore.boards.find((b) => b.id === boardId);
    if (!board) {
      return Response.json({ name: 'board-not-found' }, { status: 404 });
    }
    (req as Request & { board?: Row }).board = board;
    return null;
  },
}));

mock.module('../../../../middlewares/permissionManager', () => ({
  requireWorkspaceMembership: async (req: Request & { callerRole?: string; workspaceId?: string }, workspaceId: string) => {
    if (!callerRole) {
      return Response.json({ name: 'insufficient-role' }, { status: 403 });
    }
    req.workspaceId = workspaceId;
    req.callerRole = callerRole;
    return null;
  },
  requireRole: (req: { callerRole?: string }, minRole: string) => {
    const ranks: Record<string, number> = { OWNER: 4, ADMIN: 3, MEMBER: 2, VIEWER: 1, GUEST: 0 };
    const callerRank = ranks[req.callerRole ?? ''] ?? -1;
    const minRank = ranks[minRole] ?? 0;
    if (callerRank < minRank) {
      return Response.json({ name: 'insufficient-role' }, { status: 403 });
    }
    return null;
  },
}));

const { handleGetChatPermissions } = await import('../chatPermissions/get');
const { handlePatchChatPermissions } = await import('../chatPermissions/patch');

// ─── Tests ─────────────────────────────────────────────────────────────────
beforeEach(() => {
  dataStore = resetStore();
  callerRole = 'ADMIN';
  authenticated = true;
});

describe('GET /api/v1/boards/:boardId/chat-permissions', () => {
  it('returns safe defaults when no permission row exists', async () => {
    const res = await handleGetChatPermissions(
      new Request('http://localhost/api/v1/boards/board-1/chat-permissions'),
      'board-1',
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { guest_can_view: boolean; guest_can_use: boolean } };
    expect(body.data.guest_can_view).toBe(false);
    expect(body.data.guest_can_use).toBe(false);
  });

  it('returns persisted permissions when a row exists', async () => {
    dataStore.board_chat_permissions.push({
      id: 'perm-1',
      board_id: 'board-1',
      guest_can_view: true,
      guest_can_use: false,
      updated_at: '2026-06-01T00:00:00.000Z',
    });

    const res = await handleGetChatPermissions(
      new Request('http://localhost/api/v1/boards/board-1/chat-permissions'),
      'board-1',
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { guest_can_view: boolean; guest_can_use: boolean } };
    expect(body.data.guest_can_view).toBe(true);
    expect(body.data.guest_can_use).toBe(false);
  });

  it('returns 404 when board does not exist', async () => {
    const res = await handleGetChatPermissions(
      new Request('http://localhost/api/v1/boards/missing/chat-permissions'),
      'missing',
    );
    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    authenticated = false;
    const res = await handleGetChatPermissions(
      new Request('http://localhost/api/v1/boards/board-1/chat-permissions'),
      'board-1',
    );
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/boards/:boardId/chat-permissions', () => {
  it('ADMIN can enable guest_can_view', async () => {
    callerRole = 'ADMIN';
    const res = await handlePatchChatPermissions(
      new Request('http://localhost/api/v1/boards/board-1/chat-permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_can_view: true }),
      }),
      'board-1',
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { guest_can_view: boolean; guest_can_use: boolean } };
    expect(body.data.guest_can_view).toBe(true);
    expect(body.data.guest_can_use).toBe(false);
  });

  it('OWNER can update permissions', async () => {
    callerRole = 'OWNER';
    const res = await handlePatchChatPermissions(
      new Request('http://localhost/api/v1/boards/board-1/chat-permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_can_view: true, guest_can_use: true }),
      }),
      'board-1',
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { guest_can_view: boolean; guest_can_use: boolean } };
    expect(body.data.guest_can_view).toBe(true);
    expect(body.data.guest_can_use).toBe(true);
  });

  it('returns 403 when caller is MEMBER', async () => {
    callerRole = 'MEMBER';
    const res = await handlePatchChatPermissions(
      new Request('http://localhost/api/v1/boards/board-1/chat-permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_can_view: true }),
      }),
      'board-1',
    );
    expect(res.status).toBe(403);
  });

  it('returns 403 when caller is GUEST', async () => {
    callerRole = 'GUEST';
    const res = await handlePatchChatPermissions(
      new Request('http://localhost/api/v1/boards/board-1/chat-permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_can_view: true }),
      }),
      'board-1',
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 for non-boolean field values', async () => {
    callerRole = 'ADMIN';
    const res = await handlePatchChatPermissions(
      new Request('http://localhost/api/v1/boards/board-1/chat-permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_can_view: 'yes' }),
      }),
      'board-1',
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    callerRole = 'ADMIN';
    const res = await handlePatchChatPermissions(
      new Request('http://localhost/api/v1/boards/board-1/chat-permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
      'board-1',
    );
    expect(res.status).toBe(400);
  });

  it('normalizes: enabling guest_can_use auto-enables guest_can_view', async () => {
    callerRole = 'ADMIN';
    const res = await handlePatchChatPermissions(
      new Request('http://localhost/api/v1/boards/board-1/chat-permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_can_use: true }),
      }),
      'board-1',
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { guest_can_view: boolean; guest_can_use: boolean } };
    expect(body.data.guest_can_view).toBe(true);
    expect(body.data.guest_can_use).toBe(true);
  });

  it('normalizes: disabling guest_can_view also disables guest_can_use', async () => {
    callerRole = 'ADMIN';
    // Seed a row with both enabled
    dataStore.board_chat_permissions.push({
      id: 'perm-1',
      board_id: 'board-1',
      guest_can_view: true,
      guest_can_use: true,
      updated_at: '2026-06-01T00:00:00.000Z',
    });

    const res = await handlePatchChatPermissions(
      new Request('http://localhost/api/v1/boards/board-1/chat-permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_can_view: false }),
      }),
      'board-1',
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { guest_can_view: boolean; guest_can_use: boolean } };
    expect(body.data.guest_can_view).toBe(false);
    expect(body.data.guest_can_use).toBe(false);
  });

  it('persists updated values in DB on second call', async () => {
    callerRole = 'ADMIN';
    await handlePatchChatPermissions(
      new Request('http://localhost/api/v1/boards/board-1/chat-permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_can_view: true }),
      }),
      'board-1',
    );

    const row = dataStore.board_chat_permissions.find((r) => r.board_id === 'board-1');
    expect(row?.guest_can_view).toBe(true);
    expect(row?.guest_can_use).toBe(false);
  });
});
