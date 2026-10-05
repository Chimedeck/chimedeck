// Tests for card-chat message query — cursor-paginated retrieval.
import { describe, it, expect, beforeEach, mock } from 'bun:test';

// [why] mock.module is file-scoped in Bun — prevents cross-file contamination.
const chainFns: Record<string, ReturnType<typeof mock>> = {};
const KNOWN_CHAIN = ['where', 'whereIn', 'orderBy', 'leftJoin', 'limit', 'select'];
const KNOWN_TERMINAL = ['first', 'insert', 'update'];
for (const m of KNOWN_CHAIN) chainFns[m] = mock(() => chainProxy);
for (const m of KNOWN_TERMINAL) chainFns[m] = mock(() => undefined);
const chainProxy = new Proxy({} as Record<string, unknown>, {
  get(_target, prop) {
    if (typeof prop !== 'string') return undefined;
    if (!chainFns[prop]) chainFns[prop] = mock(() => chainProxy);
    return chainFns[prop];
  },
});
const dbRaw = mock((sql: string) => sql);
const dbFn = mock((_tableName: string) => chainProxy);
(dbFn as Record<string, unknown>).raw = dbRaw;
const q = (prop: string) => chainFns[prop] as ReturnType<typeof mock>;
mock.module('../../../../../common/db', () => ({ db: dbFn }));

// [why] query.ts does `await query` after `db(...).select(...)`. In real Knex, .select()
// returns a thenable QueryBuilder. Our mock's .select() returns a proxy — needs to be thenable.
function withRows(rows: unknown[]) {
  return mock(() => {
    const obj: Record<string, unknown> & {
      then: (resolve: (v: unknown) => void) => Promise<unknown>;
    } = {
      ...chainProxy,
      then: (resolve: (v: unknown) => void) => Promise.resolve(rows).then(resolve),
    };
    return obj;
  });
}

beforeEach(() => {
  const fns = [dbFn, dbRaw, ...Object.values(chainFns)];
  for (const fn of fns) {
    fn.mockClear();
    fn.mockImplementation(() => undefined);
  }
  for (const m of KNOWN_CHAIN) chainFns[m].mockImplementation(() => chainProxy);
  dbRaw.mockImplementation((sql: string) => sql);
  dbFn.mockImplementation((_tableName: string) => chainProxy);
});

