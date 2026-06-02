import { describe, expect, it, mock } from 'bun:test';

type TableName = 'boards' | 'cards' | 'lists';

const boardRows = new Map<string, { workspace_id: string }>([
  ['board-1', { workspace_id: 'ws-1' }],
  ['board-2', { workspace_id: 'ws-2' }],
]);
const cardRows = new Map<string, { list_id: string }>([['card-1', { list_id: 'list-1' }]]);
const listRows = new Map<string, { board_id: string }>([['list-1', { board_id: 'board-1' }]]);

class QueryBuilder {
  private id: string | null = null;

  constructor(private readonly table: TableName) {}

  where(criteria: { id: string }): QueryBuilder {
    this.id = criteria.id;
    return this;
  }

  select(_column: string): QueryBuilder {
    return this;
  }

  async first<T>(): Promise<T | undefined> {
    if (!this.id) return undefined;
    if (this.table === 'boards') return boardRows.get(this.id) as T | undefined;
    if (this.table === 'cards') return cardRows.get(this.id) as T | undefined;
    return listRows.get(this.id) as T | undefined;
  }
}

mock.module('../../../server/common/db', () => ({
  db: ((table: TableName) => new QueryBuilder(table)) as unknown as typeof import('../../../server/common/db').db,
}));

const {
  resolveRequestWorkspaceContext,
  resolveRequestWorkspaceId,
} = await import('../../../server/common/requestContext');

describe('requestContext', () => {
  it('returns the workspace id directly from workspace-scoped routes', async () => {
    const workspaceId = await resolveRequestWorkspaceId('/api/v1/workspaces/ws-1/boards');
    const context = await resolveRequestWorkspaceContext('/api/v1/workspaces/ws-1/boards');

    expect(workspaceId).toBe('ws-1');
    expect(context.workspaceId).toBe('ws-1');
  });

  it('resolves workspace context through board and card lookups', async () => {
    expect(await resolveRequestWorkspaceId('/api/v1/boards/board-1')).toBe('ws-1');
    expect(await resolveRequestWorkspaceId('/api/v1/cards/card-1')).toBe('ws-1');
  });
});
