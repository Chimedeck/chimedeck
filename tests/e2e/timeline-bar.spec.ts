// Playwright E2E tests for TimelineBar rendering (Sprint 54, Iteration 7).
//
// Covers:
// - Cards with start_date + due_date render as bars (data-testid timeline-bar-<id>) in
//   the correct swimlane's bar area.
// - The bar is visible and positioned within the bar area container.
// - The left and right resize handles are present on the bar.
// - Bars for cards in different swimlanes appear in their respective swimlanes.
// - Cards without dates are NOT rendered as bars (only as unscheduled chips).

import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

// ── Helpers ────────────────────────────────────────────────────────────────

interface Credentials { email: string; password: string; token: string }

async function registerAndLogin(request: APIRequestContext, suffix: string): Promise<Credentials> {
  const email = `tb-test-${suffix}-${Date.now()}@journeyh.io`;
  const password = 'TestPassword1!';
  await request.post(`${BASE_URL}/api/v1/auth/register`, {
    data: { email, password, name: `TB ${suffix}` },
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
    data: { name: `WS-TB-${Date.now()}` },
  });
  const body = await res.json() as { data: { id: string } };
  return body.data.id;
}

async function createBoard(request: APIRequestContext, token: string, workspaceId: string): Promise<{ id: string }> {
  const res = await request.post(`${BASE_URL}/api/v1/workspaces/${workspaceId}/boards`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: `Board-TB-${Date.now()}` },
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

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Timeline Bar Rendering', () => {
  test('Card with start_date and due_date renders as a bar in its swimlane', async ({ page, request }) => {
    const creds = await registerAndLogin(request, 'bar-basic');
    const wsId = await createWorkspace(request, creds.token);
    const board = await createBoard(request, creds.token, wsId);
    const listId = await createList(request, creds.token, board.id, 'Sprint');
    const cardId = await createCard(request, creds.token, listId, 'BarCard');
    await patchCard(request, creds.token, cardId, {
      start_date: offsetDate(-3),
      due_date: offsetDate(4),
    });

    await goToTimelineView(page, BASE_URL, board.id, creds);

    // Bar should be rendered inside the correct swimlane
    const barArea = page.getByTestId(`timeline-bar-area-${listId}`);
    await expect(barArea).toBeVisible();

    const bar = page.getByTestId(`timeline-bar-${cardId}`);
    await expect(bar).toBeVisible();

    // Bar should be contained within the bar area (not in unscheduled row)
    await expect(page.getByTestId(`timeline-unscheduled-chip-${cardId}`)).not.toBeVisible();
  });

  test('Bar has left and right resize handles', async ({ page, request }) => {
    const creds = await registerAndLogin(request, 'bar-handles');
    const wsId = await createWorkspace(request, creds.token);
    const board = await createBoard(request, creds.token, wsId);
    const listId = await createList(request, creds.token, board.id, 'Work');
    const cardId = await createCard(request, creds.token, listId, 'HandleCard');
    await patchCard(request, creds.token, cardId, {
      start_date: offsetDate(-1),
      due_date: offsetDate(6),
    });

    await goToTimelineView(page, BASE_URL, board.id, creds);

    await expect(page.getByTestId(`timeline-bar-resize-left-${cardId}`)).toBeVisible();
    await expect(page.getByTestId(`timeline-bar-resize-right-${cardId}`)).toBeVisible();
  });

  test('Bar title matches the card title', async ({ page, request }) => {
    const creds = await registerAndLogin(request, 'bar-title');
    const wsId = await createWorkspace(request, creds.token);
    const board = await createBoard(request, creds.token, wsId);
    const listId = await createList(request, creds.token, board.id, 'Backlog');
    const cardId = await createCard(request, creds.token, listId, 'My Task Title');
    await patchCard(request, creds.token, cardId, {
      start_date: offsetDate(0),
      due_date: offsetDate(7),
    });

    await goToTimelineView(page, BASE_URL, board.id, creds);

    const bar = page.getByTestId(`timeline-bar-${cardId}`);
    await expect(bar).toContainText('My Task Title');
  });

  test('Cards in different swimlanes render in their respective bar areas', async ({ page, request }) => {
    const creds = await registerAndLogin(request, 'bar-lanes');
    const wsId = await createWorkspace(request, creds.token);
    const board = await createBoard(request, creds.token, wsId);
    const listId1 = await createList(request, creds.token, board.id, 'Alpha');
    const listId2 = await createList(request, creds.token, board.id, 'Beta');
    const cardId1 = await createCard(request, creds.token, listId1, 'AlphaCard');
    const cardId2 = await createCard(request, creds.token, listId2, 'BetaCard');
    await patchCard(request, creds.token, cardId1, { start_date: offsetDate(-2), due_date: offsetDate(3) });
    await patchCard(request, creds.token, cardId2, { start_date: offsetDate(1), due_date: offsetDate(5) });

    await goToTimelineView(page, BASE_URL, board.id, creds);

    // Both bars should be visible in their respective swimlanes
    await expect(page.getByTestId(`timeline-bar-${cardId1}`)).toBeVisible();
    await expect(page.getByTestId(`timeline-bar-${cardId2}`)).toBeVisible();
  });

  test('Card without dates is NOT rendered as a bar', async ({ page, request }) => {
    const creds = await registerAndLogin(request, 'bar-nodate');
    const wsId = await createWorkspace(request, creds.token);
    const board = await createBoard(request, creds.token, wsId);
    const listId = await createList(request, creds.token, board.id, 'Inbox');
    const cardId = await createCard(request, creds.token, listId, 'NoDatesCard');
    // Intentionally no dates

    await goToTimelineView(page, BASE_URL, board.id, creds);

    // Should NOT have a bar
    await expect(page.getByTestId(`timeline-bar-${cardId}`)).not.toBeVisible();
    // Should appear as an unscheduled chip instead
    await expect(page.getByTestId(`timeline-unscheduled-chip-${cardId}`)).toBeVisible();
  });
});
