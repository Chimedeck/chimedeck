import { beforeEach, describe, expect, it, mock } from 'bun:test';

type Row = Record<string, unknown>;
type DataStore = {
  users: Row[];
  memberships: Row[];
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
  attachments: Row[];
  activities: Row[];
  custom_fields: Row[];
  card_custom_field_values: Row[];
};

class QueryBuilder {
  private filters: Array<(row: Row) => boolean> = [];
  private orderByField: string | null = null;
  private orderByDirection: 'asc' | 'desc' = 'asc';
  private pickedColumns: string[] | null = null;

  constructor(private readonly store: DataStore, private readonly tableName: keyof DataStore) {}

  where(criteria: Row): this {
    this.filters.push((row) => Object.entries(criteria).every(([key, value]) => row[key] === value));
    return this;
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.orderByField = field;
    this.orderByDirection = direction;
    return this;
  }

  select(...columns: string[]): this {
    this.pickedColumns = columns.length > 0 ? columns : null;
    return this;
  }

  async first(): Promise<Row | undefined> {
    const rows = await this.execute();
    return rows[0];
  }

  async insert(payload: Row | Row[]): Promise<void> {
    const rows = Array.isArray(payload) ? payload : [payload];
    for (const row of rows) (this.store[this.tableName]).push({ ...row });
  }

  async update(patch: Row): Promise<number> {
    const rows = this.executeSync(false);
    rows.forEach((row) => Object.assign(row, patch));
    return rows.length;
  }

  async delete(): Promise<number> {
    const rows = this.store[this.tableName];
    const before = rows.length;
    this.store[this.tableName] = rows.filter((row) => !this.filters.every((filter) => filter(row)));
    return before - this.store[this.tableName].length;
  }

  then<TResult1 = Row[], TResult2 = never>(
    onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private executeSync(clone = true): Row[] {
    const source = this.store[this.tableName];
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
      { id: 'user-new', email: 'new@example.com', name: 'New User', avatar_url: null },
    ],
    memberships: [{ user_id: 'user-admin', workspace_id: 'ws-1', role: 'OWNER' }],
    boards: [{ id: 'board-1', workspace_id: 'ws-1', title: 'Board One', state: 'ACTIVE', visibility: 'PRIVATE' }],
    board_members: [{ id: 'bm-1', board_id: 'board-1', user_id: 'user-admin', role: 'ADMIN' }],
    board_guest_access: [],
    lists: [{ id: 'list-1', board_id: 'board-1', title: 'Todo', archived: false, color: null, position: 'a' }],
    cards: [{ id: 'card-1', short_id: 'card0001', list_id: 'list-1', title: 'Card One', archived: false, due_complete: false, position: 'a' }],
    labels: [
      { id: 'label-1', board_id: 'board-1', name: 'Urgent', color: 'red' },
      { id: 'label-2', board_id: 'board-1', name: 'Backlog', color: 'blue' },
    ],
    card_labels: [{ card_id: 'card-1', label_id: 'label-1' }],
    card_members: [{ card_id: 'card-1', user_id: 'user-member' }],
    checklists: [],
    checklist_items: [],
    comments: [],
    attachments: [],
    activities: [],
    custom_fields: [],
    card_custom_field_values: [],
  };
}

let dataStore = createStore();
let shortIdSeq = 0;

const authenticateMock = mock(async (req: Request & { currentUser?: unknown }) => {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token === 'hf_admin_token') {
    req.currentUser = { id: 'user-admin', email: 'admin@example.com', name: 'Admin User' };
    return null;
  }
  return Response.json({ error: { code: 'unauthorized', message: 'Invalid API token' } }, { status: 401 });
});

mock.module('../../../../auth/middlewares/authentication', () => ({ authenticate: authenticateMock }));
mock.module('../../../../../common/db', () => ({
  db: ((tableName: keyof DataStore) => new QueryBuilder(dataStore, tableName)) as unknown as typeof import('../../../../../common/db').db,
}));
mock.module('../../../../../common/ids/shortId', () => ({
  generateUniqueShortId: async () => {
    shortIdSeq += 1;
    return `short${String(shortIdSeq).padStart(4, '0')}`;
  },
}));
mock.module('../../../../../common/ids/resolveEntityId', () => ({
  resolveCardId: async (identifier: string) => {
    const found = dataStore.cards.find((row) => row.id === identifier || row.short_id === identifier);
    return (found?.id as string | undefined) ?? null;
  },
  resolveListId: async (identifier: string) => {
    const found = dataStore.lists.find((row) => row.id === identifier || row.short_id === identifier);
    return (found?.id as string | undefined) ?? null;
  },
  resolveBoardId: async (identifier: string) => {
    const found = dataStore.boards.find((row) => row.id === identifier || row.short_id === identifier);
    return (found?.id as string | undefined) ?? null;
  },
}));

const { trelloCompatRouter } = await import('../../index');

beforeEach(() => {
  Bun.env['TRELLO_COMPAT_ENABLED'] = 'true';
  dataStore = createStore();
  shortIdSeq = 0;
  authenticateMock.mockClear();
});

describe('trelloCompat card member/label endpoints', () => {
  it('POST/DELETE /cards/{id}/idMembers assigns and removes member', async () => {
    const addReq = new Request('http://localhost/trello/1/cards/card-1/idMembers', {
      method: 'POST',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ value: 'user-new' }),
    });
    const addRes = await trelloCompatRouter(addReq, '/trello/1/cards/card-1/idMembers');
    expect(addRes?.status).toBe(200);
    const added = await addRes!.json() as { idMembers: string[] };
    expect(added.idMembers.includes('user-new')).toBe(true);

    const deleteReq = new Request('http://localhost/trello/1/cards/card-1/idMembers/user-new', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const deleteRes = await trelloCompatRouter(deleteReq, '/trello/1/cards/card-1/idMembers/user-new');
    expect(deleteRes?.status).toBe(200);
    const removed = await deleteRes!.json() as { idMembers: string[] };
    expect(removed.idMembers.includes('user-new')).toBe(false);
  });

  it('POST/DELETE /cards/{id}/idLabels adds and removes labels', async () => {
    const addReq = new Request('http://localhost/trello/1/cards/card-1/idLabels', {
      method: 'POST',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ value: 'label-2' }),
    });
    const addRes = await trelloCompatRouter(addReq, '/trello/1/cards/card-1/idLabels');
    expect(addRes?.status).toBe(200);
    const added = await addRes!.json() as { idLabels: string[] };
    expect(added.idLabels.includes('label-2')).toBe(true);

    const deleteReq = new Request('http://localhost/trello/1/cards/card-1/idLabels/label-2', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const deleteRes = await trelloCompatRouter(deleteReq, '/trello/1/cards/card-1/idLabels/label-2');
    expect(deleteRes?.status).toBe(200);
    const removed = await deleteRes!.json() as { idLabels: string[] };
    expect(removed.idLabels.includes('label-2')).toBe(false);
  });
});
