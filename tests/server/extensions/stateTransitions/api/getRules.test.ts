import { beforeEach, describe, expect, it, mock } from 'bun:test';

type Row = Record<string, unknown>;
type DataStore = {
  boards: Row[];
  lists: Row[];
  memberships: Row[];
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

  insert(payload: Row | Row[]): { returning: (columns: string | string[]) => Promise<Row[]> } {
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
    boards: [{ id: 'board-1', workspace_id: 'ws-1', state: 'ACTIVE' }],
    lists: [
      { id: 'list-1', board_id: 'board-1', title: 'Todo', position: 'a', archived: false },
      { id: 'list-2', board_id: 'board-1', title: 'Doing', position: 'b', archived: false },
      { id: 'list-3', board_id: 'board-1', title: 'Done', position: 'c', archived: false },
    ],
    memberships: [{ user_id: 'user-1', workspace_id: 'ws-1', role: 'MEMBER' }],
    board_state_transitions: [],
  };
}

mock.module('../../../../../server/config/featureFlags', () => ({
  featureFlags: {
    get STATE_TRANSITIONS_ENABLED() {
      return stateTransitionsEnabled;
    },
  },
}));

mock.module('../../../../../server/common/db', () => ({
  db: ((tableName: keyof DataStore) => new QueryBuilder(dataStore, tableName)) as unknown as typeof import('../../../../../server/common/db').db,
}));

mock.module('../../../../../server/extensions/auth/middlewares/authentication', () => ({
  authenticate: async (req: Request & { currentUser?: { id: string; email: string } }) => {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (authHeader === 'Bearer test-token') {
      req.currentUser = { id: 'user-1', email: 'user@example.com' };
      return null;
    }
    return Response.json({ error: { code: 'unauthorized', message: 'Missing or invalid token' } }, { status: 401 });
  },
}));

mock.module('../../../../../server/mods/pubsub/publisher', () => ({
  publisher: {
    publish: async () => {},
  },
}));

const { handleGetStateTransitionRules } = await import('../../../../../server/extensions/stateTransitions/api/getRules');
const { clearRulesCache } = await import('../../../../../server/extensions/stateTransitions/enforcement/rules');

beforeEach(() => {
  stateTransitionsEnabled = true;
  dataStore = resetStore();
  clearRulesCache();
});

describe('GET /api/v1/boards/:boardId/state-transitions/rules', () => {
  it('returns 501 when feature flag is disabled', async () => {
    stateTransitionsEnabled = false;
    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions/rules', {
      method: 'GET',
      headers: { Authorization: 'Bearer test-token' },
    });

    const res = await handleGetStateTransitionRules(req, 'board-1');
    expect(res.status).toBe(501);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('not-implemented');
  });

  it('returns empty rules when graph has no edges', async () => {
    dataStore.board_state_transitions.push({
      id: 'st-1',
      board_id: 'board-1',
      enabled: true,
      graph_data: {
        nodes: [
          { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 10, positionY: 20 },
          { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 20, positionY: 20 },
        ],
        edges: [],
        notes: [],
      },
    });

    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions/rules', {
      method: 'GET',
      headers: { Authorization: 'Bearer test-token' },
    });
    const res = await handleGetStateTransitionRules(req, 'board-1');
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { rules: unknown[] } };
    expect(body.data.rules).toEqual([]);
  });

  it('derives allowed and forbidden states from edges', async () => {
    dataStore.board_state_transitions.push({
      id: 'st-1',
      board_id: 'board-1',
      enabled: true,
      graph_data: {
        nodes: [
          { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 10, positionY: 20 },
          { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 20, positionY: 20 },
          { id: 'list-3', listId: 'list-3', label: 'Done', positionX: 30, positionY: 20 },
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

    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions/rules', {
      method: 'GET',
      headers: { Authorization: 'Bearer test-token' },
    });
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

  it('returns 422 for invalid persisted graph payload', async () => {
    dataStore.board_state_transitions.push({
      id: 'st-2',
      board_id: 'board-1',
      enabled: true,
      graph_data: {},
    });

    const req = new Request('http://localhost/api/v1/boards/board-1/state-transitions/rules', {
      method: 'GET',
      headers: { Authorization: 'Bearer test-token' },
    });
    const res = await handleGetStateTransitionRules(req, 'board-1');
    expect(res.status).toBe(422);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('state-transition-graph-invalid');
  });
});
