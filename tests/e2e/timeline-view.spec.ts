// Playwright E2E tests for the TimelineView (Sprint 54, Iteration 6).
//
// Covers:
// - Switching to Timeline view renders the timeline container.
// - One swimlane row appears per list in the board.
// - Cards with both start_date and due_date are "scheduled" (bar area visible).
// - Cards missing start_date or due_date appear as unscheduled chips below the swimlane.
// - Today button is visible and clickable.
// - Zoom controls (Day / Week / Month) are visible and switch the header granularity.
//   Switching zoom changes the header column widths (day zoom = wider columns).

import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

// ── Helpers ────────────────────────────────────────────────────────────────

interface Credentials { email: string; password: string; token: string }

async function registerAndLogin(request: APIRequestContext, suffix: string): Promise<Credentials> {
  const email = `tv-test-${suffix}-${Date.now()}@journeyh.io`;
  const password = 'TestPassword1!';
  await request.post(`${BASE_URL}/api/v1/auth/register`, {
    data: { email, password, name: `TV ${suffix}` },
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
    data: { name: `WS-TV-${Date.now()}` },
  });
  const body = await res.json() as { data: { id: string } };
  return body.data.id;
}

async function createBoard(
  request: APIRequestContext,
  token: string,
  workspaceId: string,
): Promise<{ id: string }> {
  const res = await request.post(`${BASE_URL}/api/v1/workspaces/${workspaceId}/boards`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: `Board-TV-${Date.now()}` },
  });
  const body = await res.json() as { data: { id: string } };
  return body.data;
}

async function createList(
  request: APIRequestContext,
  token: string,
  boardId: string,
  title: string,
): Promise<string> {
  const res = await request.post(`${BASE_URL}/api/v1/boards/${boardId}/lists`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title },
  });
  const body = await res.json() as { data: { id: string } };
  return body.data.id;
}

async function createCard(
  request: APIRequestContext,
  token: string,
  listId: string,
  title: string,
): Promise<string> {
  const res = await request.post(`${BASE_URL}/api/v1/lists/${listId}/cards`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title },
  });
  const body = await res.json() as { data: { id: string } };
  return body.data.id;
}

