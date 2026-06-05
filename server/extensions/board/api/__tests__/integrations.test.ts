import { beforeEach, describe, expect, it, mock } from 'bun:test';

type Row = Record<string, unknown>;
type DataStore = {
  boards: Row[];
  memberships: Row[];
};

class QueryBuilder {
  private filters: Array<(row: Row) => boolean> = [];

  constructor(private readonly store: DataStore, private readonly tableName: keyof DataStore) {}

  where(criteria: Row): QueryBuilder {
    this.filters.push((row) =>
      Object.entries(criteria).every(([key, value]) => row[key] === value),
    );
    return this;
  }

  async first(): Promise<Row | undefined> {
    return this.executeSync()[0];
  }

  async update(patch: Row): Promise<number> {
    const rows = this.executeSync(false);
    for (const row of rows) Object.assign(row, patch);
    return rows.length;
  }

  then<TResult1 = Row[], TResult2 = never>(
    onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.executeSync()).then(onfulfilled, onrejected);
  }

  private executeSync(clone = true): Row[] {
    const rows = (this.store[this.tableName] as Row[]).filter((row) =>
      this.filters.every((predicate) => predicate(row)),
    );
    return clone ? rows.map((row) => ({ ...row })) : rows;
  }
}

let dataStore: DataStore;
let callerRole = 'ADMIN';
let authenticated = true;
let writeActivityCalls: Array<Record<string, unknown>> = [];

function resetStore(): DataStore {
  return {
    boards: [{
      id: 'board-1',
      workspace_id: 'ws-1',
      title: 'Board',
      state: 'ACTIVE',
      github_project_url: null,
      created_at: '2026-01-01T00:00:00.000Z',
    }],
    memberships: [{ user_id: 'user-1', workspace_id: 'ws-1', role: 'ADMIN' }],
  };
}

mock.module('../../../../common/db', () => ({
  db: ((tableName: keyof DataStore) => new QueryBuilder(dataStore, tableName)) as unknown as typeof import('../../../../common/db').db,
}));

mock.module('../../../auth/middlewares/authentication', () => ({
  authenticate: async (req: Request & { currentUser?: { id: string; email: string } }) => {
    if (!authenticated) {
      return Response.json({ name: 'unauthorized' }, { status: 401 });
    }
    req.currentUser = { id: 'user-1', email: 'user@example.com' };
    return null;
  },
}));

mock.module('../../../board/middlewares/requireBoardAccess', () => ({
  requireBoardAccess: async (req: Request & { board?: Row }, boardId: string) => {
    const board = dataStore.boards.find((row) => row.id === boardId);
    if (!board) {
      return Response.json({ name: 'board-not-found' }, { status: 404 });
    }
    req.board = { ...board };
    return null;
  },
}));

mock.module('../../../../middlewares/permissionManager', () => ({
  requireWorkspaceMembership: async (req: Request & { callerRole?: string; workspaceId?: string }, workspaceId: string) => {
    if (!callerRole) {
      return Response.json({ name: 'insufficient-role' }, { status: 403 });
    }
    req.workspaceId = workspaceId;
    req.callerRole = callerRole;
    return null;
  },
  requireRole: (req: { callerRole?: string }, minRole: string) => {
    const ranks: Record<string, number> = { OWNER: 4, ADMIN: 3, MEMBER: 2, VIEWER: 1, GUEST: 0 };
    const callerRank = ranks[req.callerRole ?? ''] ?? -1;
    const minRank = ranks[minRole] ?? 0;
    if (callerRank < minRank) {
      return Response.json({ name: 'insufficient-role' }, { status: 403 });
    }
    return null;
  },
}));

mock.module('../../../activity/mods/write', () => ({
  writeActivity: async (input: Record<string, unknown>) => {
    writeActivityCalls.push(input);
    return {
      id: 'activity-1',
      created_at: new Date(),
      ...input,
    };
  },
}));

const { handleGetBoardIntegrations } = await import('../integrations/get');
const { handlePatchBoardIntegrations } = await import('../integrations/patch');

beforeEach(() => {
  dataStore = resetStore();
  callerRole = 'ADMIN';
  authenticated = true;
  writeActivityCalls = [];
});

