import { beforeEach, describe, expect, it, mock } from 'bun:test';

type Row = Record<string, unknown>;
type DataStore = {
  boards: Row[];
  lists: Row[];
  cards: Row[];
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

  count(): QueryBuilder {
    return this;
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

  async del(): Promise<number> {
    const table = this.store[this.tableName] as Row[];
    const keep: Row[] = [];
    let deleted = 0;
    for (const row of table) {
      const match = this.filters.every((predicate) => predicate(row));
      if (match) {
        deleted += 1;
      } else {
        keep.push(row);
      }
    }
    table.splice(0, table.length, ...keep);
    return deleted;
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

    if (this.tableName === 'cards') {
      return [{ count: String(rows.length) }];
    }

    return clone ? rows.map((row) => ({ ...row })) : rows;
  }

  private async execute(): Promise<Row[]> {
    return this.executeSync();
  }
}

let stateTransitionsEnabled = true;
let dataStore: DataStore;
const wsEvents: Array<{ boardId: string; actorId: string; enabled: boolean }> = [];

function resetStore(): DataStore {
  return {
    boards: [{ id: 'board-1', workspace_id: 'ws-1', state: 'ACTIVE' }],
    lists: [
      { id: 'list-1', board_id: 'board-1', title: 'Todo', position: 'a', archived: false },
      { id: 'list-2', board_id: 'board-1', title: 'Doing', position: 'b', archived: false },
      { id: 'list-3', board_id: 'board-1', title: 'Done', position: 'c', archived: false },
    ],
    cards: [],
    board_members: [{ board_id: 'board-1', user_id: 'user-admin', role: 'OWNER' }],
    board_state_transitions: [],
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
    req.currentUser = { id: 'user-admin', email: 'admin@example.com' };
    return null;
  },
}));

mock.module('../../server/middlewares/permissionManager', () => ({
  requireWorkspaceMembership: async () => null,
  requireRole: () => null,
}));

mock.module('../../server/extensions/board/middlewares/requireBoardWritable', () => ({
  requireBoardWritable: async (
    req: Request & { board?: { id: string; workspace_id: string } },
    boardId: string,
  ) => {
    req.board = { id: boardId, workspace_id: 'ws-1' };
    return null;
  },
}));

mock.module('../../server/extensions/stateTransitions/common/ws', () => ({
  broadcastStateTransitionUpdated: async ({
    boardId,
    actorId,
    enabled,
  }: {
    boardId: string;
    actorId: string;
    enabled: boolean;
  }) => {
    wsEvents.push({ boardId, actorId, enabled });
  },
}));

mock.module('../../server/extensions/stateTransitions/enforcement/rules', () => ({
  getRulesForBoard: async (boardId: string) => {
    const row = dataStore.board_state_transitions.find((item) => item.board_id === boardId);
    const graph = (row?.graph_data as { nodes: Array<{ listId: string; label: string }>; edges: Array<{ fromNodeId: string; toNodeId: string; direction: string }>; notes: unknown[] } | undefined)
      ?? { nodes: [], edges: [], notes: [] };
    const enabled = Boolean(row?.enabled);
    const rules = graph.nodes
      .map((node) => {
        const allowed = graph.edges
          .filter((edge) => {
            if (edge.direction === 'two_way') {
              return edge.fromNodeId === node.listId || edge.toNodeId === node.listId;
            }
            return edge.fromNodeId === node.listId;
          })
          .map((edge) => (edge.fromNodeId === node.listId ? edge.toNodeId : edge.fromNodeId));
        const allowedIds = Array.from(new Set(allowed));
        if (allowedIds.length === 0) return null;
        const forbiddenNodes = graph.nodes.filter(
          (candidate) => candidate.listId !== node.listId && !allowedIds.includes(candidate.listId),
        );
        return {
          current_state: node.label,
          current_state_id: node.listId,
          allowed_next_states: allowedIds
            .map((id) => graph.nodes.find((candidate) => candidate.listId === id)?.label)
            .filter((label): label is string => Boolean(label)),
          allowed_next_state_ids: allowedIds,
          forbidden_next_states: forbiddenNodes.map((candidate) => candidate.label),
          forbidden_next_state_ids: forbiddenNodes.map((candidate) => candidate.listId),
        };
      })
      .filter((rule): rule is NonNullable<typeof rule> => rule !== null);
    return {
      enabled,
      hasStateTransitionRow: Boolean(row),
      rules,
      listNameById: new Map<string, string>(),
      allowedNextStatesByListId: new Map<string, Array<{ id: string; name: string }>>(),
    };
  },
  invalidateRulesCacheForBoard: () => {},
}));

mock.module('../../server/mods/events/write', () => ({
  writeEvent: async () => {},
}));

