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

  constructor(
    private readonly store: DataStore,
    private readonly tableName: keyof DataStore
  ) {}

  where(criteria: Row): this {
    this.filters.push((row) =>
      Object.entries(criteria).every(([key, value]) => row[key] === value)
    );
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
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private executeSync(clone = true): Row[] {
    let rows = this.store[this.tableName].filter((row) =>
      this.filters.every((predicate) => predicate(row))
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

function resetStore(): DataStore {
  return {
    boards: [{ id: 'board-1', workspace_id: 'ws-1' }],
    lists: [
      { id: 'list-1', board_id: 'board-1', title: 'Todo', position: 'a', archived: false },
      { id: 'list-2', board_id: 'board-1', title: 'Doing', position: 'b', archived: false },
    ],
    board_state_transitions: [
      {
        id: 'st-1',
        board_id: 'board-1',
        enabled: false,
        graph_data: {
          nodes: [
            { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 10, positionY: 20 },
            { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 20, positionY: 20 },
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
      },
    ],
  };
}

mock.module('../../../../config/featureFlags', () => ({
  featureFlags: {
    STATE_TRANSITIONS_ENABLED: true,
  },
}));

mock.module('../../../../common/db', () => ({
  db: ((tableName: keyof DataStore) =>
    new QueryBuilder(dataStore, tableName)) as unknown as typeof import('../../../../common/db').db,
}));

mock.module('../../../auth/middlewares/authentication', () => ({
  authenticate: async (req: Request & { currentUser?: { id: string; email: string } }) => {
    req.currentUser = { id: 'actor-1', email: 'actor@example.com' };
    return null;
  },
}));

mock.module('../../../board/middlewares/requireBoardWritable', () => ({
  requireBoardWritable: async (
    req: Request & { board?: { id: string; workspace_id: string } },
    boardId: string
  ) => {
    req.board = { id: boardId, workspace_id: 'ws-1' };
    return null;
  },
}));

mock.module('../../../../middlewares/permissionManager', () => ({
  requireWorkspaceMembership: async () => null,
  requireRole: () => null,
}));

mock.module('../../../../mods/pubsub/publisher', () => ({
  publisher: {
    publish: async () => null,
  },
}));

const { handlePutStateTransitions } = await import('../put');

beforeEach(() => {
  dataStore = resetStore();
});

describe('PUT /api/v1/boards/:boardId/state-transitions list sync', () => {
  it('updates node label after list rename before persisting graph', async () => {
    dataStore.lists[0] = {
      ...(dataStore.lists[0] as Row),
      title: 'Todo Renamed',
    };

    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });

    const res = await handlePutStateTransitions(req, 'board-1');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        graph: { nodes: Array<{ id: string; label: string }> };
      };
    };

    const renamedNode = body.data.graph.nodes.find((node) => node.id === 'list-1');
    expect(renamedNode?.label).toBe('Todo Renamed');
  });

  it('removes deleted list nodes and dangling edges before persisting graph', async () => {
    dataStore.board_state_transitions[0] = {
      ...(dataStore.board_state_transitions[0] as Row),
      graph_data: {
        nodes: [
          { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 10, positionY: 20 },
          {
            id: 'list-deleted',
            listId: 'list-deleted',
            label: 'Deleted',
            positionX: 30,
            positionY: 20,
          },
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
    };

    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });

    const res = await handlePutStateTransitions(req, 'board-1');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        graph: {
          nodes: Array<{ id: string }>;
          edges: Array<{ fromNodeId: string; toNodeId: string }>;
        };
      };
    };

    expect(body.data.graph.nodes.map((node) => node.id)).toEqual(['list-1']);
    expect(body.data.graph.edges).toEqual([]);
  });
});