describe('GET /api/v1/boards/:boardId/settings/integrations', () => {
  it('returns the current github_project_url', async () => {
    dataStore.boards[0]!.github_project_url = 'https://github.com/orgs/journeyh/projects/12';

    const res = await handleGetBoardIntegrations(
      new Request('http://localhost/api/v1/boards/board-1/settings/integrations'),
      'board-1',
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { github_project_url: string | null } };
    expect(body.data.github_project_url).toBe('https://github.com/orgs/journeyh/projects/12');
  });

  it('allows guest read access', async () => {
    callerRole = 'GUEST';

    const res = await handleGetBoardIntegrations(
      new Request('http://localhost/api/v1/boards/board-1/settings/integrations'),
      'board-1',
    );

    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/v1/boards/:boardId/settings/integrations', () => {
  it('normalizes and persists a valid URL, then emits audit activity', async () => {
    const res = await handlePatchBoardIntegrations(
      new Request('http://localhost/api/v1/boards/board-1/settings/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'bun-test' },
        body: JSON.stringify({ github_project_url: 'https://github.com/orgs/JourneyHorizon/projects/42/' }),
      }),
      'board-1',
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { github_project_url: string | null } };
    expect(body.data.github_project_url).toBe('https://github.com/orgs/JourneyHorizon/projects/42');
    expect(dataStore.boards[0]!.github_project_url).toBe('https://github.com/orgs/JourneyHorizon/projects/42');

    expect(writeActivityCalls).toHaveLength(1);
    const payload = writeActivityCalls[0]!.payload as {
      previous: { hash: string | null };
      next: { hash: string; reference: { scope: string; owner: string; projectNumber: number; repository: string | null } };
    };
    expect(writeActivityCalls[0]!.action).toBe('board_github_project_url_updated');
    expect(payload.previous.hash).toBeNull();
    expect(payload.next.reference.scope).toBe('org');
    expect(payload.next.reference.owner).toBe('JourneyHorizon');
    expect(payload.next.reference.projectNumber).toBe(42);
    expect(payload.next.reference.repository).toBeNull();
    expect(payload.next.hash.length).toBeGreaterThan(0);
    expect(JSON.stringify(payload).includes('https://github.com')).toBe(false);
  });

  it('accepts repository project URL shape', async () => {
    const res = await handlePatchBoardIntegrations(
      new Request('http://localhost/api/v1/boards/board-1/settings/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_project_url: 'https://github.com/octo-org/octo-repo/projects/7' }),
      }),
      'board-1',
    );
    expect(res.status).toBe(200);
  });

  it('returns 422 for invalid URL', async () => {
    const res = await handlePatchBoardIntegrations(
      new Request('http://localhost/api/v1/boards/board-1/settings/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // Three-segment path is ambiguous — neither project nor bare repo.
        body: JSON.stringify({ github_project_url: 'https://github.com/journeyh/not-a-project/extra' }),
      }),
      'board-1',
    );

    expect(res.status).toBe(422);
    expect(writeActivityCalls).toHaveLength(0);
    expect(dataStore.boards[0]!.github_project_url).toBeNull();
  });

  it('returns 403 for non-admin roles', async () => {
    callerRole = 'MEMBER';
    const memberRes = await handlePatchBoardIntegrations(
      new Request('http://localhost/api/v1/boards/board-1/settings/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_project_url: 'https://github.com/users/demo/projects/1' }),
      }),
      'board-1',
    );
    expect(memberRes.status).toBe(403);

    callerRole = 'GUEST';
    const guestRes = await handlePatchBoardIntegrations(
      new Request('http://localhost/api/v1/boards/board-1/settings/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_project_url: 'https://github.com/users/demo/projects/1' }),
      }),
      'board-1',
    );
    expect(guestRes.status).toBe(403);
  });

  it('does not emit activity when the normalized URL is unchanged', async () => {
    dataStore.boards[0]!.github_project_url = 'https://github.com/users/demo/projects/1';

    const res = await handlePatchBoardIntegrations(
      new Request('http://localhost/api/v1/boards/board-1/settings/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_project_url: 'https://github.com/users/demo/projects/1/' }),
      }),
      'board-1',
    );

    expect(res.status).toBe(200);
    expect(writeActivityCalls).toHaveLength(0);
  });
});
