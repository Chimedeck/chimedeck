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

  where(criteria: Row): this {
    this.filters.push((row) => Object.entries(criteria).every(([key, value]) => row[key] === value));
    return this;
  }

  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.orderedBy = column;
    this.orderDirection = direction;
    return this;
  }

  select(...columns: string[]): this {
    this.selectedColumns = columns.length > 0 ? columns : null;
    return this;
  }

  async first(): Promise<Row | undefined> {
    const rows = await this.execute();
    return rows[0];
  }

  insert(payload: Row | Row[]): { returning: () => Promise<Row[]> } {
    const rows = Array.isArray(payload) ? payload : [payload];
    const inserted = rows.map((row) => ({ ...row }));
    for (const row of inserted) {
      (this.store[this.tableName]).push(row);
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
    let rows = (this.store[this.tableName]).filter((row) =>
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
    board_state_transitions: [],
  };
}

mock.module('../../../../config/featureFlags', () => ({
  featureFlags: {
    get STATE_TRANSITIONS_ENABLED() {
      return stateTransitionsEnabled;
    },
  },
}));

mock.module('../../../../common/db', () => ({
  db: ((tableName: keyof DataStore) => new QueryBuilder(dataStore, tableName)) as unknown as typeof import('../../../../common/db').db,
}));

mock.module('../../../auth/middlewares/authentication', () => ({
  authenticate: async (req: Request & { currentUser?: { id: string; email: string } }) => {
    req.currentUser = { id: 'user-1', email: 'user@example.com' };
    return null;
  },
}));

mock.module('../../../../middlewares/permissionManager', () => ({
  requireWorkspaceMembership: async () => null,
}));

mock.module('../../../../common/uuid', () => ({
  generateId: () => 'state-transition-generated',
}));

const { handleGetStateTransitions } = await import('../get');

beforeEach(() => {
  stateTransitionsEnabled = true;
  dataStore = resetStore();
});

describe('GET /api/v1/boards/:boardId/state-transitions', () => {
  it('returns 501 when feature flag is disabled', async () => {
    stateTransitionsEnabled = false;

    const res = await handleGetStateTransitions(
      new Request('http://localhost/api/v1/boards/board-1/state-transitions', { method: 'GET' }),
      'board-1',
    );

    expect(res.status).toBe(501);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('not-implemented');
  });

  it('returns default graph when no state transition row exists', async () => {
    const res = await handleGetStateTransitions(
      new Request('http://localhost/api/v1/boards/board-1/state-transitions', { method: 'GET' }),
      'board-1',
    );

    expect(res.status).toBe(200);
    const body = await res.json() as {
      data: {
        boardId: string;
        enabled: boolean;
        graph: { nodes: Array<{ id: string; listId: string; label: string }>; edges: unknown[]; notes: unknown[] };
      };
    };

    expect(body.data.boardId).toBe('board-1');
    expect(body.data.enabled).toBe(false);
    expect(body.data.graph.nodes).toEqual([
      expect.objectContaining({ id: 'list-1', listId: 'list-1', label: 'Todo' }),
      expect.objectContaining({ id: 'list-2', listId: 'list-2', label: 'Doing' }),
    ]);
    expect(body.data.graph.edges).toEqual([]);
    expect(body.data.graph.notes).toEqual([]);
    expect(dataStore.board_state_transitions).toHaveLength(1);
  });

  it('returns existing saved graph when transition row exists', async () => {
    dataStore.board_state_transitions.push({
      id: 'st-1',
      board_id: 'board-1',
      enabled: true,
      graph_data: {
        nodes: [
          { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 10, positionY: 20 },
          { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 30, positionY: 20 },
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
      updated_at: '2026-05-19T10:00:00.000Z',
    });

    const res = await handleGetStateTransitions(
      new Request('http://localhost/api/v1/boards/board-1/state-transitions', { method: 'GET' }),
      'board-1',
    );

    expect(res.status).toBe(200);
    const body = await res.json() as {
      data: {
        enabled: boolean;
        graph: { nodes: unknown[]; edges: Array<{ fromNodeId: string; toNodeId: string }>; notes: unknown[] };
      };
    };

    expect(body.data.enabled).toBe(true);
    expect(body.data.graph.nodes).toHaveLength(2);
    expect(body.data.graph.edges).toEqual([
      expect.objectContaining({ fromNodeId: 'list-1', toNodeId: 'list-2' }),
    ]);
    expect(body.data.graph.notes).toEqual([]);
  });

  it('repairs stale graph nodes and edges when lists were renamed or deleted', async () => {
    dataStore.lists = [
      { id: 'list-1', board_id: 'board-1', title: 'Todo renamed', position: 'a', archived: false },
      { id: 'list-2', board_id: 'board-1', title: 'Doing', position: 'b', archived: false },
    ];
    dataStore.board_state_transitions.push({
      id: 'st-2',
      board_id: 'board-1',
      enabled: true,
      graph_data: {
        nodes: [
          { id: 'list-1', listId: 'list-1', label: 'Todo old', positionX: 10, positionY: 20 },
          { id: 'list-deleted', listId: 'list-deleted', label: 'Deleted', positionX: 20, positionY: 20 },
        ],
        edges: [
          {
            id: 'edge-stale',
            fromNodeId: 'list-1',
            toNodeId: 'list-deleted',
            action: 'allowed_move_to',
            direction: 'one_way',
            style: 'curved',
          },
        ],
        notes: [],
      },
      updated_at: '2026-05-19T10:00:00.000Z',
    });

    const res = await handleGetStateTransitions(
      new Request('http://localhost/api/v1/boards/board-1/state-transitions', { method: 'GET' }),
      'board-1',
    );

    expect(res.status).toBe(200);
    const body = await res.json() as {
      data: {
        graph: {
          nodes: Array<{ id: string; label: string }>;
          edges: Array<{ id: string }>;
        };
      };
    };

    expect(body.data.graph.nodes).toEqual([
      expect.objectContaining({ id: 'list-1', label: 'Todo renamed' }),
    ]);
    expect(body.data.graph.edges).toEqual([]);
    expect((dataStore.board_state_transitions[0] as {
      graph_data: { nodes: Array<{ id: string; label: string }>; edges: unknown[] };
    }).graph_data).toEqual(
      expect.objectContaining({
        nodes: [expect.objectContaining({ id: 'list-1', label: 'Todo renamed' })],
        edges: [],
      }),
    );
  });

  it('returns 404 when board does not exist', async () => {
    const res = await handleGetStateTransitions(
      new Request('http://localhost/api/v1/boards/board-missing/state-transitions', { method: 'GET' }),
      'board-missing',
    );

    expect(res.status).toBe(404);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('board-not-found');
  });

  it('returns empty graph when board has no active lists', async () => {
    dataStore.lists = [];

    const res = await handleGetStateTransitions(
      new Request('http://localhost/api/v1/boards/board-1/state-transitions', { method: 'GET' }),
      'board-1',
    );

    expect(res.status).toBe(200);
    const body = await res.json() as {
      data: { graph: { nodes: unknown[]; edges: unknown[]; notes: unknown[] } };
    };
    expect(body.data.graph.nodes).toEqual([]);
    expect(body.data.graph.edges).toEqual([]);
    expect(body.data.graph.notes).toEqual([]);
  });

  it('reflects feature-flag changes between requests at runtime', async () => {
    stateTransitionsEnabled = true;
    const enabledResponse = await handleGetStateTransitions(
      new Request('http://localhost/api/v1/boards/board-1/state-transitions', { method: 'GET' }),
      'board-1',
    );
    expect(enabledResponse.status).toBe(200);

    stateTransitionsEnabled = false;
    const disabledResponse = await handleGetStateTransitions(
      new Request('http://localhost/api/v1/boards/board-1/state-transitions', { method: 'GET' }),
      'board-1',
    );
    expect(disabledResponse.status).toBe(501);
  });
});
