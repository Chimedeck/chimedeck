// tests/e2e/_helpers.ts
// Shared helper utilities for Playwright E2E tests.
// Import these in individual spec files to avoid repetition.

import { type APIRequestContext } from '@playwright/test';

export const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

export async function registerAndLogin(
  request: APIRequestContext,
  suffix: string,
): Promise<string> {
  const email = `e2e-${suffix}-${Date.now()}@example.com`;
  const password = 'TestPassword1!';

  const regRes = await request.post(`${BASE_URL}/api/v1/auth/register`, {
    data: { email, password, name: `Test ${suffix}` },
  });
  // Register returns an accessToken directly (201); avoid a separate login call
  // which is rate-limited (10/IP/min) and would 429 under the full suite.
  const body = await regRes.json() as { data: { accessToken: string } };
  return body.data.accessToken;
}

export async function createWorkspace(
  request: APIRequestContext,
  token: string,
): Promise<string> {
  const res = await request.post(`${BASE_URL}/api/v1/workspaces`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: `WS-${Date.now()}` },
  });
  const body = await res.json() as { data: { id: string } };
  return body.data.id;
}

export async function createBoard(
  request: APIRequestContext,
  token: string,
  workspaceId: string,
): Promise<string> {
  const res = await request.post(`${BASE_URL}/api/v1/workspaces/${workspaceId}/boards`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: `Board-${Date.now()}` },
  });
  const body = await res.json() as { data: { id: string } };
  return body.data.id;
}

export async function createList(
  request: APIRequestContext,
  token: string,
  boardId: string,
): Promise<string> {
  const res = await request.post(`${BASE_URL}/api/v1/boards/${boardId}/lists`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: `List-${Date.now()}` },
  });
  const body = await res.json() as { data: { id: string } };
  return body.data.id;
}

export async function createCard(
  request: APIRequestContext,
  token: string,
  listId: string,
  title = 'Test Card',
): Promise<string> {
  const res = await request.post(`${BASE_URL}/api/v1/lists/${listId}/cards`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title },
  });
  const body = await res.json() as { data: { id: string } };
  return body.data.id;
}
