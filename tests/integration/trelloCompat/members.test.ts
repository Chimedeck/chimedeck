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
  card_members: Row[];
  labels: Row[];
  card_labels: Row[];
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
    workspaces: [{ id: 'ws-1', name: 'Workspace One', owner_id: 'user-admin' }],
    memberships: [
      { user_id: 'user-admin', workspace_id: 'ws-1', role: 'OWNER' },
      { user_id: 'user-member', workspace_id: 'ws-1', role: 'MEMBER' },
    ],
    boards: [
      {
        id: 'board-private',
        workspace_id: 'ws-1',
        title: 'Private Board',
        description: 'private',
        state: 'ACTIVE',
        visibility: 'PRIVATE',
      },
      {
        id: 'board-workspace',
        workspace_id: 'ws-1',
        title: 'Workspace Board',
        description: 'workspace',
        state: 'ACTIVE',
        visibility: 'WORKSPACE',
      },
    ],
    board_members: [
      { id: 'bm-1', board_id: 'board-private', user_id: 'user-admin', role: 'ADMIN' },
      { id: 'bm-2', board_id: 'board-private', user_id: 'user-member', role: 'MEMBER' },
      { id: 'bm-3', board_id: 'board-workspace', user_id: 'user-admin', role: 'ADMIN' },
    ],
    board_guest_access: [],
    lists: [
      { id: 'list-1', board_id: 'board-private', title: 'Todo', archived: false, position: 'a' },
      { id: 'list-2', board_id: 'board-workspace', title: 'Doing', archived: false, position: 'a' },
    ],
    cards: [
      { id: 'card-1', list_id: 'list-1', title: 'Card 1', archived: false, position: 'a', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'card-2', list_id: 'list-2', title: 'Card 2', archived: false, position: 'a', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ],
    card_members: [
      { card_id: 'card-1', user_id: 'user-member' },
      { card_id: 'card-2', user_id: 'user-member' },
    ],
    labels: [],
    card_labels: [],
    checklists: [],
    checklist_items: [],
    comments: [],
    attachments: [],
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

const { trelloCompatRouter } = await import('../../../server/extensions/trelloCompat/api/index');

beforeEach(() => {
  Bun.env['TRELLO_COMPAT_ENABLED'] = 'true';
  dataStore = createStore();
  authenticateMock.mockClear();
});

describe('trelloCompat members', () => {
  it('GET /members/me and /members/{id} return TrelloMember shape', async () => {
    const meReq = new Request('http://localhost/trello/1/members/me', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_member_token' },
    });
    const meRes = await trelloCompatRouter(meReq, '/trello/1/members/me');
    expect(meRes?.status).toBe(200);
    const meBody = await meRes!.json() as { id: string; fullName: string; username: string };
    expect(meBody.id).toBe('user-member');
    expect(meBody.fullName).toBe('Member User');
    expect(meBody.username).toBe('member');

    const byIdReq = new Request('http://localhost/trello/1/members/user-member', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const byIdRes = await trelloCompatRouter(byIdReq, '/trello/1/members/user-member');
    expect(byIdRes?.status).toBe(200);
    const byIdBody = await byIdRes!.json() as { id: string };
    expect(byIdBody.id).toBe('user-member');
  });

  it('GET /members/me/boards, /cards, /organizations returns arrays', async () => {
    const boardsReq = new Request('http://localhost/trello/1/members/me/boards', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_member_token' },
    });
    const boardsRes = await trelloCompatRouter(boardsReq, '/trello/1/members/me/boards');
    expect(boardsRes?.status).toBe(200);
    const boards = await boardsRes!.json() as Array<{ id: string }>;
    expect(boards.map((board) => board.id)).toEqual(['board-private', 'board-workspace']);

    const cardsReq = new Request('http://localhost/trello/1/members/me/cards', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_member_token' },
    });
    const cardsRes = await trelloCompatRouter(cardsReq, '/trello/1/members/me/cards');
    expect(cardsRes?.status).toBe(200);
    const cards = await cardsRes!.json() as Array<{ id: string }>;
    expect(cards.map((card) => card.id)).toEqual(['card-1', 'card-2']);

    const orgReq = new Request('http://localhost/trello/1/members/me/organizations', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_member_token' },
    });
    const orgRes = await trelloCompatRouter(orgReq, '/trello/1/members/me/organizations');
    expect(orgRes?.status).toBe(200);
    const organizations = await orgRes!.json() as Array<{ id: string }>;
    expect(organizations).toHaveLength(1);
    expect(organizations[0]?.id).toBe('ws-1');
  });

  it('PUT /members/me updates fullName', async () => {
    const req = new Request('http://localhost/trello/1/members/me', {
      method: 'PUT',
      headers: { Authorization: 'Bearer hf_member_token' },
      body: JSON.stringify({ fullName: 'Renamed Member' }),
    });
    const res = await trelloCompatRouter(req, '/trello/1/members/me');
    expect(res?.status).toBe(200);
    const body = await res!.json() as { fullName: string };
    expect(body.fullName).toBe('Renamed Member');
    expect(dataStore.users.find((row) => row.id === 'user-member')?.name).toBe('Renamed Member');
  });

  it('PUT /members/{otherId} by different user returns 401', async () => {
    const req = new Request('http://localhost/trello/1/members/user-other', {
      method: 'PUT',
      headers: { Authorization: 'Bearer hf_member_token' },
      body: JSON.stringify({ fullName: 'Nope' }),
    });
    const res = await trelloCompatRouter(req, '/trello/1/members/user-other');
    expect(res?.status).toBe(401);
  });
});
