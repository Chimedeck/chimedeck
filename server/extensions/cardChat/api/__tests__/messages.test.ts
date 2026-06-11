// Integration tests for card-chat messages API handlers
// (GET /api/v1/cards/:cardId/chat/messages, POST /api/v1/cards/:cardId/chat/messages).
import { describe, it, expect, beforeEach, mock } from 'bun:test';

// [why] Declare mocks as bun:test mock() factories — mock.module evaluates before imports.
const mockAuthenticate = mock();
const mockRequireMembership = mock();
const mockGetMessages = mock();
const mockWriteMessage = mock();

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

mock.module('../../mods/messages/query', () => ({
  getCardChatMessages: mockGetMessages,
}));

mock.module('../../mods/messages/write', () => ({
  writeCardChatMessage: mockWriteMessage,
}));

// [why] The auth middleware sets currentUser on the request when auth succeeds.
function addCurrentUser(req: Request): void {
  (req as Record<string, unknown>).currentUser = {
    id: 'user-1', name: 'Alice', email: 'alice@test.local',
  };
}

const cardId = 'card-abc';

beforeEach(() => {
  mockAuthenticate.mockClear();
  mockRequireMembership.mockClear();
  mockGetMessages.mockClear();
  mockWriteMessage.mockClear();
});

describe('handleGetCardChatMessages', () => {
  it('returns 401 when authentication fails', async () => {
    mockAuthenticate.mockResolvedValueOnce(
      new Response(JSON.stringify({ name: 'unauthorized' }), { status: 401 }),
    );

    const { handleGetCardChatMessages } = await import('../messages/get');

    const result = await handleGetCardChatMessages(
      new Request('http://localhost/api/v1/cards/card-abc/chat/messages'),
      cardId,
    );
    expect(result.status).toBe(401);
  });

  it('returns messages with pagination metadata', async () => {
    mockAuthenticate.mockResolvedValueOnce(null);
    mockGetMessages.mockResolvedValueOnce({
      data: [{
        id: 'msg-1', session_id: 'sess-1', role: 'user', content: 'Hello',
        metadata: null, author_id: 'user-1',
        created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
        authorName: 'Alice', avatar: 'https://example.com/avatar.png',
      }],
      metadata: { cursor: null, hasMore: false },
    });

    const { handleGetCardChatMessages } = await import('../messages/get');

    const result = await handleGetCardChatMessages(
      new Request('http://localhost/api/v1/cards/card-abc/chat/messages'),
      cardId,
    );
    expect(result.status).toBe(200);
    const body = await result.json() as { data: unknown[]; metadata: { hasMore: boolean } };
    expect(body.data).toHaveLength(1);
    expect(body.metadata.hasMore).toBe(false);
  });

  it('passes cursor and limit from query params', async () => {
    mockAuthenticate.mockResolvedValueOnce(null);
    mockGetMessages.mockResolvedValueOnce({ data: [], metadata: { cursor: null, hasMore: false } });

    const { handleGetCardChatMessages } = await import('../messages/get');

    await handleGetCardChatMessages(
      new Request('http://localhost/api/v1/cards/card-abc/chat/messages?cursor=msg-10&limit=20'),
      cardId,
    );
    expect(mockGetMessages).toHaveBeenCalledWith({ cardId, cursor: 'msg-10', limit: 20 });
  });

  it('defaults limit to 50 when not provided', async () => {
    mockAuthenticate.mockResolvedValueOnce(null);
    mockGetMessages.mockResolvedValueOnce({ data: [], metadata: { cursor: null, hasMore: false } });

    const { handleGetCardChatMessages } = await import('../messages/get');

    await handleGetCardChatMessages(
      new Request('http://localhost/api/v1/cards/card-abc/chat/messages'),
      cardId,
    );
    expect(mockGetMessages).toHaveBeenCalledWith({ cardId, cursor: null, limit: 50 });
  });
});

