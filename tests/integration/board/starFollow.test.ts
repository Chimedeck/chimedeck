// tests/integration/board/starFollow.test.ts
// Integration tests for board star/follow endpoints (Sprint 48).
//
// Strategy: handler-level tests that exercise authentication guards and response
// shapes without requiring a live database. DB-dependent tests (actual
// star/unstar toggling) require a running server and are covered by Playwright MCP.
import { describe, it, expect } from 'bun:test';
import { handleStarBoard, handleUnstarBoard } from '../../../server/extensions/board/api/star';
import { handleFollowBoard, handleUnfollowBoard } from '../../../server/extensions/board/api/follow';
import { handleGetMeStarredBoards } from '../../../server/extensions/board/api/me-starred-boards';
import { issueAccessToken } from '../../../server/extensions/auth/mods/token/issue';

async function makeToken(userId = 'user-1', email = 'user@test.com'): Promise<string> {
  return issueAccessToken({ sub: userId, email });
}

function makeRequest(method: string, authHeader?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;
  return new Request(`http://localhost/api/v1/boards/board-1/${method === 'GET' ? '' : method}`, {
    method,
    headers,
  });
}

function makeMeRequest(authHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (authHeader) headers['Authorization'] = authHeader;
  return new Request('http://localhost/api/v1/me/starred-boards', { method: 'GET', headers });
}

// ---------------------------------------------------------------------------
// Authentication guard tests — no DB needed
// ---------------------------------------------------------------------------

describe('POST /api/v1/boards/:id/star', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await handleStarBoard(makeRequest('POST'), 'board-1');
    expect(res.status).toBe(401);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('unauthorized');
  });

  it('returns 401 for an invalid token', async () => {
    const res = await handleStarBoard(makeRequest('POST', 'Bearer invalid.token.here'), 'board-1');
    expect(res.status).toBe(401);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('unauthorized');
  });
});

describe('DELETE /api/v1/boards/:id/star', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await handleUnstarBoard(makeRequest('DELETE'), 'board-1');
    expect(res.status).toBe(401);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('unauthorized');
  });
});

describe('POST /api/v1/boards/:id/follow', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await handleFollowBoard(makeRequest('POST'), 'board-1');
    expect(res.status).toBe(401);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('unauthorized');
  });

  it('returns 401 for an invalid token', async () => {
    const res = await handleFollowBoard(makeRequest('POST', 'Bearer invalid.token.here'), 'board-1');
    expect(res.status).toBe(401);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('unauthorized');
  });
});

describe('DELETE /api/v1/boards/:id/follow', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await handleUnfollowBoard(makeRequest('DELETE'), 'board-1');
    expect(res.status).toBe(401);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('unauthorized');
  });
});

describe('GET /api/v1/me/starred-boards', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await handleGetMeStarredBoards(makeMeRequest());
    expect(res.status).toBe(401);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('unauthorized');
  });

  it('returns 401 for an invalid token', async () => {
    const res = await handleGetMeStarredBoards(makeMeRequest('Bearer bad.token'));
    expect(res.status).toBe(401);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('unauthorized');
  });
});
