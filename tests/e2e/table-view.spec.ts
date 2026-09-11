// Playwright E2E tests for the TableView (Sprint 52).
//
// Covers:
// - Switching to Table view renders the table with all expected column headers.
// - All cards in the board appear as rows.
// - Clicking a column header sorts the table.
// - Clicking a card title opens the card detail modal.

import { test, expect } from '@playwright/test';
import {
  BASE_URL,
  registerAndGetCredentials,
  createWorkspace,
  createBoard,
  createList,
  createCard,
  loginViaUi,
  type Credentials,
} from './_helpers';

const UI_URL = process.env.TEST_UI_URL ?? 'http://localhost:5173';

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Table View', () => {
  test('Table view renders column headers after switching to TABLE', async ({ page, request }) => {
    const creds: Credentials = await registerAndGetCredentials(request, 'headers');
    const wsId = await createWorkspace(request, creds.token);
    const boardId = await createBoard(request, creds.token, wsId);
    const listId = await createList(request, creds.token, boardId, 'To Do');
    await createCard(request, creds.token, listId, 'Alpha card');

    // Set TABLE view preference so the board loads in TABLE mode
    await request.put(`${BASE_URL}/api/v1/boards/${boardId}/view-preference`, {
      headers: { Authorization: `Bearer ${creds.token}` },
      data: { viewType: 'TABLE' },
    });

    // The app authenticates via HttpOnly cookies, so log in through the UI form.
    await loginViaUi(page, UI_URL, creds);
    await page.goto(`${UI_URL}/b/${boardId}`);
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
    const creds: Credentials = await registerAndGetCredentials(request, 'rows');
    const wsId = await createWorkspace(request, creds.token);
    const boardId = await createBoard(request, creds.token, wsId);
    const listId = await createList(request, creds.token, boardId, 'Backlog');
    const cardId = await createCard(request, creds.token, listId, 'My test card');

    await loginViaUi(page, UI_URL, creds);
    await page.goto(`${UI_URL}/b/${boardId}`);
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
    const creds: Credentials = await registerAndGetCredentials(request, 'sort');
    const wsId = await createWorkspace(request, creds.token);
    const boardId = await createBoard(request, creds.token, wsId);
    const listId = await createList(request, creds.token, boardId, 'Work');
    await createCard(request, creds.token, listId, 'Zebra card');
    await createCard(request, creds.token, listId, 'Alpha card');

    await loginViaUi(page, UI_URL, creds);
    await page.goto(`${UI_URL}/b/${boardId}`);
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
    const creds: Credentials = await registerAndGetCredentials(request, 'modal');
    const wsId = await createWorkspace(request, creds.token);
    const boardId = await createBoard(request, creds.token, wsId);
    const listId = await createList(request, creds.token, boardId, 'Sprint');
    const cardId = await createCard(request, creds.token, listId, 'Open me please');

    await loginViaUi(page, UI_URL, creds);
    await page.goto(`${UI_URL}/b/${boardId}`);
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
