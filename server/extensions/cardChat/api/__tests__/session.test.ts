// Integration tests for card-chat session API handlers
// (POST /api/v1/cards/:cardId/chat/session/start, pause, GET /api/v1/cards/:cardId/chat).
import { describe, it, expect, beforeEach, mock } from 'bun:test';

const mockAuthenticate = mock();
const mockRequireMembership = mock();
const mockStartSession = mock();
const mockPauseSession = mock();
const mockEmitActivity = mock();
const mockGetSession = mock();

mock.module('../../../../../config/env', () => ({
  env: {
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    JWT_PRIVATE_KEY: 'test',
    JWT_PUBLIC_KEY: 'test',
  },
}));

mock.module('../../../auth/middlewares/authentication', () => ({
  authenticate: mockAuthenticate,
}));

mock.module('../../../../middlewares/permissionManager', () => ({
  requireWorkspaceMembership: mockRequireMembership,
}));

mock.module('../../mods/session/lifecycle', () => ({
  startSession: mockStartSession,
  pauseSession: mockPauseSession,
}));

mock.module('../../mods/activities', () => ({
  emitCardChatActivity: mockEmitActivity,
}));

mock.module('../session/get', () => ({
  handleGetCardChatSession: mockGetSession,
  cardChatSessionGetDeps: { authenticate: mock(), requireWorkspaceMembership: mock(), db: mock() },
}));

function addAuthContext(req: Request): void {
  (req as Record<string, unknown>).currentUser = {
    id: 'user-1',
    name: 'Alice',
    email: 'alice@test.local',
  };
  (req as Record<string, unknown>).workspaceId = 'ws-1';
}

const cardId = 'card-abc';

beforeEach(() => {
  mockAuthenticate.mockClear();
  mockRequireMembership.mockClear();
  mockStartSession.mockClear();
  mockPauseSession.mockClear();
  mockEmitActivity.mockClear();
  mockGetSession.mockClear();
});

