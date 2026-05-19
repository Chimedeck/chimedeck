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
    users: [{ id: 'user-admin', email: 'admin@example.com', name: 'Admin User', avatar_url: null }],
    memberships: [{ user_id: 'user-admin', workspace_id: 'ws-1', role: 'OWNER' }],
    boards: [
      {
        id: 'board-1',
        workspace_id: 'ws-1',
        title: 'Board One',
        description: 'Primary board',
        state: 'ACTIVE',
        visibility: 'PRIVATE',
        background: 'blue',
        created_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      },
    ],
    board_members: [{ id: 'bm-1', board_id: 'board-1', user_id: 'user-admin', role: 'ADMIN' }],
    board_guest_access: [],
    lists: [{ id: 'list-1', board_id: 'board-1', title: 'Todo', archived: false, position: 'a', color: null }],
    cards: [
      {
        id: 'card-1',
        short_id: 'card0001',
        list_id: 'list-1',
        title: 'Card One',
        description: 'card',
        archived: false,
        position: 'a',
        created_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        updated_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      },
    ],
    labels: [],
    card_labels: [],
    card_members: [],
    checklists: [
      {
        id: 'checklist-source',
        card_id: 'card-1',
        title: 'Source Checklist',
        position: 'a',
      },
    ],
    checklist_items: [
      {
        id: 'item-source-1',
        checklist_id: 'checklist-source',
        card_id: 'card-1',
        title: 'Source Item 1',
        checked: false,
        position: 'a',
      },
      {
        id: 'item-source-2',
        checklist_id: 'checklist-source',
        card_id: 'card-1',
        title: 'Source Item 2',
        checked: true,
        position: 'b',
      },
    ],
    comments: [],
    attachments: [],
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

  return Response.json({ error: { code: 'unauthorized', message: 'Invalid API token' } }, { status: 401 });
});

mock.module('../../auth/middlewares/authentication', () => ({
  authenticate: authenticateMock,
}));

mock.module('../../../common/db', () => ({
  db: ((tableName: keyof DataStore) => new QueryBuilder(dataStore, tableName)) as unknown as typeof import('../../../common/db').db,
}));

mock.module('../../../common/ids/resolveEntityId', () => ({
  resolveCardId: async (identifier: string) => {
    const found = dataStore.cards.find((row) => row.id === identifier || row.short_id === identifier);
    return (found?.id as string | undefined) ?? null;
  },
  resolveBoardId: async (identifier: string) => {
    const found = dataStore.boards.find((row) => row.id === identifier || row.short_id === identifier);
    return (found?.id as string | undefined) ?? null;
  },
  resolveListId: async () => null,
}));

const { trelloCompatRouter } = await import('../api/index');

beforeEach(() => {
  Bun.env['TRELLO_COMPAT_ENABLED'] = 'true';
  dataStore = createStore();
  authenticateMock.mockClear();
});

describe('trelloCompat checklists', () => {
  it('POST /checklists with idCard creates checklist', async () => {
    const req = new Request('http://localhost/trello/1/checklists', {
      method: 'POST',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ idCard: 'card-1', name: 'New Checklist' }),
    });

    const res = await trelloCompatRouter(req, '/trello/1/checklists');
    expect(res?.status).toBe(200);
    const body = await res!.json() as { idCard: string; idBoard: string; name: string; checkItems: unknown[] };
    expect(body.idCard).toBe('card-1');
    expect(body.idBoard).toBe('board-1');
    expect(body.name).toBe('New Checklist');
    expect(body.checkItems).toEqual([]);
  });

  it('GET /checklists/{id} returns checklist with nested checkItems', async () => {
    const req = new Request('http://localhost/trello/1/checklists/checklist-source', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });

    const res = await trelloCompatRouter(req, '/trello/1/checklists/checklist-source');
    expect(res?.status).toBe(200);
    const body = await res!.json() as { id: string; checkItems: Array<{ id: string }> };
    expect(body.id).toBe('checklist-source');
    expect(body.checkItems).toHaveLength(2);
    expect(body.checkItems[0]?.id).toBe('item-source-1');
  });

  it('POST /checklists/{id}/checkItems creates checkItem and DELETE removes it', async () => {
    const createReq = new Request('http://localhost/trello/1/checklists/checklist-source/checkItems', {
      method: 'POST',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ name: 'New Item' }),
    });
    const createRes = await trelloCompatRouter(createReq, '/trello/1/checklists/checklist-source/checkItems');
    expect(createRes?.status).toBe(200);
    const created = await createRes!.json() as { id: string; state: string };
    expect(created.state).toBe('incomplete');

    const deleteReq = new Request(`http://localhost/trello/1/checklists/checklist-source/checkItems/${created.id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const deleteRes = await trelloCompatRouter(deleteReq, `/trello/1/checklists/checklist-source/checkItems/${created.id}`);
    expect(deleteRes?.status).toBe(200);
    expect(await deleteRes!.json()).toEqual({});
    expect(dataStore.checklist_items.some((row) => row.id === created.id)).toBe(false);
  });

  it('DELETE /checklists/{id} deletes checklist and its items', async () => {
    const req = new Request('http://localhost/trello/1/checklists/checklist-source', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });

    const res = await trelloCompatRouter(req, '/trello/1/checklists/checklist-source');
    expect(res?.status).toBe(200);
    expect(await res!.json()).toEqual({});
    expect(dataStore.checklists.find((row) => row.id === 'checklist-source')).toBeUndefined();
  });

  it('GET /checklists/{id}/board returns parent board', async () => {
    const req = new Request('http://localhost/trello/1/checklists/checklist-source/board', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });

    const res = await trelloCompatRouter(req, '/trello/1/checklists/checklist-source/board');
    expect(res?.status).toBe(200);
    const body = await res!.json() as { id: string; name: string };
    expect(body.id).toBe('board-1');
    expect(body.name).toBe('Board One');
  });

  it('POST /checklists with idChecklistSource copies all check items', async () => {
    const req = new Request('http://localhost/trello/1/checklists', {
      method: 'POST',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ idCard: 'card-1', name: 'Copied', idChecklistSource: 'checklist-source' }),
    });

    const res = await trelloCompatRouter(req, '/trello/1/checklists');
    expect(res?.status).toBe(200);
    const body = await res!.json() as { id: string; checkItems: Array<{ name: string }> };
    expect(body.checkItems).toHaveLength(2);
    expect(body.checkItems.map((item) => item.name)).toEqual(['Source Item 1', 'Source Item 2']);
  });
});
