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
    ],
    memberships: [{ user_id: 'user-admin', workspace_id: 'ws-1', role: 'OWNER' }],
    boards: [{ id: 'board-1', workspace_id: 'ws-1', title: 'Board One', state: 'ACTIVE', visibility: 'PRIVATE' }],
    board_members: [{ id: 'bm-1', board_id: 'board-1', user_id: 'user-admin', role: 'ADMIN' }],
    board_guest_access: [],
    lists: [{ id: 'list-1', board_id: 'board-1', title: 'Todo', archived: false, position: 'a' }],
    cards: [{ id: 'card-1', list_id: 'list-1', title: 'Card One', archived: false, position: 'a' }],
    labels: [],
    card_labels: [],
    card_members: [],
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

const authenticateMock = mock(async (req: Request & { currentUser?: unknown }) => {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token === 'hf_admin_token') {
    req.currentUser = { id: 'user-admin', email: 'admin@example.com', name: 'Admin User' };
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

describe('trelloCompat customFields', () => {
  it('POST/GET/PUT/DELETE /customFields works and delete removes card values', async () => {
    const createReq = new Request('http://localhost/trello/1/customFields', {
      method: 'POST',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ name: 'Text Field', type: 'text', idModel: 'board-1', modelType: 'board' }),
    });
    const createRes = await trelloCompatRouter(createReq, '/trello/1/customFields');
    expect(createRes?.status).toBe(200);
    const created = await createRes!.json() as { id: string; name: string; type: string };
    expect(created.name).toBe('Text Field');
    expect(created.type).toBe('text');

    dataStore.card_custom_field_values.push({
      id: 'cfv-1',
      card_id: 'card-1',
      custom_field_id: created.id,
      value_text: 'seeded',
    });

    const getReq = new Request(`http://localhost/trello/1/customFields/${created.id}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const getRes = await trelloCompatRouter(getReq, `/trello/1/customFields/${created.id}`);
    expect(getRes?.status).toBe(200);
    const loaded = await getRes!.json() as { id: string; name: string };
    expect(loaded.id).toBe(created.id);
    expect(loaded.name).toBe('Text Field');

    const putReq = new Request(`http://localhost/trello/1/customFields/${created.id}`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ name: 'Renamed Field' }),
    });
    const putRes = await trelloCompatRouter(putReq, `/trello/1/customFields/${created.id}`);
    expect(putRes?.status).toBe(200);
    const updated = await putRes!.json() as { name: string };
    expect(updated.name).toBe('Renamed Field');

    const deleteReq = new Request(`http://localhost/trello/1/customFields/${created.id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const deleteRes = await trelloCompatRouter(deleteReq, `/trello/1/customFields/${created.id}`);
    expect(deleteRes?.status).toBe(200);
    expect(await deleteRes!.json()).toEqual({});
    expect(dataStore.custom_fields.find((row) => row.id === created.id)).toBeUndefined();
    expect(dataStore.card_custom_field_values.find((row) => row.custom_field_id === created.id)).toBeUndefined();
  });

  it('POST/DELETE /customFields/{id}/options manages dropdown options', async () => {
    dataStore.custom_fields.push({
      id: 'cf-list-1',
      board_id: 'board-1',
      name: 'Priority',
      field_type: 'DROPDOWN',
      options: [],
      show_on_card: false,
      position: 65535,
    });

    const createOptionReq = new Request('http://localhost/trello/1/customFields/cf-list-1/options', {
      method: 'POST',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ value: { text: 'High' } }),
    });
    const createOptionRes = await trelloCompatRouter(createOptionReq, '/trello/1/customFields/cf-list-1/options');
    expect(createOptionRes?.status).toBe(200);
    const option = await createOptionRes!.json() as { id: string; idCustomField: string; value: { text: string } };
    expect(option.idCustomField).toBe('cf-list-1');
    expect(option.value.text).toBe('High');

    dataStore.card_custom_field_values.push({
      id: 'cfv-1',
      card_id: 'card-1',
      custom_field_id: 'cf-list-1',
      value_option_id: option.id,
    });

    const deleteOptionReq = new Request(`http://localhost/trello/1/customFields/cf-list-1/options/${option.id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const deleteOptionRes = await trelloCompatRouter(deleteOptionReq, `/trello/1/customFields/cf-list-1/options/${option.id}`);
    expect(deleteOptionRes?.status).toBe(200);
    expect(await deleteOptionRes!.json()).toEqual({});
    expect(dataStore.card_custom_field_values.find((row) => row.id === 'cfv-1')?.value_option_id).toBeNull();
  });

  it('PUT /cards/{id}/customField/{id}/item and GET /cards/{id}/customFieldItems store and list values', async () => {
    dataStore.custom_fields.push({
      id: 'cf-text-1',
      board_id: 'board-1',
      name: 'Estimate',
      field_type: 'TEXT',
      options: null,
      show_on_card: false,
      position: 65535,
    });

    const putReq = new Request('http://localhost/trello/1/cards/card-1/customField/cf-text-1/item', {
      method: 'PUT',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ value: { text: 'hello' } }),
    });
    const putRes = await trelloCompatRouter(putReq, '/trello/1/cards/card-1/customField/cf-text-1/item');
    expect(putRes?.status).toBe(200);
    const saved = await putRes!.json() as { idCustomField: string; value: { text?: string | null } };
    expect(saved.idCustomField).toBe('cf-text-1');
    expect(saved.value.text).toBe('hello');

    const getReq = new Request('http://localhost/trello/1/cards/card-1/customFieldItems', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const getRes = await trelloCompatRouter(getReq, '/trello/1/cards/card-1/customFieldItems');
    expect(getRes?.status).toBe(200);
    const items = await getRes!.json() as Array<{ idCustomField: string; value: { text?: string | null } }>;
    expect(items).toHaveLength(1);
    expect(items[0]?.idCustomField).toBe('cf-text-1');
    expect(items[0]?.value.text).toBe('hello');
  });
});
