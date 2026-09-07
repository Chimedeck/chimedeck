import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { StateTransitionGraph } from '../types';

type Row = Record<string, unknown>;
type DataStore = {
  lists: Row[];
  cards: Row[];
  board_state_transitions: Array<{
    board_id: string;
    graph_data: StateTransitionGraph;
    updated_at: string;
  }>;
};

class QueryBuilder {
  private filters: Array<(row: Row) => boolean> = [];
  private selectedColumns: string[] | null = null;
  private orderedBy: string | null = null;
  private orderDirection: 'asc' | 'desc' = 'asc';
  private countAlias: string | null = null;

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

  count(aliasExpression: string): QueryBuilder {
    this.countAlias = aliasExpression.split(' as ')[1] ?? 'count';
    return this;
  }

  async first(): Promise<Row | undefined> {
    if (this.countAlias) {
      const rows = (this.store[this.tableName] as Row[]).filter((row) =>
        this.filters.every((predicate) => predicate(row)),
      );
      return { [this.countAlias]: rows.length };
    }
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

  async del(): Promise<number> {
    const table = this.store[this.tableName] as Row[];
    const before = table.length;
    const filtered = table.filter((row) => !this.filters.every((predicate) => predicate(row)));
    table.splice(0, table.length, ...filtered);
    return before - filtered.length;
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

function resetStore(): DataStore {
  return {
    lists: [
      { id: 'list-1', board_id: 'board-1', title: 'Todo', position: 'a', archived: false },
      { id: 'list-2', board_id: 'board-1', title: 'Doing', position: 'b', archived: false },
      { id: 'list-3', board_id: 'board-1', title: 'Done', position: 'c', archived: false },
    ],
    cards: [],
    board_state_transitions: [
      {
        board_id: 'board-1',
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
            {
              id: 'edge-2',
              fromNodeId: 'list-2',
              toNodeId: 'list-3',
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
  requireRole: () => null,
}));

mock.module('../../../board/middlewares/requireBoardWritable', () => ({
  requireBoardWritable: async (req: Request & { board?: { id: string; workspace_id: string } }, boardId: string) => {
    req.board = { id: boardId, workspace_id: 'ws-1' };
    return null;
  },
}));

mock.module('../../../../mods/events/write', () => ({
  writeEvent: async () => null,
}));

mock.module('../../../../common/sanitize', () => ({
  sanitizeText: (value: string) => value,
}));

mock.module('../../../../config/featureFlags', () => ({
  featureFlags: {
    STATE_TRANSITIONS_ENABLED: true,
  },
}));

const { handleUpdateList } = await import('../../../list/api/update');
const { handleDeleteList } = await import('../../../list/api/delete');

beforeEach(() => {
  dataStore = resetStore();
});

describe('state transitions list sync hooks', () => {
  it('updates node labels when a list is renamed', async () => {
    const req = new Request('http://localhost/api/v1/lists/list-2', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'In Progress' }),
    });

    const res = await handleUpdateList(req, 'list-2');
    expect(res.status).toBe(200);

    const node = dataStore.board_state_transitions[0]?.graph_data.nodes.find(
      (entry) => entry.id === 'list-2',
    );
    expect(node?.label).toBe('In Progress');
  });

  it('removes node and related edges when a list is deleted', async () => {
    const req = new Request('http://localhost/api/v1/lists/list-2', {
      method: 'DELETE',
    });

    const res = await handleDeleteList(req, 'list-2');
    expect(res.status).toBe(204);

    const graph = dataStore.board_state_transitions[0]?.graph_data;
    expect(graph).toBeDefined();
    if (!graph) throw new Error('expected graph_data to be defined');
    expect(graph.nodes.some((node) => node.id === 'list-2')).toBe(false);
    expect(graph.edges.some((edge) => edge.fromNodeId === 'list-2' || edge.toNodeId === 'list-2')).toBe(false);
  });
});
