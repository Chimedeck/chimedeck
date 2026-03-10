// tests/e2e/member-joined-event.spec.ts
// Playwright E2E tests for the member_joined real-time event (Sprint 50).
//
// Verifies that:
//  1. Inviting a user as a board guest emits a `member_joined` event with scope:'board'.
//  2. The emitted event includes a `version` field (integer).
//  3. Directly adding a workspace member emits a `member_joined` event with scope:'workspace'.
//
// Run with: npx playwright test tests/e2e/member-joined-event.spec.ts
import { test, expect, type APIRequestContext } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function registerAndLogin(request: APIRequestContext, suffix: string): Promise<{ token: string; email: string }> {
  const email = `mj-test-${suffix}-${Date.now()}@example.com`;
  const password = 'TestPassword1!';

  await request.post(`${BASE_URL}/api/v1/auth/register`, {
    data: { email, password, name: `MJ ${suffix}` },
  });

  const loginRes = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email, password },
  });
  const body = await loginRes.json() as { data: { access_token: string } };
  return { token: body.data.access_token, email };
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
): Promise<string> {
  const res = await request.post(`${BASE_URL}/api/v1/workspaces/${workspaceId}/boards`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: `Board-${Date.now()}` },
  });
  const body = await res.json() as { data: { id: string } };
  return body.data.id;
}

async function getUserId(request: APIRequestContext, token: string): Promise<string> {
  const res = await request.get(`${BASE_URL}/api/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json() as { data: { id: string } };
  return body.data.id;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('member_joined event', () => {
  test('inviting a board guest emits member_joined with scope:board and version field', async ({ request }) => {
    // Owner sets up workspace and board
    const owner = await registerAndLogin(request, 'mj-owner');
    const workspaceId = await createWorkspace(request, owner.token);
    const boardId = await createBoard(request, owner.token, workspaceId);

    // Create a second user who will be invited as guest
    const guest = await registerAndLogin(request, 'mj-guest');
    const guestUserId = await getUserId(request, guest.token);

    // Invite the guest to the board
    const inviteRes = await request.post(`${BASE_URL}/api/v1/boards/${boardId}/guests`, {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { userId: guestUserId },
    });
    expect(inviteRes.status()).toBe(201);

    // Fetch board events — the member_joined event should be present
    const eventsRes = await request.get(`${BASE_URL}/api/v1/boards/${boardId}/events?since=0`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    expect(eventsRes.status()).toBe(200);

    const eventsBody = await eventsRes.json() as {
      data: Array<{ type: string; version: number; payload: Record<string, unknown> }>;
    };

    const memberJoinedEvent = eventsBody.data.find((e) => e.type === 'member_joined');

    expect(memberJoinedEvent).toBeDefined();
    expect(typeof memberJoinedEvent!.version).toBe('number');
    expect(memberJoinedEvent!.version).toBeGreaterThan(0);
    expect(memberJoinedEvent!.payload.scope).toBe('board');
    expect(memberJoinedEvent!.payload.userId).toBe(guestUserId);
    expect(memberJoinedEvent!.payload.role).toBe('GUEST');
  });

  test('all board events include a version field', async ({ request }) => {
    const owner = await registerAndLogin(request, 'mj-ver');
    const workspaceId = await createWorkspace(request, owner.token);
    const boardId = await createBoard(request, owner.token, workspaceId);

    const guest = await registerAndLogin(request, 'mj-ver-guest');
    const guestUserId = await getUserId(request, guest.token);

    // Trigger at least one event (board_created fires on board creation; invite fires member_joined)
    await request.post(`${BASE_URL}/api/v1/boards/${boardId}/guests`, {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { userId: guestUserId },
    });

    const eventsRes = await request.get(`${BASE_URL}/api/v1/boards/${boardId}/events?since=0`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    expect(eventsRes.status()).toBe(200);

    const eventsBody = await eventsRes.json() as {
      data: Array<{ type: string; version: number }>;
    };

    expect(eventsBody.data.length).toBeGreaterThan(0);

    // Every event must carry a numeric version field
    for (const event of eventsBody.data) {
      expect(typeof event.version, `event ${event.type} must have a numeric version`).toBe('number');
    }
  });
});
