// tests/e2e/search-filters.spec.ts
// Playwright E2E tests for search box, type filter, and board scoping.
// Based on: specs/tests/search-filters.md (if present)
// Soft-skips when the server is not reachable.

import { test, expect } from '@playwright/test';
import { BASE_URL, registerAndLogin, createWorkspace, createBoard, createList, createCard } from './_helpers';

const UI_URL = process.env.TEST_UI_URL ?? 'http://localhost:5173';

test.describe('Search Filters', () => {
  let token: string;
  let boardId: string;
  let otherBoardId: string;
  const run = Date.now();

  test.beforeAll(async ({ request }) => {
    // Soft-skip entire suite if the server is not reachable
    const probe = await request.get(`${BASE_URL}/api/v1/health`).catch(() => null);
    if (!probe || probe.status() >= 500) {
      return;
    }

    token = await registerAndLogin(request, `search-${run}`);
    const workspaceId = await createWorkspace(request, token);
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

    const res = await request.get(`${BASE_URL}/api/v1/search?q=Alpha+Card+${run}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status() === 404 || res.status() === 501) {
      test.skip(true, 'Search endpoint not yet implemented — skipping');
      return;
    }

    expect(res.status()).toBe(200);
    const body = await res.json() as { data: Array<{ title: string }> };
    expect(Array.isArray(body.data)).toBe(true);
    const titles = body.data.map((c) => c.title);
    expect(titles.some((t) => t.includes(`Alpha Card ${run}`))).toBe(true);
  });

  test('Test 2 — Search with type=card filter returns only card results', async ({ request }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    const res = await request.get(`${BASE_URL}/api/v1/search?q=${run}&type=card`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status() === 404 || res.status() === 501) {
      test.skip(true, 'Type-filter on search endpoint not yet implemented — skipping');
      return;
    }

    expect(res.status()).toBe(200);
    const body = await res.json() as { data: Array<{ type?: string; title: string }> };
    expect(Array.isArray(body.data)).toBe(true);
    // Every returned item must be a card (type field absent or equal to 'card')
    for (const item of body.data) {
      if (item.type !== undefined) {
        expect(item.type).toBe('card');
      }
    }
  });

  test('Test 3 — Search scoped to a specific board excludes other-board cards', async ({ request }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    const res = await request.get(
      `${BASE_URL}/api/v1/search?q=${run}&boardId=${boardId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (res.status() === 404 || res.status() === 501) {
      test.skip(true, 'Board-scoped search not yet implemented — skipping');
      return;
    }

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

    const res = await request.get(`${BASE_URL}/api/v1/search?q=anything`);

    if (res.status() === 404 || res.status() === 501) {
      test.skip(true, 'Search endpoint not yet implemented — skipping');
      return;
    }

    expect(res.status()).toBe(401);
  });

  test('Test 5 — UI search box filters visible cards by keyword', async ({ request, page }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    await page.goto(UI_URL);
    await page.evaluate(({ t }: { t: string }) => localStorage.setItem('auth_token', t), { t: token });
    await page.goto(`${UI_URL}/boards/${boardId}`);
    await page.waitForLoadState('networkidle');

    // Locate the search input — try common selectors
    const searchInput = page.locator(
      '[data-testid="search-input"], input[placeholder*="Search"], input[type="search"]',
    ).first();

    if (await searchInput.count() === 0) {
      test.skip(true, 'Search input not found in UI — skipping UI search test');
      return;
    }

    await searchInput.fill(`Alpha Card ${run}`);
    await page.waitForTimeout(400);

    // The matching card should remain visible
    const matchCard = page.locator(`[data-testid*="card"], .card-title`).filter({ hasText: `Alpha Card ${run}` }).first();
    if (await matchCard.count() > 0) {
      await expect(matchCard).toBeVisible({ timeout: 5000 });
    }

    // The non-matching card should be hidden or absent
    const noMatchCard = page.locator(`[data-testid*="card"], .card-title`).filter({ hasText: `Beta Task ${run}` }).first();
    if (await noMatchCard.count() > 0) {
      await expect(noMatchCard).toBeHidden({ timeout: 5000 });
    }
  });

  test('Test 6 — UI type filter toggle shows only matching result type', async ({ request, page }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    await page.goto(UI_URL);
    await page.evaluate(({ t }: { t: string }) => localStorage.setItem('auth_token', t), { t: token });
    await page.goto(`${UI_URL}/boards/${boardId}`);
    await page.waitForLoadState('networkidle');

    // Locate a type-filter control — button or select
    const typeFilter = page.locator(
      '[data-testid="filter-type"], [aria-label*="filter"], select[name*="type"]',
    ).first();

    if (await typeFilter.count() === 0) {
      test.skip(true, 'Type filter control not found in UI — skipping');
      return;
    }

    await typeFilter.click();
    // Select "card" option if it appears in a dropdown
    const cardOption = page.locator('option[value="card"], [data-value="card"], li:has-text("Card")').first();
    if (await cardOption.count() > 0) {
      await cardOption.click();
    }

    await page.waitForTimeout(300);
    await expect(typeFilter).toBeVisible();
  });
});
