// Playwright E2E tests for TimelineView drag/resize interactions (Sprint 54, Iteration 7).
//
// Covers:
// - Dragging the right resize handle updates due_date via PATCH.
// - Dragging the left resize handle updates start_date via PATCH.
// - Dragging the bar body shifts both start_date and due_date.
// - On PATCH failure the bar reverts to its original position and an error toast appears.

import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

// ── Helpers ────────────────────────────────────────────────────────────────

interface Credentials { email: string; password: string; token: string }

async function registerAndLogin(request: APIRequestContext, suffix: string): Promise<Credentials> {
  const email = `td-test-${suffix}-${Date.now()}@journeyh.io`;
  const password = 'TestPassword1!';
  await request.post(`${BASE_URL}/api/v1/auth/register`, {
    data: { email, password, name: `TD ${suffix}` },
  });
  const loginRes = await request.post(`${BASE_URL}/api/v1/auth/token`, {
    data: { email, password },
  });
  const body = await loginRes.json() as { data: { accessToken: string } };
  return { email, password, token: body.data.accessToken };
}

async function createWorkspace(request: APIRequestContext, token: string): Promise<string> {
  const res = await request.post(`${BASE_URL}/api/v1/workspaces`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: `WS-TD-${Date.now()}` },
  });
  const body = await res.json() as { data: { id: string } };
  return body.data.id;
}

async function createBoard(request: APIRequestContext, token: string, workspaceId: string): Promise<{ id: string }> {
  const res = await request.post(`${BASE_URL}/api/v1/workspaces/${workspaceId}/boards`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: `Board-TD-${Date.now()}` },
  });
  const body = await res.json() as { data: { id: string } };
  return body.data;
}

async function createList(request: APIRequestContext, token: string, boardId: string, title: string): Promise<string> {
  const res = await request.post(`${BASE_URL}/api/v1/boards/${boardId}/lists`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title },
  });
  const body = await res.json() as { data: { id: string } };
  return body.data.id;
}

async function createCard(request: APIRequestContext, token: string, listId: string, title: string): Promise<string> {
  const res = await request.post(`${BASE_URL}/api/v1/lists/${listId}/cards`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title },
  });
  const body = await res.json() as { data: { id: string } };
  return body.data.id;
}

