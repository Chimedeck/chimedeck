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
let currentUserId = 'user-admin';

function resetStore(): DataStore {
  return {
    boards: [
      { id: 'board-source', workspace_id: 'ws-1' },
      { id: 'board-target', workspace_id: 'ws-1' },
    ],
    lists: [
      { id: 'src-list-1', board_id: 'board-source', title: 'Todo', position: 'a', archived: false },
      { id: 'src-list-2', board_id: 'board-source', title: 'Doing', position: 'b', archived: false },
      { id: 'src-list-3', board_id: 'board-source', title: 'Done', position: 'c', archived: false },
      { id: 'tgt-list-1', board_id: 'board-target', title: 'TODO', position: 'a', archived: false },
      { id: 'tgt-list-2', board_id: 'board-target', title: 'Doing', position: 'b', archived: false },
      { id: 'tgt-list-3', board_id: 'board-target', title: 'Done', position: 'c', archived: false },
    ],
    board_members: [
      { board_id: 'board-source', user_id: 'user-admin', role: 'ADMIN' },
      { board_id: 'board-target', user_id: 'user-admin', role: 'OWNER' },
    ],
    board_state_transitions: [
      {
        id: 'st-source',
        board_id: 'board-source',
        enabled: true,
        graph_data: {
          nodes: [
            { id: 'src-list-1', listId: 'src-list-1', label: 'Todo', positionX: 10, positionY: 20 },
            { id: 'src-list-2', listId: 'src-list-2', label: 'Doing', positionX: 30, positionY: 40 },
            { id: 'src-list-3', listId: 'src-list-3', label: 'Done', positionX: 50, positionY: 60 },
          ],
          edges: [
            {
              id: 'edge-1',
              fromNodeId: 'src-list-1',
              toNodeId: 'src-list-2',
              action: 'allowed_move_to',
              direction: 'one_way',
              style: 'curved',
            },
            {
              id: 'edge-2',
              fromNodeId: 'src-list-2',
              toNodeId: 'src-list-3',
              action: 'allowed_move_to',
              direction: 'one_way',
              style: 'straight',
            },
          ],
          notes: [{ id: 'note-1', content: 'copy me', positionX: 3, positionY: 4 }],
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
    req.currentUser = { id: currentUserId, email: 'admin@example.com' };
    return null;
  },
}));

mock.module('../../../../common/uuid', () => ({
  generateId: () => 'generated-st-id',
}));

const { handleCopyStateTransitions } = await import('../copy');

beforeEach(() => {
  stateTransitionsEnabled = true;
  currentUserId = 'user-admin';
  dataStore = resetStore();
});

describe('POST /api/v1/boards/:boardId/state-transitions/copy', () => {
  it('copies full graph to target board by case-insensitive list name match', async () => {
    const req = new Request('http://localhost/api/v1/boards/board-source/state-transitions/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetBoardId: 'board-target' }),
    });

    const res = await handleCopyStateTransitions(req, 'board-source');
    expect(res.status).toBe(200);
    const body = await res.json() as {
      data: {
        boardId: string;
        enabled: boolean;
        graph: {
          nodes: Array<{ id: string; listId: string; label: string }>;
          edges: Array<{ fromNodeId: string; toNodeId: string }>;
          notes: Array<{ id: string }>;
        };
        updatedAt: string;
      };
      metadata: {
        skippedNodes: number;
        copyEnabled: boolean;
      };
    };

    expect(body.data.boardId).toBe('board-target');
    expect(body.data.enabled).toBe(true);
    expect(body.data.graph.nodes.map((node) => node.id)).toEqual(['tgt-list-1', 'tgt-list-2', 'tgt-list-3']);
    expect(body.data.graph.nodes.map((node) => node.listId)).toEqual(['tgt-list-1', 'tgt-list-2', 'tgt-list-3']);
    expect(body.data.graph.nodes.map((node) => node.label)).toEqual(['TODO', 'Doing', 'Done']);
    expect(body.data.graph.edges).toMatchObject([
      { fromNodeId: 'tgt-list-1', toNodeId: 'tgt-list-2' },
      { fromNodeId: 'tgt-list-2', toNodeId: 'tgt-list-3' },
    ]);
    expect(body.data.graph.notes).toMatchObject([{ id: 'note-1' }]);
    expect(typeof body.data.updatedAt).toBe('string');
    expect(body.metadata).toEqual({ skippedNodes: 0, copyEnabled: true });

    const persisted = dataStore.board_state_transitions.find((row) => row.board_id === 'board-target') as {
      enabled: boolean;
      graph_data: {
        nodes: Array<{ id: string }>;
        edges: Array<{ fromNodeId: string; toNodeId: string }>;
      };
    } | undefined;
    expect(persisted).toBeDefined();
    expect(persisted?.enabled).toBe(true);
    expect(persisted?.graph_data.nodes.map((node) => node.id)).toEqual(['tgt-list-1', 'tgt-list-2', 'tgt-list-3']);
    expect(persisted?.graph_data.edges).toMatchObject([
      { fromNodeId: 'tgt-list-1', toNodeId: 'tgt-list-2' },
      { fromNodeId: 'tgt-list-2', toNodeId: 'tgt-list-3' },
    ]);
  });

  it('drops unmatched nodes and related edges when target board has partial list-name overlap', async () => {
    dataStore.lists = (dataStore.lists as Array<{ board_id: string; id: string; title: string }>).filter(
      (list) => list.board_id !== 'board-target' || list.id !== 'tgt-list-2',
    );

    const req = new Request('http://localhost/api/v1/boards/board-source/state-transitions/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetBoardId: 'board-target' }),
    });

    const res = await handleCopyStateTransitions(req, 'board-source');
    expect(res.status).toBe(200);
    const body = await res.json() as {
      data: {
        graph: {
          nodes: Array<{ id: string }>;
          edges: Array<{ id: string }>;
        };
      };
      metadata: {
        skippedNodes: number;
      };
    };

    expect(body.data.graph.nodes.map((node) => node.id)).toEqual(['tgt-list-1', 'tgt-list-3']);
    expect(body.data.graph.edges).toEqual([]);
    expect(body.metadata.skippedNodes).toBe(1);
  });

  it('keeps target enabled value unchanged when copyEnabled=false', async () => {
    dataStore.board_state_transitions.push({
      id: 'st-target',
      board_id: 'board-target',
      enabled: false,
      graph_data: { nodes: [], edges: [], notes: [] },
      updated_at: '2026-05-19T10:05:00.000Z',
    });

    const req = new Request('http://localhost/api/v1/boards/board-source/state-transitions/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetBoardId: 'board-target', copyEnabled: false }),
    });

    const res = await handleCopyStateTransitions(req, 'board-source');
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { enabled: boolean }; metadata: { copyEnabled: boolean } };
    expect(body.data.enabled).toBe(false);
    expect(body.metadata.copyEnabled).toBe(false);

    const persisted = dataStore.board_state_transitions.find((row) => row.board_id === 'board-target') as
      | { enabled: boolean }
      | undefined;
    expect(persisted?.enabled).toBe(false);
  });

  it('returns 422 when caller is not ADMIN/OWNER on the target board', async () => {
    const targetMembership = dataStore.board_members.find(
      (row) => row.board_id === 'board-target' && row.user_id === 'user-admin',
    ) as { role: string } | undefined;
    if (!targetMembership) throw new Error('missing target membership fixture');
    targetMembership.role = 'MEMBER';

    const req = new Request('http://localhost/api/v1/boards/board-source/state-transitions/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetBoardId: 'board-target' }),
    });

    const res = await handleCopyStateTransitions(req, 'board-source');
    expect(res.status).toBe(422);
    const body = await res.json() as { name: string; data: Record<string, unknown> };
    expect(body.name).toBe('state-transition-copy-insufficient-permission');
    expect(body.data).toEqual({});
  });

  it('returns 422 when source board has no transitions row', async () => {
    dataStore.board_state_transitions = dataStore.board_state_transitions.filter(
      (row) => row.board_id !== 'board-source',
    );

    const req = new Request('http://localhost/api/v1/boards/board-source/state-transitions/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetBoardId: 'board-target' }),
    });

    const res = await handleCopyStateTransitions(req, 'board-source');
    expect(res.status).toBe(422);
    const body = await res.json() as { name: string; data: Record<string, unknown> };
    expect(body.name).toBe('state-transition-copy-no-source');
    expect(body.data).toEqual({});
  });
});