describe('handleStartCardChatSession', () => {
  it('returns 401 when authentication fails', async () => {
    mockAuthenticate.mockResolvedValueOnce(
      new Response(JSON.stringify({ name: 'unauthorized' }), { status: 401 })
    );

    const { handleStartCardChatSession } = await import('../session/start');

    const result = await handleStartCardChatSession(
      new Request('http://localhost/api/v1/cards/card-abc/chat/session/start', { method: 'POST' }),
      cardId
    );
    expect(result.status).toBe(401);
  });

  it('returns 201 with session on success', async () => {
    mockAuthenticate.mockImplementationOnce((req: Record<string, unknown>) => {
      addAuthContext(req as Request);
      return null;
    });
    mockRequireMembership.mockResolvedValueOnce(null);
    mockStartSession.mockResolvedValueOnce({
      status: 201,
      data: {
        session: {
          id: 'sess-1',
          card_id: cardId,
          workspace_id: 'ws-1',
          created_by: 'user-1',
          status: 'ACTIVE_REFINEMENT',
          quality_score: null,
          last_actor_at: '2026-01-01T00:00:00.000Z',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      },
    });

    const { handleStartCardChatSession } = await import('../session/start');

    const result = await handleStartCardChatSession(
      new Request('http://localhost/api/v1/cards/card-abc/chat/session/start', { method: 'POST' }),
      cardId
    );
    expect(result.status).toBe(201);
    const body = (await result.json()) as { data: { id: string; status: string } };
    expect(body.data.id).toBe('sess-1');
    expect(body.data.status).toBe('ACTIVE_REFINEMENT');
  });

  it('passes correct params to startSession', async () => {
    mockAuthenticate.mockImplementationOnce((req: Record<string, unknown>) => {
      addAuthContext(req as Request);
      return null;
    });
    mockRequireMembership.mockResolvedValueOnce(null);
    mockStartSession.mockResolvedValueOnce({
      status: 201,
      data: { session: { id: 'sess-1', status: 'ACTIVE_REFINEMENT' } },
    });

    const { handleStartCardChatSession } = await import('../session/start');

    await handleStartCardChatSession(
      new Request('http://localhost/api/v1/cards/card-abc/chat/session/start', { method: 'POST' }),
      cardId
    );
    expect(mockStartSession).toHaveBeenCalledWith({
      cardId,
      workspaceId: 'ws-1',
      userId: 'user-1',
    });
  });
});

describe('handlePauseCardChatSession', () => {
  it('returns 400 when body is not valid JSON', async () => {
    mockAuthenticate.mockResolvedValueOnce(null);
    mockRequireMembership.mockResolvedValueOnce(null);

    const { handlePauseCardChatSession } = await import('../session/pause');

    const result = await handlePauseCardChatSession(
      new Request('http://localhost/api/v1/cards/card-abc/chat/session/pause', {
        method: 'POST',
        body: 'not json',
      }),
      cardId
    );
    expect(result.status).toBe(400);
    const body = (await result.json()) as { name: string };
    expect(body.name).toBe('invalid-request-body');
  });

  it('returns 400 when sessionId is missing', async () => {
    mockAuthenticate.mockResolvedValueOnce(null);
    mockRequireMembership.mockResolvedValueOnce(null);

    const { handlePauseCardChatSession } = await import('../session/pause');

    const result = await handlePauseCardChatSession(
      new Request('http://localhost/api/v1/cards/card-abc/chat/session/pause', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      cardId
    );
    expect(result.status).toBe(400);
    const body = (await result.json()) as { name: string };
    expect(body.name).toBe('missing-session-id');
  });

  it('returns 200 with PAUSED session on success', async () => {
    mockAuthenticate.mockImplementationOnce((req: Record<string, unknown>) => {
      addAuthContext(req as Request);
      return null;
    });
    mockRequireMembership.mockResolvedValueOnce(null);
    mockPauseSession.mockResolvedValueOnce({
      status: 200,
      data: {
        session: {
          id: 'sess-1',
          card_id: cardId,
          workspace_id: 'ws-1',
          created_by: 'user-1',
          status: 'PAUSED',
          quality_score: 50,
          last_actor_at: '2026-01-01T00:00:00.000Z',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      },
    });
    mockEmitActivity.mockResolvedValueOnce(undefined);

    const { handlePauseCardChatSession } = await import('../session/pause');

    const result = await handlePauseCardChatSession(
      new Request('http://localhost/api/v1/cards/card-abc/chat/session/pause', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 'sess-1' }),
      }),
      cardId
    );
    expect(result.status).toBe(200);
    const body = (await result.json()) as { data: { status: string } };
    expect(body.data.status).toBe('PAUSED');
    expect(mockEmitActivity).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'card_ai_assist_paused' })
    );
  });

  it('returns 404 when session not found', async () => {
    mockAuthenticate.mockImplementationOnce((req: Record<string, unknown>) => {
      addAuthContext(req as Request);
      return null;
    });
    mockRequireMembership.mockResolvedValueOnce(null);
    mockPauseSession.mockResolvedValueOnce({
      status: 404,
      name: 'session-not-found',
      data: { message: 'Session not found' },
    });

    const { handlePauseCardChatSession } = await import('../session/pause');

    const result = await handlePauseCardChatSession(
      new Request('http://localhost/api/v1/cards/card-abc/chat/session/pause', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 'sess-404' }),
      }),
      cardId
    );
    expect(result.status).toBe(404);
    const body = (await result.json()) as { name: string };
    expect(body.name).toBe('session-not-found');
  });

  it('returns 409 when session is already paused', async () => {
    mockAuthenticate.mockImplementationOnce((req: Record<string, unknown>) => {
      addAuthContext(req as Request);
      return null;
    });
    mockRequireMembership.mockResolvedValueOnce(null);
    mockPauseSession.mockResolvedValueOnce({
      status: 409,
      name: 'session-already-paused',
      data: { message: 'Session is already paused' },
    });

    const { handlePauseCardChatSession } = await import('../session/pause');

    const result = await handlePauseCardChatSession(
      new Request('http://localhost/api/v1/cards/card-abc/chat/session/pause', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 'sess-1' }),
      }),
      cardId
    );
    expect(result.status).toBe(409);
    const body = (await result.json()) as { name: string };
    expect(body.name).toBe('session-already-paused');
  });
});

describe('handleGetCardChatSession', () => {
  it('returns { data: null } when no active/paused session exists', async () => {
    mockGetSession.mockResolvedValueOnce(Response.json({ data: null }, { status: 200 }));

    const result = await mockGetSession(
      new Request('http://localhost/api/v1/cards/card-abc/chat'),
      cardId
    );
    expect(result.status).toBe(200);
    const body = (await result.json()) as { data: unknown };
    expect(body.data).toBe(null);
  });

  it('returns session with latest message when active session exists', async () => {
    mockGetSession.mockResolvedValueOnce(
      Response.json(
        {
          data: {
            session: { id: 'sess-1', card_id: cardId, status: 'ACTIVE_REFINEMENT' },
            latestMessage: { id: 'msg-1', content: 'Hello' },
          },
        },
        { status: 200 }
      )
    );

    const result = await mockGetSession(
      new Request('http://localhost/api/v1/cards/card-abc/chat'),
      cardId
    );
    expect(result.status).toBe(200);
    const body = (await result.json()) as {
      data: { session: { id: string }; latestMessage: { id: string } | null };
    };
    expect(body.data.session.id).toBe('sess-1');
    expect(body.data.latestMessage).not.toBe(null);
    expect(body.data.latestMessage!.id).toBe('msg-1');
  });
});
