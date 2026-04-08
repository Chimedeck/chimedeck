import { test, expect } from '@playwright/test';

// Scenario 1 — Typing while offline saves to IndexedDB

test.describe('Offline Comment Draft Recovery', () => {
  test('Typing while offline saves to IndexedDB', async ({ page, context }) => {
    // 1. Authenticate as User A (assume helper exists or use direct navigation)
    await page.goto('/login');
    await page.fill('input[name=email]', 'usera@example.com');
    await page.fill('input[name=password]', 'password');
    await page.click('button[type=submit]');
    await page.waitForURL('**/board/**');

    // 2. Open card modal for card C1 (assume card with id 'C1' exists)
    await page.click('[data-testid="card-C1"]');
    await page.waitForSelector('[data-testid="card-modal"]');

    // 3. Go offline
    await context.setOffline(true);

    // 4. Type in the comment editor
    await page.fill('[data-testid="comment-editor-input"]', 'My offline comment text');

    // 5. Wait for debounce interval (800ms)
    await page.waitForTimeout(900);

    // 6. Check IndexedDB for draft
    const draft = await page.evaluate(async () => {
      const dbReq = indexedDB.open('kanban-offline-drafts');
      return new Promise((resolve, reject) => {
        dbReq.onerror = () => reject('DB open error');
        dbReq.onsuccess = () => {
          const db = dbReq.result;
          const tx = db.transaction('drafts', 'readonly');
          const store = tx.objectStore('drafts');
          const allReq = store.getAll();
          allReq.onsuccess = () => resolve(allReq.result);
          allReq.onerror = () => reject('GetAll error');
        };
      });
    });
    expect(Array.isArray(draft)).toBeTruthy();
    const found = draft.find((d: any) => d.draftType === 'comment' && d.contentMarkdown === 'My offline comment text');
    expect(found).toBeTruthy();
    expect(found.intent).toBe('editing');
    expect(found.key).toMatch(/.+::.+::C1::comment/);

    // 7. Check footer UI
    await expect(page.locator('[data-testid="comment-draft-footer"]')).toHaveText(/Will sync when online/);
  });
});
