# Test: Theme Toggle — Persist and Icon Display

## Overview
Verifies that the ThemeToggle button switches themes correctly, persists the selection across page refreshes, and displays the correct icon for each mode.

## Setup
- Navigate to the application (authenticated user on any page with the Header visible).

---

## Test 1 — Toggle to light mode and verify background changes

**Steps:**
1. Ensure the page starts in dark mode (default).
2. Locate the ThemeToggle button in the Header (shows SunIcon in dark mode).
3. Click the ThemeToggle button.

**Expected:**
- The `<html>` element loses the `dark` class.
- The page background changes from dark (slate-900/slate-50 dark) to a light colour (slate-50/white).
- The ThemeToggle button now shows a MoonIcon.
- `localStorage.getItem('theme')` returns `'light'`.

---

## Test 2 — Persist light mode across page refresh

**Steps:**
1. While in light mode (from Test 1), refresh the page (F5 / Cmd+R).

**Expected:**
- The page loads immediately in light mode — no dark flash before React hydration.
- The `<html>` element does NOT have the `dark` class.
- The page background is light (slate-50/white).
- The ThemeToggle button shows a MoonIcon.

---

## Test 3 — Toggle back to dark mode

**Steps:**
1. While in light mode, click the ThemeToggle button.

**Expected:**
- The `<html>` element gains the `dark` class.
- The page background returns to dark (slate-900).
- The ThemeToggle button shows a SunIcon.
- `localStorage.getItem('theme')` returns `'dark'`.

---

## Test 4 — Default to dark when no preference stored

**Steps:**
1. Clear localStorage (`localStorage.removeItem('theme')`).
2. Refresh the page.

**Expected:**
- The `<html>` element has the `dark` class on first paint (before React hydration).
- Dark mode is active.
- ThemeToggle shows SunIcon.

---

## Playwright MCP Implementation Notes

```ts
import { test, expect } from '@playwright/test';

test('toggle to light mode', async ({ page }) => {
  await page.goto('/');
  // Should start in dark mode
  await expect(page.locator('html')).toHaveClass(/dark/);
  
  const toggle = page.getByRole('button', { name: /switch to light mode/i });
  await toggle.click();
  
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  const theme = await page.evaluate(() => localStorage.getItem('theme'));
  expect(theme).toBe('light');
});

test('light mode persists after refresh', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('theme', 'light'));
  await page.reload();
  
  // No dark flash — html should not have dark class immediately
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('toggle back to dark mode', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('theme', 'light'));
  await page.reload();
  
  const toggle = page.getByRole('button', { name: /switch to dark mode/i });
  await toggle.click();
  
  await expect(page.locator('html')).toHaveClass(/dark/);
  const theme = await page.evaluate(() => localStorage.getItem('theme'));
  expect(theme).toBe('dark');
});
```
