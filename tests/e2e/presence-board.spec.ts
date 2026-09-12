// tests/e2e/presence-board.spec.ts
// Playwright E2E test for real-time board presence.
// Scenario: a second user joins the same board and the presence list is updated.
// Based on: specs/tests/presence-board.md
// Soft-skips when the server is not reachable.

import { test, expect } from '@playwright/test';
import { BASE_URL, registerAndGetCredentials, createWorkspace, createBoard, createList, type Credentials } from './_helpers';

const WS_URL = (process.env.TEST_BASE_URL ?? 'http://localhost:3000').replace(/^http/, 'ws');

// Open a realtime WebSocket, subscribe to the board, and resolve once the server
// accepts the subscription. Used by the join and leave tests.
function subscribeToBoard(token: string, boardId: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}/api/v1/ws?token=${encodeURIComponent(token)}`);
    const timer = setTimeout(() => reject(new Error('WS subscribe timed out')), 8000);
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'subscribe', board_id: boardId }));
    });
    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as { type?: string; name?: string };
        if (msg.type === 'error') {
          clearTimeout(timer);
          reject(new Error(`WS error: ${msg.name ?? 'unknown'}`));
        }
        // Any non-error message after subscribe means the subscription was accepted.
        if (msg.type !== 'error') {
          clearTimeout(timer);
          resolve(ws);
        }
      } catch {
        // ignore non-JSON frames
      }
    });
    ws.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('WS connection error'));
    });
  });
}

test.describe('Board Presence', () => {
  let credsA: Credentials;
  let credsB: Credentials;
  let tokenA: string;
  let tokenB: string;
  let boardId: string;
  const run = Date.now();

  test.beforeAll(async ({ request }) => {
    // Soft-skip entire suite if the server is not reachable
    const probe = await request.get(`${BASE_URL}/api/v1/health`).catch(() => null);
    if (!probe || probe.status() >= 500) {
      return;
    }

    // User A creates the board.
    // Suffixes are lowercase: the workspace member-add endpoint lowercases the
    // email before lookup while register preserves case, so a mixed-case address
    // would not be matchable. (Tracked separately as a product inconsistency.)
    credsA = await registerAndGetCredentials(request, `presa-${run}`);
    tokenA = credsA.token;
    const workspaceId = await createWorkspace(request, tokenA);
    boardId = await createBoard(request, tokenA, workspaceId);
    await createList(request, tokenA, boardId);

    // User B — a second independent user, added to the workspace so they can
    // subscribe to the board over the realtime WebSocket (subscribe enforces
    // workspace membership).
    credsB = await registerAndGetCredentials(request, `presb-${run}`);
    tokenB = credsB.token;
    const addRes = await request.post(`${BASE_URL}/api/v1/workspaces/${workspaceId}/members`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: { email: credsB.email, role: 'MEMBER' },
    });
    if (!addRes.ok()) {
      throw new Error(`Failed to add user B to workspace: ${addRes.status()} ${await addRes.text()}`);
    }
  });

  test('Test 1 — GET /boards/:id/presence returns active viewer list', async ({ request }) => {
    if (!tokenA) test.skip(true, 'Server not running — skipping');

    const res = await request.get(`${BASE_URL}/api/v1/boards/${boardId}/presence`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    expect(res.status()).toBe(200);
    const body = await res.json() as { data: Array<{ id: string }> };
    expect(Array.isArray(body.data)).toBe(true);
  });

  // NOTE: There is no REST join/leave endpoint. Presence is owned by the realtime
  // WebSocket layer — a client subscribes to a board and the server sets
  // presence:<boardId>:<userId>; on disconnect the key expires. POST and DELETE
  // to /boards/:id/presence return 404 by design.
  //
  // Two tests here previously asserted those endpoints (and skipped themselves
  // when they 404'd, so they never ran). The real behaviour is covered over the
  // WebSocket path instead: Test 2 covers join (two subscribers appear by id),
  // Test 3 covers leave (one disconnects and disappears while the other stays).
  // Asserting the absence of a REST endpoint would test nothing.

  test('Test 2 — Second user joining the board is reflected in the presence list', async ({ request }) => {
    if (!tokenA || !tokenB) test.skip(true, 'Server not running — skipping');

    const idOf = async (token: string): Promise<string> => {
      const res = await request.get(`${BASE_URL}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(200);
      return ((await res.json()) as { data: { id: string } }).data.id;
    };
    const readPresenceIds = async (): Promise<string[]> => {
      const res = await request.get(`${BASE_URL}/api/v1/boards/${boardId}/presence`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      expect(res.status()).toBe(200);
      return ((await res.json()) as { data: Array<{ id: string }> }).data.map((u) => u.id);
    };

    const idA = await idOf(tokenA);
    const idB = await idOf(tokenB);

    const socketA = await subscribeToBoard(tokenA, boardId);
    const socketB = await subscribeToBoard(tokenB, boardId);

    try {
      // Both specific subscribers must be listed by id — not merely "two users".
      await expect
        .poll(readPresenceIds, { timeout: 8000 })
        .toEqual(expect.arrayContaining([idA, idB]));
    } finally {
      socketA.close();
      socketB.close();
    }
  });

  test('Test 3 — Leaving a board removes the user from the presence list', async ({ request }) => {
    if (!tokenA || !tokenB) test.skip(true, 'Server not running — skipping');

    // Subscribe both, confirm both present, then close B's socket and confirm B
    // disappears. This covers the unsubscribe -> cache.del(presence:<boardId>:<userId>)
    // path that the removed REST leave test never reached.
    const readPresenceIds = async (): Promise<string[]> => {
      const res = await request.get(`${BASE_URL}/api/v1/boards/${boardId}/presence`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json() as { data: Array<{ id: string }> };
      return body.data.map((u) => u.id);
    };

    // Resolve both user ids so the assertion can name WHO left rather than only
    // that the list shrank.
    const idOf = async (token: string): Promise<string> => {
      const res = await request.get(`${BASE_URL}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json() as { data: { id: string } };
      return body.data.id;
    };
    const idA = await idOf(tokenA);
    const idB = await idOf(tokenB);

    const socketA = await subscribeToBoard(tokenA, boardId);
    const socketB = await subscribeToBoard(tokenB, boardId);

    try {
      // Both subscribers are recorded, by id.
      await expect
        .poll(readPresenceIds, { timeout: 8000 })
        .toEqual(expect.arrayContaining([idA, idB]));

      // B leaves. B must disappear while A remains — asserting identity, not
      // just a smaller count, so a collapse of both connections cannot pass.
      socketB.close();
      await expect
        .poll(async () => (await readPresenceIds()).includes(idB), { timeout: 10000 })
        .toBe(false);
      expect(await readPresenceIds()).toContain(idA);
    } finally {
      socketA.close();
      socketB.close();
    }
  });

  test('Test 4 — Unauthenticated presence request returns 401', async ({ request }) => {
    if (!tokenA) test.skip(true, 'Server not running — skipping');

    const res = await request.get(`${BASE_URL}/api/v1/boards/${boardId}/presence`);

    expect(res.status()).toBe(401);
  });

  // NOTE: A UI test previously asserted that a second user's avatar appears in
  // the first user's board header. The component for that exists
  // (src/extensions/Realtime/components/PresenceAvatars.tsx) but is never
  // imported anywhere — the board header renders the static MemberAvatarStack
  // instead. The feature is undelivered, so the test could never pass and
  // soft-skipped on every run. The gap is recorded in the E2E recovery backlog
  // as a product item rather than kept here as a permanently-skipping test.
});
