import { beforeEach, describe, expect, it, mock } from 'bun:test';

type Row = Record<string, unknown>;
type DataStore = {
  boards: Row[];
  lists: Row[];
  board_members: Row[];
  board_state_transitions: Row[];
};

class QueryBuilder {
  private filters: Array<(row: Row) => boolean> = [];
  private selectedColumns: string[] | null = null;
  private orderedBy: string | null = null;
  private orderDirection: 'asc' | 'desc' = 'asc';

  constructor(private readonly store: DataStore, private readonly tableName: keyof DataStore) {}

  where(criteria: Row): QueryBuilder {
    this.filters.push((row) => Object.entries(criteria).every(([key, value]) => row[key] === value));
    return this;
  }

  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): QueryBuilder {
    this.orderedBy = column;
    this.orderDirection = direction;
    return this;
  }

  select(...columns: string[]): QueryBuilder {
    this.selectedColumns = columns.length > 0 ? columns : null;
    return this;
  }

  async first(): Promise<Row | undefined> {
    const rows = await this.execute();
    return rows[0];
  }

  insert(payload: Row | Row[]): { returning: (_columns?: string[] | string) => Promise<Row[]> } {
    const rows = Array.isArray(payload) ? payload : [payload];
    const inserted = rows.map((row) => ({ ...row }));
    for (const row of inserted) {
      (this.store[this.tableName] as Row[]).push(row);
    }
    return {
      returning: async () => inserted.map((row) => ({ ...row })),
    };
  }

  async update(patch: Row, returning?: string[]): Promise<Row[] | number> {
    const rows = this.executeSync(false);
    for (const row of rows) Object.assign(row, patch);
    if (returning && returning.length > 0) {
      return rows.map((row) => ({ ...row }));
    }
    return rows.length;
  }

  then<TResult1 = Row[], TResult2 = never>(
    onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private executeSync(clone = true): Row[] {
    let rows = (this.store[this.tableName] as Row[]).filter((row) =>
      this.filters.every((predicate) => predicate(row)),
    );

    if (this.orderedBy) {
      const key = this.orderedBy;
      const factor = this.orderDirection === 'asc' ? 1 : -1;
      rows = [...rows].sort((left, right) => {
        const l = left[key];
        const r = right[key];
        if (l === r) return 0;
        return String(l) > String(r) ? factor : -factor;
      });
    }

    if (this.selectedColumns) {
      rows = rows.map((row) => {
        const next: Row = {};
        for (const key of this.selectedColumns!) next[key] = row[key];
        return next;
      });
    }

    return clone ? rows.map((row) => ({ ...row })) : rows;
  }

  private async execute(): Promise<Row[]> {
    return this.executeSync();
  }
}

let dataStore: DataStore;
let stateTransitionsEnabled = true;
let currentUserId = 'user-admin';
let boardWriteRoleCheckDenied = false;

function resetStore(): DataStore {
  return {
    boards: [
      { id: 'board-source', workspace_id: 'workspace-1' },
      { id: 'board-target', workspace_id: 'workspace-1' },
      { id: 'board-settings', workspace_id: 'workspace-1' },
    ],
    lists: [
      { id: 'src-list-1', board_id: 'board-source', title: 'Todo', position: 'a', archived: false },
      { id: 'src-list-2', board_id: 'board-source', title: 'Doing', position: 'b', archived: false },
      { id: 'tgt-list-1', board_id: 'board-target', title: 'Todo', position: 'a', archived: false },
      { id: 'tgt-list-2', board_id: 'board-target', title: 'Doing', position: 'b', archived: false },
      { id: 'settings-list-1', board_id: 'board-settings', title: 'Todo', position: 'a', archived: false },
    ],
    board_members: [
      { board_id: 'board-source', user_id: 'user-admin', role: 'ADMIN' },
      { board_id: 'board-target', user_id: 'user-admin', role: 'OWNER' },
      { board_id: 'board-settings', user_id: 'user-admin', role: 'MEMBER' },
    ],
    board_state_transitions: [
      {
        id: 'st-source',
        board_id: 'board-source',
        enabled: true,
        graph_data: {
          nodes: [
            { id: 'src-list-1', listId: 'src-list-1', label: 'Todo', positionX: 0, positionY: 0 },
            { id: 'src-list-2', listId: 'src-list-2', label: 'Doing', positionX: 120, positionY: 0 },
          ],
          edges: [],
          notes: [],
        },
        updated_at: '2026-05-19T10:00:00.000Z',
      },
    ],
  };
}

