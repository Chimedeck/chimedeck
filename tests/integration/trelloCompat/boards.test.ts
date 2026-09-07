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
    rows.forEach((row) => {
      Object.assign(row, patch);
    });
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
      { id: 'user-new', email: 'new@example.com', name: 'New User', avatar_url: null },
    ],
    memberships: [
      { user_id: 'user-admin', workspace_id: 'ws-1', role: 'OWNER' },
      { user_id: 'user-member', workspace_id: 'ws-1', role: 'MEMBER' },
      { user_id: 'user-new', workspace_id: 'ws-1', role: 'MEMBER' },
    ],
    boards: [
      {
        id: 'board-1',
        short_id: 'board001',
        workspace_id: 'ws-1',
        title: 'My Board',
        description: 'Initial board',
        state: 'ACTIVE',
        visibility: 'PRIVATE',
        background: 'blue',
        created_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      },
    ],
    board_members: [
      {
        id: 'bm-1',
        board_id: 'board-1',
        user_id: 'user-admin',
        role: 'ADMIN',
        created_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      },
      {
        id: 'bm-2',
        board_id: 'board-1',
        user_id: 'user-member',
        role: 'MEMBER',
        created_at: new Date('2026-01-02T00:00:00.000Z').toISOString(),
      },
    ],
    board_guest_access: [],
    lists: [
      { id: 'list-open', short_id: 'list0001', board_id: 'board-1', title: 'To Do', position: 'a', archived: false, color: null },
      { id: 'list-closed', short_id: 'list0002', board_id: 'board-1', title: 'Done', position: 'b', archived: true, color: null },
    ],
    cards: [
      {
        id: 'card-open',
        short_id: 'card0001',
        list_id: 'list-open',
        title: 'Open card',
        description: 'Open',
        archived: false,
        created_at: new Date('2026-01-02T00:00:00.000Z').toISOString(),
        updated_at: new Date('2026-01-03T00:00:00.000Z').toISOString(),
      },
      {
        id: 'card-closed',
        short_id: 'card0002',
        list_id: 'list-open',
        title: 'Closed card',
        description: 'Closed',
        archived: true,
        created_at: new Date('2026-01-02T00:00:00.000Z').toISOString(),
        updated_at: new Date('2026-01-03T00:00:00.000Z').toISOString(),
      },
    ],
    labels: [{ id: 'label-1', board_id: 'board-1', name: 'Urgent', color: 'red' }],
    card_labels: [{ card_id: 'card-open', label_id: 'label-1' }],
    card_members: [{ card_id: 'card-open', user_id: 'user-member' }],
    checklists: [{ id: 'checklist-1', card_id: 'card-open' }],
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
  resolveBoardId: async (identifier: string) => {
    const found = dataStore.boards.find(
      (row) => row.id === identifier || row.short_id === identifier,
    );
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

describe('trelloCompat boards', () => {
  it('GET /boards/{id} returns TrelloBoard shape', async () => {
    const req = new Request('http://localhost/trello/1/boards/board-1', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });

    const res = await trelloCompatRouter(req, '/trello/1/boards/board-1');
    expect(res?.status).toBe(200);
    const body = await res!.json() as { id: string; name: string; desc: string; closed: boolean; idOrganization: string; prefs: { permissionLevel: string }; url: string };
    expect(body.id).toBe('board-1');
    expect(body.name).toBe('My Board');
    expect(body.desc).toBe('Initial board');
    expect(body.closed).toBe(false);
    expect(body.idOrganization).toBe('ws-1');
    expect(body.prefs.permissionLevel).toBe('private');
    expect(body.url).toBe('/trello/1/boards/board-1');
  });

  it('POST /boards creates board and 3 default lists', async () => {
    const req = new Request('http://localhost/trello/1/boards/', {
      method: 'POST',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ name: 'Created Board', idOrganization: 'ws-1' }),
    });

    const res = await trelloCompatRouter(req, '/trello/1/boards/');
    expect(res?.status).toBe(200);
    const body = await res!.json() as { id: string; name: string };
    expect(body.name).toBe('Created Board');

    const createdLists = dataStore.lists.filter((row) => row.board_id === body.id);
    expect(createdLists.map((row) => row.title)).toEqual(['To Do', 'In Progress', 'Done']);
  });

  it('PUT /boards/{id} archives board when closed=true', async () => {
    const req = new Request('http://localhost/trello/1/boards/board-1', {
      method: 'PUT',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ closed: true }),
    });

    const res = await trelloCompatRouter(req, '/trello/1/boards/board-1');
    expect(res?.status).toBe(200);
    const body = await res!.json() as { closed: boolean };
    expect(body.closed).toBe(true);
    expect(dataStore.boards.find((row) => row.id === 'board-1')?.state).toBe('ARCHIVED');
  });

  it('DELETE /boards/{id} removes board', async () => {
    const req = new Request('http://localhost/trello/1/boards/board-1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });

    const res = await trelloCompatRouter(req, '/trello/1/boards/board-1');
    expect(res?.status).toBe(200);
    expect(dataStore.boards.find((row) => row.id === 'board-1')).toBeUndefined();
  });

  it('GET /boards/{id}/lists returns open lists by default and closed lists by filter', async () => {
    const openReq = new Request('http://localhost/trello/1/boards/board-1/lists', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const openRes = await trelloCompatRouter(openReq, '/trello/1/boards/board-1/lists');
    const openBody = await openRes!.json() as Array<{ id: string; closed: boolean }>;
    expect(openBody).toHaveLength(1);
    expect(openBody[0]?.id).toBe('list-open');
    expect(openBody[0]?.closed).toBe(false);

    const closedReq = new Request('http://localhost/trello/1/boards/board-1/lists?filter=closed', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const closedRes = await trelloCompatRouter(closedReq, '/trello/1/boards/board-1/lists');
    const closedBody = await closedRes!.json() as Array<{ id: string; closed: boolean }>;
    expect(closedBody).toHaveLength(1);
    expect(closedBody[0]?.id).toBe('list-closed');
    expect(closedBody[0]?.closed).toBe(true);
  });

  it('GET /boards/{id}/cards returns non-archived cards with members/labels', async () => {
    const req = new Request('http://localhost/trello/1/boards/board-1/cards', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });

    const res = await trelloCompatRouter(req, '/trello/1/boards/board-1/cards');
    expect(res?.status).toBe(200);
    const body = await res!.json() as Array<{ id: string; idBoard: string; idList: string; idMembers: string[]; labels: Array<{ id: string }> }>;
    expect(body).toHaveLength(1);
    expect(body[0]?.id).toBe('card-open');
    expect(body[0]?.idBoard).toBe('board-1');
    expect(body[0]?.idList).toBe('list-open');
    expect(body[0]?.idMembers).toEqual(['user-member']);
    expect(body[0]?.labels[0]?.id).toBe('label-1');
  });

  it('GET /boards/{id}/members, /labels, /memberships return sub-resources', async () => {
    const membersReq = new Request('http://localhost/trello/1/boards/board-1/members', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const membersRes = await trelloCompatRouter(membersReq, '/trello/1/boards/board-1/members');
    const members = await membersRes!.json() as Array<{ id: string }>;
    expect(members.map((m) => m.id)).toEqual(['user-admin', 'user-member']);

    const labelsReq = new Request('http://localhost/trello/1/boards/board-1/labels', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const labelsRes = await trelloCompatRouter(labelsReq, '/trello/1/boards/board-1/labels');
    const labels = await labelsRes!.json() as Array<{ id: string }>;
    expect(labels).toHaveLength(1);
    expect(labels[0]?.id).toBe('label-1');

    const membershipsReq = new Request('http://localhost/trello/1/boards/board-1/memberships', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const membershipsRes = await trelloCompatRouter(membershipsReq, '/trello/1/boards/board-1/memberships');
    const memberships = await membershipsRes!.json() as Array<{ idMember: string; memberType: string }>;
    expect(memberships).toHaveLength(2);
    expect(memberships[0]?.memberType).toBe('admin');
  });

  it('PUT/DELETE /boards/{id}/members/{id} add-update-remove member', async () => {
    const addReq = new Request('http://localhost/trello/1/boards/board-1/members/user-new', {
      method: 'PUT',
      headers: { Authorization: 'Bearer hf_admin_token' },
      body: JSON.stringify({ type: 'normal' }),
    });
    const addRes = await trelloCompatRouter(addReq, '/trello/1/boards/board-1/members/user-new');
    expect(addRes?.status).toBe(200);
    expect(dataStore.board_members.some((row) => row.user_id === 'user-new')).toBe(true);

    const deleteReq = new Request('http://localhost/trello/1/boards/board-1/members/user-new', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });
    const deleteRes = await trelloCompatRouter(deleteReq, '/trello/1/boards/board-1/members/user-new');
    expect(deleteRes?.status).toBe(200);
    expect(dataStore.board_members.some((row) => row.user_id === 'user-new')).toBe(false);
  });

  it('non-admin DELETE /boards/{id} returns 401', async () => {
    const req = new Request('http://localhost/trello/1/boards/board-1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer hf_member_token' },
    });

    const res = await trelloCompatRouter(req, '/trello/1/boards/board-1');
    expect(res?.status).toBe(401);
    const body = await res!.json() as { message: string; error: string };
    expect(body).toEqual({ message: 'unauthorized permission requested', error: 'UNAUTHORIZED' });
  });

  it('GET /boards/{id}/{field} returns scalar field value', async () => {
    const req = new Request('http://localhost/trello/1/boards/board-1/name', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_admin_token' },
    });

    const res = await trelloCompatRouter(req, '/trello/1/boards/board-1/name');
    expect(res?.status).toBe(200);
    const body = await res!.json();
    expect(body).toBe('My Board');
  });
});
