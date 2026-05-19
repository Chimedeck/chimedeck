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
  custom_fields: Row[];
  card_custom_field_values: Row[];
};

class QueryBuilder {
  private filters: Array<(row: Row) => boolean> = [];
  private orderByField: string | null = null;
  private orderByDirection: 'asc' | 'desc' = 'asc';
  private pickedColumns: string[] | null = null;

  constructor(private readonly store: DataStore, private readonly tableName: keyof DataStore) {}

  where(criteria: Row): QueryBuilder {
    this.filters.push((row) =>
      Object.entries(criteria).every(([key, value]) => row[key] === value));
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
    ],
    memberships: [
      { user_id: 'user-admin', workspace_id: 'ws-1', role: 'OWNER' },
      { user_id: 'user-member', workspace_id: 'ws-1', role: 'MEMBER' },
    ],
    boards: [
      {
        id: 'board-1',
        short_id: 'board0001',
        workspace_id: 'ws-1',
        title: 'Primary Board',
        description: 'Board one',
        state: 'ACTIVE',
        visibility: 'PRIVATE',
      },
      {
        id: 'board-2',
        short_id: 'board0002',
        workspace_id: 'ws-1',
        title: 'Target Board',
        description: 'Board two',
        state: 'ACTIVE',
        visibility: 'PRIVATE',
      },
    ],
    board_members: [
      { id: 'bm-1', board_id: 'board-1', user_id: 'user-admin', role: 'ADMIN' },
      { id: 'bm-2', board_id: 'board-1', user_id: 'user-member', role: 'MEMBER' },
      { id: 'bm-3', board_id: 'board-2', user_id: 'user-admin', role: 'ADMIN' },
    ],
    board_guest_access: [],
    lists: [
      { id: 'list-a', short_id: 'list0001', board_id: 'board-1', title: 'List A', archived: false, color: null, position: 'a' },
      { id: 'list-b', short_id: 'list0002', board_id: 'board-1', title: 'List B', archived: false, color: null, position: 'b' },
      { id: 'list-c', short_id: 'list0003', board_id: 'board-1', title: 'List C', archived: false, color: null, position: 'c' },
      { id: 'list-target', short_id: 'list1000', board_id: 'board-2', title: 'Target', archived: false, color: null, position: 'a' },
    ],
    cards: [
      { id: 'card-open-1', list_id: 'list-a', title: 'Card 1', archived: false, position: 'a', created_at: new Date('2026-01-01T00:00:00.000Z').toISOString(), updated_at: new Date('2026-01-01T00:00:00.000Z').toISOString() },
      { id: 'card-open-2', list_id: 'list-a', title: 'Card 2', archived: false, position: 'b', created_at: new Date('2026-01-01T00:00:00.000Z').toISOString(), updated_at: new Date('2026-01-01T00:00:00.000Z').toISOString() },
      { id: 'card-archived', list_id: 'list-a', title: 'Card 3', archived: true, position: 'c', created_at: new Date('2026-01-01T00:00:00.000Z').toISOString(), updated_at: new Date('2026-01-01T00:00:00.000Z').toISOString() },
      { id: 'card-target', list_id: 'list-target', title: 'Target Card', archived: false, position: 'a', created_at: new Date('2026-01-01T00:00:00.000Z').toISOString(), updated_at: new Date('2026-01-01T00:00:00.000Z').toISOString() },
    ],
    labels: [{ id: 'label-1', board_id: 'board-1', name: 'Urgent', color: 'red' }],
    card_labels: [{ card_id: 'card-open-1', label_id: 'label-1' }],
    card_members: [{ card_id: 'card-open-1', user_id: 'user-member' }],
    checklists: [{ id: 'checklist-1', card_id: 'card-open-1' }],
    checklist_items: [{ id: 'checkitem-1', card_id: 'card-open-1', checked: true }],
    comments: [{ id: 'comment-1', card_id: 'card-open-1', deleted: false }],
    attachments: [{ id: 'attachment-1', card_id: 'card-open-1' }],
    custom_fields: [],
    card_custom_field_values: [],
  };
}

