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

  constructor(
    private readonly store: DataStore,
    private readonly tableName: keyof DataStore
  ) {}

  where(criteria: Row): this {
    this.filters.push((row) =>
      Object.entries(criteria).every(([key, value]) => row[key] === value)
    );
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
    for (const row of rows) {
      this.store[this.tableName].push({ ...row });
    }
  }

  async update(patch: Row): Promise<number> {
    const rows = this.executeSync(false);
    rows.forEach((row) => Object.assign(row, patch));
    return rows.length;
  }

  async delete(): Promise<number> {
    const rows = this.store[this.tableName];
    const before = rows.length;
    const keep = rows.filter((row) => !this.filters.every((filter) => filter(row)));
    this.store[this.tableName] = keep;
    return before - keep.length;
  }

  then<TResult1 = Row[], TResult2 = never>(
    onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
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
    users: [{ id: 'user-admin', email: 'admin@example.com', name: 'Admin User', avatar_url: null }],
    memberships: [{ user_id: 'user-admin', workspace_id: 'ws-1', role: 'OWNER' }],
    boards: [
      {
        id: 'board-1',
        workspace_id: 'ws-1',
        title: 'Board One',
        state: 'ACTIVE',
        visibility: 'PRIVATE',
      },
    ],
    board_members: [{ id: 'bm-1', board_id: 'board-1', user_id: 'user-admin', role: 'ADMIN' }],
    board_guest_access: [],
    lists: [],
    cards: [],
    labels: [{ id: 'label-1', board_id: 'board-1', name: 'Urgent', color: 'red' }],
    card_labels: [{ card_id: 'card-1', label_id: 'label-1' }],
    card_members: [],
    checklists: [],
    checklist_items: [],
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

  return Response.json(
    { error: { code: 'unauthorized', message: 'Invalid API token' } },
    { status: 401 }
  );
});

mock.module('../../auth/middlewares/authentication', () => ({
  authenticate: authenticateMock,
}));

mock.module('../../../common/db', () => ({
  db: ((tableName: keyof DataStore) =>
    new QueryBuilder(dataStore, tableName)) as unknown as typeof import('../../../common/db').db,
}));

mock.module('../../../common/ids/resolveEntityId', () => ({
  resolveBoardId: async (identifier: string) => {
    const found = dataStore.boards.find(
      (row) => row.id === identifier || row.short_id === identifier
    );
    return (found?.id as string | undefined) ?? null;
  },
  resolveCardId: async () => null,
  resolveListId: async () => null,
}));

const { trelloCompatRouter } = await import('../api/index');

beforeEach(() => {
  Bun.env['TRELLO_COMPAT_ENABLED'] = 'true';
  dataStore = createStore();
  authenticateMock.mockClear();
});

describe('trelloCompat labels', () => {
  it('POST /labels creates label', async () => {
    const req = new Request('http://localhost/trello/1/labels', {
      method: 'POST',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ name: 'Bug', color: '#FF5733', idBoard: 'board-1' }),
    });

    const res = await trelloCompatRouter(req, '/trello/1/labels');
    expect(res?.status).toBe(200);
    const body = (await res!.json()) as { idBoard: string; name: string; color: string };
    expect(body.idBoard).toBe('board-1');
    expect(body.name).toBe('Bug');
    expect(body.color).toBe('#FF5733');
  });

  it('GET /labels/{id} returns label', async () => {
    const req = new Request('http://localhost/trello/1/labels/label-1', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });

    const res = await trelloCompatRouter(req, '/trello/1/labels/label-1');
    expect(res?.status).toBe(200);
    const body = (await res!.json()) as { id: string; name: string };
    expect(body.id).toBe('label-1');
    expect(body.name).toBe('Urgent');
  });

  it('PUT /labels/{id} updates label fields', async () => {
    const req = new Request('http://localhost/trello/1/labels/label-1', {
      method: 'PUT',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ name: 'Backend Bug' }),
    });

    const res = await trelloCompatRouter(req, '/trello/1/labels/label-1');
    expect(res?.status).toBe(200);
    const body = (await res!.json()) as { name: string };
    expect(body.name).toBe('Backend Bug');
    expect(dataStore.labels.find((row) => row.id === 'label-1')?.name).toBe('Backend Bug');
  });

  it('PUT /labels/{id}/color updates only color', async () => {
    const req = new Request('http://localhost/trello/1/labels/label-1/color', {
      method: 'PUT',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ value: '#123456' }),
    });

    const res = await trelloCompatRouter(req, '/trello/1/labels/label-1/color');
    expect(res?.status).toBe(200);
    const body = (await res!.json()) as { name: string; color: string };
    expect(body.name).toBe('Urgent');
    expect(body.color).toBe('#123456');
  });

  it('DELETE /labels/{id} removes label and card label references', async () => {
    const req = new Request('http://localhost/trello/1/labels/label-1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });

    const res = await trelloCompatRouter(req, '/trello/1/labels/label-1');
    expect(res?.status).toBe(200);
    expect(await res!.json()).toEqual({});
    expect(dataStore.labels.find((row) => row.id === 'label-1')).toBeUndefined();
    expect(dataStore.card_labels.find((row) => row.label_id === 'label-1')).toBeUndefined();
  });
});
