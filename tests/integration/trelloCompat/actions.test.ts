import { beforeEach, describe, expect, it, mock } from 'bun:test';

type Row = Record<string, unknown>;
type DataStore = {
  users: Row[];
  memberships: Row[];
  workspaces: Row[];
  boards: Row[];
  board_members: Row[];
  board_guest_access: Row[];
  lists: Row[];
  cards: Row[];
  labels: Row[];
  card_labels: Row[];
  card_members: Row[];
  checklists: Row[];
  checklist_items: Row[];
  comments: Row[];
  activities: Row[];
  attachments: Row[];
  comment_reactions: Row[];
};

class QueryBuilder {
  private filters: Array<(row: Row) => boolean> = [];
  private orderByField: string | null = null;
  private orderByDirection: 'asc' | 'desc' = 'asc';
  private pickedColumns: string[] | null = null;

  constructor(private readonly store: DataStore, private readonly tableName: keyof DataStore) {}

  where(criteria: Row): QueryBuilder {
    this.filters.push((row) => Object.entries(criteria).every(([key, value]) => row[key] === value));
    return this;
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): QueryBuilder {
    this.orderByField = field;
    this.orderByDirection = direction;
    return this;
  }

  select(...columns: string[]): QueryBuilder {
    this.pickedColumns = columns.length > 0 ? columns : null;
    return this;
  }

  async first(): Promise<Row | undefined> {
    const rows = await this.execute();
    return rows[0];
  }

  async insert(payload: Row | Row[]): Promise<void> {
    const rows = Array.isArray(payload) ? payload : [payload];
    for (const row of rows) {
      (this.store[this.tableName] as Row[]).push({ ...row });
    }
  }

  async update(patch: Row): Promise<number> {
    const rows = this.executeSync(false);
    rows.forEach((row) => Object.assign(row, patch));
    return rows.length;
  }

  async delete(): Promise<number> {
    const rows = this.store[this.tableName] as Row[];
    const before = rows.length;
    const keep = rows.filter((row) => !this.filters.every((filter) => filter(row)));
    this.store[this.tableName] = keep;
    return before - keep.length;
  }

  then<TResult1 = Row[], TResult2 = never>(
    onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private executeSync(clone = true): Row[] {
    const source = this.store[this.tableName] as Row[];
    let rows = source.filter((row) => this.filters.every((filter) => filter(row)));
    if (this.orderByField) {
      const field = this.orderByField;
      const factor = this.orderByDirection === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const left = a[field];
        const right = b[field];
        if (left === right) return 0;
        if (left === undefined || left === null) return -1 * factor;
        if (right === undefined || right === null) return 1 * factor;
        return String(left) > String(right) ? factor : -1 * factor;
      });
    }

    if (this.pickedColumns) {
      rows = rows.map((row) => {
        const next: Row = {};
        this.pickedColumns!.forEach((column) => {
          next[column] = row[column];
        });
        return next;
      });
    }
    return clone ? rows.map((row) => ({ ...row })) : rows;
  }

  private async execute(): Promise<Row[]> {
    return this.executeSync();
  }
}

function createStore(): DataStore {
  return {
    users: [
      { id: 'user-admin', email: 'admin@example.com', name: 'Admin User', avatar_url: null },
      { id: 'user-member', email: 'member@example.com', name: 'Member User', avatar_url: null },
      { id: 'user-other', email: 'other@example.com', name: 'Other User', avatar_url: null },
    ],
    memberships: [
      { user_id: 'user-admin', workspace_id: 'ws-1', role: 'OWNER' },
      { user_id: 'user-member', workspace_id: 'ws-1', role: 'MEMBER' },
      { user_id: 'user-other', workspace_id: 'ws-1', role: 'MEMBER' },
    ],
    workspaces: [{ id: 'ws-1', name: 'Workspace One', owner_id: 'user-admin' }],
    boards: [{ id: 'board-1', workspace_id: 'ws-1', title: 'Board One', description: 'board', state: 'ACTIVE', visibility: 'PRIVATE' }],
    board_members: [
      { id: 'bm-1', board_id: 'board-1', user_id: 'user-admin', role: 'ADMIN' },
      { id: 'bm-2', board_id: 'board-1', user_id: 'user-member', role: 'MEMBER' },
      { id: 'bm-3', board_id: 'board-1', user_id: 'user-other', role: 'MEMBER' },
    ],
    board_guest_access: [],
    lists: [{ id: 'list-1', board_id: 'board-1', title: 'Todo', archived: false, position: 'a', color: null }],
    cards: [{ id: 'card-1', short_id: 'card0001', list_id: 'list-1', title: 'Card One', archived: false, position: 'a', created_at: new Date('2026-01-01T00:00:00.000Z').toISOString(), updated_at: new Date('2026-01-01T00:00:00.000Z').toISOString() }],
    labels: [],
    card_labels: [],
    card_members: [],
    checklists: [],
    checklist_items: [],
    comments: [
      {
        id: 'comment-1',
        short_id: 'comm0001',
        card_id: 'card-1',
        user_id: 'user-admin',
        content: 'Initial comment',
        version: 1,
        deleted: false,
        created_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        updated_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      },
    ],
    activities: [
      {
        id: 'activity-1',
        short_id: 'acti0001',
        entity_type: 'card',
        entity_id: 'card-1',
        board_id: 'board-1',
        actor_id: 'user-admin',
        action: 'card_updated',
        payload: { from: 'A', to: 'B' },
        created_at: new Date('2026-01-01T01:00:00.000Z').toISOString(),
      },
    ],
    attachments: [],
    comment_reactions: [],
  };
}