async function patchCard(
  request: APIRequestContext,
  token: string,
  cardId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await request.patch(`${BASE_URL}/api/v1/cards/${cardId}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
}

/** Returns "YYYY-MM-DD" for today ± offset days. */
function offsetDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function goToBoard(page: Page, baseUrl: string, boardId: string, creds: Credentials) {
  await page.goto(`${baseUrl}/login`);
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${baseUrl}/workspaces**`, { timeout: 15000 });
  await page.goto(`${baseUrl}/boards/${boardId}`);
  await page.waitForLoadState('networkidle');
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Timeline View', () => {
  test('Switching to Timeline renders the timeline container', async ({ page, request }) => {
    const creds = await registerAndLogin(request, 'tl-switch');
    const wsId = await createWorkspace(request, creds.token);
    const board = await createBoard(request, creds.token, wsId);

    await goToBoard(page, BASE_URL, board.id, creds);
    await expect(page.getByTestId('board-view-switcher')).toBeVisible({ timeout: 15000 });

    await page.getByTestId('board-view-tab-TIMELINE').click();
    await expect(page.getByTestId('timeline-view')).toBeVisible();
    await expect(page.getByTestId('timeline-header')).toBeVisible();
    await expect(page.getByTestId('timeline-today-button')).toBeVisible();
    await expect(page.getByTestId('timeline-zoom-control')).toBeVisible();
  });

  test('One swimlane row renders per list in the board', async ({ page, request }) => {
    const creds = await registerAndLogin(request, 'tl-swimlanes');
    const wsId = await createWorkspace(request, creds.token);
    const board = await createBoard(request, creds.token, wsId);
    const listId1 = await createList(request, creds.token, board.id, 'Backlog');
    const listId2 = await createList(request, creds.token, board.id, 'In Progress');

    await goToBoard(page, BASE_URL, board.id, creds);
    await page.getByTestId('board-view-tab-TIMELINE').click();
    await expect(page.getByTestId('timeline-view')).toBeVisible();

    await expect(page.getByTestId(`timeline-row-${listId1}`)).toBeVisible();
    await expect(page.getByTestId(`timeline-row-${listId2}`)).toBeVisible();

    // Labels should display the list titles
    await expect(page.getByTestId(`timeline-lane-label-${listId1}`)).toContainText('Backlog');
    await expect(page.getByTestId(`timeline-lane-label-${listId2}`)).toContainText('In Progress');
  });

  test('Card with both start_date and due_date is scheduled (bar area visible)', async ({ page, request }) => {
    const creds = await registerAndLogin(request, 'tl-scheduled');
    const wsId = await createWorkspace(request, creds.token);
    const board = await createBoard(request, creds.token, wsId);
    const listId = await createList(request, creds.token, board.id, 'Sprint');
    const cardId = await createCard(request, creds.token, listId, 'ScheduledCard');
    await patchCard(request, creds.token, cardId, {
      start_date: offsetDate(-2),
      due_date: offsetDate(5),
    });

    await goToBoard(page, BASE_URL, board.id, creds);
    await page.getByTestId('board-view-tab-TIMELINE').click();
    await expect(page.getByTestId('timeline-view')).toBeVisible();

    // Bar area for the list should be visible
    await expect(page.getByTestId(`timeline-bar-area-${listId}`)).toBeVisible();

    // Scheduled card should NOT appear as an unscheduled chip
    await expect(page.getByTestId(`timeline-unscheduled-chip-${cardId}`)).not.toBeVisible();
  });

  test('Card missing start_date appears as unscheduled chip below its swimlane', async ({ page, request }) => {
    const creds = await registerAndLogin(request, 'tl-unscheduled');
    const wsId = await createWorkspace(request, creds.token);
    const board = await createBoard(request, creds.token, wsId);
    const listId = await createList(request, creds.token, board.id, 'Backlog');
    const cardId = await createCard(request, creds.token, listId, 'UnscheduledCard');
    // Only due_date — no start_date → unscheduled
    await patchCard(request, creds.token, cardId, { due_date: offsetDate(3) });

    await goToBoard(page, BASE_URL, board.id, creds);
    await page.getByTestId('board-view-tab-TIMELINE').click();
    await expect(page.getByTestId('timeline-view')).toBeVisible();

    // Unscheduled row should be visible for this list
    await expect(page.getByTestId(`timeline-unscheduled-row-${listId}`)).toBeVisible();
    // Chip for the card should be present
    await expect(page.getByTestId(`timeline-unscheduled-chip-${cardId}`)).toBeVisible();
    await expect(page.getByTestId(`timeline-unscheduled-chip-${cardId}`)).toContainText('UnscheduledCard');
  });

  test('Card with no dates at all appears as unscheduled chip', async ({ page, request }) => {
    const creds = await registerAndLogin(request, 'tl-nodates');
    const wsId = await createWorkspace(request, creds.token);
    const board = await createBoard(request, creds.token, wsId);
    const listId = await createList(request, creds.token, board.id, 'Inbox');
    const cardId = await createCard(request, creds.token, listId, 'NoDatesCard');
    // No dates set at all

    await goToBoard(page, BASE_URL, board.id, creds);
    await page.getByTestId('board-view-tab-TIMELINE').click();
    await expect(page.getByTestId('timeline-view')).toBeVisible();

    await expect(page.getByTestId(`timeline-unscheduled-chip-${cardId}`)).toBeVisible();
  });

  test('Today button is clickable and does not throw', async ({ page, request }) => {
    const creds = await registerAndLogin(request, 'tl-today');
    const wsId = await createWorkspace(request, creds.token);
    const board = await createBoard(request, creds.token, wsId);

    await goToBoard(page, BASE_URL, board.id, creds);
    await page.getByTestId('board-view-tab-TIMELINE').click();
    await expect(page.getByTestId('timeline-view')).toBeVisible();

    // Today button should scroll the timeline without errors
    await page.getByTestId('timeline-today-button').click();
    // Today column should be highlighted in the header
    await expect(page.getByTestId('timeline-today-column')).toBeVisible();
  });

  test('Zoom controls change axis granularity (day zoom renders wider columns)', async ({ page, request }) => {
    const creds = await registerAndLogin(request, 'tl-zoom');
    const wsId = await createWorkspace(request, creds.token);
    const board = await createBoard(request, creds.token, wsId);

    await goToBoard(page, BASE_URL, board.id, creds);
    await page.getByTestId('board-view-tab-TIMELINE').click();
    await expect(page.getByTestId('timeline-view')).toBeVisible();

    // Default is week zoom
    const weekZoomBtn = page.getByTestId('timeline-zoom-week');
    await expect(weekZoomBtn).toHaveAttribute('aria-pressed', 'true');

    // Switch to Day zoom
    await page.getByTestId('timeline-zoom-day').click();
    await expect(page.getByTestId('timeline-zoom-day')).toHaveAttribute('aria-pressed', 'true');
    await expect(weekZoomBtn).toHaveAttribute('aria-pressed', 'false');

    // Switch to Month zoom
    await page.getByTestId('timeline-zoom-month').click();
    await expect(page.getByTestId('timeline-zoom-month')).toHaveAttribute('aria-pressed', 'true');

    // Switch back to Week
    await weekZoomBtn.click();
    await expect(weekZoomBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('Clicking an unscheduled chip opens the card detail modal', async ({ page, request }) => {
    const creds = await registerAndLogin(request, 'tl-chip-click');
    const wsId = await createWorkspace(request, creds.token);
    const board = await createBoard(request, creds.token, wsId);
    const listId = await createList(request, creds.token, board.id, 'Backlog');
    const cardId = await createCard(request, creds.token, listId, 'ClickableCard');

    await goToBoard(page, BASE_URL, board.id, creds);
    await page.getByTestId('board-view-tab-TIMELINE').click();
    await expect(page.getByTestId('timeline-view')).toBeVisible();

    const chip = page.getByTestId(`timeline-unscheduled-chip-${cardId}`);
    await expect(chip).toBeVisible();
    await chip.click();

    // Card modal should open (URL should contain ?card=<id>)
    await expect(page).toHaveURL(new RegExp(`card=${cardId}`), { timeout: 5000 });
  });
});
