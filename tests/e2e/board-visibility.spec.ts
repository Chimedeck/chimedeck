// tests/e2e/board-visibility.spec.ts
// Playwright E2E tests for board visibility access control (Sprint 49).
//
// These tests require a running server (npm run dev or the Docker stack) and a
// seeded database.  Run with: npx playwright test tests/e2e/board-visibility.spec.ts
//
// Test scenarios:
//  1. PRIVATE board — non-member gets 403.
//  2. PUBLIC  board — accessible without an auth token.
//  3. UI      — changing visibility via board settings PATCH endpoint.
import { test, expect, type APIRequestContext } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function registerAndLogin(request: APIRequestContext, suffix: string): Promise<string> {
  const email = `vis-test-${suffix}-${Date.now()}@example.com`;
  const password = 'TestPassword1!';

  await request.post(`${BASE_URL}/api/v1/auth/register`, {
    data: { email, password, name: `Test ${suffix}` },
  });

  const loginRes = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email, password },
  });
  const body = await loginRes.json() as { data: { access_token: string } };
  return body.data.access_token;
}

async function createWorkspace(request: APIRequestContext, token: string): Promise<string> {
  const res = await request.post(`${BASE_URL}/api/v1/workspaces`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: `WS-${Date.now()}` },
  });
  const body = await res.json() as { data: { id: string } };
  return body.data.id;
}

async function createBoard(
  request: APIRequestContext,
  token: string,
  workspaceId: string,
  visibility: 'PRIVATE' | 'WORKSPACE' | 'PUBLIC' = 'PRIVATE',
): Promise<string> {
  const createRes = await request.post(`${BASE_URL}/api/v1/workspaces/${workspaceId}/boards`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: `Board-${Date.now()}` },
  });
  const body = await createRes.json() as { data: { id: string } };
  const boardId = body.data.id;

  await request.patch(`${BASE_URL}/api/v1/boards/${boardId}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { visibility },
  });

  return boardId;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Board visibility access control', () => {
  test('PRIVATE board — unauthenticated request is rejected (401)', async ({ request }) => {
    const ownerToken = await registerAndLogin(request, 'owner-priv');
    const workspaceId = await createWorkspace(request, ownerToken);
    const boardId = await createBoard(request, ownerToken, workspaceId, 'PRIVATE');

    const res = await request.get(`${BASE_URL}/api/v1/boards/${boardId}`);
    expect(res.status()).toBe(401);
  });

  test('PRIVATE board — non-member authenticated request returns 403', async ({ request }) => {
    const ownerToken = await registerAndLogin(request, 'owner-priv2');
    const workspaceId = await createWorkspace(request, ownerToken);
    const boardId = await createBoard(request, ownerToken, workspaceId, 'PRIVATE');

    const nonMemberToken = await registerAndLogin(request, 'nonmember-priv2');
    const res = await request.get(`${BASE_URL}/api/v1/boards/${boardId}`, {
      headers: { Authorization: `Bearer ${nonMemberToken}` },
    });
    expect(res.status()).toBe(403);
  });

  test('PUBLIC board — accessible without an auth token', async ({ request }) => {
    const ownerToken = await registerAndLogin(request, 'owner-pub');
    const workspaceId = await createWorkspace(request, ownerToken);
    const boardId = await createBoard(request, ownerToken, workspaceId, 'PUBLIC');

    const res = await request.get(`${BASE_URL}/api/v1/boards/${boardId}`);
    expect(res.status()).toBe(200);
    const body = await res.json() as { data: { id: string; visibility: string } };
    expect(body.data.id).toBe(boardId);
    expect(body.data.visibility).toBe('PUBLIC');
  });

  test('UI — PATCH visibility updates board and new visibility is applied', async ({ request }) => {
    const ownerToken = await registerAndLogin(request, 'owner-patch');
    const workspaceId = await createWorkspace(request, ownerToken);
    const boardId = await createBoard(request, ownerToken, workspaceId, 'PRIVATE');

    // Change to PUBLIC via PATCH
    const patchRes = await request.patch(`${BASE_URL}/api/v1/boards/${boardId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { visibility: 'PUBLIC' },
    });
    expect(patchRes.status()).toBe(200);
    const patchBody = await patchRes.json() as { data: { visibility: string } };
    expect(patchBody.data.visibility).toBe('PUBLIC');

    // Board is now PUBLIC — anonymous access allowed
    const getRes = await request.get(`${BASE_URL}/api/v1/boards/${boardId}`);
    expect(getRes.status()).toBe(200);
  });
});
