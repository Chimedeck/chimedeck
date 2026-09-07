import { beforeEach, describe, expect, it, mock } from 'bun:test';

type Row = Record<string, unknown>;
type DataStore = {
  memberships: Row[];
  boards: Row[];
  board_members: Row[];
  board_guest_access: Row[];
  custom_fields: Row[];
  card_custom_field_values: Row[];
};

class QueryBuilder {
  private filters: Array<(row: Row) => boolean> = [];
  private pickedColumns: string[] | null = null;

  constructor(private readonly store: DataStore, private readonly tableName: keyof DataStore) {}

  where(criteria: Row): QueryBuilder {
    this.filters.push((row) => Object.entries(criteria).every(([key, value]) => row[key] === value));
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
    for (const row of rows) (this.store[this.tableName] as Row[]).push({ ...row });
  }

  async update(patch: Row): Promise<number> {
    const rows = this.executeSync(false);
    rows.forEach((row) => Object.assign(row, patch));
    return rows.length;
  }

  async delete(): Promise<number> {
    const rows = this.store[this.tableName] as Row[];
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
    const source = this.store[this.tableName] as Row[];
    let rows = source.filter((row) => this.filters.every((filter) => filter(row)));
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
    memberships: [{ user_id: 'user-admin', workspace_id: 'ws-1', role: 'OWNER' }],
    boards: [{ id: 'board-1', workspace_id: 'ws-1', state: 'ACTIVE', visibility: 'PRIVATE' }],
    board_members: [{ id: 'bm-1', board_id: 'board-1', user_id: 'user-admin', role: 'ADMIN' }],
    board_guest_access: [],
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

mock.module('../../../../../server/extensions/auth/middlewares/authentication', () => ({
  authenticate: authenticateMock,
}));
mock.module('../../../../../server/common/db', () => ({
  db: ((tableName: keyof DataStore) => new QueryBuilder(dataStore, tableName)) as unknown as typeof import('../../../../../server/common/db').db,
}));
mock.module('../../../../../server/common/ids/resolveEntityId', () => ({
  resolveBoardId: async (identifier: string) => {
    const found = dataStore.boards.find((row) => row.id === identifier || row.short_id === identifier);
    return (found?.id as string | undefined) ?? null;
  },
  resolveCardId: async () => null,
  resolveListId: async () => null,
}));

const { trelloCompatRouter } = await import('../../../../../server/extensions/trelloCompat/api/index');

beforeEach(() => {
  Bun.env['TRELLO_COMPAT_ENABLED'] = 'true';
  dataStore = createStore();
  authenticateMock.mockClear();
});

describe('trelloCompat custom fields', () => {
  it('supports custom field CRUD and option CRUD', async () => {
    const createReq = new Request('http://localhost/trello/1/customFields', {
      method: 'POST',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ name: 'Priority', type: 'list', idModel: 'board-1', modelType: 'board' }),
    });
    const createRes = await trelloCompatRouter(createReq, '/trello/1/customFields');
    expect(createRes?.status).toBe(200);
    const created = await createRes!.json() as { id: string; name: string; type: string; idModel: string };
    expect(created.idModel).toBe('board-1');
    expect(created.name).toBe('Priority');
    expect(created.type).toBe('list');

    const getReq = new Request(`http://localhost/trello/1/customFields/${created.id}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const getRes = await trelloCompatRouter(getReq, `/trello/1/customFields/${created.id}`);
    expect(getRes?.status).toBe(200);
    const fetched = await getRes!.json() as { id: string; name: string };
    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe('Priority');

    const updateReq = new Request(`http://localhost/trello/1/customFields/${created.id}`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ name: 'Priority Updated' }),
    });
    const updateRes = await trelloCompatRouter(updateReq, `/trello/1/customFields/${created.id}`);
    expect(updateRes?.status).toBe(200);
    const updated = await updateRes!.json() as { name: string };
    expect(updated.name).toBe('Priority Updated');

    const optionCreateReq = new Request(`http://localhost/trello/1/customFields/${created.id}/options`, {
      method: 'POST',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ value: { text: 'High' } }),
    });
    const optionCreateRes = await trelloCompatRouter(optionCreateReq, `/trello/1/customFields/${created.id}/options`);
    expect(optionCreateRes?.status).toBe(200);
    const createdOption = await optionCreateRes!.json() as { id: string; idCustomField: string; value: { text: string } };
    expect(createdOption.idCustomField).toBe(created.id);
    expect(createdOption.value.text).toBe('High');

    const optionDeleteReq = new Request(
      `http://localhost/trello/1/customFields/${created.id}/options/${createdOption.id}`,
      {
        method: 'DELETE',
        headers: { Authorization: 'Bearer hf_admin_token' },
      },
    );
    const optionDeleteRes = await trelloCompatRouter(
      optionDeleteReq,
      `/trello/1/customFields/${created.id}/options/${createdOption.id}`,
    );
    expect(optionDeleteRes?.status).toBe(200);
    expect(await optionDeleteRes!.json()).toEqual({});

    dataStore.card_custom_field_values.push({
      id: 'cfv-1',
      card_id: 'card-1',
      custom_field_id: created.id,
      value_text: 'stale',
    });
    const fieldDeleteReq = new Request(`http://localhost/trello/1/customFields/${created.id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const fieldDeleteRes = await trelloCompatRouter(fieldDeleteReq, `/trello/1/customFields/${created.id}`);
    expect(fieldDeleteRes?.status).toBe(200);
    expect(await fieldDeleteRes!.json()).toEqual({});
    expect(dataStore.custom_fields.find((row) => row.id === created.id)).toBeUndefined();
    expect(dataStore.card_custom_field_values.filter((row) => row.custom_field_id === created.id)).toHaveLength(0);
  });
});