describe('getCardChatMessages', () => {
  it('returns empty data when no session exists for the card', async () => {
    const { getCardChatMessages } = await import('../query');
    q('first').mockResolvedValueOnce(null);

    const result = await getCardChatMessages({ cardId: 'card-1' });

    expect(result.data).toEqual([]);
    expect(result.metadata).toEqual({ cursor: null, hasMore: false });
  });

  it('returns messages with author join for an active session', async () => {
    const { getCardChatMessages } = await import('../query');

    const session = { id: 'sess-1', card_id: 'card-1', status: 'ACTIVE_REFINEMENT' };
    const messageRow = {
      id: 'msg-1',
      session_id: 'sess-1',
      role: 'user',
      content: 'Hello',
      metadata: null,
      author_id: 'user-1',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      author_name: 'Test User',
      author_avatar_url: 'https://example.com/avatar.png',
    };

    q('first').mockResolvedValueOnce(session);
    chainFns['select'] = withRows([messageRow]);

    const result = await getCardChatMessages({ cardId: 'card-1' });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('msg-1');
    expect(result.data[0].authorName).toBe('Test User');
    expect(result.data[0].avatar).toBe('https://example.com/avatar.png');
    expect(result.metadata.hasMore).toBe(false);
    expect(result.metadata.cursor).toBe(null);
  });

  it('detects hasMore when result exceeds limit', async () => {
    const { getCardChatMessages } = await import('../query');

    const session = { id: 'sess-1', card_id: 'card-1', status: 'ACTIVE_REFINEMENT' };
    q('first').mockResolvedValueOnce(session);

    const rows = Array.from({ length: 51 }, (_, i) => ({
      id: `msg-${i}`,
      session_id: 'sess-1',
      role: 'user',
      content: `Msg ${i}`,
      metadata: null,
      author_id: null,
      created_at: `2026-01-01T00:${String(i).padStart(2, '0')}:00.000Z`,
      updated_at: `2026-01-01T00:${String(i).padStart(2, '0')}:00.000Z`,
      author_name: null,
      author_avatar_url: null,
    }));
    chainFns['select'] = withRows(rows);

    const result = await getCardChatMessages({ cardId: 'card-1' });

    expect(result.data).toHaveLength(50);
    expect(result.metadata.hasMore).toBe(true);
    expect(result.metadata.cursor).toBeTruthy();
  });

  it('uses cursor for keyset pagination when cursor is provided', async () => {
    const { getCardChatMessages } = await import('../query');

    const session = { id: 'sess-1', card_id: 'card-1', status: 'ACTIVE_REFINEMENT' };
    q('first').mockResolvedValueOnce(session);

    const rows = [
      {
        id: 'msg-1',
        session_id: 'sess-1',
        role: 'user',
        content: 'Hi',
        metadata: null,
        author_id: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        author_name: null,
        author_avatar_url: null,
      },
    ];
    chainFns['select'] = withRows(rows);

    const result = await getCardChatMessages({
      cardId: 'card-1',
      cursor: 'eyJpZCI6Im1zZy0wIiwiY3JlYXRlZF9hdCI6IjIwMjYtMDEtMDFUMjM6NTk6MDAuMDAwWiJ9',
    });

    expect(result.data).toHaveLength(1);
    expect(q('where')).toHaveBeenCalled();
  });

  it('caps limit at MAX_LIMIT (100)', async () => {
    const { getCardChatMessages } = await import('../query');

    const session = { id: 'sess-1', card_id: 'card-1', status: 'ACTIVE_REFINEMENT' };
    q('first').mockResolvedValueOnce(session);
    const rows = [
      {
        id: 'msg-1',
        session_id: 'sess-1',
        role: 'user',
        content: 'Hi',
        metadata: null,
        author_id: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        author_name: null,
        author_avatar_url: null,
      },
    ];
    chainFns['select'] = withRows(rows);

    const result = await getCardChatMessages({ cardId: 'card-1', limit: 200 });

    expect(result.data).toHaveLength(1);
    expect(q('limit')).toHaveBeenCalledWith(101); // MAX_LIMIT + 1 for hasMore
  });

  it('defaults limit to 50 when not provided', async () => {
    const { getCardChatMessages } = await import('../query');

    const session = { id: 'sess-1', card_id: 'card-1', status: 'ACTIVE_REFINEMENT' };
    q('first').mockResolvedValueOnce(session);
    const row = {
      id: 'msg-1',
      session_id: 'sess-1',
      role: 'assistant',
      content: 'AI response',
      metadata: null,
      author_id: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      author_name: null,
      author_avatar_url: null,
    };
    chainFns['select'] = withRows([row]);

    const result = await getCardChatMessages({ cardId: 'card-1' });

    expect(result.data).toHaveLength(1);
    expect(q('limit')).toHaveBeenCalledWith(51);
  });

  it('returns null avatar and authorName when no author match', async () => {
    const { getCardChatMessages } = await import('../query');

    const session = { id: 'sess-1', card_id: 'card-1', status: 'ACTIVE_REFINEMENT' };
    q('first').mockResolvedValueOnce(session);
    const row = {
      id: 'msg-1',
      session_id: 'sess-1',
      role: 'user',
      content: 'Hi',
      metadata: null,
      author_id: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      author_name: null,
      author_avatar_url: null,
    };
    chainFns['select'] = withRows([row]);

    const result = await getCardChatMessages({ cardId: 'card-1' });

    expect(result.data[0].authorName).toBeNull();
    expect(result.data[0].avatar).toBeNull();
  });

  it('uses most recent session when multiple exist for card', async () => {
    const { getCardChatMessages } = await import('../query');

    const newestSession = { id: 'sess-latest', card_id: 'card-1', status: 'ACTIVE_REFINEMENT' };
    q('first').mockResolvedValueOnce(newestSession);
    const rows = [
      {
        id: 'msg-1',
        session_id: 'sess-latest',
        role: 'user',
        content: 'First',
        metadata: null,
        author_id: null,
        created_at: '2026-01-01T00:01:00.000Z',
        updated_at: '2026-01-01T00:01:00.000Z',
        author_name: null,
        author_avatar_url: null,
      },
      {
        id: 'msg-2',
        session_id: 'sess-latest',
        role: 'user',
        content: 'Second',
        metadata: null,
        author_id: null,
        created_at: '2026-01-01T00:02:00.000Z',
        updated_at: '2026-01-01T00:02:00.000Z',
        author_name: null,
        author_avatar_url: null,
      },
    ];
    chainFns['select'] = withRows(rows);

    const result = await getCardChatMessages({ cardId: 'card-1' });

    expect(result.data).toHaveLength(2);
    expect(result.data[0].content).toBe('First');
    expect(result.data[1].content).toBe('Second');
  });

  it('returns messages in ascending created_at order', async () => {
    const { getCardChatMessages } = await import('../query');

    const session = { id: 'sess-1', card_id: 'card-1', status: 'ACTIVE_REFINEMENT' };
    q('first').mockResolvedValueOnce(session);
    const rows = [
      {
        id: 'msg-1',
        session_id: 'sess-1',
        role: 'user',
        content: 'Hi',
        metadata: null,
        author_id: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        author_name: null,
        author_avatar_url: null,
      },
    ];
    chainFns['select'] = withRows(rows);

    await getCardChatMessages({ cardId: 'card-1' });

    // [why] orderBy is called 3 times: for session query (desc) + message query (m.created_at asc, m.id asc)
    expect(q('orderBy')).toHaveBeenCalledTimes(3);
    expect(q('orderBy').mock.calls).toContainEqual(['created_at', 'desc']); // session query
    expect(q('orderBy').mock.calls).toContainEqual(['m.created_at', 'asc']); // message query
    expect(q('orderBy').mock.calls).toContainEqual(['m.id', 'asc']); // message query
  });

  it('handles NaN limit by falling back to default', async () => {
    const { getCardChatMessages } = await import('../query');

    const session = { id: 'sess-1', card_id: 'card-1', status: 'ACTIVE_REFINEMENT' };
    q('first').mockResolvedValueOnce(session);
    const rows = [
      {
        id: 'msg-1',
        session_id: 'sess-1',
        role: 'user',
        content: 'Hi',
        metadata: null,
        author_id: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        author_name: null,
        author_avatar_url: null,
      },
    ];
    chainFns['select'] = withRows(rows);

    const result = await getCardChatMessages({ cardId: 'card-1', limit: NaN });

    expect(result.data).toHaveLength(1);
    expect(q('limit')).toHaveBeenCalledWith(51);
  });

  it('handles zero limit by falling back to default', async () => {
    const { getCardChatMessages } = await import('../query');

    const session = { id: 'sess-1', card_id: 'card-1', status: 'ACTIVE_REFINEMENT' };
    q('first').mockResolvedValueOnce(session);
    const rows = [
      {
        id: 'msg-1',
        session_id: 'sess-1',
        role: 'user',
        content: 'Hi',
        metadata: null,
        author_id: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        author_name: null,
        author_avatar_url: null,
      },
    ];
    chainFns['select'] = withRows(rows);

    const result = await getCardChatMessages({ cardId: 'card-1', limit: 0 });

    expect(result.data).toHaveLength(1);
    expect(q('limit')).toHaveBeenCalledWith(51);
  });
});
