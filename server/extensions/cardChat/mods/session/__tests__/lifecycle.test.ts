// Tests for card-chat session lifecycle — start, pause, ensure-active.
import { describe, it, expect, beforeEach, mock } from 'bun:test';

// [why] mock.module is file-scoped in Bun, preventing vi.mock cross-file hoisting issues.
// All cardChat tests must use mock.module instead of vi.mock.

// ---- mock chain builder (Knex-style: db('table').where(...).first()) ----
const chainFns: Record<string, ReturnType<typeof mock>> = {};
const KNOWN_CHAIN_METHODS = ['where', 'whereIn', 'orderBy', 'leftJoin', 'limit', 'select'];
const KNOWN_TERMINAL_METHODS = ['first', 'insert', 'update'];

// [why] Eagerly create all known chain/terminal methods so mockClear can reset them.
for (const m of KNOWN_CHAIN_METHODS) {
  chainFns[m] = mock(() => chainProxy);
}
for (const m of KNOWN_TERMINAL_METHODS) {
  chainFns[m] = mock(() => undefined);
}

const chainProxy = new Proxy({} as Record<string, unknown>, {
  get(_target, prop) {
    if (typeof prop !== 'string') return undefined;
    if (!chainFns[prop]) {
      // Unknown method — treat as chain
      chainFns[prop] = mock(() => chainProxy);
    }
    return chainFns[prop];
  },
});

const dbRaw = mock((sql: string) => sql);
const dbTrx = mock((fn: (trx: unknown) => Promise<unknown>) => fn(dbFn));
const dbFn = mock((_tableName: string) => chainProxy);
(dbFn as Record<string, unknown>).raw = dbRaw;
(dbFn as Record<string, unknown>).transaction = dbTrx;

mock.module('../../../../../common/db', () => ({
  db: dbFn,
}));

// Convenience getter for chain methods
const q = (prop: string) => chainFns[prop] as ReturnType<typeof mock>;

beforeEach(() => {
  // Reset calls + implementations for all known methods
  const allFns = [dbFn, dbRaw, dbTrx, ...Object.values(chainFns)];
  for (const fn of allFns) {
    fn.mockClear();
    fn.mockImplementation(() => undefined);
  }
  // Re-apply default implementations after clear
  for (const m of KNOWN_CHAIN_METHODS) {
    chainFns[m].mockImplementation(() => chainProxy);
  }
  for (const m of KNOWN_TERMINAL_METHODS) {
    chainFns[m].mockImplementation(() => undefined);
  }
  dbRaw.mockImplementation((sql: string) => sql);
  dbTrx.mockImplementation((fn: (trx: unknown) => Promise<unknown>) => fn(dbFn));
  dbFn.mockImplementation((_tableName: string) => chainProxy);
});

