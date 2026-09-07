import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { StateTransitionForbiddenError } from '../../common/errors';

type Row = Record<string, unknown>;
type DataStore = {
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

  async update(patch: Row, returning?: string[]): Promise<Row[] | number> {
    const rows = (this.store[this.tableName] as Row[]).filter((row) =>
      this.filters.every((predicate) => predicate(row)),
    );
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

let dataStore: DataStore;
const publishedMessages: Array<{ boardId: string; message: string }> = [];

function resetStore(): DataStore {
  return {
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
            { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 30, positionY: 20 },
          ],
          edges: [],
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
  db: ((tableName: keyof DataStore) => new QueryBuilder(dataStore, tableName)) as unknown as typeof import('../../../../common/db').db,
}));

mock.module('../../../auth/middlewares/authentication', () => ({
  authenticate: async (req: Request & { currentUser?: { id: string; email: string } }) => {
    req.currentUser = { id: 'actor-1', email: 'actor@example.com' };
    return null;
  },
}));

mock.module('../../../../middlewares/permissionManager', () => ({
  requireWorkspaceMembership: async () => null,
  requireRole: () => null,
}));

mock.module('../../../board/middlewares/requireBoardWritable', () => ({
  requireBoardWritable: async (req: Request & { board?: { id: string; workspace_id: string } }, boardId: string) => {
    req.board = { id: boardId, workspace_id: 'ws-1' };
    return null;
  },
}));

mock.module('../../../../mods/pubsub/publisher', () => ({
  publisher: {
    publish: async (boardId: string, message: string) => {
      publishedMessages.push({ boardId, message });
    },
  },
}));

const { handlePutStateTransitions } = await import('../put');
const { validateCardMove } = await import('../../enforcement');
const { clearRulesCache } = await import('../../enforcement/rules');

beforeEach(() => {
  dataStore = resetStore();
  publishedMessages.length = 0;
  clearRulesCache();
});

describe('PUT state transitions websocket broadcast', () => {
  it('emits state_transition_updated after successful PUT', async () => {
    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });

    const res = await handlePutStateTransitions(req, 'board-1');
    expect(res.status).toBe(200);
    expect(publishedMessages).toHaveLength(1);

    const published = publishedMessages[0];
    expect(published?.boardId).toBe('board-1');
    const event = JSON.parse(published?.message ?? '{}') as {
      type: string;
      board_id: string;
      actor_id: string;
      payload: { enabled: boolean; graph: { nodes: unknown[] } };
      timestamp: string;
    };

    expect(event.type).toBe('state_transition_updated');
    expect(event.board_id).toBe('board-1');
    expect(event.actor_id).toBe('actor-1');
    expect(event.payload.enabled).toBe(true);
    expect(Array.isArray(event.payload.graph.nodes)).toBe(true);
    expect(typeof event.timestamp).toBe('string');
  });

  it('invalidates cached rules so validateCardMove sees updated graph after PUT', async () => {
    dataStore.board_state_transitions[0] = {
      ...(dataStore.board_state_transitions[0] as Row),
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
    };

    await expect(
      validateCardMove({ boardId: 'board-1', fromListId: 'list-1', toListId: 'list-2' }),
    ).resolves.toBeUndefined();

    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        graph: {
          nodes: [
            { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 10, positionY: 20 },
            { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 30, positionY: 20 },
          ],
          edges: [],
          notes: [],
        },
      }),
    });
    const putRes = await handlePutStateTransitions(req, 'board-1');
    expect(putRes.status).toBe(200);

    await expect(
      validateCardMove({ boardId: 'board-1', fromListId: 'list-1', toListId: 'list-2' }),
    ).rejects.toBeInstanceOf(StateTransitionForbiddenError);
  });
});
