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
const publishMock = mock((_boardId: string, _message: string) => Promise.resolve());

function resetStore(): DataStore {
  return {
    boards: [{ id: 'board-1', workspace_id: 'ws-1' }],
    lists: [
      { id: 'list-1', board_id: 'board-1', title: 'Todo Renamed', position: 'a', archived: false },
      { id: 'list-2', board_id: 'board-1', title: 'Doing', position: 'b', archived: false },
    ],
    board_state_transitions: [
      {
        id: 'st-1',
        board_id: 'board-1',
        enabled: false,
        graph_data: {
          nodes: [
            { id: 'list-1', listId: 'list-1', label: 'Todo Old', positionX: 1, positionY: 2 },
            { id: 'list-deleted', listId: 'list-deleted', label: 'Deleted', positionX: 3, positionY: 4 },
          ],
          edges: [
            {
              id: 'edge-1',
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
      },
    ],
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
    req.currentUser = { id: 'user-admin', email: 'admin@example.com' };
    return null;
  },
}));

mock.module('../../../board/middlewares/requireBoardWritable', () => ({
  requireBoardWritable: async (
    req: Request & { board?: { id: string; workspace_id: string } },
    boardId: string,
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
    publish: publishMock,
  },
}));

const { handlePutStateTransitions } = await import('../put');

beforeEach(() => {
  stateTransitionsEnabled = true;
  dataStore = resetStore();
  publishMock.mockClear();
});

describe('PUT /api/v1/boards/:boardId/state-transitions sync hooks', () => {
  it('syncs stale graph nodes/labels and broadcasts state_transition_updated', async () => {
    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });

    const res = await handlePutStateTransitions(req, 'board-1');
    expect(res.status).toBe(200);

    const body = await res.json() as {
      data: { enabled: boolean; graph: { nodes: Array<{ id: string; label: string }>; edges: unknown[] } };
    };
    expect(body.data.enabled).toBe(true);
    expect(body.data.graph.nodes).toHaveLength(1);
    expect(body.data.graph.nodes[0]).toMatchObject({
      id: 'list-1',
      label: 'Todo Renamed',
    });
    expect(body.data.graph.edges).toEqual([]);

    const persisted = dataStore.board_state_transitions[0] as {
      graph_data: { nodes: Array<{ id: string; label: string }>; edges: unknown[] };
    };
    expect(persisted.graph_data.nodes).toHaveLength(1);
    expect(persisted.graph_data.nodes[0]?.label).toBe('Todo Renamed');
    expect(persisted.graph_data.edges).toEqual([]);

    expect(publishMock).toHaveBeenCalledTimes(1);
    const [publishedBoardId, publishedMessage] = publishMock.mock.calls[0] as [string, string];
    expect(publishedBoardId).toBe('board-1');
    const parsed = JSON.parse(publishedMessage) as {
      type: string;
      board_id: string;
      actor_id: string;
      payload: { enabled: boolean; graph: { nodes: unknown[] } };
    };
    expect(parsed.type).toBe('state_transition_updated');
    expect(parsed.board_id).toBe('board-1');
    expect(parsed.actor_id).toBe('user-admin');
    expect(parsed.payload.enabled).toBe(true);
    expect(parsed.payload.graph.nodes).toHaveLength(1);
  });
});