const { handleGetStateTransitionRules } = await import('../../server/extensions/stateTransitions/api/getRules');
const { handlePutStateTransitions } = await import('../../server/extensions/stateTransitions/api/put');
const { handleUpdateList } = await import('../../server/extensions/list/api/update');
const { handleDeleteList } = await import('../../server/extensions/list/api/delete');

beforeEach(() => {
  stateTransitionsEnabled = true;
  dataStore = resetStore();
  wsEvents.splice(0, wsEvents.length);
});

describe('state transitions rules + sync hooks', () => {
  it('GET /rules returns empty rules when no edges exist', async () => {
    dataStore.board_state_transitions.push({
      id: 'st-1',
      board_id: 'board-1',
      enabled: true,
      graph_data: {
        nodes: [
          { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 0, positionY: 0 },
          { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 10, positionY: 0 },
        ],
        edges: [],
        notes: [],
      },
    });

    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions/rules', { method: 'GET' });
    const res = await handleGetStateTransitionRules(req, 'board-1');
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { rules: unknown[] } };
    expect(body.data.rules).toEqual([]);
  });

  it('GET /rules derives allowed and forbidden states from edges', async () => {
    dataStore.board_state_transitions.push({
      id: 'st-1',
      board_id: 'board-1',
      enabled: true,
      graph_data: {
        nodes: [
          { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 0, positionY: 0 },
          { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 10, positionY: 0 },
          { id: 'list-3', listId: 'list-3', label: 'Done', positionX: 20, positionY: 0 },
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
    });

    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions/rules', { method: 'GET' });
    const res = await handleGetStateTransitionRules(req, 'board-1');
    expect(res.status).toBe(200);
    const body = await res.json() as {
      data: {
        rules: Array<{
          current_state_id: string;
          allowed_next_state_ids: string[];
          forbidden_next_state_ids: string[];
        }>;
      };
    };
    expect(body.data.rules).toEqual([
      {
        current_state: 'Todo',
        current_state_id: 'list-1',
        allowed_next_states: ['Doing'],
        allowed_next_state_ids: ['list-2'],
        forbidden_next_states: ['Done'],
        forbidden_next_state_ids: ['list-3'],
      },
    ]);
  });

  it('PUT emits state_transition_updated websocket broadcast after save', async () => {
    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        graph: {
          nodes: [
            { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 0, positionY: 0 },
            { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 10, positionY: 0 },
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
    expect(wsEvents).toEqual([{ boardId: 'board-1', actorId: 'user-admin', enabled: true }]);
  });

  it('list rename updates graph node label', async () => {
    dataStore.board_state_transitions.push({
      id: 'st-1',
      board_id: 'board-1',
      enabled: true,
      graph_data: {
        nodes: [
          { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 0, positionY: 0 },
          { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 10, positionY: 0 },
        ],
        edges: [],
        notes: [],
      },
    });

    const req = new Request('http://localhost/api/v1/lists/list-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Backlog' }),
    });
    const res = await handleUpdateList(req, 'list-1');
    expect(res.status).toBe(200);

    const row = dataStore.board_state_transitions[0] as { graph_data: { nodes: Array<{ listId: string; label: string }> } };
    const renamedNode = row.graph_data.nodes.find((node) => node.listId === 'list-1');
    expect(renamedNode?.label).toBe('Backlog');
  });

  it('list delete strips deleted node and related edges', async () => {
    dataStore.board_state_transitions.push({
      id: 'st-1',
      board_id: 'board-1',
      enabled: true,
      graph_data: {
        nodes: [
          { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 0, positionY: 0 },
          { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 10, positionY: 0 },
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
    });

    const req = new Request('http://localhost/api/v1/lists/list-2', { method: 'DELETE' });
    const res = await handleDeleteList(req, 'list-2');
    expect(res.status).toBe(204);

    const row = dataStore.board_state_transitions[0] as { graph_data: { nodes: Array<{ listId: string }>; edges: Array<{ id: string }> } };
    expect(row.graph_data.nodes.map((node) => node.listId)).toEqual(['list-1']);
    expect(row.graph_data.edges).toEqual([]);
  });

  it('GET /rules and PUT return 501 when feature flag is disabled', async () => {
    stateTransitionsEnabled = false;

    const getRulesReq = new Request('http://localhost/api/v1/boards/board-1/state-transitions/rules', { method: 'GET' });
    const getRulesRes = await handleGetStateTransitionRules(getRulesReq, 'board-1');
    expect(getRulesRes.status).toBe(501);

    const putReq = new Request('http://localhost/api/v1/boards/board-1/state-transitions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    const putRes = await handlePutStateTransitions(putReq, 'board-1');
    expect(putRes.status).toBe(501);
  });
});
