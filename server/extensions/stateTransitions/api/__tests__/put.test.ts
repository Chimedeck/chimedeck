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

  insert(payload: Row | Row[]): { returning: () => Promise<Row[]> } {
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
const publishMock = mock((_boardId: string, _payload: string) => Promise.resolve());

function resetStore(): DataStore {
  return {
    boards: [{ id: 'board-1', workspace_id: 'ws-1' }],
    lists: [
      { id: 'list-1', board_id: 'board-1', title: 'Todo', position: 'a', archived: false },
      { id: 'list-2', board_id: 'board-1', title: 'Doing', position: 'b', archived: false },
    ],
    board_members: [{ board_id: 'board-1', user_id: 'user-admin', role: 'ADMIN' }],
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
    req.currentUser = { id: 'user-admin', email: 'admin@example.com' };
    return null;
  },
}));

mock.module('../../../board/middlewares/requireBoardWritable', () => ({
  requireBoardWritable: async (
    req: Request & { board?: { id: string; workspace_id: string } },
    boardId: string,
  ) => {
    const board = dataStore.boards.find((candidate) => candidate.id === boardId) as
      | { id: string; workspace_id: string }
      | undefined;
    if (!board) {
      return Response.json(
        { error: { code: 'board-not-found', message: 'Board not found' } },
        { status: 404 },
      );
    }
    req.board = { id: board.id, workspace_id: board.workspace_id };
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

mock.module('../../../../common/uuid', () => ({
  generateId: () => 'state-transition-generated',
}));

const { handlePutStateTransitions } = await import('../put');
const { handleGetStateTransitions } = await import('../get');

beforeEach(() => {
  stateTransitionsEnabled = true;
  dataStore = resetStore();
  publishMock.mockClear();
});

describe('PUT /api/v1/boards/:boardId/state-transitions', () => {
  it('returns 501 when feature flag is disabled', async () => {
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

  it('saves valid graph and returns updated data', async () => {
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

    const body = await res.json() as {
      data: {
        boardId: string;
        enabled: boolean;
        graph: {
          nodes: Array<{ id: string }>;
          edges: Array<{ fromNodeId: string; toNodeId: string }>;
        };
      };
    };

    expect(body.data.boardId).toBe('board-1');
    expect(body.data.enabled).toBe(true);
    expect(body.data.graph.nodes).toHaveLength(2);
    expect(body.data.graph.edges).toEqual([
      expect.objectContaining({ fromNodeId: 'list-1', toNodeId: 'list-2' }),
    ]);
    expect(dataStore.board_state_transitions).toHaveLength(1);
    expect((dataStore.board_state_transitions[0] as { enabled: boolean }).enabled).toBe(true);
    expect(publishMock).toHaveBeenCalledTimes(1);
    const [, message] = publishMock.mock.calls[0] as [string, string];
    const wsEvent = JSON.parse(message) as { type: string; board_id: string };
    expect(wsEvent.type).toBe('state_transition_updated');
    expect(wsEvent.board_id).toBe('board-1');
  });

  it('syncs renamed list labels from current board lists before persisting', async () => {
    dataStore.board_state_transitions.push({
      id: 'st-existing',
      board_id: 'board-1',
      enabled: false,
      graph_data: {
        nodes: [
          { id: 'list-1', listId: 'list-1', label: 'Todo (old)', positionX: 10, positionY: 20 },
          { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 30, positionY: 20 },
        ],
        edges: [],
        notes: [],
      },
      updated_at: '2026-05-19T10:00:00.000Z',
    });
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
    const body = await res.json() as {
      data: {
        graph: { nodes: Array<{ id: string; label: string }> };
      };
    };

    expect(body.data.graph.nodes.find((node) => node.id === 'list-1')?.label).toBe('Todo Renamed');
  });

  it('strips deleted list nodes and dangling edges before persisting', async () => {
    dataStore.board_state_transitions.push({
      id: 'st-existing',
      board_id: 'board-1',
      enabled: false,
      graph_data: {
        nodes: [
          { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 10, positionY: 20 },
          { id: 'list-deleted', listId: 'list-deleted', label: 'Deleted', positionX: 30, positionY: 20 },
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

    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });

    const res = await handlePutStateTransitions(req, 'board-1');
    expect(res.status).toBe(200);
    const body = await res.json() as {
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

  it('preserves graph structure across PUT then GET roundtrip', async () => {
    const graphPayload = {
      nodes: [
        { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 100, positionY: 50 },
        { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 350, positionY: 50 },
      ],
      edges: [
        {
          id: 'edge-1',
          fromNodeId: 'list-1',
          toNodeId: 'list-2',
          action: 'allowed_move_to' as const,
          direction: 'one_way' as const,
          style: 'straight' as const,
        },
      ],
      notes: [{ id: 'note-1', content: 'QA only', positionX: 220, positionY: 160 }],
    };

    const putReq = new Request('http://localhost/api/v1/boards/board-1/state-transitions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, graph: graphPayload }),
    });
    const putRes = await handlePutStateTransitions(putReq, 'board-1');
    expect(putRes.status).toBe(200);

    const getReq = new Request('http://localhost/api/v1/boards/board-1/state-transitions', { method: 'GET' });
    const getRes = await handleGetStateTransitions(getReq, 'board-1');
    expect(getRes.status).toBe(200);

    const body = await getRes.json() as {
      data: { enabled: boolean; graph: typeof graphPayload };
    };
    expect(body.data.enabled).toBe(true);
    expect(body.data.graph).toEqual(graphPayload);
  });

  it('returns 422 state-transition-node-unknown-list when graph references unknown list IDs', async () => {
    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graph: {
          nodes: [
            { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 10, positionY: 20 },
            { id: 'list-unknown', listId: 'list-unknown', label: 'Unknown', positionX: 30, positionY: 20 },
          ],
          edges: [],
          notes: [],
        },
      }),
    });

    const res = await handlePutStateTransitions(req, 'board-1');
    expect(res.status).toBe(422);

    const body = await res.json() as { name: string; data?: { nodeId?: string } };
    expect(body.name).toBe('state-transition-node-unknown-list');
    expect(body.data?.nodeId).toBe('list-unknown');
  });

  it('returns 400 for malformed JSON body', async () => {
    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{"enabled":true',
    });

    const res = await handlePutStateTransitions(req, 'board-1');
    expect(res.status).toBe(400);

    const body = await res.json() as { name: string };
    expect(body.name).toBe('bad-request');
  });

  it('returns 404 when board does not exist', async () => {
    const req = new Request('http://localhost/api/v1/boards/board-missing/state-transitions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });

    const res = await handlePutStateTransitions(req, 'board-missing');
    expect(res.status).toBe(404);

    const body = await res.json() as { name: string };
    expect(body.name).toBe('board-not-found');
  });

  it('persists enabled state with empty graph when board has no active lists', async () => {
    dataStore.lists = [];
    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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

  it('rejects stale node labels when graph is out of sync with current list titles', async () => {
    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graph: {
          nodes: [
            { id: 'list-1', listId: 'list-1', label: 'Todo (stale)', positionX: 10, positionY: 20 },
            { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 30, positionY: 20 },
          ],
          edges: [],
          notes: [],
        },
      }),
    });

    const res = await handlePutStateTransitions(req, 'board-1');
    expect(res.status).toBe(422);

    const body = await res.json() as {
      name: string;
      data?: {
        nodeId?: string;
        listId?: string;
        expectedLabel?: string;
        receivedLabel?: string;
      };
    };
    expect(body.name).toBe('state-transition-graph-out-of-sync');
    expect(body.data?.nodeId).toBe('list-1');
    expect(body.data?.listId).toBe('list-1');
    expect(body.data?.expectedLabel).toBe('Todo');
    expect(body.data?.receivedLabel).toBe('Todo (stale)');
  });

  it('rejects graph payloads that do not include nodes for all active board lists', async () => {
    dataStore.lists.push({ id: 'list-3', board_id: 'board-1', title: 'Done', position: 'c', archived: false });

    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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

    const res = await handlePutStateTransitions(req, 'board-1');
    expect(res.status).toBe(422);
    const body = await res.json() as {
      name: string;
      data?: { listId?: string };
    };
    expect(body.name).toBe('state-transition-graph-out-of-sync');
    expect(body.data?.listId).toBe('list-3');
  });

  it('reflects feature-flag changes between requests at runtime', async () => {
    stateTransitionsEnabled = true;
    const enabledReq = new Request('http://localhost/api/v1/boards/board-1/state-transitions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    const enabledRes = await handlePutStateTransitions(enabledReq, 'board-1');
    expect(enabledRes.status).toBe(200);

    stateTransitionsEnabled = false;
    const disabledReq = new Request('http://localhost/api/v1/boards/board-1/state-transitions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    const disabledRes = await handlePutStateTransitions(disabledReq, 'board-1');
    expect(disabledRes.status).toBe(501);
  });
});