describe('handleCreateCardChatMessage', () => {
  it('returns 400 when body is not valid JSON', async () => {
    mockAuthenticate.mockResolvedValueOnce(null);
    mockRequireMembership.mockResolvedValueOnce(null);

    const { handleCreateCardChatMessage } = await import('../messages/create');

    const result = await handleCreateCardChatMessage(
      new Request('http://localhost/api/v1/cards/card-abc/chat/messages', { method: 'POST', body: 'not json' }),
      cardId,
    );
    expect(result.status).toBe(400);
    const body = await result.json() as { name: string };
    expect(body.name).toBe('invalid-request-body');
  });

  it('returns 400 when sessionId is missing', async () => {
    mockAuthenticate.mockResolvedValueOnce(null);
    mockRequireMembership.mockResolvedValueOnce(null);

    const { handleCreateCardChatMessage } = await import('../messages/create');

    const result = await handleCreateCardChatMessage(
      new Request('http://localhost/api/v1/cards/card-abc/chat/messages', {
        method: 'POST', body: JSON.stringify({ content: 'Hello' }),
      }),
      cardId,
    );
    expect(result.status).toBe(400);
    const body = await result.json() as { name: string };
    expect(body.name).toBe('missing-session-id');
  });

  it('returns 400 when content is missing', async () => {
    mockAuthenticate.mockResolvedValueOnce(null);
    mockRequireMembership.mockResolvedValueOnce(null);

    const { handleCreateCardChatMessage } = await import('../messages/create');

    const result = await handleCreateCardChatMessage(
      new Request('http://localhost/api/v1/cards/card-abc/chat/messages', {
        method: 'POST', body: JSON.stringify({ sessionId: 'sess-1' }),
      }),
      cardId,
    );
    expect(result.status).toBe(400);
    const body = await result.json() as { name: string };
    expect(body.name).toBe('invalid-content');
  });

  it('returns 201 with message on success', async () => {
    mockAuthenticate.mockImplementationOnce((req: Record<string, unknown>) => {
      addCurrentUser(req as Request);
      return null;
    });
    mockRequireMembership.mockResolvedValueOnce(null);

    mockWriteMessage.mockResolvedValueOnce({
      status: 201,
      data: { message: { id: 'msg-1', session_id: 'sess-1', role: 'user', content: 'Hello world', metadata: null, author_id: 'user-1', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' } },
    });

    const { handleCreateCardChatMessage } = await import('../messages/create');

    const result = await handleCreateCardChatMessage(
      new Request('http://localhost/api/v1/cards/card-abc/chat/messages', {
        method: 'POST', body: JSON.stringify({ sessionId: 'sess-1', content: 'Hello world' }),
      }),
      cardId,
    );
    expect(result.status).toBe(201);
    const body = await result.json() as { data: { id: string; content: string } };
    expect(body.data.id).toBe('msg-1');
    expect(body.data.content).toBe('Hello world');
  });

  it('returns 404 when session does not exist', async () => {
    mockAuthenticate.mockImplementationOnce((req: Record<string, unknown>) => {
      addCurrentUser(req as Request);
      return null;
    });
    mockRequireMembership.mockResolvedValueOnce(null);
    mockWriteMessage.mockRejectedValueOnce(new Error('card-chat-session-not-found'));

    const { handleCreateCardChatMessage } = await import('../messages/create');

    const result = await handleCreateCardChatMessage(
      new Request('http://localhost/api/v1/cards/card-abc/chat/messages', {
        method: 'POST', body: JSON.stringify({ sessionId: 'sess-1', content: 'x' }),
      }),
      cardId,
    );
    expect(result.status).toBe(404);
    const body = await result.json() as { name: string };
    expect(body.name).toBe('session-not-found');
  });

  it('returns 409 when session is paused', async () => {
    mockAuthenticate.mockImplementationOnce((req: Record<string, unknown>) => {
      addCurrentUser(req as Request);
      return null;
    });
    mockRequireMembership.mockResolvedValueOnce(null);
    mockWriteMessage.mockRejectedValueOnce(new Error('card-chat-session-not-active'));

    const { handleCreateCardChatMessage } = await import('../messages/create');

    const result = await handleCreateCardChatMessage(
      new Request('http://localhost/api/v1/cards/card-abc/chat/messages', {
        method: 'POST', body: JSON.stringify({ sessionId: 'sess-1', content: 'x' }),
      }),
      cardId,
    );
    expect(result.status).toBe(409);
    const body = await result.json() as { name: string };
    expect(body.name).toBe('session-is-paused');
  });
});
