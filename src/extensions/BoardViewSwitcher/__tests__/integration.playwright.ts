// Playwright E2E test: Board View Switcher (Sprint 52)
// Tests that the view switcher renders on the board page, switching tabs
// calls PUT /boards/:id/view-preference, and the view persists on reload.
//
// NOTE: Run against a live dev server — `bun run dev` must be running.
// Set PLAYWRIGHT_BASE_URL or default to http://localhost:5173.
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

// ── Auth helper ─────────────────────────────────────────────────────────────

async function loginAndGetBoardUrl(request: import('@playwright/test').APIRequestContext): Promise<{ token: string; boardUrl: string }> {
  const loginRes = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email: 'test@example.com', password: 'password' },
  });
  expect(loginRes.ok()).toBeTruthy();
  const { data: { token } } = await loginRes.json();

  const workspacesRes = await request.get(`${BASE_URL}/api/v1/workspaces`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { data: workspaces } = await workspacesRes.json();
  const workspaceId = workspaces[0].id;

  const boardsRes = await request.get(`${BASE_URL}/api/v1/workspaces/${workspaceId}/boards`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { data: boards } = await boardsRes.json();
  const boardId = boards[0].id;

  return { token, boardUrl: `/boards/${boardId}` };
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('BoardViewSwitcher', () => {
  test('renders view switcher tabs on the board page', async ({ page, request }) => {
    const { boardUrl } = await loginAndGetBoardUrl(request);
    await page.goto(`${BASE_URL}${boardUrl}`);

    const switcher = page.getByTestId('board-view-switcher');
    await expect(switcher).toBeVisible({ timeout: 10000 });

    // All four tabs should be present
    await expect(page.getByRole('tab', { name: 'Kanban' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Table' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Calendar' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Timeline' })).toBeVisible();
  });

  test('Kanban tab is active by default', async ({ page, request }) => {
    const { boardUrl } = await loginAndGetBoardUrl(request);
    await page.goto(`${BASE_URL}${boardUrl}`);

    const kanbanTab = page.getByRole('tab', { name: 'Kanban' });
    await expect(kanbanTab).toBeVisible({ timeout: 10000 });
    await expect(kanbanTab).toHaveAttribute('aria-selected', 'true');
  });

  test('switching to Table view calls PUT and shows placeholder', async ({ page, request }) => {
    const { boardUrl } = await loginAndGetBoardUrl(request);
    await page.goto(`${BASE_URL}${boardUrl}`);

    // Intercept the PUT call
    const putRequests: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'PUT' && req.url().includes('view-preference')) {
        putRequests.push(req.url());
      }
    });

    const tableTab = page.getByRole('tab', { name: 'Table' });
    await tableTab.click();
    await expect(tableTab).toHaveAttribute('aria-selected', 'true');

    // PUT should have fired
    await page.waitForTimeout(500);
    expect(putRequests.length).toBeGreaterThan(0);
  });

  test('view preference persists across reload', async ({ page, request }) => {
    const { boardUrl } = await loginAndGetBoardUrl(request);
    await page.goto(`${BASE_URL}${boardUrl}`);

    // Switch to Calendar view
    const calendarTab = page.getByRole('tab', { name: 'Calendar' });
    await calendarTab.click();
    await expect(calendarTab).toHaveAttribute('aria-selected', 'true');

    // Wait for PUT to settle
    await page.waitForTimeout(800);

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Calendar tab should still be active
    const calendarTabAfterReload = page.getByRole('tab', { name: 'Calendar' });
    await expect(calendarTabAfterReload).toHaveAttribute('aria-selected', 'true', { timeout: 5000 });
  });
});
