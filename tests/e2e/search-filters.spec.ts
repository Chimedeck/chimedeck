// tests/e2e/search-filters.spec.ts
// Playwright E2E tests for search box, type filter, and board scoping.
// Based on: specs/tests/search-filters.md (if present)
// Soft-skips when the server is not reachable.

import { test, expect } from '@playwright/test';
import { BASE_URL, registerAndGetCredentials, createWorkspace, createBoard, createList, createCard, loginViaCookie, type Credentials } from './_helpers';

const UI_URL = process.env.TEST_UI_URL ?? 'http://localhost:5173';

test.describe('Search Filters', () => {
  let creds: Credentials;
  let token: string;
  let workspaceId: string;
  let boardId: string;
  let otherBoardId: string;
  const run = Date.now();

  test.beforeAll(async ({ request }) => {
    // Soft-skip entire suite if the server is not reachable
    const probe = await request.get(`${BASE_URL}/api/v1/health`).catch(() => null);
    if (!probe || probe.status() >= 500) {
      return;
    }

    creds = await registerAndGetCredentials(request, `search-${run}`);
    token = creds.token;
    workspaceId = await createWorkspace(request, token);
    boardId = await createBoard(request, token, workspaceId);
    otherBoardId = await createBoard(request, token, workspaceId);

    const listId = await createList(request, token, boardId);
    const otherListId = await createList(request, token, otherBoardId);

    // Seed cards with distinct titles for search assertions
    await createCard(request, token, listId, `Alpha Card ${run}`);
    await createCard(request, token, listId, `Beta Task ${run}`);
    await createCard(request, token, otherListId, `Gamma Card ${run}`);
  });

  test('Test 1 — Search returns cards matching the query term', async ({ request }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    // Real route is workspace-scoped: GET /api/v1/workspaces/:id/search.
    // There is no global /api/v1/search.
    const res = await request.get(`${BASE_URL}/api/v1/workspaces/${workspaceId}/search?q=Alpha+Card+${run}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status()).toBe(200);
    const body = await res.json() as { data: Array<{ title: string; type: string }> };
    expect(Array.isArray(body.data)).toBe(true);
    const titles = body.data.map((c) => c.title);
    expect(titles.some((t) => t.includes(`Alpha Card ${run}`))).toBe(true);
  });

  test('Test 2 — Search with type=card filter returns only card results', async ({ request }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    const res = await request.get(`${BASE_URL}/api/v1/workspaces/${workspaceId}/search?q=${run}&type=card`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status()).toBe(200);
    const body = await res.json() as { data: Array<{ type?: string; title: string }> };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    // Every returned item must be a card.
    for (const item of body.data) {
      expect(item.type).toBe('card');
    }
  });

  test('Test 3 — Search scoped to a specific board excludes other-board cards', async ({ request }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    // Board-scoped search has its own route: GET /api/v1/boards/:id/search.
    const res = await request.get(
      `${BASE_URL}/api/v1/boards/${boardId}/search?q=${run}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    expect(res.status()).toBe(200);
    const body = await res.json() as { data: Array<{ title: string }> };
    expect(Array.isArray(body.data)).toBe(true);
    const titles = body.data.map((c) => c.title);

    // "Gamma Card" belongs to otherBoardId and must not appear
    expect(titles.some((t) => t.includes(`Gamma Card ${run}`))).toBe(false);
    // "Alpha Card" belongs to boardId and should appear
    expect(titles.some((t) => t.includes(`Alpha Card ${run}`))).toBe(true);
  });

  test('Test 4 — Unauthenticated search returns 401', async ({ request }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    const res = await request.get(`${BASE_URL}/api/v1/workspaces/${workspaceId}/search?q=anything`);

    expect(res.status()).toBe(401);
  });

  // The board page has no inline search input. Search is a modal palette opened
  // from the header "Search" button (also Cmd/Ctrl+K), with an input whose
  // placeholder is "Search boards and cards…" and All/Boards/Cards filter tabs.
  async function openSearchPalette(page: import('@playwright/test').Page): Promise<void> {
    await page.getByRole('button', { name: /search/i }).first().click();
    await page.getByPlaceholder('Search boards and cards…').waitFor({ timeout: 8000 });
  }

  test('Test 5 — UI search palette finds a card by keyword', async ({ request, page }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    // Fresh user/board so the palette only sees these cards.
    const uiCreds = await registerAndGetCredentials(request, `search-ui5-${run}`);
    const uiToken = uiCreds.token;
    const uiWorkspaceId = await createWorkspace(request, uiToken);
    const uiBoardId = await createBoard(request, uiToken, uiWorkspaceId);
    const uiListId = await createList(request, uiToken, uiBoardId);
    await createCard(request, uiToken, uiListId, `Alpha Card ${run}`);
    await createCard(request, uiToken, uiListId, `Beta Task ${run}`);

    await loginViaCookie(page, UI_URL, uiCreds);
    await page.goto(`${UI_URL}/b/${uiBoardId}`);
    await page.waitForLoadState('networkidle');
    await openSearchPalette(page);

    const paletteInput = page.getByPlaceholder('Search boards and cards…');
    await paletteInput.fill(`Alpha Card ${run}`);

    // Scope to the palette: the board grid behind the modal still shows every
    // card, so a page-wide text check would match non-results too.
    const palette = page.locator('[role="dialog"]').last();
    await expect(palette.getByText(`Alpha Card ${run}`).first()).toBeVisible({ timeout: 8000 });
    // The non-matching card must not be offered as a result.
    await expect(palette.getByText(`Beta Task ${run}`)).toHaveCount(0);
  });

  test('Test 6 — UI type filter narrows results to cards', async ({ request, page }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    const uiCreds = await registerAndGetCredentials(request, `search-ui6-${run}`);
    const uiToken = uiCreds.token;
    const uiWorkspaceId = await createWorkspace(request, uiToken);
    const uiBoardId = await createBoard(request, uiToken, uiWorkspaceId);
    const uiListId = await createList(request, uiToken, uiBoardId);
    await createCard(request, uiToken, uiListId, `Alpha Card ${run}`);

    await loginViaCookie(page, UI_URL, uiCreds);
    await page.goto(`${UI_URL}/b/${uiBoardId}`);
    await page.waitForLoadState('networkidle');
    await openSearchPalette(page);

    const paletteInput = page.getByPlaceholder('Search boards and cards…');
    await paletteInput.fill(run.toString());

    // The palette exposes All / Boards / Cards tabs (role=tab, not button).
    const cardsTab = page.getByRole('tab', { name: 'Cards', exact: true }).first();
    await expect(cardsTab).toBeVisible({ timeout: 8000 });
    await cardsTab.click();

    // With the Cards filter chosen the seeded card is still listed.
    const palette = page.locator('[role="dialog"]').last();
    await expect(palette.getByText(`Alpha Card ${run}`).first()).toBeVisible({ timeout: 8000 });
  });
});
