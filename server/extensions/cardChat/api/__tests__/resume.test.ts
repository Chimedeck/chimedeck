// Tests for POST /api/v1/cards/:cardId/chat/session/resume handler.
// [why] Handler tests cover the API layer — auth, membership, body validation,
// and interaction with the resume session lifecycle mod.
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { handleResumeCardChatSession } from '../../api/session/resume';

// ---- mock auth + membership (always pass for handler tests) ----
const mockAuthenticate = mock(async (_req: unknown) => null);
const mockRequireWorkspaceMembership = mock(async (_req: unknown, _wsId: string) => null);
const mockResumeSession = mock(async () => ({}));
const mockEmitActivity = mock(async () => undefined);

// Wire mocks into the handler's deps
import { cardChatSessionResumeApiDeps } from '../../api/session/resume';
cardChatSessionResumeApiDeps.authenticate = mockAuthenticate as unknown as typeof cardChatSessionResumeApiDeps.authenticate;
cardChatSessionResumeApiDeps.requireWorkspaceMembership = mockRequireWorkspaceMembership as unknown as typeof cardChatSessionResumeApiDeps.requireWorkspaceMembership;
cardChatSessionResumeApiDeps.resumeSession = mockResumeSession as unknown as typeof cardChatSessionResumeApiDeps.resumeSession;
cardChatSessionResumeApiDeps.emitCardChatActivity = mockEmitActivity as unknown as typeof cardChatSessionResumeApiDeps.emitCardChatActivity;

// Helper: build a minimal Request-like object
function makeReq(method: string, body?: unknown): Request {
  const r = new Request('http://localhost/api/v1/cards/card-1/chat/session/resume', {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  // [why] Attach workspaceId + currentUser so membership + activity emission work
  Object.defineProperty(r, 'workspaceId', { value: 'ws-1', writable: true });
  Object.defineProperty(r, 'currentUser', { value: { id: 'user-1' }, writable: true });
  return r;
}

beforeEach(() => {
  mockAuthenticate.mockReset();
  mockAuthenticate.mockImplementation(async (_req: unknown) => null);

  mockRequireWorkspaceMembership.mockReset();
  mockRequireWorkspaceMembership.mockImplementation(async (_req: unknown, _wsId: string) => null);

  mockResumeSession.mockReset();
  mockEmitActivity.mockReset();
});

describe('handleResumeCardChatSession', () => {
  it('returns 200 with session data on successful resume', async () => {
    const session = { id: 's1', card_id: 'card-1', status: 'ACTIVE_REFINEMENT', quality_score: null };
    mockResumeSession.mockResolvedValueOnce({ status: 200, data: { session } });

    const req = makeReq('POST', { sessionId: 's1' });
    const res = await handleResumeCardChatSession(req, 'card-1');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe('s1');
    expect(body.data.status).toBe('ACTIVE_REFINEMENT');
    // [why] Fire-and-forget activity should be emitted on success
    expect(mockEmitActivity).toHaveBeenCalledTimes(1);
  });

  it('returns 409 when session is READY_FOR_REVIEW', async () => {
    mockResumeSession.mockResolvedValueOnce({
      status: 409,
      name: 'session-is-ready-for-review',
      data: { message: 'Cannot resume a session that is ready for review' },
    });

    const req = makeReq('POST', { sessionId: 's1' });
    const res = await handleResumeCardChatSession(req, 'card-1');

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.name).toBe('session-is-ready-for-review');
  });

  it('returns 404 when session does not exist', async () => {
    mockResumeSession.mockResolvedValueOnce({
      status: 404,
      name: 'session-not-found',
      data: { message: 'No chat session found for this card' },
    });

    const req = makeReq('POST', { sessionId: 'nonexistent' });
    const res = await handleResumeCardChatSession(req, 'card-1');

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.name).toBe('session-not-found');
  });

  it('returns 400 when sessionId is missing from body', async () => {
    const req = makeReq('POST', {});
    const res = await handleResumeCardChatSession(req, 'card-1');

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.name).toBe('missing-session-id');
  });

  it('returns 400 when body is not valid JSON', async () => {
    const req = new Request('http://localhost/api/v1/cards/card-1/chat/session/resume', {
      method: 'POST',
      body: 'not json',
    });
    Object.defineProperty(req, 'workspaceId', { value: 'ws-1', writable: true });
    Object.defineProperty(req, 'currentUser', { value: { id: 'user-1' }, writable: true });

    const res = await handleResumeCardChatSession(req, 'card-1');

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.name).toBe('invalid-request-body');
  });

  it('returns 401 when auth fails', async () => {
    mockAuthenticate.mockResolvedValueOnce(
      Response.json({ name: 'unauthorized', data: { message: 'Not authenticated' } }, { status: 401 }),
    );

    const req = makeReq('POST', { sessionId: 's1' });
    const res = await handleResumeCardChatSession(req, 'card-1');

    expect(res.status).toBe(401);
  });
});
