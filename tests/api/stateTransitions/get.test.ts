import { beforeEach, describe, expect, it, mock } from 'bun:test';

type Row = Record<string, unknown>;
type DataStore = {
  boards: Row[];
  lists: Row[];
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

  then<TResult1 = Row[], TResult2 = never>(
    onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<Row[]> {
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

    return rows.map((row) => ({ ...row }));
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
    board_state_transitions: [],
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
    req.currentUser = { id: 'user-1', email: 'member@example.com' };
    return null;
  },
}));

mock.module('../../../server/middlewares/permissionManager', () => ({
  requireWorkspaceMembership: async () => null,
}));

const { handleGetStateTransitions } = await import('../../../server/extensions/stateTransitions/api/get');

beforeEach(() => {
  stateTransitionsEnabled = true;
  dataStore = resetStore();
});

describe('GET /api/v1/boards/:boardId/state-transitions', () => {
  it('returns default graph and creates transition row when missing', async () => {
    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions', { method: 'GET' });
    const res = await handleGetStateTransitions(req, 'board-1');

    expect(res.status).toBe(200);
    const body = await res.json() as {
      data: { enabled: boolean; graph: { nodes: Array<{ listId: string; label: string }>; edges: unknown[]; notes: unknown[] } };
    };
    expect(body.data.enabled).toBe(false);
    expect(body.data.graph.nodes).toHaveLength(2);
    expect(body.data.graph.nodes.map((node) => node.listId)).toEqual(['list-1', 'list-2']);
    expect(body.data.graph.nodes.map((node) => node.label)).toEqual(['Todo', 'Doing']);
    expect(body.data.graph.edges).toEqual([]);
    expect(body.data.graph.notes).toEqual([]);
    expect(dataStore.board_state_transitions).toHaveLength(1);
  });

  it('returns 501 when STATE_TRANSITIONS_ENABLED is false', async () => {
    stateTransitionsEnabled = false;
    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions', { method: 'GET' });
    const res = await handleGetStateTransitions(req, 'board-1');

    expect(res.status).toBe(501);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('not-implemented');
  });

  it('returns empty graph when board has no active lists', async () => {
    dataStore.lists = [];
    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions', { method: 'GET' });
    const res = await handleGetStateTransitions(req, 'board-1');

    expect(res.status).toBe(200);
    const body = await res.json() as {
      data: { graph: { nodes: unknown[]; edges: unknown[]; notes: unknown[] } };
    };
    expect(body.data.graph.nodes).toEqual([]);
    expect(body.data.graph.edges).toEqual([]);
    expect(body.data.graph.notes).toEqual([]);
  });
});
