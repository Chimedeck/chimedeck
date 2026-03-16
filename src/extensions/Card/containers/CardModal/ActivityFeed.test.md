# ActivityFeed — Playwright MCP Tests

## Test: Newest activity item appears first

1. Navigate to a board that has at least one card with two or more comments or activity events at different timestamps.
2. Click the card to open the CardModal.
3. Locate the Activity section.
4. Verify that the **first** item in the feed list (topmost rendered item below the comment input) has a timestamp that is **newer than or equal to** the second item's timestamp.
   - If two comments exist, the one added most recently should appear at the top of the list.

## Test: Comment input is above the feed list

1. Navigate to a board and open any card (with or without existing activity).
2. In the CardModal, locate the Activity section.
3. Verify the comment input / editor (`textarea` or `[placeholder="Add a comment…"]`) is rendered **before** (above) the list of feed items in the DOM.
   - Use `page.locator('[placeholder="Add a comment…"]')` and `page.locator('[data-testid="activity-feed-list"]')` (or the first feed item).
   - Assert that the bounding box `y` of the comment input is **less than** the `y` of the first feed item.

## Test: Empty feed shows input at top with no-activity placeholder

1. Open a card that has no comments and no activity events.
2. Verify the comment input is present and visible.
3. Verify the "No activity yet." placeholder text appears below the input.

## Playwright code sketch

```ts
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
```