let dataStore = createStore();

const authenticateMock = mock(async (req: Request & { currentUser?: unknown }) => {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (token === 'hf_admin_token') {
    req.currentUser = { id: 'user-admin', email: 'admin@example.com', name: 'Admin User' };
    return null;
  }
  if (token === 'hf_member_token') {
    req.currentUser = { id: 'user-member', email: 'member@example.com', name: 'Member User' };
    return null;
  }
  if (token === 'hf_other_token') {
    req.currentUser = { id: 'user-other', email: 'other@example.com', name: 'Other User' };
    return null;
  }
  return Response.json({ error: { code: 'unauthorized', message: 'Invalid API token' } }, { status: 401 });
});

mock.module('../../../server/extensions/auth/middlewares/authentication', () => ({
  authenticate: authenticateMock,
}));

mock.module('../../../server/common/db', () => ({
  db: ((tableName: keyof DataStore) => new QueryBuilder(dataStore, tableName)) as unknown as typeof import('../../../server/common/db').db,
}));

mock.module('../../../server/common/ids/resolveEntityId', () => ({
  resolveCardId: async (identifier: string) => {
    const found = dataStore.cards.find((row) => row.id === identifier || row.short_id === identifier);
    return (found?.id as string | undefined) ?? null;
  },
  resolveBoardId: async (identifier: string) => {
    const found = dataStore.boards.find((row) => row.id === identifier || row.short_id === identifier);
    return (found?.id as string | undefined) ?? null;
  },
  resolveListId: async (identifier: string) => {
    const found = dataStore.lists.find((row) => row.id === identifier || row.short_id === identifier);
    return (found?.id as string | undefined) ?? null;
  },
}));

const { trelloCompatRouter } = await import('../../../server/extensions/trelloCompat/api/index');

beforeEach(() => {
  Bun.env['TRELLO_COMPAT_ENABLED'] = 'true';
  dataStore = createStore();
  authenticateMock.mockClear();
});

describe('trelloCompat actions', () => {
  it('GET /actions/{commentId} returns type=commentCard with data.text', async () => {
    const req = new Request('http://localhost/trello/1/actions/comment-1', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const res = await trelloCompatRouter(req, '/trello/1/actions/comment-1');
    expect(res?.status).toBe(200);
    const body = await res!.json() as { type: string; data: { text: string } };
    expect(body.type).toBe('commentCard');
    expect(body.data.text).toBe('Initial comment');
  });

  it('GET /actions/{activityId} returns mapped Trello action type', async () => {
    const req = new Request('http://localhost/trello/1/actions/activity-1', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const res = await trelloCompatRouter(req, '/trello/1/actions/activity-1');
    expect(res?.status).toBe(200);
    const body = await res!.json() as { type: string };
    expect(body.type).toBe('updateCard');
  });

  it('PUT /actions/{id}/text updates comment if caller is author', async () => {
    const req = new Request('http://localhost/trello/1/actions/comment-1/text', {
      method: 'PUT',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ value: 'Updated comment' }),
    });
    const res = await trelloCompatRouter(req, '/trello/1/actions/comment-1/text');
    expect(res?.status).toBe(200);
    const body = await res!.json() as { data: { text: string } };
    expect(body.data.text).toBe('Updated comment');
    expect(dataStore.comments.find((row) => row.id === 'comment-1')?.content).toBe('Updated comment');
  });

  it('DELETE /actions/{id} deletes own comment', async () => {
    const req = new Request('http://localhost/trello/1/actions/comment-1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const res = await trelloCompatRouter(req, '/trello/1/actions/comment-1');
    expect(res?.status).toBe(200);
    expect(await res!.json()).toEqual({});
    expect(dataStore.comments.find((row) => row.id === 'comment-1')).toBeUndefined();
  });

  it('DELETE /actions/{id} for activity returns 422', async () => {
    const req = new Request('http://localhost/trello/1/actions/activity-1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const res = await trelloCompatRouter(req, '/trello/1/actions/activity-1');
    expect(res?.status).toBe(422);
    const body = await res!.json() as { message: string; error: string };
    expect(body.message).toBe('Action does not have an associated action text.');
    expect(body.error).toBe('ERROR');
  });

  it('PUT by non-author and non-admin returns 401', async () => {
    const req = new Request('http://localhost/trello/1/actions/comment-1', {
      method: 'PUT',
      headers: { Authorization: 'Bearer hf_other_token' },
      body: JSON.stringify({ text: 'No permission' }),
    });
    const res = await trelloCompatRouter(req, '/trello/1/actions/comment-1');
    expect(res?.status).toBe(401);
  });
});
