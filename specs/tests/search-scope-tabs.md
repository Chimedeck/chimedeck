# Search Scope Tabs — Playwright Test Spec

## Overview
Tests for Sprint 77 CommandPalette scope tabs (All / Boards / Cards), API type filtering, sessionStorage persistence, scoped placeholder text, scoped empty states, and keyboard navigation.

## Prerequisites
- A workspace with at least one board and one card exists.
- The current user is logged in.
- The search API `GET /api/v1/workspaces/:id/search?q=&type=board|card` is running.

---

## Test 1 — Three scope tabs are visible when the palette opens

```
Given the user is on any authenticated page
When the user presses Cmd+K (or Ctrl+K on Windows/Linux)
Then the command palette dialog opens
And three scope tab buttons are visible: "All", "Boards", and "Cards"
And the "All" tab is selected by default (aria-selected="true")
```

**Steps:**
1. Navigate to any authenticated page (e.g. workspace dashboard).
2. Press `Meta+K` (or `Control+K`).
3. Assert a `role="dialog"` element with `aria-label="Search"` is visible.
4. Assert three buttons with `role="tab"` are present.
5. Assert tab labels are "All", "Boards", and "Cards" (in that order).
6. Assert the "All" tab has `aria-selected="true"`.
7. Assert the "Boards" and "Cards" tabs have `aria-selected="false"`.

---

## Test 2 — Boards scope shows only board results

```
Given the command palette is open
When the user clicks the "Boards" tab
And types a query that matches both a board and a card
Then only board results are displayed
And the "Cards" section is not visible
```

**Steps:**
1. Open the command palette.
2. Click the "Boards" tab button.
3. Assert `aria-selected="true"` on the "Boards" tab.
4. Type a query of at least 2 characters that is known to match at least one board (e.g. the board title).
5. Wait for results to load.
6. Assert at least one result row with the badge text "Board" is visible.
7. Assert no result row with the badge text "Card" is visible.
8. Assert no "Cards" section heading is present.

---

## Test 3 — Cards scope shows only card results

```
Given the command palette is open
When the user clicks the "Cards" tab
And types a query that matches both a board and a card
Then only card results are displayed
And the "Boards" section is not visible
```

**Steps:**
1. Open the command palette.
2. Click the "Cards" tab button.
3. Assert `aria-selected="true"` on the "Cards" tab.
4. Type a query of at least 2 characters that matches at least one card.
5. Wait for results to load.
6. Assert at least one result row with the badge text "Card" is visible.
7. Assert no result row with the badge text "Board" is visible.
8. Assert no "Boards" section heading is present.

---

## Test 4 — Scope persists across palette close and reopen (sessionStorage)

```
Given the command palette is open
And the user selects the "Boards" tab
When the user closes the palette (presses Escape)
And reopens the palette (presses Cmd+K again)
Then the "Boards" tab is still selected (not reset to "All")
```

**Steps:**
1. Open the command palette.
2. Click the "Boards" tab.
3. Assert `aria-selected="true"` on the "Boards" tab.
4. Press `Escape` to close the palette.
5. Assert the dialog is no longer visible.
6. Press `Meta+K` to reopen the palette.
7. Assert the "Boards" tab has `aria-selected="true"` without any additional action.
8. (Optional) Open DevTools → Application → Session Storage → assert `command-palette-scope` = `"board"`.

---

## Test 5 — Placeholder text changes per scope

```
Given the command palette is open
When the user switches between scope tabs
Then the search input placeholder text updates to match the active scope
```

**Steps:**
1. Open the command palette.
2. Assert the search input has `placeholder="Search boards and cards…"` (All scope).
3. Click the "Boards" tab.
4. Assert the search input has `placeholder="Search boards…"`.
5. Click the "Cards" tab.
6. Assert the search input has `placeholder="Search cards…"`.
7. Click the "All" tab.
8. Assert the search input returns to `placeholder="Search boards and cards…"`.

---

## Test 6 — Scoped empty state message when no results found

```
Given the command palette is open and a scope tab is selected
When the user types a query that returns no results
Then the empty state message reflects the active scope
```

**Steps:**
1. Open the command palette.
2. Ensure the "All" scope is active.
3. Type a query unlikely to match anything (e.g. "xyzzy-no-match-12345").
4. Wait for loading to finish.
5. Assert the empty state text is "No results found."
6. Click the "Boards" tab.
7. Wait for loading to finish.
8. Assert the empty state text is "No boards found."
9. Click the "Cards" tab.
10. Wait for loading to finish.
11. Assert the empty state text is "No cards found."

---

## Test 7 — Keyboard navigation: arrow keys navigate scope tabs

```
Given the command palette is open
When the user focuses a scope tab button and presses ArrowRight
Then focus moves to the next tab
When ArrowLeft is pressed
Then focus moves to the previous tab
And wrap-around works at the boundaries
```

**Steps:**
1. Open the command palette.
2. Click the "All" tab (to ensure focus is on a tab button).
3. Press `ArrowRight` — assert "Boards" tab receives focus.
4. Press `ArrowRight` — assert "Cards" tab receives focus.
5. Press `ArrowRight` — assert "All" tab receives focus (wrap-around).
6. Press `ArrowLeft` — assert "Cards" tab receives focus (wrap-around in reverse).

---

## Test 8 — Keyboard navigation: arrow keys navigate result items

```
Given the command palette is open
And search results are displayed
When the user presses ArrowDown in the search input
Then the first result item receives focus
When the user presses ArrowDown again
Then the second result item receives focus
When the user presses ArrowUp from the first result
Then focus returns to the search input
```

**Steps:**
1. Open the command palette.
2. Type a query that returns at least 2 results.
3. Wait for results to render.
4. Assert focus is in the search input.
5. Press `ArrowDown` — assert the first result button is focused.
6. Press `ArrowDown` — assert the second result button is focused.
7. Press `ArrowUp` (from the second result) — assert the first result button is focused.
8. Press `ArrowUp` (from the first result) — assert the search input is focused again.

---

## Acceptance Criteria Summary

| # | Criterion |
|---|-----------|
| 1 | Three scope tabs (All, Boards, Cards) are visible when the palette opens |
| 2 | "Boards" scope shows only board results; no card results or section heading |
| 3 | "Cards" scope shows only card results; no board results or section heading |
| 4 | Selected scope is persisted in `sessionStorage` under key `command-palette-scope`; survives close/reopen |
| 5 | Placeholder text updates to match the active scope |
| 6 | Empty state message is scope-aware ("No results found." / "No boards found." / "No cards found.") |
| 7 | ArrowRight/ArrowLeft navigate between scope tab buttons with wrap-around |
| 8 | ArrowDown from input focuses first result; ArrowUp from first result returns to input |
