import { beforeEach, describe, expect, it, mock } from 'bun:test';

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

function makeGraph(withEdge: boolean) {
  return {
    nodes: [
      { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 10, positionY: 20 },
      { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 30, positionY: 20 },
    ],
    edges: withEdge
      ? [
        {
          id: 'edge-1',
          fromNodeId: 'list-1',
          toNodeId: 'list-2',
          action: 'allowed_move_to',
          direction: 'one_way',
          style: 'curved',
        },
      ]
      : [],
    notes: [],
  };
}

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
        enabled: true,
        graph_data: makeGraph(true),
      },
    ],
  };
}

mock.module('../../../../common/db', () => ({
  db: ((tableName: keyof DataStore) => new QueryBuilder(dataStore, tableName)) as unknown as typeof import('../../../../common/db').db,
}));

const { clearRulesCache, getRulesForBoard, invalidateRulesCacheFromStateTransitionEvent } = await import('../rules');

beforeEach(() => {
  dataStore = resetStore();
  clearRulesCache();
});

describe('state transition rules cache', () => {
  it('returns stale cached rules until state_transition_updated invalidation', async () => {
    const initial = await getRulesForBoard('board-1');
    expect(initial.allowedNextStatesByListId.get('list-1')).toEqual([{ id: 'list-2', name: 'Doing' }]);

    dataStore.board_state_transitions[0] = {
      ...(dataStore.board_state_transitions[0] as Row),
      graph_data: makeGraph(false),
    };

    const cached = await getRulesForBoard('board-1');
    expect(cached.allowedNextStatesByListId.get('list-1')).toEqual([{ id: 'list-2', name: 'Doing' }]);

    invalidateRulesCacheFromStateTransitionEvent({
      type: 'state_transition_updated',
      board_id: 'board-1',
    });

    const refreshed = await getRulesForBoard('board-1');
    expect(refreshed.allowedNextStatesByListId.get('list-1')).toBeUndefined();
  });
});