mock.module('../../server/config/featureFlags', () => ({
  featureFlags: {
    get STATE_TRANSITIONS_ENABLED() {
      return stateTransitionsEnabled;
    },
  },
}));

mock.module('../../server/common/db', () => ({
  db: ((tableName: keyof DataStore) => new QueryBuilder(dataStore, tableName)) as unknown as typeof import('../../server/common/db').db,
}));

mock.module('../../server/extensions/auth/middlewares/authentication', () => ({
  authenticate: async (req: Request & { currentUser?: { id: string; email: string } }) => {
    req.currentUser = { id: currentUserId, email: 'admin@example.com' };
    return null;
  },
}));

mock.module('../../server/extensions/board/middlewares/requireBoardWritable', () => ({
  requireBoardWritable: async (
    req: Request & { board?: { id: string; workspace_id: string } },
    boardId: string,
  ) => {
    req.board = { id: boardId, workspace_id: 'workspace-1' };
    return null;
  },
}));

mock.module('../../server/middlewares/permissionManager', () => ({
  requireWorkspaceMembership: async () => null,
  requireRole: () => (boardWriteRoleCheckDenied
    ? Response.json({ name: 'forbidden', data: { message: 'ADMIN role required' } }, { status: 403 })
    : null),
}));

mock.module('../../server/common/uuid', () => ({
  generateId: () => 'generated-st-id',
}));

mock.module('../../server/extensions/stateTransitions/common/ws', () => ({
  broadcastStateTransitionUpdated: async () => undefined,
}));

const { handlePutStateTransitions } = await import('../../server/extensions/stateTransitions/api/put');
const { handleCopyStateTransitions } = await import('../../server/extensions/stateTransitions/api/copy');

beforeEach(() => {
  dataStore = resetStore();
  stateTransitionsEnabled = true;
  currentUserId = 'user-admin';
  boardWriteRoleCheckDenied = false;
});

describe('state transitions permissions', () => {
  it('rejects PUT when caller is neither workspace ADMIN nor board ADMIN/OWNER', async () => {
    boardWriteRoleCheckDenied = true;

    const req = new Request('http://localhost/api/v1/boards/board-settings/state-transitions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });

    const res = await handlePutStateTransitions(req, 'board-settings');
    expect(res.status).toBe(403);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('forbidden');
  });

  it('copies transitions when caller is ADMIN/OWNER on both source and target boards', async () => {
    const req = new Request('http://localhost/api/v1/boards/board-source/state-transitions/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetBoardId: 'board-target' }),
    });

    const res = await handleCopyStateTransitions(req, 'board-source');
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { boardId: string }; metadata: { skippedNodes: number } };
    expect(body.data.boardId).toBe('board-target');
    expect(body.metadata.skippedNodes).toBe(0);
  });

  it('returns insufficient permission when caller is not ADMIN/OWNER on target board', async () => {
    const targetMembership = dataStore.board_members.find(
      (row) => row.board_id === 'board-target' && row.user_id === currentUserId,
    ) as { role: string } | undefined;
    if (!targetMembership) throw new Error('missing target membership fixture');
    targetMembership.role = 'MEMBER';

    const req = new Request('http://localhost/api/v1/boards/board-source/state-transitions/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetBoardId: 'board-target' }),
    });

    const res = await handleCopyStateTransitions(req, 'board-source');
    expect(res.status).toBe(422);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('state-transition-copy-insufficient-permission');
  });
});
