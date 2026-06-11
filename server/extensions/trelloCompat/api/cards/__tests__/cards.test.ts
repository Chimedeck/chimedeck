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
  plugin_data: Row[];
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
    ],
    memberships: [{ user_id: 'user-admin', workspace_id: 'ws-1', role: 'OWNER' }],
    boards: [
      {
        id: 'board-1',
        workspace_id: 'ws-1',
        title: 'Board One',
        description: '',
        state: 'ACTIVE',
        visibility: 'PRIVATE',
        created_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      },
    ],
    board_members: [{ id: 'bm-1', board_id: 'board-1', user_id: 'user-admin', role: 'ADMIN' }],
    board_guest_access: [],
    lists: [
      { id: 'list-1', board_id: 'board-1', title: 'Todo', archived: false, color: null, position: 'a' },
      { id: 'list-2', board_id: 'board-1', title: 'Done', archived: false, color: null, position: 'b' },
    ],
    cards: [
      {
        id: 'card-1',
        short_id: 'card0001',
        list_id: 'list-1',
        title: 'Card One',
        description: 'Desc',
        archived: false,
        due_complete: false,
        position: 'a',
        created_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        updated_at: new Date('2026-01-02T00:00:00.000Z').toISOString(),
      },
    ],
    labels: [{ id: 'label-1', board_id: 'board-1', name: 'Urgent', color: 'red' }],
    card_labels: [{ card_id: 'card-1', label_id: 'label-1' }],
    card_members: [{ card_id: 'card-1', user_id: 'user-member' }],
    checklists: [{ id: 'checklist-1', card_id: 'card-1', title: 'Checklist', position: 'a' }],
    checklist_items: [{ id: 'item-1', card_id: 'card-1', checklist_id: 'checklist-1', title: 'Item 1', checked: true, position: 'a' }],
    comments: [{ id: 'comment-1', card_id: 'card-1', user_id: 'user-admin', content: 'Hello', deleted: false, created_at: new Date().toISOString() }],
    attachments: [{ id: 'att-1', card_id: 'card-1', uploaded_by: 'user-admin', name: 'file.txt', type: 'URL', created_at: new Date().toISOString() }],
    activities: [],
    custom_fields: [
      {
        id: 'cf-text-1',
        board_id: 'board-1',
        name: 'Estimate',
        field_type: 'TEXT',
        options: null,
        show_on_card: false,
        position: 65535,
      },
    ],
    card_custom_field_values: [],
    plugin_data: [
      {
        id: 'pd-shared-1',
        plugin_id: 'plugin-card-size',
        scope: 'card',
        resource_id: 'card-1',
        board_id: 'board-1',
        user_id: null,
        key: 'size',
        value: '{"firstStageAmount":100,"secondStageAmount":250,"scope":"shared"}',
      },
      {
        id: 'pd-public-1',
        plugin_id: 'plugin-public',
        scope: 'card',
        resource_id: 'card-1',
        board_id: 'board-1',
        user_id: null,
        key: 'public-data',
        value: '{"scope":"public","plan":"starter"}',
      },
      {
        id: 'pd-private-1',
        plugin_id: 'plugin-private',
        scope: 'card',
        resource_id: 'card-1',
        board_id: 'board-1',
        user_id: 'user-admin',
        key: 'secret',
        value: '{"scope":"private","secret":true}',
      },
      {
        id: 'pd-board-scope-1',
        plugin_id: 'plugin-board-level',
        scope: 'board',
        resource_id: 'board-1',
        board_id: 'board-1',
        user_id: null,
        key: 'ignored',
        value: '{"scope":"shared","ignored":true}',
      },
    ],
  };
}

let dataStore = createStore();
let shortIdSeq = 0;
const validateCardMoveMock = mock(async () => undefined);

