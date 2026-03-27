> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Sprint 93 — TableView i18n: Playwright MCP Test Plan

**Goal:** Verify all TableView UI copy renders from `translations/en.json` and no hardcoded English strings remain.

---

## Prerequisites

- Dev server running at `http://localhost:3000`
- At least one board with lists exists
- At least one card exists on the board for row-level assertions
- A board with **no cards** exists (or can be simulated) for empty-state verification

---

## Steps

### 1. Navigate to the app and open a board in Table view

1. Go to `http://localhost:3000`
2. Log in if required
3. Open any board that has at least one card
4. Click the "Table" view switcher button in the board toolbar

### 2. Verify column headers

Assert the following `<th>` elements are visible with text matching their translation keys:

| `data-testid` | Expected text | Translation key |
|---|---|---|
| `table-header-title` | "Title" | `translations['TableView.columnTitle']` |
| `table-header-list` | "List" | `translations['TableView.columnList']` |
| `table-header-assignees` | "Members" | `translations['TableView.columnMembers']` |
| `table-header-labels` | "Labels" | `translations['TableView.columnLabels']` |
| `table-header-due_date` | "Due Date" | `translations['TableView.columnDueDate']` |
| `table-header-start_date` | "Start Date" | `translations['TableView.columnStartDate']` |
| `table-header-value` | "Value" | `translations['TableView.columnMoney']` |

### 3. Verify the table renders data rows

1. Confirm `data-testid="table-view"` is visible (not `table-view-empty`)
2. Confirm at least one `data-testid` matching `table-row-{cardId}` is present

### 4. Verify card title aria-label

For the first visible card row:

1. Find the title button (`data-testid="table-card-title-{cardId}"`)
2. Assert its `aria-label` starts with `translations['TableView.ariaOpenCard']` ("Open card:")
3. Assert the rest of the `aria-label` equals the card's title

### 5. Verify sort interactions

1. Click the "Title" column header (`data-testid="table-header-title"`)
2. Assert the column `aria-sort` becomes `"ascending"`
3. Click "Title" again
4. Assert the column `aria-sort` becomes `"descending"`
5. Click "Title" a third time
6. Assert the column `aria-sort` returns to `"none"`

### 6. Verify the empty state

1. Navigate to a board with no cards (create one if needed, then archive all cards)
2. Switch to Table view
3. Assert `data-testid="table-view-empty"` is visible
4. Assert its text content equals `translations['TableView.noCards']` ("No cards in this board")

---

## Acceptance Criteria

- [ ] All seven column headers render text from translations (no hardcoded English labels)
- [ ] Card title button `aria-label` uses `translations['TableView.ariaOpenCard']` prefix
- [ ] Sort aria-sort attributes cycle correctly (`none` → `ascending` → `descending` → `none`)
- [ ] Empty-state message renders from `translations['TableView.noCards']`
- [ ] No hardcoded English UI strings remain in `src/extensions/TableView/**/*.tsx`
- [ ] All TableView interactions (click to open card, sort columns) function identically after the refactor