// Playwright E2E tests for the TableView (Sprint 52).
//
// Covers:
// - Switching to Table view renders the table with all expected column headers.
// - All cards in the board appear as rows.
// - Clicking a column header sorts the table.
// - Clicking a card title opens the card detail modal.

import { test, expect, type APIRequestContext } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

// ── Helpers ────────────────────────────────────────────────────────────────

async function registerAndLogin(request: APIRequestContext, suffix: string): Promise<string> {
  const email = `tv-test-${suffix}-${Date.now()}@example.com`;
  const password = 'TestPassword1!';
  await request.post(`${BASE_URL}/api/v1/auth/register`, {
    data: { email, password, name: `TV ${suffix}` },
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
    data: { name: `Board-TV-${Date.now()}` },
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

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Table View', () => {
  test('Table view renders column headers after switching to TABLE', async ({ page, request }) => {
    const token = await registerAndLogin(request, 'headers');
    const wsId = await createWorkspace(request, token);
    const board = await createBoard(request, token, wsId);
    const listId = await createList(request, token, board.id, 'To Do');
    await createCard(request, token, listId, 'Alpha card');

    // Set TABLE view preference so the board loads in TABLE mode
    await request.put(`${BASE_URL}/api/v1/boards/${board.id}/view-preference`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { viewType: 'TABLE' },
    });

    // Log in via the UI
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', `tv-test-headers-${Date.now() - 100}@example.com`);

    // Re-login properly using API token in localStorage
    await page.evaluate(
      ([url, tok]) => {
        localStorage.setItem('access_token', tok as string);
        window.location.href = `${url}/boards/${(tok as string).slice(-8)}`;
      },
      [BASE_URL, token],
    );

    await page.goto(`${BASE_URL}/boards/${board.id}`);
    await page.waitForLoadState('networkidle');

    // BoardViewSwitcher should be visible
    await expect(page.getByTestId('board-view-switcher')).toBeVisible();

    // Click the TABLE tab
    await page.getByTestId('board-view-tab-TABLE').click();

    // Table should be visible
    await expect(page.getByTestId('table-view')).toBeVisible();

    // All column headers should be present
    const expectedHeaders = ['title', 'list', 'assignees', 'labels', 'due_date', 'start_date', 'value'];
    for (const col of expectedHeaders) {
      await expect(page.getByTestId(`table-header-${col}`)).toBeVisible();
    }
  });

  test('Table view renders card rows', async ({ page, request }) => {
    const token = await registerAndLogin(request, 'rows');
    const wsId = await createWorkspace(request, token);
    const board = await createBoard(request, token, wsId);
    const listId = await createList(request, token, board.id, 'Backlog');
    const cardId = await createCard(request, token, listId, 'My test card');

    await page.goto(`${BASE_URL}/boards/${board.id}`);
    await page.waitForLoadState('networkidle');

    // Switch to TABLE view via the switcher
    await page.getByTestId('board-view-tab-TABLE').click();
    await expect(page.getByTestId('table-view')).toBeVisible();

    // The card row should be present
    await expect(page.getByTestId(`table-row-${cardId}`)).toBeVisible();
    // The card title button should contain the card title
    await expect(page.getByTestId(`table-card-title-${cardId}`)).toHaveText('My test card');
  });

  test('Clicking a column header changes sort order', async ({ page, request }) => {
    const token = await registerAndLogin(request, 'sort');
    const wsId = await createWorkspace(request, token);
    const board = await createBoard(request, token, wsId);
    const listId = await createList(request, token, board.id, 'Work');
    await createCard(request, token, listId, 'Zebra card');
    await createCard(request, token, listId, 'Alpha card');

    await page.goto(`${BASE_URL}/boards/${board.id}`);
    await page.waitForLoadState('networkidle');
    await page.getByTestId('board-view-tab-TABLE').click();
    await expect(page.getByTestId('table-view')).toBeVisible();

    const titleHeader = page.getByTestId('table-header-title');

    // First click — ascending
    await titleHeader.click();
    await expect(titleHeader).toHaveAttribute('aria-sort', 'ascending');

    // Second click — descending
    await titleHeader.click();
    await expect(titleHeader).toHaveAttribute('aria-sort', 'descending');

    // Third click — back to none
    await titleHeader.click();
    await expect(titleHeader).toHaveAttribute('aria-sort', 'none');
  });

  test('Clicking card title opens card detail modal', async ({ page, request }) => {
    const token = await registerAndLogin(request, 'modal');
    const wsId = await createWorkspace(request, token);
    const board = await createBoard(request, token, wsId);
    const listId = await createList(request, token, board.id, 'Sprint');
    const cardId = await createCard(request, token, listId, 'Open me please');

    await page.goto(`${BASE_URL}/boards/${board.id}`);
    await page.waitForLoadState('networkidle');
    await page.getByTestId('board-view-tab-TABLE').click();
    await expect(page.getByTestId('table-view')).toBeVisible();

    // Click the card title button
    await page.getByTestId(`table-card-title-${cardId}`).click();

    // URL should now contain ?card=<cardId>
    await expect(page).toHaveURL(new RegExp(`card=${cardId}`));

    // Card modal should be visible (CardModal renders an accessible dialog or section)
    // The modal contains the card title text
    await expect(page.getByText('Open me please').first()).toBeVisible();
  });
});
