// Integration tests for POST /api/v1/cards/:cardId/chat/refine handler.
import { describe, it, expect, beforeEach, mock } from 'bun:test';

const mockAuthenticate = mock();
const mockRequireMembership = mock();
const mockRunGoalLoop = mock();

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

mock.module('../../mods/baPersona/goalLoop', () => ({
  runGoalLoop: mockRunGoalLoop,
}));

function addCurrentUser(req: Request): void {
  (req as Record<string, unknown>).currentUser = { id: 'user-1', name: 'Alice', email: 'alice@test.local' };
}

const cardId = 'card-abc';

beforeEach(() => {
  mockAuthenticate.mockClear();
  mockRequireMembership.mockClear();
  mockRunGoalLoop.mockClear();
});

describe('handleRefineCardChat', () => {
  it('returns 401 when authentication fails', async () => {
    mockAuthenticate.mockResolvedValueOnce(
      new Response(JSON.stringify({ name: 'unauthorized' }), { status: 401 }),
    );

    const { handleRefineCardChat } = await import('../refine');

    const result = await handleRefineCardChat(
      new Request('http://localhost/api/v1/cards/card-abc/chat/refine', { method: 'POST', body: JSON.stringify({ sessionId: 'sess-1' }) }),
      cardId,
    );
    expect(result.status).toBe(401);
  });

  it('returns 400 when body is not valid JSON', async () => {
    mockAuthenticate.mockResolvedValueOnce(null);
    mockRequireMembership.mockResolvedValueOnce(null);

    const { handleRefineCardChat } = await import('../refine');

    const result = await handleRefineCardChat(
      new Request('http://localhost/api/v1/cards/card-abc/chat/refine', { method: 'POST', body: 'not json' }),
      cardId,
    );
    expect(result.status).toBe(400);
    const body = await result.json() as { name: string };
    expect(body.name).toBe('invalid-request-body');
  });

  it('returns 400 when sessionId is missing', async () => {
    mockAuthenticate.mockResolvedValueOnce(null);
    mockRequireMembership.mockResolvedValueOnce(null);

    const { handleRefineCardChat } = await import('../refine');

    const result = await handleRefineCardChat(
      new Request('http://localhost/api/v1/cards/card-abc/chat/refine', { method: 'POST', body: JSON.stringify({}) }),
      cardId,
    );
    expect(result.status).toBe(400);
    const body = await result.json() as { name: string };
    expect(body.name).toBe('missing-session-id');
  });

  it('returns 200 with refinement data when loop completes', async () => {
    mockAuthenticate.mockImplementationOnce((req: Record<string, unknown>) => {
      addCurrentUser(req as Request);
      return null;
    });
    mockRequireMembership.mockResolvedValueOnce(null);
    mockRunGoalLoop.mockResolvedValueOnce({
      status: 200,
      data: {
        session: { id: 'sess-1', card_id: cardId, workspace_id: 'ws-1', created_by: 'user-1', status: 'READY_FOR_REVIEW', quality_score: 95, last_actor_at: '2026-01-01T00:00:00.000Z', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
        assistantMessage: { id: 'msg-1', session_id: 'sess-1', role: 'assistant', content: 'Here is the refined requirement.', metadata: null, author_id: null, created_at: '2026-01-01T00:00:01.000Z', updated_at: '2026-01-01T00:00:01.000Z' },
        qualityScore: { earsCoverage: 23, acceptanceCriteria: 24, constraintClarity: 23, testability: 22, ambiguityPenalty: 0, total: 95 },
        loopComplete: true,
      },
    });

    const { handleRefineCardChat } = await import('../refine');

    const result = await handleRefineCardChat(
      new Request('http://localhost/api/v1/cards/card-abc/chat/refine', { method: 'POST', body: JSON.stringify({ sessionId: 'sess-1' }) }),
      cardId,
    );
    expect(result.status).toBe(200);
    const body = await result.json() as { data: { assistantMessage: { content: string }; session: { status: string }; qualityScore: { total: number }; loopComplete: boolean } };
    expect(body.data.assistantMessage.content).toBe('Here is the refined requirement.');
    expect(body.data.session.status).toBe('READY_FOR_REVIEW');
    expect(body.data.qualityScore.total).toBe(95);
    expect(body.data.loopComplete).toBe(true);
  });

  it('returns 409 when session is not in ACTIVE_REFINEMENT state', async () => {
    mockAuthenticate.mockImplementationOnce((req: Record<string, unknown>) => {
      addCurrentUser(req as Request);
      return null;
    });
    mockRequireMembership.mockResolvedValueOnce(null);
    mockRunGoalLoop.mockResolvedValueOnce({ status: 409, name: 'session-not-active', message: 'Session must be in ACTIVE_REFINEMENT state to run refinement' });

    const { handleRefineCardChat } = await import('../refine');

    const result = await handleRefineCardChat(
      new Request('http://localhost/api/v1/cards/card-abc/chat/refine', { method: 'POST', body: JSON.stringify({ sessionId: 'sess-paused' }) }),
      cardId,
    );
    expect(result.status).toBe(409);
    const body = await result.json() as { name: string };
    expect(body.name).toBe('session-not-active');
  });

  it('returns 404 when session does not exist', async () => {
    mockAuthenticate.mockImplementationOnce((req: Record<string, unknown>) => {
      addCurrentUser(req as Request);
      return null;
    });
    mockRequireMembership.mockResolvedValueOnce(null);
    mockRunGoalLoop.mockResolvedValueOnce({ status: 404, name: 'session-not-found', message: 'No chat session found for this card' });

    const { handleRefineCardChat } = await import('../refine');

    const result = await handleRefineCardChat(
      new Request('http://localhost/api/v1/cards/card-abc/chat/refine', { method: 'POST', body: JSON.stringify({ sessionId: 'sess-nonexistent' }) }),
      cardId,
    );
    expect(result.status).toBe(404);
    const body = await result.json() as { name: string };
    expect(body.name).toBe('session-not-found');
  });

  it('returns 500 on unexpected errors', async () => {
    mockAuthenticate.mockImplementationOnce((req: Record<string, unknown>) => {
      addCurrentUser(req as Request);
      return null;
    });
    mockRequireMembership.mockResolvedValueOnce(null);
    mockRunGoalLoop.mockRejectedValueOnce(new Error('something-crashed'));

    const { handleRefineCardChat } = await import('../refine');

    const result = await handleRefineCardChat(
      new Request('http://localhost/api/v1/cards/card-abc/chat/refine', { method: 'POST', body: JSON.stringify({ sessionId: 'sess-1' }) }),
      cardId,
    );
    expect(result.status).toBe(500);
    const body = await result.json() as { name: string };
    expect(body.name).toBe('internal-error');
  });
});
