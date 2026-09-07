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

  insert(payload: Row | Row[]): { returning: (_columns?: string | string[]) => Promise<Row[]> } {
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

let stateTransitionsEnabled = true;
let dataStore: DataStore;

function resetStore(): DataStore {
  return {
    boards: [{ id: 'board-1', workspace_id: 'ws-1' }],
    lists: [
      { id: 'list-1', board_id: 'board-1', title: 'Todo', position: 'a', archived: false },
      { id: 'list-2', board_id: 'board-1', title: 'Doing', position: 'b', archived: false },
    ],
    board_members: [{ board_id: 'board-1', user_id: 'user-admin', role: 'OWNER' }],
    board_state_transitions: [
      {
        id: 'st-1',
        board_id: 'board-1',
        enabled: false,
        graph_data: { nodes: [], edges: [], notes: [] },
        updated_at: '2026-05-19T10:00:00.000Z',
      },
    ],
  };
}

mock.module('../../../server/config/featureFlags', () => ({
  featureFlags: {
    get STATE_TRANSITIONS_ENABLED() {
      return stateTransitionsEnabled;
    },
  },
}));

mock.module('../../../server/common/db', () => ({
  db: ((tableName: keyof DataStore) => new QueryBuilder(dataStore, tableName)) as unknown as typeof import('../../../server/common/db').db,
}));

mock.module('../../../server/extensions/auth/middlewares/authentication', () => ({
  authenticate: async (req: Request & { currentUser?: { id: string; email: string } }) => {
    req.currentUser = { id: 'user-admin', email: 'admin@example.com' };
    return null;
  },
}));

mock.module('../../../server/extensions/board/middlewares/requireBoardWritable', () => ({
  requireBoardWritable: async (
    req: Request & { board?: { id: string; workspace_id: string } },
    boardId: string,
  ) => {
    req.board = { id: boardId, workspace_id: 'ws-1' };
    return null;
  },
}));

mock.module('../../../server/middlewares/permissionManager', () => ({
  requireWorkspaceMembership: async () => null,
  requireRole: () => null,
}));

mock.module('../../../server/extensions/stateTransitions/common/ws', () => ({
  broadcastStateTransitionUpdated: async () => {},
}));

mock.module('../../../server/extensions/stateTransitions/enforcement/rules', () => ({
  invalidateRulesCacheForBoard: () => {},
}));

const { handlePutStateTransitions } = await import('../../../server/extensions/stateTransitions/api/put');

beforeEach(() => {
  stateTransitionsEnabled = true;
  dataStore = resetStore();
});

describe('PUT /api/v1/boards/:boardId/state-transitions', () => {
  it('returns 200 and updated data for a valid graph', async () => {
    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        graph: {
          nodes: [
            { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 120, positionY: 80 },
            { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 360, positionY: 80 },
          ],
          edges: [
            {
              id: 'edge-1',
              fromNodeId: 'list-1',
              toNodeId: 'list-2',
              action: 'allowed_move_to',
              direction: 'one_way',
              style: 'curved',
            },
          ],
          notes: [],
        },
      }),
    });

    const res = await handlePutStateTransitions(req, 'board-1');
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { enabled: boolean; graph: { edges: Array<{ id: string }> } } };
    expect(body.data.enabled).toBe(true);
    expect(body.data.graph.edges[0]?.id).toBe('edge-1');
  });

  it('returns 422 state-transition-node-unknown-list when graph has unknown node listId', async () => {
    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graph: {
          nodes: [{ id: 'missing-list', listId: 'missing-list', label: 'Ghost', positionX: 1, positionY: 1 }],
          edges: [],
          notes: [],
        },
      }),
    });

    const res = await handlePutStateTransitions(req, 'board-1');
    expect(res.status).toBe(422);
    const body = await res.json() as { name: string; data: { nodeId: string } };
    expect(body.name).toBe('state-transition-node-unknown-list');
    expect(body.data.nodeId).toBe('missing-list');
  });

  it('returns 501 when STATE_TRANSITIONS_ENABLED is false', async () => {
    stateTransitionsEnabled = false;
    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });

    const res = await handlePutStateTransitions(req, 'board-1');
    expect(res.status).toBe(501);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('not-implemented');
  });

  it('persists enabled state with empty graph when board has no active lists', async () => {
    dataStore.lists = [];
    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });

    const res = await handlePutStateTransitions(req, 'board-1');
    expect(res.status).toBe(200);
    const body = await res.json() as {
      data: { enabled: boolean; graph: { nodes: unknown[]; edges: unknown[]; notes: unknown[] } };
    };
    expect(body.data.enabled).toBe(true);
    expect(body.data.graph.nodes).toEqual([]);
    expect(body.data.graph.edges).toEqual([]);
    expect(body.data.graph.notes).toEqual([]);
  });
});
