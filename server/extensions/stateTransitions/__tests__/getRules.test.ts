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
    for (const row of inserted) (this.store[this.tableName] as Row[]).push(row);
    return {
      returning: async () => inserted.map((row) => ({ ...row })),
    };
  }

  async update(patch: Row, returning?: string[]): Promise<Row[] | number> {
    const rows = this.executeSync(false);
    for (const row of rows) Object.assign(row, patch);
    if (returning && returning.length > 0) return rows.map((row) => ({ ...row }));
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

let dataStore: DataStore;

function resetStore(): DataStore {
  return {
    boards: [{ id: 'board-1', workspace_id: 'ws-1' }],
    lists: [
      { id: 'list-1', board_id: 'board-1', title: 'Todo', position: 'a', archived: false },
      { id: 'list-2', board_id: 'board-1', title: 'Doing', position: 'b', archived: false },
      { id: 'list-3', board_id: 'board-1', title: 'Done', position: 'c', archived: false },
    ],
    board_state_transitions: [],
  };
}

mock.module('../../../config/featureFlags', () => ({
  featureFlags: {
    STATE_TRANSITIONS_ENABLED: true,
  },
}));

mock.module('../../../common/db', () => ({
  db: ((tableName: keyof DataStore) => new QueryBuilder(dataStore, tableName)) as unknown as typeof import('../../../common/db').db,
}));

mock.module('../../auth/middlewares/authentication', () => ({
  authenticate: async (req: Request & { currentUser?: { id: string; email: string } }) => {
    req.currentUser = { id: 'user-1', email: 'user@example.com' };
    return null;
  },
}));

mock.module('../../../middlewares/permissionManager', () => ({
  requireWorkspaceMembership: async () => null,
}));

mock.module('../../../common/uuid', () => ({
  generateId: () => 'state-transition-1',
}));

const { handleGetStateTransitionRules } = await import('../api/getRules');

beforeEach(() => {
  dataStore = resetStore();
});

describe('GET state transition rules', () => {
  it('returns empty rules when graph has no edges', async () => {
    dataStore.board_state_transitions.push({
      id: 'st-1',
      board_id: 'board-1',
      enabled: true,
      graph_data: {
        nodes: [
          { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 10, positionY: 20 },
          { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 30, positionY: 20 },
        ],
        edges: [],
        notes: [],
      },
    });

    const res = await handleGetStateTransitionRules(
      new Request('http://localhost/api/v1/boards/board-1/state-transitions/rules'),
      'board-1',
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { rules: unknown[] } };
    expect(body.data.rules).toEqual([]);
  });

  it('returns normalized allowed and forbidden state ids from edges', async () => {
    dataStore.board_state_transitions.push({
      id: 'st-2',
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

    const res = await handleGetStateTransitionRules(
      new Request('http://localhost/api/v1/boards/board-1/state-transitions/rules'),
      'board-1',
    );
    expect(res.status).toBe(200);
    const body = await res.json() as {
      data: {
        rules: Array<{
          currentStateId: string;
          allowedNextStateIds: string[];
          forbiddenNextStateIds: string[];
        }>;
      };
    };
    expect(body.data.rules).toHaveLength(1);
    expect(body.data.rules[0]).toMatchObject({
      currentStateId: 'list-1',
      allowedNextStateIds: ['list-2'],
      forbiddenNextStateIds: ['list-3'],
    });
  });
});