const authenticateMock = mock(async (req: Request & { currentUser?: unknown }) => {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token === 'hf_admin_token') {
    req.currentUser = { id: 'user-admin', email: 'admin@example.com', name: 'Admin User' };
    return null;
  }
  return Response.json({ error: { code: 'unauthorized', message: 'Invalid API token' } }, { status: 401 });
});

mock.module('../../../../auth/middlewares/authentication', () => ({
  authenticate: authenticateMock,
}));

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

mock.module('../../../../stateTransitions/enforcement', () => ({
  validateCardMove: validateCardMoveMock,
}));

const { StateTransitionForbiddenError } = await import('../../../../stateTransitions/common/errors');
const { trelloCompatRouter } = await import('../../index');

beforeEach(() => {
  Bun.env['TRELLO_COMPAT_ENABLED'] = 'true';
  dataStore = createStore();
  shortIdSeq = 0;
  validateCardMoveMock.mockClear();
  authenticateMock.mockClear();
});

describe('trelloCompat cards', () => {
  it('POST/GET/PUT/DELETE /cards works with Trello card shape', async () => {
    const createReq = new Request('http://localhost/trello/1/cards', {
      method: 'POST',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ name: 'Created Card', idList: 'list-1' }),
    });
    const createRes = await trelloCompatRouter(createReq, '/trello/1/cards');
    expect(createRes?.status).toBe(200);
    const created = await createRes!.json() as { id: string; idList: string; idBoard: string; url: string };
    expect(created.idList).toBe('list-1');
    expect(created.idBoard).toBe('board-1');
    expect(created.url).toBe(`/trello/1/cards/${created.id}`);

    const getReq = new Request('http://localhost/trello/1/cards/card-1', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const getRes = await trelloCompatRouter(getReq, '/trello/1/cards/card-1');
    expect(getRes?.status).toBe(200);
    const body = await getRes!.json() as {
      labels: Array<{ id: string }>;
      idMembers: string[];
      idChecklists: string[];
      badges: { comments: number; attachments: number; checkItems: number; checkItemsChecked: number };
    };
    expect(body.labels[0]?.id).toBe('label-1');
    expect(body.idMembers).toEqual(['user-member']);
    expect(body.idChecklists).toEqual(['checklist-1']);
    expect(body.badges.comments).toBe(1);
    expect(body.badges.attachments).toBe(1);
    expect(body.badges.checkItems).toBe(1);
    expect(body.badges.checkItemsChecked).toBe(1);

    const putReq = new Request('http://localhost/trello/1/cards/card-1', {
      method: 'PUT',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({
        name: 'Renamed',
        idList: 'list-2',
        closed: true,
        due: '2026-06-01T00:00:00.000Z',
      }),
    });
    const putRes = await trelloCompatRouter(putReq, '/trello/1/cards/card-1');
    expect(putRes?.status).toBe(200);
    const updated = await putRes!.json() as { name: string; idList: string; closed: boolean; due: string | null };
    expect(updated.name).toBe('Renamed');
    expect(updated.idList).toBe('list-2');
    expect(updated.closed).toBe(true);
    expect(updated.due).toBe('2026-06-01T00:00:00.000Z');

    const deleteReq = new Request('http://localhost/trello/1/cards/card-1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const deleteRes = await trelloCompatRouter(deleteReq, '/trello/1/cards/card-1');
    expect(deleteRes?.status).toBe(200);
    const deleted = await deleteRes!.json();
    expect(deleted).toEqual({});
    expect(dataStore.cards.find((row) => row.id === 'card-1')).toBeUndefined();
  });

  it('GET /cards/{id}/board, /list, /checklists returns includes', async () => {
    const boardReq = new Request('http://localhost/trello/1/cards/card-1/board', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const boardRes = await trelloCompatRouter(boardReq, '/trello/1/cards/card-1/board');
    expect(boardRes?.status).toBe(200);
    const board = await boardRes!.json() as { id: string };
    expect(board.id).toBe('board-1');

    const listReq = new Request('http://localhost/trello/1/cards/card-1/list', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const listRes = await trelloCompatRouter(listReq, '/trello/1/cards/card-1/list');
    expect(listRes?.status).toBe(200);
    const list = await listRes!.json() as { id: string };
    expect(list.id).toBe('list-1');

    const checklistsReq = new Request('http://localhost/trello/1/cards/card-1/checklists', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const checklistsRes = await trelloCompatRouter(checklistsReq, '/trello/1/cards/card-1/checklists');
    expect(checklistsRes?.status).toBe(200);
    const checklists = await checklistsRes!.json() as Array<{ id: string; checkItems: Array<{ id: string }> }>;
    expect(checklists[0]?.id).toBe('checklist-1');
    expect(checklists[0]?.checkItems[0]?.id).toBe('item-1');
  });

  it('PUT /cards/{idCard}/customField/{idCustomField}/item upserts value and GET customFieldItems returns it', async () => {
    const putReq = new Request('http://localhost/trello/1/cards/card-1/customField/cf-text-1/item', {
      method: 'PUT',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ value: { text: 'hello' } }),
    });
    const putRes = await trelloCompatRouter(putReq, '/trello/1/cards/card-1/customField/cf-text-1/item');
    expect(putRes?.status).toBe(200);
    const putBody = await putRes!.json() as {
      idCustomField: string;
      value: { text?: string | null };
    };
    expect(putBody.idCustomField).toBe('cf-text-1');
    expect(putBody.value.text).toBe('hello');

    const listReq = new Request('http://localhost/trello/1/cards/card-1/customFieldItems', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const listRes = await trelloCompatRouter(listReq, '/trello/1/cards/card-1/customFieldItems');
    expect(listRes?.status).toBe(200);
    const items = await listRes!.json() as Array<{
      idCustomField: string;
      value: { text?: string | null };
    }>;
    expect(items).toHaveLength(1);
    expect(items[0]?.idCustomField).toBe('cf-text-1');
    expect(items[0]?.value.text).toBe('hello');
  });

  it('GET /cards/{id}/pluginData returns shared/public values in Trello-compatible shape', async () => {
    const req = new Request('http://localhost/trello/1/cards/card-1/pluginData', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });

    const res = await trelloCompatRouter(req, '/trello/1/cards/card-1/pluginData');
    expect(res?.status).toBe(200);
    const body = await res!.json() as Array<{ idPlugin?: string; value?: string }>;

    expect(body).toHaveLength(2);
    expect(body).toEqual([
      {
        idPlugin: 'plugin-card-size',
        value: '{"firstStageAmount":100,"secondStageAmount":250,"scope":"shared"}',
      },
      {
        idPlugin: 'plugin-public',
        value: '{"scope":"public","plan":"starter"}',
      },
    ]);
  });

  it('returns Trello-style 422 when state transition enforcement blocks card move', async () => {
    validateCardMoveMock.mockImplementationOnce(async () => {
      throw new StateTransitionForbiddenError({
        boardId: 'board-1',
        fromListId: 'list-1',
        fromListName: 'Todo',
        toListId: 'list-2',
        toListName: 'Done',
        allowedNextStates: [],
      });
    });

    const putReq = new Request('http://localhost/trello/1/cards/card-1', {
      method: 'PUT',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ idList: 'list-2' }),
    });
    const putRes = await trelloCompatRouter(putReq, '/trello/1/cards/card-1');
    expect(putRes?.status).toBe(422);
    const body = await putRes!.json() as { message: string; error: string };
    expect(body).toEqual({
      message: 'State transition from "Todo" to "Done" is not allowed.',
      error: 'STATE_TRANSITION_FORBIDDEN',
    });
    expect(validateCardMoveMock).toHaveBeenCalledWith({
      boardId: 'board-1',
      fromListId: 'list-1',
      toListId: 'list-2',
      cardId: 'card-1',
      actorId: 'user-admin',
      ipAddress: null,
      userAgent: null,
    });
  });
});