async function patchCard(request: APIRequestContext, token: string, cardId: string, data: Record<string, unknown>): Promise<void> {
  await request.patch(`${BASE_URL}/api/v1/cards/${cardId}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
}

async function getCard(request: APIRequestContext, token: string, cardId: string): Promise<{ start_date: string | null; due_date: string | null }> {
  const res = await request.get(`${BASE_URL}/api/v1/cards/${cardId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json() as { data: { start_date: string | null; due_date: string | null } };
  return body.data;
}

function offsetDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function goToTimelineView(page: Page, baseUrl: string, boardId: string, creds: Credentials) {
  await page.goto(`${baseUrl}/login`);
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${baseUrl}/workspaces**`, { timeout: 15000 });
  await page.goto(`${baseUrl}/boards/${boardId}`);
  await page.waitForLoadState('networkidle');
  await page.getByTestId('board-view-tab-TIMELINE').click();
  await expect(page.getByTestId('timeline-view')).toBeVisible({ timeout: 10000 });
}

/**
 * Simulates a mouse drag from the centre of `handle` by `deltaX` pixels.
 */
async function dragHandle(page: Page, handleTestId: string, deltaX: number) {
  const handle = page.getByTestId(handleTestId);
  const box = await handle.boundingBox();
  if (!box) throw new Error(`Could not get bounding box for ${handleTestId}`);
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Move in small steps to trigger all mousemove events.
  const steps = Math.abs(deltaX) / 4;
  await page.mouse.move(startX + deltaX, startY, { steps: Math.max(steps, 4) });
  await page.mouse.up();
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Timeline Drag / Resize', () => {
  test('Dragging the right handle extends due_date via PATCH', async ({ page, request }) => {
    const creds = await registerAndLogin(request, 'drag-right');
    const wsId = await createWorkspace(request, creds.token);
    const board = await createBoard(request, creds.token, wsId);
    const listId = await createList(request, creds.token, board.id, 'Sprint');
    const cardId = await createCard(request, creds.token, listId, 'ResizeRight');
    // Set dates close to today so the bar is visible in the default week zoom
    const startDate = offsetDate(-1);
    const dueDate = offsetDate(3);
    await patchCard(request, creds.token, cardId, { start_date: startDate, due_date: dueDate });

    await goToTimelineView(page, BASE_URL, board.id, creds);

    // Intercept the PATCH request so we can verify it is made.
    const patchPromise = page.waitForRequest(
      (req) => req.method() === 'PATCH' && req.url().includes(`/cards/${cardId}`),
    );

    // Week zoom = 14px/day. Drag right handle ~28px (2 days) to the right.
    await dragHandle(page, `timeline-bar-resize-right-${cardId}`, 28);

    const patchReq = await patchPromise;
    const body = patchReq.postDataJSON() as { start_date?: string; due_date?: string };
    // start_date should be unchanged; due_date should be later
    expect(body.start_date).toBe(startDate);
    expect(body.due_date).not.toBe(dueDate);
    expect(new Date(body.due_date!).getTime()).toBeGreaterThan(new Date(dueDate).getTime());
  });

  test('Dragging the left handle moves start_date via PATCH', async ({ page, request }) => {
    const creds = await registerAndLogin(request, 'drag-left');
    const wsId = await createWorkspace(request, creds.token);
    const board = await createBoard(request, creds.token, wsId);
    const listId = await createList(request, creds.token, board.id, 'Sprint');
    const cardId = await createCard(request, creds.token, listId, 'ResizeLeft');
    const startDate = offsetDate(-2);
    const dueDate = offsetDate(5);
    await patchCard(request, creds.token, cardId, { start_date: startDate, due_date: dueDate });

    await goToTimelineView(page, BASE_URL, board.id, creds);

    const patchPromise = page.waitForRequest(
      (req) => req.method() === 'PATCH' && req.url().includes(`/cards/${cardId}`),
    );

    // Drag left handle 28px to the left (2 days earlier).
    await dragHandle(page, `timeline-bar-resize-left-${cardId}`, -28);

    const patchReq = await patchPromise;
    const body = patchReq.postDataJSON() as { start_date?: string; due_date?: string };
    // due_date should be unchanged; start_date should be earlier
    expect(body.due_date).toBe(dueDate);
    expect(body.start_date).not.toBe(startDate);
    expect(new Date(body.start_date!).getTime()).toBeLessThan(new Date(startDate).getTime());
  });

  test('Dragging the bar body shifts both dates via PATCH', async ({ page, request }) => {
    const creds = await registerAndLogin(request, 'drag-body');
    const wsId = await createWorkspace(request, creds.token);
    const board = await createBoard(request, creds.token, wsId);
    const listId = await createList(request, creds.token, board.id, 'Work');
    const cardId = await createCard(request, creds.token, listId, 'MoveCard');
    const startDate = offsetDate(-1);
    const dueDate = offsetDate(6);
    await patchCard(request, creds.token, cardId, { start_date: startDate, due_date: dueDate });

    await goToTimelineView(page, BASE_URL, board.id, creds);

    const patchPromise = page.waitForRequest(
      (req) => req.method() === 'PATCH' && req.url().includes(`/cards/${cardId}`),
    );

    // Drag bar body 28px to the right (2 days forward).
    const bar = page.getByTestId(`timeline-bar-${cardId}`);
    const barBox = await bar.boundingBox();
    if (!barBox) throw new Error('Could not get bar bounding box');
    const midX = barBox.x + barBox.width / 2;
    const midY = barBox.y + barBox.height / 2;
    await page.mouse.move(midX, midY);
    await page.mouse.down();
    await page.mouse.move(midX + 28, midY, { steps: 7 });
    await page.mouse.up();

    const patchReq = await patchPromise;
    const body = patchReq.postDataJSON() as { start_date?: string; due_date?: string };

    // Both dates should shift by the same delta.
    expect(body.start_date).not.toBe(startDate);
    expect(body.due_date).not.toBe(dueDate);

    const origDuration =
      new Date(dueDate).getTime() - new Date(startDate).getTime();
    const newDuration =
      new Date(body.due_date!).getTime() - new Date(body.start_date!).getTime();
    // Duration (gap between start and due) should remain the same.
    expect(newDuration).toBe(origDuration);
  });

  test('PATCH failure reverts bar dates and shows error toast', async ({ page, request }) => {
    const creds = await registerAndLogin(request, 'drag-revert');
    const wsId = await createWorkspace(request, creds.token);
    const board = await createBoard(request, creds.token, wsId);
    const listId = await createList(request, creds.token, board.id, 'Sprint');
    const cardId = await createCard(request, creds.token, listId, 'RevertCard');
    const startDate = offsetDate(-2);
    const dueDate = offsetDate(4);
    await patchCard(request, creds.token, cardId, { start_date: startDate, due_date: dueDate });

    await goToTimelineView(page, BASE_URL, board.id, creds);

    // Intercept the PATCH and force a 500 error.
    await page.route(`**/api/v1/cards/${cardId}`, (route) => {
      if (route.request().method() === 'PATCH') {
        route.fulfill({ status: 500, body: JSON.stringify({ name: 'internal-server-error' }) });
      } else {
        route.continue();
      }
    });

    await dragHandle(page, `timeline-bar-resize-right-${cardId}`, 42);

    // Error toast should appear.
    await expect(page.getByText(/failed to update card dates/i)).toBeVisible({ timeout: 8000 });

    // After revert, the server-side dates should remain unchanged.
    const serverCard = await getCard(request, creds.token, cardId);
    expect(serverCard.start_date?.slice(0, 10)).toBe(startDate);
    expect(serverCard.due_date?.slice(0, 10)).toBe(dueDate);
  });
});
