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
let workspaceMembershipError: Response | null = null;

function resetStore(): DataStore {
  return {
    boards: [{ id: 'board-1', workspace_id: 'ws-1' }],
    lists: [
      { id: 'list-1', board_id: 'board-1', title: 'Todo', position: 'a', archived: false },
      { id: 'list-2', board_id: 'board-1', title: 'Doing', position: 'b', archived: false },
      { id: 'list-3', board_id: 'board-1', title: 'Done', position: 'c', archived: false },
      { id: 'list-4', board_id: 'board-1', title: 'Blocked', position: 'd', archived: false },
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
  requireWorkspaceMembership: async () => workspaceMembershipError,
}));

mock.module('../../../../common/uuid', () => ({
  generateId: () => 'state-transition-1',
}));

const { handleGetStateTransitionRules } = await import('../getRules');

beforeEach(() => {
  stateTransitionsEnabled = true;
  dataStore = resetStore();
  workspaceMembershipError = null;
});

describe('GET /api/v1/boards/:boardId/state-transitions/rules', () => {
  it('returns 501 when feature flag is off', async () => {
    stateTransitionsEnabled = false;

    const res = await handleGetStateTransitionRules(
      new Request('http://localhost/api/v1/boards/board-1/state-transitions/rules', { method: 'GET' }),
      'board-1',
    );

    expect(res.status).toBe(501);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('not-implemented');
  });

  it('returns workspace membership error when caller is forbidden', async () => {
    workspaceMembershipError = Response.json(
      { name: 'forbidden', data: { message: 'Not a board member' } },
      { status: 403 },
    );

    const res = await handleGetStateTransitionRules(
      new Request('http://localhost/api/v1/boards/board-1/state-transitions/rules', { method: 'GET' }),
      'board-1',
    );

    expect(res.status).toBe(403);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('forbidden');
  });

  it('returns empty rules array when graph has no outgoing edges', async () => {
    dataStore.board_state_transitions.push({
      id: 'st-1',
      board_id: 'board-1',
      enabled: true,
      graph_data: {
        nodes: [
          { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 10, positionY: 20 },
          { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 30, positionY: 40 },
        ],
        edges: [],
        notes: [],
      },
    });

    const res = await handleGetStateTransitionRules(
      new Request('http://localhost/api/v1/boards/board-1/state-transitions/rules', { method: 'GET' }),
      'board-1',
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { rules: unknown[] } };
    expect(body.data.rules).toEqual([]);
  });

  it('derives allowed and forbidden transitions from one-way and two-way edges', async () => {
    dataStore.board_state_transitions.push({
      id: 'st-1',
      board_id: 'board-1',
      enabled: true,
      graph_data: {
        nodes: [
          { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 10, positionY: 20 },
          { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 20, positionY: 20 },
          { id: 'list-3', listId: 'list-3', label: 'Done', positionX: 30, positionY: 20 },
          { id: 'list-4', listId: 'list-4', label: 'Blocked', positionX: 40, positionY: 20 },
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
          {
            id: 'edge-2',
            fromNodeId: 'list-3',
            toNodeId: 'list-1',
            action: 'allowed_move_to',
            direction: 'two_way',
            style: 'straight',
          },
        ],
        notes: [],
      },
    });

    const res = await handleGetStateTransitionRules(
      new Request('http://localhost/api/v1/boards/board-1/state-transitions/rules', { method: 'GET' }),
      'board-1',
    );

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

    expect(body.data.rules).toHaveLength(2);
    const ruleFromTodo = body.data.rules.find((rule) => rule.current_state_id === 'list-1');
    const ruleFromDone = body.data.rules.find((rule) => rule.current_state_id === 'list-3');

    expect(ruleFromTodo).toBeDefined();
    expect(ruleFromDone).toBeDefined();
    expect((ruleFromTodo?.allowed_next_state_ids ?? []).sort()).toEqual(['list-2', 'list-3']);
    expect((ruleFromTodo?.forbidden_next_state_ids ?? []).sort()).toEqual(['list-4']);
    expect((ruleFromDone?.allowed_next_state_ids ?? []).sort()).toEqual(['list-1']);
    expect((ruleFromDone?.forbidden_next_state_ids ?? []).sort()).toEqual(['list-2', 'list-4']);
  });

  it('normalizes rule IDs to listId values even when node IDs differ', async () => {
    dataStore.board_state_transitions.push({
      id: 'st-2',
      board_id: 'board-1',
      enabled: true,
      graph_data: {
        nodes: [
          { id: 'node-a', listId: 'list-1', label: 'Todo', positionX: 10, positionY: 20 },
          { id: 'node-b', listId: 'list-2', label: 'Doing', positionX: 20, positionY: 20 },
          { id: 'node-c', listId: 'list-3', label: 'Done', positionX: 30, positionY: 20 },
        ],
        edges: [
          {
            id: 'edge-3',
            fromNodeId: 'node-a',
            toNodeId: 'node-b',
            action: 'allowed_move_to',
            direction: 'one_way',
            style: 'curved',
          },
        ],
        notes: [],
      },
    });

    const res = await handleGetStateTransitionRules(
      new Request('http://localhost/api/v1/boards/board-1/state-transitions/rules', { method: 'GET' }),
      'board-1',
    );
    expect(res.status).toBe(200);
    const body = await res.json() as {
      data: {
        rules: Array<{ current_state_id: string; allowed_next_state_ids: string[] }>;
      };
    };

    expect(body.data.rules).toHaveLength(1);
    expect(body.data.rules[0]).toMatchObject({
      current_state_id: 'list-1',
      allowed_next_state_ids: ['list-2'],
    });
  });

  it('ignores deleted nodes and relabels renamed nodes in normalized rules output', async () => {
    dataStore.lists = [
      { id: 'list-1', board_id: 'board-1', title: 'Todo renamed', position: 'a', archived: false },
      { id: 'list-2', board_id: 'board-1', title: 'Doing', position: 'b', archived: false },
      { id: 'list-3', board_id: 'board-1', title: 'Done', position: 'c', archived: false },
    ];

    dataStore.board_state_transitions.push({
      id: 'st-3',
      board_id: 'board-1',
      enabled: true,
      graph_data: {
        nodes: [
          { id: 'list-1', listId: 'list-1', label: 'Todo old', positionX: 10, positionY: 20 },
          { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 20, positionY: 20 },
          { id: 'list-deleted', listId: 'list-deleted', label: 'Deleted', positionX: 30, positionY: 20 },
        ],
        edges: [
          {
            id: 'edge-4',
            fromNodeId: 'list-1',
            toNodeId: 'list-2',
            action: 'allowed_move_to',
            direction: 'one_way',
            style: 'curved',
          },
          {
            id: 'edge-5',
            fromNodeId: 'list-1',
            toNodeId: 'list-deleted',
            action: 'allowed_move_to',
            direction: 'one_way',
            style: 'curved',
          },
        ],
        notes: [],
      },
    });

    const res = await handleGetStateTransitionRules(
      new Request('http://localhost/api/v1/boards/board-1/state-transitions/rules', { method: 'GET' }),
      'board-1',
    );

    expect(res.status).toBe(200);
    const body = await res.json() as {
      data: {
        rules: Array<{
          current_state: string;
          current_state_id: string;
          allowed_next_states: string[];
          allowed_next_state_ids: string[];
          forbidden_next_states: string[];
          forbidden_next_state_ids: string[];
        }>;
      };
    };

    expect(body.data.rules).toEqual([
      {
        current_state: 'Todo renamed',
        current_state_id: 'list-1',
        allowed_next_states: ['Doing'],
        allowed_next_state_ids: ['list-2'],
        forbidden_next_states: [],
        forbidden_next_state_ids: [],
      },
    ]);
  });

  it('returns 422 for invalid persisted graph payload', async () => {
    dataStore.board_state_transitions.push({
      id: 'st-cache',
      board_id: 'board-1',
      enabled: true,
      graph_data: {
        nodes: [],
      },
    });

    const res = await handleGetStateTransitionRules(
      new Request('http://localhost/api/v1/boards/board-1/state-transitions/rules', { method: 'GET' }),
      'board-1',
    );
    expect(res.status).toBe(422);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('state-transition-graph-invalid');
  });
});
