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
const emitCardMoveBlockedActivityMock = mock(async () => null);

function makeGraph({
  edges,
}: {
  edges: Array<{
    id: string;
    fromNodeId: string;
    toNodeId: string;
    action: 'allowed_move_to';
    direction: 'one_way' | 'two_way';
    style: 'straight' | 'curved';
  }>;
}) {
  return {
    nodes: [
      { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 10, positionY: 10 },
      { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 20, positionY: 10 },
      { id: 'list-3', listId: 'list-3', label: 'Done', positionX: 30, positionY: 10 },
    ],
    edges,
    notes: [],
  };
}

function resetStore(): DataStore {
  return {
    lists: [
      { id: 'list-1', board_id: 'board-1', title: 'Todo', position: 'a', archived: false },
      { id: 'list-2', board_id: 'board-1', title: 'Doing', position: 'b', archived: false },
      { id: 'list-3', board_id: 'board-1', title: 'Done', position: 'c', archived: false },
    ],
    board_state_transitions: [
      {
        id: 'st-1',
        board_id: 'board-1',
        enabled: true,
        graph_data: makeGraph({
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
        }),
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

mock.module('../../common/activityLog', () => ({
  emitCardMoveBlockedActivity: emitCardMoveBlockedActivityMock,
}));

const { validateCardMove } = await import('..');
const { clearRulesCache, invalidateRulesCacheForBoard } = await import('../rules');

beforeEach(() => {
  stateTransitionsEnabled = true;
  dataStore = resetStore();
  clearRulesCache();
  emitCardMoveBlockedActivityMock.mockClear();
});

describe('state transition card-move enforcement', () => {
  it('allows move when destination is listed in allowed transitions', async () => {
    await expect(
      validateCardMove({ boardId: 'board-1', fromListId: 'list-1', toListId: 'list-2' }),
    ).resolves.toBeUndefined();
  });

  it('blocks move to forbidden list and returns allowedNextStates', async () => {
    const promise = validateCardMove({
      boardId: 'board-1',
      fromListId: 'list-1',
      toListId: 'list-3',
      cardId: 'card-1',
      actorId: 'user-1',
    });

    await expect(promise).rejects.toBeInstanceOf(StateTransitionForbiddenError);
    await expect(promise).rejects.toMatchObject({
      boardId: 'board-1',
      fromListId: 'list-1',
      toListId: 'list-3',
      allowedNextStates: [{ id: 'list-2', name: 'Doing' }],
    });
    expect(emitCardMoveBlockedActivityMock).toHaveBeenCalledTimes(1);
    expect(emitCardMoveBlockedActivityMock).toHaveBeenCalledWith({
      cardId: 'card-1',
      boardId: 'board-1',
      actorId: 'user-1',
      fromListId: 'list-1',
      fromListName: 'Todo',
      toListId: 'list-3',
      toListName: 'Done',
      ipAddress: undefined,
      userAgent: undefined,
    });
  });

  it('always allows same-list reorder', async () => {
    dataStore.board_state_transitions[0] = {
      ...(dataStore.board_state_transitions[0] as Row),
      graph_data: makeGraph({ edges: [] }),
    };
    clearRulesCache();

    await expect(
      validateCardMove({ boardId: 'board-1', fromListId: 'list-1', toListId: 'list-1' }),
    ).resolves.toBeUndefined();
  });

  it('blocks all outgoing moves from node with no outgoing edges', async () => {
    dataStore.board_state_transitions[0] = {
      ...(dataStore.board_state_transitions[0] as Row),
      graph_data: makeGraph({ edges: [] }),
    };
    clearRulesCache();

    const promise = validateCardMove({
      boardId: 'board-1',
      fromListId: 'list-1',
      toListId: 'list-2',
    });
    await expect(promise).rejects.toBeInstanceOf(StateTransitionForbiddenError);
    await expect(promise).rejects.toMatchObject({ allowedNextStates: [] });
  });

  it('is a no-op when board-level enforcement is disabled', async () => {
    dataStore.board_state_transitions[0] = {
      ...(dataStore.board_state_transitions[0] as Row),
      enabled: false,
      graph_data: makeGraph({ edges: [] }),
    };
    clearRulesCache();

    await expect(
      validateCardMove({ boardId: 'board-1', fromListId: 'list-1', toListId: 'list-2' }),
    ).resolves.toBeUndefined();
  });

  it('is a no-op when feature flag is disabled', async () => {
    stateTransitionsEnabled = false;
    await expect(
      validateCardMove({ boardId: 'board-1', fromListId: 'list-1', toListId: 'list-3' }),
    ).resolves.toBeUndefined();
  });

  it('uses fresh rules after cache invalidation', async () => {
    await expect(
      validateCardMove({ boardId: 'board-1', fromListId: 'list-1', toListId: 'list-2' }),
    ).resolves.toBeUndefined();

    dataStore.board_state_transitions[0] = {
      ...(dataStore.board_state_transitions[0] as Row),
      graph_data: makeGraph({
        edges: [
          {
            id: 'edge-2',
            fromNodeId: 'list-1',
            toNodeId: 'list-3',
            action: 'allowed_move_to',
            direction: 'one_way',
            style: 'curved',
          },
        ],
      }),
    };

    // Still allowed while cached snapshot is active.
    await expect(
      validateCardMove({ boardId: 'board-1', fromListId: 'list-1', toListId: 'list-2' }),
    ).resolves.toBeUndefined();

    invalidateRulesCacheForBoard('board-1');

    await expect(
      validateCardMove({ boardId: 'board-1', fromListId: 'list-1', toListId: 'list-2' }),
    ).rejects.toBeInstanceOf(StateTransitionForbiddenError);

    await expect(
      validateCardMove({ boardId: 'board-1', fromListId: 'list-1', toListId: 'list-3' }),
    ).resolves.toBeUndefined();
  });
});
