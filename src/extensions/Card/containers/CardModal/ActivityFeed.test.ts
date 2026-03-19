import { test, expect } from '@playwright/test';

test('activity feed: newest item is first', async ({ page }) => {
  await page.goto('/');
  // Open a board and card with multiple comments
  // (adapt selectors to match actual app routing)
  await page.getByRole('button', { name: /open card/i }).first().click();

  const feedItems = page.locator('.activity-feed-item');
  const count = await feedItems.count();
  if (count >= 2) {
    const firstTs = await feedItems.nth(0).getAttribute('data-ts');
    const secondTs = await feedItems.nth(1).getAttribute('data-ts');
    expect(new Date(firstTs!).getTime()).toBeGreaterThanOrEqual(new Date(secondTs!).getTime());
  }
});

test('activity feed: comment input is above feed list', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /open card/i }).first().click();

  const input = page.locator('textarea[placeholder="Add a comment…"]');
  const firstItem = page.locator('.activity-feed-item').first();

  const inputBox = await input.boundingBox();
  const itemBox = await firstItem.boundingBox();

  if (inputBox && itemBox) {
    expect(inputBox.y).toBeLessThan(itemBox.y);
  }
});

test('activity feed: empty feed shows placeholder below input', async ({ page }) => {
  await page.goto('/');
  // Open a card with no activity
  await page.getByRole('button', { name: /open card/i }).first().click();

  const input = page.locator('textarea[placeholder="Add a comment…"]');
  await expect(input).toBeVisible();

  const placeholder = page.getByText('No activity yet.');
  await expect(placeholder).toBeVisible();

  const inputBox = await input.boundingBox();
  const placeholderBox = await placeholder.boundingBox();
  if (inputBox && placeholderBox) {
    expect(inputBox.y).toBeLessThan(placeholderBox.y);
  }
});
