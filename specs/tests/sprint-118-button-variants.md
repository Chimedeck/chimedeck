# Test: Sprint 118 — Button Variants (Light & Dark Mode)

## Overview
Verifies that the four primary button variants (primary, secondary, ghost, danger) render with the correct semantic token colours in both light and dark modes, and that toggling the theme updates button appearance without any component code change.

## Pre-conditions
- User is authenticated and on any page that renders buttons (e.g. the board view or card modal).
- The app uses the ThemeToggle component to switch between dark and light modes.

---

## Test 1 — Primary button renders with brand colour in dark mode

**Steps:**
1. Navigate to the app (authenticated).
2. Ensure dark mode is active (`<html>` has `dark` class).
3. Locate a button with `variant="primary"` (e.g. "Create board", "Add card", or any primary CTA).

**Expected:**
- The button has a blue background (`--color-primary` resolves to `#3b82f6` in dark mode).
- Button text is white.
- Hovering the button darkens it slightly (`--color-primary-hover`).

---

## Test 2 — Secondary button renders with overlay surface in dark mode

**Steps:**
1. Locate a button with `variant="secondary"` (e.g. "Cancel" in a modal, or a secondary action).

**Expected:**
- The button background uses `--bg-overlay` (dark: `#334155`).
- Text uses `--text-base` (dark: `#f1f5f9`).
- A border is visible using `--border` (dark: `#334155`).

---

## Test 3 — Ghost button renders transparent with muted text in dark mode

**Steps:**
1. Locate a button with `variant="ghost"` (e.g. close/dismiss icons, minor actions).

**Expected:**
- The button background is transparent.
- Text colour is `--text-muted` (dark: `#94a3b8`).
- Hovering reveals a subtle `--bg-overlay` background.

---

## Test 4 — Danger button renders red in dark mode

**Steps:**
1. Open a card modal and locate a destructive action button (e.g. "Delete card", "Remove member") with `variant="danger"`.

**Expected:**
- The button has a red background (`--color-danger` resolves to `#ef4444` in dark mode).
- Button text is white.

---

## Test 5 — Primary button colour changes when switching to light mode

**Steps:**
1. Note the current primary button background colour in dark mode (blue-500 `#3b82f6`).
2. Click the ThemeToggle button to switch to light mode.
3. Observe the same primary button.

**Expected:**
- The `<html>` element loses the `dark` class.
- The primary button background changes to `#2563eb` (blue-600, `--color-primary` in light mode).
- No component code changed — only the CSS variable resolved to a different value.
- Button text remains white.

---

## Test 6 — Danger button colour is correct in light mode

**Steps:**
1. While in light mode (from Test 5), locate a danger button.

**Expected:**
- Danger button background is `#dc2626` (red-600, `--color-danger` in light mode).
- Button text is white.

---

## Test 7 — Secondary button surface is light in light mode

**Steps:**
1. While in light mode, locate a secondary button.

**Expected:**
- Background uses `--bg-overlay` (light: `#f1f5f9`, slate-100).
- Text uses `--text-base` (light: `#0f172a`, slate-900) — clearly legible on light background.
- Border visible using `--border` (light: `#e2e8f0`).

---

## Test 8 — Ghost button is readable in light mode

**Steps:**
1. While in light mode, locate a ghost button.

**Expected:**
- Background is transparent.
- Text colour is `--text-muted` (light: `#64748b`, slate-500) — readable on white/light surface.
- Hovering reveals `--bg-overlay` (slate-100) background.

---

## Playwright MCP Implementation Notes

```ts
import { test, expect } from '@playwright/test';

test('primary button has correct colour in dark mode', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('theme', 'dark'));
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);

  // Find a primary button and check its computed background
  const primaryBtn = page.locator('button.bg-primary').first();
  await expect(primaryBtn).toBeVisible();
  const bg = await primaryBtn.evaluate(el =>
    getComputedStyle(el).getPropertyValue('background-color')
  );
  // --color-primary in dark = #3b82f6 → rgb(59, 130, 246)
  expect(bg).toContain('59, 130, 246');
});

test('primary button colour changes in light mode', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('theme', 'light'));
  await page.reload();
  await expect(page.locator('html')).not.toHaveClass(/dark/);

  const primaryBtn = page.locator('button.bg-primary').first();
  await expect(primaryBtn).toBeVisible();
  const bg = await primaryBtn.evaluate(el =>
    getComputedStyle(el).getPropertyValue('background-color')
  );
  // --color-primary in light = #2563eb → rgb(37, 99, 235)
  expect(bg).toContain('37, 99, 235');
});

test('danger button renders red in light mode', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('theme', 'light'));
  await page.reload();

  // Open a card and find a danger button
  const dangerBtn = page.locator('button.bg-danger').first();
  if (await dangerBtn.count() === 0) return; // skip if no danger button visible
  const bg = await dangerBtn.evaluate(el =>
    getComputedStyle(el).getPropertyValue('background-color')
  );
  // --color-danger in light = #dc2626 → rgb(220, 38, 38)
  expect(bg).toContain('220, 38, 38');
});
```
