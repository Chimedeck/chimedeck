// Playwright E2E tests for the CalendarView (Sprint 53).
//
// Covers:
// - Switching to Calendar view renders the monthly grid.
// - Current month title is displayed.
// - Cards with due_date appear on the correct day cells.
// - "+N more" overflow chip is shown when a day has > 3 cards and expands on click.
// - Prev/next month navigation works.
// - Cards without due_date do not appear; toolbar note is visible.

import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

// ── Helpers ────────────────────────────────────────────────────────────────

interface Credentials { email: string; password: string; token: string }

async function registerAndLogin(request: APIRequestContext, suffix: string): Promise<Credentials> {
  const email = `cv-test-${suffix}-${Date.now()}@journeyh.io`;
  const password = 'TestPassword1!';
  await request.post(`${BASE_URL}/api/v1/auth/register`, {
    data: { email, password, name: `CV ${suffix}` },
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
    data: { name: `WS-CV-${Date.now()}` },
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
    data: { title: `Board-CV-${Date.now()}` },
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

/** Returns "YYYY-MM-DD" for the given year/month/day (all 1-indexed). */
function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ── Tests ──────────────────────────────────────────────────────────────────

/** Log in via the browser UI and navigate to a board. */
async function goToBoard(page: Page, baseUrl: string, boardId: string, creds: Credentials) {
  await page.goto(`${baseUrl}/login`);
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');
  // After login the app redirects to /workspaces — wait for that before navigating to the board
  await page.waitForURL(`${baseUrl}/workspaces**`, { timeout: 15000 });
  await page.goto(`${baseUrl}/boards/${boardId}`);
  await page.waitForLoadState('networkidle');
}

test.describe('Calendar View', () => {
  test('Switching to Calendar renders the monthly grid with current month title', async ({ page, request }) => {
    const creds = await registerAndLogin(request, 'cal-switch');
    const wsId = await createWorkspace(request, creds.token);
    const board = await createBoard(request, creds.token, wsId);

    await goToBoard(page, BASE_URL, board.id, creds);
    await expect(page.getByTestId('board-view-switcher')).toBeVisible({ timeout: 15000 });

    await page.getByTestId('board-view-tab-CALENDAR').click();
    await expect(page.getByTestId('calendar-view')).toBeVisible();
    await expect(page.getByTestId('calendar-month-grid')).toBeVisible();

    // Month title should contain current year
    const now = new Date();
    const title = page.getByTestId('calendar-month-title');
    await expect(title).toContainText(String(now.getFullYear()));
  });

  test('Cards with due_date appear on correct day cells', async ({ page, request }) => {
    const creds = await registerAndLogin(request, 'cal-cards');
    const wsId = await createWorkspace(request, creds.token);
    const board = await createBoard(request, creds.token, wsId);
    const listId = await createList(request, creds.token, board.id, 'Todo');

    // Create a card with due_date on a specific day
    const now = new Date();
    const targetDay = 15;
    const due = isoDate(now.getFullYear(), now.getMonth() + 1, targetDay);
    const cardId = await createCard(request, creds.token, listId, 'DueCard');
    await patchCard(request, creds.token, cardId, { due_date: due });

    // Create a card without due_date (should not appear)
    await createCard(request, creds.token, listId, 'NoDueCard');

    await goToBoard(page, BASE_URL, board.id, creds);
    await page.getByTestId('board-view-tab-CALENDAR').click();
    await expect(page.getByTestId('calendar-month-grid')).toBeVisible();

    const dayCell = page.getByTestId(`calendar-day-${due}`);
    await expect(dayCell).toBeVisible();
    await expect(dayCell.getByTestId(`calendar-chip-${cardId}`)).toBeVisible();
  });

  test('"Cards without a due date" toolbar note is visible', async ({ page, request }) => {
    const creds = await registerAndLogin(request, 'cal-note');
    const wsId = await createWorkspace(request, creds.token);
    const board = await createBoard(request, creds.token, wsId);

    await goToBoard(page, BASE_URL, board.id, creds);
    await page.getByTestId('board-view-tab-CALENDAR').click();
    await expect(page.getByTestId('calendar-no-due-date-note')).toBeVisible();
    await expect(page.getByTestId('calendar-no-due-date-note')).toContainText(
      'Cards without a due date are not shown',
    );
  });

  test('Prev/next month navigation changes the month title', async ({ page, request }) => {
    const creds = await registerAndLogin(request, 'cal-nav');
    const wsId = await createWorkspace(request, creds.token);
    const board = await createBoard(request, creds.token, wsId);

    await goToBoard(page, BASE_URL, board.id, creds);
    await page.getByTestId('board-view-tab-CALENDAR').click();
    await expect(page.getByTestId('calendar-month-grid')).toBeVisible();

    const MONTHS = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const now = new Date();
    const currentMonthName = MONTHS[now.getMonth()];
    const prevMonthName = MONTHS[(now.getMonth() + 11) % 12];
    const nextMonthName = MONTHS[(now.getMonth() + 1) % 12];

    await expect(page.getByTestId('calendar-month-title')).toContainText(currentMonthName);

    // Navigate to next month
    await page.getByTestId('calendar-next').click();
    await expect(page.getByTestId('calendar-month-title')).toContainText(nextMonthName);

    // Navigate back twice to get to previous month
    await page.getByTestId('calendar-prev').click();
    await page.getByTestId('calendar-prev').click();
    await expect(page.getByTestId('calendar-month-title')).toContainText(prevMonthName);
  });

  test('"+N more" overflow chip shown when day has > 3 cards', async ({ page, request }) => {
    const creds = await registerAndLogin(request, 'cal-overflow');
    const wsId = await createWorkspace(request, creds.token);
    const board = await createBoard(request, creds.token, wsId);
    const listId = await createList(request, creds.token, board.id, 'Sprint');

    const now = new Date();
    const targetDay = 10;
    const due = isoDate(now.getFullYear(), now.getMonth() + 1, targetDay);

    // Create 5 cards all due on the same day
    for (let i = 1; i <= 5; i++) {
      const cardId = await createCard(request, creds.token, listId, `OverflowCard${i}`);
      await patchCard(request, creds.token, cardId, { due_date: due });
    }

    await goToBoard(page, BASE_URL, board.id, creds);
    await page.getByTestId('board-view-tab-CALENDAR').click();
    await expect(page.getByTestId('calendar-month-grid')).toBeVisible();

    const overflowChip = page.getByTestId(`calendar-day-overflow-${due}`);
    await expect(overflowChip).toBeVisible();
    await expect(overflowChip).toContainText('+2 more');

    // Click to expand — overflow chip should be replaced by "Show less"
    await overflowChip.click();
    await expect(overflowChip).not.toBeVisible();
  });
});
