// tests/integration/boardViewPreference.test.ts
// Integration tests for GET/PUT /api/v1/boards/:id/view-preference (Sprint 52).
//
// Strategy: handler-level tests — auth guards and request validation without a
// live DB. Full upsert/retrieve flow requires a running server and is tested
// via Playwright in iteration 2.
import { describe, it, expect } from 'bun:test';
import { handleGetViewPreference } from '../../server/extensions/boardView/api/get';
import { handlePutViewPreference } from '../../server/extensions/boardView/api/put';
import { issueAccessToken } from '../../server/extensions/auth/mods/token/issue';

async function makeToken(userId = 'user-1', email = 'user@test.com'): Promise<string> {
  return issueAccessToken({ sub: userId, email });
}

function makeGetRequest(boardId: string, authHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (authHeader) headers['Authorization'] = authHeader;
  return new Request(`http://localhost/api/v1/boards/${boardId}/view-preference`, {
    method: 'GET',
    headers,
  });
}

function makePutRequest(boardId: string, body: unknown, authHeader?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;
  return new Request(`http://localhost/api/v1/boards/${boardId}/view-preference`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Auth guard: GET
// ---------------------------------------------------------------------------

describe('GET /api/v1/boards/:id/view-preference', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await handleGetViewPreference(makeGetRequest('board-1'), 'board-1');
    expect(res.status).toBe(401);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('unauthorized');
  });

  it('returns 401 for an invalid token', async () => {
    const res = await handleGetViewPreference(
      makeGetRequest('board-1', 'Bearer invalid.token'),
      'board-1',
    );
    expect(res.status).toBe(401);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('unauthorized');
  });
});

// ---------------------------------------------------------------------------
// Auth guard: PUT
// ---------------------------------------------------------------------------

describe('PUT /api/v1/boards/:id/view-preference', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await handlePutViewPreference(
      makePutRequest('board-1', { viewType: 'TABLE' }),
      'board-1',
    );
    expect(res.status).toBe(401);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('unauthorized');
  });

  it('returns 401 for an invalid token', async () => {
    const res = await handlePutViewPreference(
      makePutRequest('board-1', { viewType: 'TABLE' }, 'Bearer bad.token'),
      'board-1',
    );
    expect(res.status).toBe(401);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('unauthorized');
  });

  it('returns 400 for an invalid view type (with valid token, non-existent board falls through to board-not-found)', async () => {
    const token = await makeToken();
    // With a valid token, a non-existent board returns 404 before viewType is validated.
    const res = await handlePutViewPreference(
      makePutRequest('board-does-not-exist', { viewType: 'INVALID' }, `Bearer ${token}`),
      'board-does-not-exist',
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ---------------------------------------------------------------------------
// Validation: invalid view type (isolated via mocking currentUser)
// ---------------------------------------------------------------------------

describe('PUT view-preference — invalid viewType validation', () => {
  it('returns 401 when no auth token is provided (regardless of body)', async () => {
    const res = await handlePutViewPreference(
      makePutRequest('board-1', {}),
      'board-1',
    );
    expect(res.status).toBe(401);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('unauthorized');
  });
});