function orderedListIds(boardId: string): string[] {
  return dataStore.lists
    .filter((row) => row.board_id === boardId)
    .sort((a, b) => (String(a.position) > String(b.position) ? 1 : -1))
    .map((row) => String(row.id));
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
  if (token === 'hf_member_token') {
    req.currentUser = { id: 'user-member', email: 'member@example.com', name: 'Member User' };
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

mock.module('../../../server/common/ids/shortId', () => ({
  generateUniqueShortId: async () => {
    shortIdSeq += 1;
    return `short${String(shortIdSeq).padStart(4, '0')}`;
  },
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
  shortIdSeq = 0;
  authenticateMock.mockClear();
});

describe('trelloCompat lists', () => {
  it('POST /lists creates list and supports pos=top/bottom/numeric', async () => {
    const createTop = new Request('http://localhost/trello/1/lists', {
      method: 'POST',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ name: 'Top List', idBoard: 'board-1', pos: 'top' }),
    });
    const topRes = await trelloCompatRouter(createTop, '/trello/1/lists');
    expect(topRes?.status).toBe(200);
    const topBody = await topRes!.json() as { id: string; idBoard: string; closed: boolean; pos: number };
    expect(topBody.idBoard).toBe('board-1');
    expect(topBody.closed).toBe(false);
    expect(topBody.pos).toBeGreaterThan(0);
    expect(orderedListIds('board-1')[0]).toBe(topBody.id);

    const createBottom = new Request('http://localhost/trello/1/lists', {
      method: 'POST',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ name: 'Bottom List', idBoard: 'board-1', pos: 'bottom' }),
    });
    const bottomRes = await trelloCompatRouter(createBottom, '/trello/1/lists');
    const bottomBody = await bottomRes!.json() as { id: string };
    const boardOrder = orderedListIds('board-1');
    expect(boardOrder[boardOrder.length - 1]).toBe(bottomBody.id);

    const createNumeric = new Request('http://localhost/trello/1/lists', {
      method: 'POST',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ name: 'Middle List', idBoard: 'board-1', pos: 65535 }),
    });
    const numericRes = await trelloCompatRouter(createNumeric, '/trello/1/lists');
    const numericBody = await numericRes!.json() as { id: string };
    expect(orderedListIds('board-1').indexOf(numericBody.id)).toBe(1);
  });

  it('GET /lists/{id} and GET /lists/{id}/name return list payload and scalar field', async () => {
    const req = new Request('http://localhost/trello/1/lists/list-a', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const res = await trelloCompatRouter(req, '/trello/1/lists/list-a');
    expect(res?.status).toBe(200);
    const body = await res!.json() as { id: string; idBoard: string; name: string; pos: number };
    expect(body.id).toBe('list-a');
    expect(body.idBoard).toBe('board-1');
    expect(body.name).toBe('List A');
    expect(body.pos).toBeGreaterThan(0);

    const nameReq = new Request('http://localhost/trello/1/lists/list-a/name', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const nameRes = await trelloCompatRouter(nameReq, '/trello/1/lists/list-a/name');
    expect(nameRes?.status).toBe(200);
    expect(await nameRes!.json()).toBe('List A');
  });

  it('PUT /lists/{id} updates name', async () => {
    const req = new Request('http://localhost/trello/1/lists/list-a', {
      method: 'PUT',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ name: 'Renamed List' }),
    });
    const res = await trelloCompatRouter(req, '/trello/1/lists/list-a');
    expect(res?.status).toBe(200);
    const body = await res!.json() as { name: string };
    expect(body.name).toBe('Renamed List');
    expect(dataStore.lists.find((row) => row.id === 'list-a')?.title).toBe('Renamed List');
  });

  it('PUT /lists/{id}/closed toggles archive state', async () => {
    const archiveReq = new Request('http://localhost/trello/1/lists/list-a/closed', {
      method: 'PUT',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ value: true }),
    });
    const archiveRes = await trelloCompatRouter(archiveReq, '/trello/1/lists/list-a/closed');
    expect(archiveRes?.status).toBe(200);
    const archivedBody = await archiveRes!.json() as { closed: boolean };
    expect(archivedBody.closed).toBe(true);

    const unarchiveReq = new Request('http://localhost/trello/1/lists/list-a/closed', {
      method: 'PUT',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ value: false }),
    });
    const unarchiveRes = await trelloCompatRouter(unarchiveReq, '/trello/1/lists/list-a/closed');
    const unarchivedBody = await unarchiveRes!.json() as { closed: boolean };
    expect(unarchivedBody.closed).toBe(false);
  });

  it('PUT /lists/{id}/idBoard moves list to another board', async () => {
    const req = new Request('http://localhost/trello/1/lists/list-b/idBoard', {
      method: 'PUT',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ value: 'board-2' }),
    });
    const res = await trelloCompatRouter(req, '/trello/1/lists/list-b/idBoard');
    expect(res?.status).toBe(200);
    const body = await res!.json() as { idBoard: string };
    expect(body.idBoard).toBe('board-2');
    expect(dataStore.lists.find((row) => row.id === 'list-b')?.board_id).toBe('board-2');
  });

  it('GET /lists/{id}/cards returns only non-archived cards', async () => {
    const req = new Request('http://localhost/trello/1/lists/list-a/cards', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const res = await trelloCompatRouter(req, '/trello/1/lists/list-a/cards');
    expect(res?.status).toBe(200);
    const body = await res!.json() as Array<{ id: string }>;
    expect(body.map((card) => card.id)).toEqual(['card-open-1', 'card-open-2']);
  });

  it('POST /lists/{id}/archiveAllCards archives all active cards', async () => {
    const req = new Request('http://localhost/trello/1/lists/list-a/archiveAllCards', {
      method: 'POST',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const res = await trelloCompatRouter(req, '/trello/1/lists/list-a/archiveAllCards');
    expect(res?.status).toBe(200);
    expect(await res!.json()).toEqual({});
    const stillOpen = dataStore.cards.filter((row) => row.list_id === 'list-a' && row.archived === false);
    expect(stillOpen).toHaveLength(0);
  });

  it('POST /lists/{id}/moveAllCards moves active cards to target list', async () => {
    const req = new Request('http://localhost/trello/1/lists/list-a/moveAllCards', {
      method: 'POST',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ idBoard: 'board-2', idList: 'list-target' }),
    });
    const res = await trelloCompatRouter(req, '/trello/1/lists/list-a/moveAllCards');
    expect(res?.status).toBe(200);
    expect(await res!.json()).toEqual({});

    const movedCardIds = dataStore.cards
      .filter((row) => row.list_id === 'list-target')
      .map((row) => String(row.id));
    expect(movedCardIds).toEqual(expect.arrayContaining(['card-open-1', 'card-open-2', 'card-target']));

    const archivedSource = dataStore.cards.find((row) => row.id === 'card-archived');
    expect(archivedSource?.list_id).toBe('list-a');
  });

  it('GET /lists/{id}/board returns parent board', async () => {
    const req = new Request('http://localhost/trello/1/lists/list-a/board', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const res = await trelloCompatRouter(req, '/trello/1/lists/list-a/board');
    expect(res?.status).toBe(200);
    const body = await res!.json() as { id: string; name: string };
    expect(body.id).toBe('board-1');
    expect(body.name).toBe('Primary Board');
  });

  it('returns list-not-found for unknown list', async () => {
    const req = new Request('http://localhost/trello/1/lists/does-not-exist', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const res = await trelloCompatRouter(req, '/trello/1/lists/does-not-exist');
    expect(res?.status).toBe(404);
    const body = await res!.json() as { message: string; error: string };
    expect(body).toEqual({ message: 'The requested list was not found.', error: 'ERROR' });
  });
});