describe('startSession', () => {
  it('creates a new session when none exists', async () => {
    const { startSession } = await import('../lifecycle');

    q('first')!.mockResolvedValueOnce(null);
    q('insert')!.mockResolvedValueOnce(undefined);

    const result = await startSession({
      cardId: 'card-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
    });

    expect(result.status).toBe(201);
    expect(result.data.session.status).toBe('ACTIVE_REFINEMENT');
    expect(result.data.session.card_id).toBe('card-1');
    expect(result.data.session.workspace_id).toBe('ws-1');
    expect(result.data.session.created_by).toBe('user-1');
    expect(q('insert')).toHaveBeenCalledTimes(1);
  });

  it('returns existing active session instead of creating a new one', async () => {
    const { startSession } = await import('../lifecycle');

    const existingSession = {
      id: 'session-existing',
      card_id: 'card-1',
      workspace_id: 'ws-1',
      created_by: 'user-1',
      status: 'ACTIVE_REFINEMENT',
      quality_score: null,
      last_actor_at: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    q('first')!.mockResolvedValueOnce(existingSession);

    const result = await startSession({
      cardId: 'card-1',
      workspaceId: 'ws-1',
      userId: 'user-2',
    });

    expect(result.status).toBe(201);
    expect(result.data.session.id).toBe('session-existing');
    expect(result.data.session.status).toBe('ACTIVE_REFINEMENT');
    expect(q('insert')).toHaveBeenCalledTimes(0);
  });

  it('returns existing paused session (idempotent)', async () => {
    const { startSession } = await import('../lifecycle');

    const pausedSession = {
      id: 'session-paused',
      card_id: 'card-1',
      workspace_id: 'ws-1',
      created_by: 'user-1',
      status: 'PAUSED',
      quality_score: 45,
      last_actor_at: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    q('first')!.mockResolvedValueOnce(pausedSession);

    const result = await startSession({
      cardId: 'card-1',
      workspaceId: 'ws-1',
      userId: 'user-2',
    });

    expect(result.status).toBe(201);
    expect(result.data.session.id).toBe('session-paused');
  });
});

describe('pauseSession', () => {
  it('pauses an active session', async () => {
    const { pauseSession } = await import('../lifecycle');

    const activeSession = {
      id: 'session-1',
      card_id: 'card-1',
      workspace_id: 'ws-1',
      created_by: 'user-1',
      status: 'ACTIVE_REFINEMENT',
      quality_score: null,
      last_actor_at: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    q('first')!.mockResolvedValueOnce(activeSession);
    q('update')!.mockResolvedValueOnce(1);

    const result = await pauseSession({
      sessionId: 'session-1',
      cardId: 'card-1',
      userId: 'user-1',
    });

    expect(result.status).toBe(200);
    expect((result as { data: { session: { status: string } } }).data.session.status).toBe('PAUSED');
  });

  it('returns 404 for non-existent session', async () => {
    const { pauseSession } = await import('../lifecycle');

    q('first')!.mockResolvedValueOnce(null);

    const result = await pauseSession({
      sessionId: 'nonexistent',
      cardId: 'card-1',
      userId: 'user-1',
    });

    expect(result.status).toBe(404);
    if ('name' in result) {
      expect(result.name).toBe('session-not-found');
    }
  });

  it('returns 409 for already-paused session', async () => {
    const { pauseSession } = await import('../lifecycle');

    const pausedSession = {
      id: 'session-1',
      card_id: 'card-1',
      workspace_id: 'ws-1',
      created_by: 'user-1',
      status: 'PAUSED',
      quality_score: null,
      last_actor_at: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    q('first')!.mockResolvedValueOnce(pausedSession);

    const result = await pauseSession({
      sessionId: 'session-1',
      cardId: 'card-1',
      userId: 'user-1',
    });

    expect(result.status).toBe(409);
    if ('name' in result) {
      expect(result.name).toBe('session-already-paused');
    }
  });

  it('returns 409 for READY_FOR_REVIEW session', async () => {
    const { pauseSession } = await import('../lifecycle');

    const readySession = {
      id: 'session-1',
      card_id: 'card-1',
      workspace_id: 'ws-1',
      created_by: 'user-1',
      status: 'READY_FOR_REVIEW',
      quality_score: 95,
      last_actor_at: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    q('first')!.mockResolvedValueOnce(readySession);

    const result = await pauseSession({
      sessionId: 'session-1',
      cardId: 'card-1',
      userId: 'user-1',
    });

    expect(result.status).toBe(409);
    if ('name' in result) {
      expect(result.name).toBe('session-is-ready-for-review');
    }
  });
});

describe('ensureActiveSession', () => {
  it('creates a new session when none exists', async () => {
    const { ensureActiveSession } = await import('../lifecycle');

    q('first')!.mockResolvedValueOnce(null);
    q('insert')!.mockResolvedValueOnce(undefined);

    const result = await ensureActiveSession({
      cardId: 'card-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
    });

    expect(result.status).toBe(201);
    expect(result.data.session.status).toBe('ACTIVE_REFINEMENT');
  });

  it('returns existing active session', async () => {
    const { ensureActiveSession } = await import('../lifecycle');

    const activeSession = {
      id: 'session-1',
      card_id: 'card-1',
      workspace_id: 'ws-1',
      created_by: 'user-1',
      status: 'ACTIVE_REFINEMENT',
      quality_score: 45,
      last_actor_at: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    q('first')!.mockResolvedValueOnce(activeSession);

    const result = await ensureActiveSession({
      cardId: 'card-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
    });

    expect(result.status).toBe(200);
    expect(result.data.session.id).toBe('session-1');
    expect(result.data.session.status).toBe('ACTIVE_REFINEMENT');
  });

  it('resumes a paused session', async () => {
    const { ensureActiveSession } = await import('../lifecycle');

    const pausedSession = {
      id: 'session-paused',
      card_id: 'card-1',
      workspace_id: 'ws-1',
      created_by: 'user-1',
      status: 'PAUSED',
      quality_score: 60,
      last_actor_at: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    q('first')!.mockResolvedValueOnce(pausedSession);
    q('update')!.mockResolvedValueOnce(1);

    const result = await ensureActiveSession({
      cardId: 'card-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
    });

    expect(result.status).toBe(200);
    expect(result.data.session.status).toBe('ACTIVE_REFINEMENT');
    expect(q('update')).toHaveBeenCalledTimes(1);
  });
});

describe('resumeSession', () => {
  it('resumes a paused session to ACTIVE_REFINEMENT', async () => {
    const { resumeSession } = await import('../lifecycle');

    const pausedSession = {
      id: 'session-1',
      card_id: 'card-1',
      workspace_id: 'ws-1',
      created_by: 'user-1',
      status: 'PAUSED',
      quality_score: 60,
      last_actor_at: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    q('first')!.mockResolvedValueOnce(pausedSession);
    q('update')!.mockResolvedValueOnce(1);

    const result = await resumeSession({
      sessionId: 'session-1',
      cardId: 'card-1',
      userId: 'user-1',
    });

    expect(result.status).toBe(200);
    expect((result as { data: { session: { status: string } } }).data.session.status).toBe('ACTIVE_REFINEMENT');
    expect(q('update')).toHaveBeenCalledTimes(1);
  });

  it('resumes an IDLE session to ACTIVE_REFINEMENT', async () => {
    const { resumeSession } = await import('../lifecycle');

    const idleSession = {
      id: 'session-1',
      card_id: 'card-1',
      workspace_id: 'ws-1',
      created_by: 'user-1',
      status: 'IDLE',
      quality_score: null,
      last_actor_at: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    q('first')!.mockResolvedValueOnce(idleSession);
    q('update')!.mockResolvedValueOnce(1);

    const result = await resumeSession({
      sessionId: 'session-1',
      cardId: 'card-1',
      userId: 'user-1',
    });

    expect(result.status).toBe(200);
    expect((result as { data: { session: { status: string } } }).data.session.status).toBe('ACTIVE_REFINEMENT');
  });

  it('returns 200 no-op for already-active session', async () => {
    const { resumeSession } = await import('../lifecycle');

    const activeSession = {
      id: 'session-1',
      card_id: 'card-1',
      workspace_id: 'ws-1',
      created_by: 'user-1',
      status: 'ACTIVE_REFINEMENT',
      quality_score: 45,
      last_actor_at: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    q('first')!.mockResolvedValueOnce(activeSession);

    const result = await resumeSession({
      sessionId: 'session-1',
      cardId: 'card-1',
      userId: 'user-1',
    });

    expect(result.status).toBe(200);
    expect(result.data.session.status).toBe('ACTIVE_REFINEMENT');
    expect(q('update')).toHaveBeenCalledTimes(0);
  });

  it('returns 409 for READY_FOR_REVIEW session', async () => {
    const { resumeSession } = await import('../lifecycle');

    const readySession = {
      id: 'session-1',
      card_id: 'card-1',
      workspace_id: 'ws-1',
      created_by: 'user-1',
      status: 'READY_FOR_REVIEW',
      quality_score: 95,
      last_actor_at: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    q('first')!.mockResolvedValueOnce(readySession);

    const result = await resumeSession({
      sessionId: 'session-1',
      cardId: 'card-1',
      userId: 'user-1',
    });

    expect(result.status).toBe(409);
    if ('name' in result) {
      expect(result.name).toBe('session-is-ready-for-review');
    }
  });

  it('returns 404 for non-existent session', async () => {
    const { resumeSession } = await import('../lifecycle');

    q('first')!.mockResolvedValueOnce(null);

    const result = await resumeSession({
      sessionId: 'nonexistent',
      cardId: 'card-1',
      userId: 'user-1',
    });

    expect(result.status).toBe(404);
    if ('name' in result) {
      expect(result.name).toBe('session-not-found');
    }
  });
});
