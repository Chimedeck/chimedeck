// Tests for card-chat message write operations.
import { describe, it, expect, beforeEach, mock } from 'bun:test';

// [why] mock.module is file-scoped in Bun — prevents cross-file contamination.
const chainFns: Record<string, ReturnType<typeof mock>> = {};
const KNOWN_CHAIN = ['where', 'whereIn', 'orderBy', 'limit', 'select'];
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
const dbTrx = mock((fn: (trx: unknown) => Promise<unknown>) => fn(dbFn));
const dbFn = mock((_tableName: string) => chainProxy);
(dbFn as Record<string, unknown>).raw = dbRaw;
(dbFn as Record<string, unknown>).transaction = dbTrx;
const q = (prop: string) => chainFns[prop] as ReturnType<typeof mock>;

mock.module('../../../../../common/db', () => ({ db: dbFn }));

beforeEach(() => {
  for (const fn of [dbFn, dbRaw, dbTrx, ...Object.values(chainFns)]) {
    fn.mockClear();
    fn.mockImplementation(() => undefined);
  }
  for (const m of KNOWN_CHAIN) chainFns[m].mockImplementation(() => chainProxy);
  dbRaw.mockImplementation((sql: string) => sql);
  dbTrx.mockImplementation((fn: (trx: unknown) => Promise<unknown>) => fn(dbFn));
  dbFn.mockImplementation((_tableName: string) => chainProxy);
});

describe('writeCardChatMessage', () => {
  it('writes a user message to an active session', async () => {
    const { writeCardChatMessage } = await import('../write');

    q('first').mockResolvedValueOnce({ id: 'session-1', status: 'ACTIVE_REFINEMENT' });
    q('insert').mockResolvedValueOnce(undefined);
    q('update').mockResolvedValueOnce(1);

    const result = await writeCardChatMessage({
      sessionId: 'session-1', cardId: 'card-1', authorId: 'user-1',
      role: 'user', content: 'The system should allow users to log in.',
    });

    expect(result.status).toBe(201);
    expect(result.data.message.role).toBe('user');
    expect(result.data.message.content).toBe('The system should allow users to log in.');
    expect(result.data.message.session_id).toBe('session-1');
    expect(q('insert')).toHaveBeenCalledTimes(1);
    expect(q('update')).toHaveBeenCalledTimes(1);
  });

  it('writes an assistant message', async () => {
    const { writeCardChatMessage } = await import('../write');

    q('first').mockResolvedValueOnce({ id: 'session-1', status: 'ACTIVE_REFINEMENT' });
    q('insert').mockResolvedValueOnce(undefined);
    q('update').mockResolvedValueOnce(1);

    const result = await writeCardChatMessage({
      sessionId: 'session-1', cardId: 'card-1', authorId: 'user-1',
      role: 'assistant', content: 'Thank you for that information.',
    });

    expect(result.status).toBe(201);
    expect(result.data.message.role).toBe('assistant');
  });

  it('throws for empty content', async () => {
    const { writeCardChatMessage } = await import('../write');

    await expect(
      writeCardChatMessage({
        sessionId: 'session-1', cardId: 'card-1', authorId: 'user-1',
        role: 'user', content: '',
      }),
    ).rejects.toThrow('missing-card-chat-content');
  });

  it('trims whitespace from content', async () => {
    const { writeCardChatMessage } = await import('../write');

    q('first').mockResolvedValueOnce({ id: 'session-1', status: 'ACTIVE_REFINEMENT' });
    q('insert').mockResolvedValueOnce(undefined);
    q('update').mockResolvedValueOnce(1);

    const result = await writeCardChatMessage({
      sessionId: 'session-1', cardId: 'card-1', authorId: 'user-1',
      role: 'user', content: '  Hello world  ',
    });

    expect(result.data.message.content).toBe('Hello world');
  });

  it('throws for non-existent session', async () => {
    const { writeCardChatMessage } = await import('../write');
    q('first').mockResolvedValueOnce(null);

    await expect(
      writeCardChatMessage({
        sessionId: 'nonexistent', cardId: 'card-1', authorId: 'user-1',
        role: 'user', content: 'Hello',
      }),
    ).rejects.toThrow('card-chat-session-not-found');
  });

  it('throws for paused session', async () => {
    const { writeCardChatMessage } = await import('../write');
    q('first').mockResolvedValueOnce({ id: 'session-1', status: 'PAUSED' });

    await expect(
      writeCardChatMessage({
        sessionId: 'session-1', cardId: 'card-1', authorId: 'user-1',
        role: 'user', content: 'Hello',
      }),
    ).rejects.toThrow('card-chat-session-not-active');
  });

  it('throws for READY_FOR_REVIEW session', async () => {
    const { writeCardChatMessage } = await import('../write');
    q('first').mockResolvedValueOnce({ id: 'session-1', status: 'READY_FOR_REVIEW' });

    await expect(
      writeCardChatMessage({
        sessionId: 'session-1', cardId: 'card-1', authorId: 'user-1',
        role: 'user', content: 'Hello',
      }),
    ).rejects.toThrow('card-chat-session-not-active');
  });

  it('bumps last_actor_at on the session after write', async () => {
    const { writeCardChatMessage } = await import('../write');

    q('first').mockResolvedValueOnce({ id: 'session-1', status: 'ACTIVE_REFINEMENT' });
    q('insert').mockResolvedValueOnce(undefined);
    q('update').mockResolvedValueOnce(1);

    await writeCardChatMessage({
      sessionId: 'session-1', cardId: 'card-1', authorId: 'user-1',
      role: 'user', content: 'Hello',
    });

    const updateCall = q('update').mock.calls[0]?.[0] as
      | { last_actor_at?: string; updated_at?: string }
      | undefined;
    expect(updateCall?.last_actor_at).toBeDefined();
    expect(updateCall?.updated_at).toBeDefined();
  });
});
