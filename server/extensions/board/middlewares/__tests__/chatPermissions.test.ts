import { beforeEach, describe, expect, it, mock } from 'bun:test';

type Row = Record<string, unknown>;
type DataStore = {
  board_chat_permissions: Row[];
};

class QueryBuilder {
  private filters: Array<(row: Row) => boolean> = [];

  constructor(
    private readonly store: DataStore,
    private readonly tableName: keyof DataStore,
  ) {}

  where(criteria: Row): QueryBuilder {
    this.filters.push((row) => Object.entries(criteria).every(([key, value]) => row[key] === value));
    return this;
  }

  async first(): Promise<Row | undefined> {
    return this.executeSync()[0];
  }

  private executeSync(): Row[] {
    return (this.store[this.tableName] as Row[]).filter((row) =>
      this.filters.every((predicate) => predicate(row)),
    );
  }
}

let dataStore: DataStore;

mock.module('../../../../common/db', () => ({
  db: ((tableName: keyof DataStore) => new QueryBuilder(dataStore, tableName)) as unknown as typeof import('../../../../common/db').db,
}));

const {
  requireGuestCanViewBoardChat,
  requireGuestCanUseBoardChat,
} = await import('../chatPermissions');

beforeEach(() => {
  dataStore = {
    board_chat_permissions: [],
  };
});

describe('chat permissions middleware', () => {
  it('allows workspace members to view/send regardless of guest toggles', async () => {
    const req = {
      currentUser: { id: 'user-1', email: 'member@example.com' },
      callerRole: 'MEMBER',
    } as Request & { currentUser: { id: string; email: string }; callerRole: string };

    const viewResult = await requireGuestCanViewBoardChat(req as any, 'board-1');
    const sendResult = await requireGuestCanUseBoardChat(req as any, 'board-1');

    expect(viewResult).toBeNull();
    expect(sendResult).toBeNull();
  });

  it('denies guest view access by default when permission row is missing', async () => {
    const req = {
      currentUser: { id: 'guest-1', email: 'guest@example.com' },
      callerRole: 'GUEST',
    } as Request & { currentUser: { id: string; email: string }; callerRole: string };

    const result = await requireGuestCanViewBoardChat(req as any, 'board-1');

    expect(result?.status).toBe(403);
    const body = await result!.json() as { name: string };
    expect(body.name).toBe('guest-chat-view-denied');
  });

  it('denies guest send access by default when permission row is missing', async () => {
    const req = {
      currentUser: { id: 'guest-1', email: 'guest@example.com' },
      callerRole: 'GUEST',
    } as Request & { currentUser: { id: string; email: string }; callerRole: string };

    const result = await requireGuestCanUseBoardChat(req as any, 'board-1');

    expect(result?.status).toBe(403);
    const body = await result!.json() as { name: string };
    expect(body.name).toBe('guest-chat-use-denied');
  });

  it('allows guest view when guest_can_view=true', async () => {
    dataStore.board_chat_permissions.push({
      board_id: 'board-1',
      guest_can_view: true,
      guest_can_use: false,
    });
    const req = {
      currentUser: { id: 'guest-1', email: 'guest@example.com' },
      callerRole: 'GUEST',
    } as Request & { currentUser: { id: string; email: string }; callerRole: string };

    const result = await requireGuestCanViewBoardChat(req as any, 'board-1');
    expect(result).toBeNull();
  });

  it('denies guest send when guest_can_use=false even if guest_can_view=true', async () => {
    dataStore.board_chat_permissions.push({
      board_id: 'board-1',
      guest_can_view: true,
      guest_can_use: false,
    });
    const req = {
      currentUser: { id: 'guest-1', email: 'guest@example.com' },
      callerRole: 'GUEST',
    } as Request & { currentUser: { id: string; email: string }; callerRole: string };

    const result = await requireGuestCanUseBoardChat(req as any, 'board-1');

    expect(result?.status).toBe(403);
    const body = await result!.json() as { name: string };
    expect(body.name).toBe('guest-chat-use-denied');
  });

  it('allows guest view/send when both toggles are true', async () => {
    dataStore.board_chat_permissions.push({
      board_id: 'board-1',
      guest_can_view: true,
      guest_can_use: true,
    });
    const req = {
      currentUser: { id: 'guest-1', email: 'guest@example.com' },
      callerRole: 'GUEST',
    } as Request & { currentUser: { id: string; email: string }; callerRole: string };

    const viewResult = await requireGuestCanViewBoardChat(req as any, 'board-1');
    const sendResult = await requireGuestCanUseBoardChat(req as any, 'board-1');
    expect(viewResult).toBeNull();
    expect(sendResult).toBeNull();
  });

  it('applies coupling: guest_can_view=false forces send denial even with guest_can_use=true', async () => {
    dataStore.board_chat_permissions.push({
      board_id: 'board-1',
      guest_can_view: false,
      guest_can_use: true,
    });
    const req = {
      currentUser: { id: 'guest-1', email: 'guest@example.com' },
      callerRole: 'GUEST',
    } as Request & { currentUser: { id: string; email: string }; callerRole: string };

    const viewResult = await requireGuestCanViewBoardChat(req as any, 'board-1');
    const sendResult = await requireGuestCanUseBoardChat(req as any, 'board-1');

    expect(viewResult?.status).toBe(403);
    expect(sendResult?.status).toBe(403);
  });

  it('returns 401 when caller is unauthenticated', async () => {
    const req = { callerRole: 'GUEST' } as Request & { callerRole: string };
    const result = await requireGuestCanViewBoardChat(req as any, 'board-1');
    expect(result?.status).toBe(401);
  });
});
