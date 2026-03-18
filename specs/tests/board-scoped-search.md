# Board-Scoped Search

> Playwright MCP test scenarios for Sprint 84 — board-scoped search API and UI flows.

---

## API Scenarios

### API-01 — Auth required

**Preconditions:** Board exists with `PRIVATE` visibility.  
**Steps:**
1. Send `GET /api/v1/boards/:boardId/search?q=task` with no `Authorization` header.

**Expected:**
- Response status: `401`
- Body: `{ error: { code: 'missing-or-invalid-token', ... } }`

---

### API-02 — Board not found

**Preconditions:** Authenticated workspace member.  
**Steps:**
1. Send `GET /api/v1/boards/nonexistent-id/search?q=task`.

**Expected:**
- Response status: `404`
- Body: `{ error: { code: 'board-not-found', ... } }`

---

### API-03 — Board access denied (PRIVATE, non-member)

**Preconditions:**
- Board exists with `PRIVATE` visibility.
- Authenticated user is a workspace MEMBER but not in `board_members`.

**Steps:**
1. Send `GET /api/v1/boards/:boardId/search?q=task`.

**Expected:**
- Response status: `403`
- Body: `{ error: { code: 'board-access-denied', ... } }`

---

### API-04 — Query too short (less than 2 characters)

**Preconditions:** Authenticated user has board access.  
**Steps:**
1. Send `GET /api/v1/boards/:boardId/search?q=a`.

**Expected:**
- Response status: `400`
- Body: `{ error: { code: 'search-query-too-short', ... } }`

---

### API-05 — Query with only special characters (no valid terms)

**Preconditions:** Authenticated user has board access.  
**Steps:**
1. Send `GET /api/v1/boards/:boardId/search?q=!!`.

**Expected:**
- Response status: `400`
- Body: `{ error: { code: 'search-query-invalid', ... } }`

---

### API-06 — Results strictly board-scoped

**Preconditions:**
- Board A has card titled "Deploy feature".
- Board B (same workspace) has card titled "Deploy hotfix".
- Authenticated user has access to both boards.

**Steps:**
1. Send `GET /api/v1/boards/<boardA-id>/search?q=deploy`.

**Expected:**
- Response status: `200`
- `data` contains the card from Board A.
- `data` does NOT contain any card from Board B.

---

### API-07 — Returns cards and lists from the board

**Preconditions:**
- Board has a list titled "Release Tasks" and a card titled "Release notes draft".
- Authenticated user has board access.

**Steps:**
1. Send `GET /api/v1/boards/:boardId/search?q=release`.

**Expected:**
- Response status: `200`
- `data` contains at least one item with `type: 'list'` and `title` containing "Release".
- `data` contains at least one item with `type: 'card'` and `title` containing "Release".

---

### API-08 — Result shape

**Preconditions:** At least one matching card in the board.  
**Steps:**
1. Send `GET /api/v1/boards/:boardId/search?q=test`.

**Expected:**
- Each item in `data` has: `type` (`'card'` or `'list'`), `id` (string), `title` (string).
- Card items additionally have `listId` (string).
- List items do not have a `listId` field (or it is `undefined`).
- No `rank` field is exposed in the response.

---

### API-09 — Default limit is 20, max is 50

**Preconditions:** Board has 60 cards all matching "item".  
**Steps:**
1. Send `GET /api/v1/boards/:boardId/search?q=item` (no `limit` param).
2. Send `GET /api/v1/boards/:boardId/search?q=item&limit=100`.

**Expected (step 1):**
- `data.length` is at most 20.

**Expected (step 2):**
- `data.length` is at most 50 (server enforces cap regardless of client request).

---

### API-10 — Archived cards excluded by default

**Preconditions:**
- Board has a card titled "Archive me" that is archived.
- Board has a card titled "Archive ready" that is not archived.

**Steps:**
1. Send `GET /api/v1/boards/:boardId/search?q=archive`.

**Expected:**
- `data` contains the non-archived card.
- `data` does NOT contain the archived card.

---

### API-11 — Stable ordering by relevance

**Preconditions:**
- Board has card "Sprint planning" (title matches once) and card "Sprint sprint sprint" (title contains the term three times).

**Steps:**
1. Send `GET /api/v1/boards/:boardId/search?q=sprint`.

**Expected:**
- Card "Sprint sprint sprint" appears before "Sprint planning" in `data`.

---

### API-12 — Empty query string returns no-results (client guard)

> This scenario is enforced client-side; the server returns 400 for `q` shorter than 2 chars.

**Preconditions:** Authenticated user has board access.  
**Steps:**
1. Send `GET /api/v1/boards/:boardId/search?q=` (empty string).

**Expected:**
- Response status: `400`
- Body: `{ error: { code: 'search-query-too-short', ... } }`

---

### API-13 — PUBLIC board accessible without auth token

**Preconditions:** Board exists with `PUBLIC` visibility.  
**Steps:**
1. Send `GET /api/v1/boards/:boardId/search?q=hello` with no `Authorization` header.

**Expected:**
- Response status: `200`
- Body shape: `{ data: [...] }`

---

## UI Scenarios

### UI-01 — Search bar renders in board header

**Preconditions:** Authenticated user navigates to a board page.  
**Steps:**
1. Open any board page (e.g., `/boards/:boardId`).

**Expected:**
- A search input with `aria-label="Search cards and lists on this board"` is visible in the board header.
- The input shows placeholder text "Search board…".
- No results panel is visible.

---

### UI-02 — Min-char guard: no request for fewer than 2 characters

**Preconditions:** User is on a board page with the search bar visible.  
**Steps:**
1. Type `"a"` (1 character) into the search bar.

**Expected:**
- No network request is fired to `/api/v1/boards/:boardId/search`.
- No results panel appears (or panel shows "Type at least 2 characters to search.").

---

### UI-03 — Debounce: request fires 300 ms after last keystroke

**Preconditions:** User is on a board page.  
**Steps:**
1. Type `"sp"` quickly into the search bar.
2. Observe network tab — no request fires immediately.
3. Wait 300 ms.

**Expected:**
- Exactly one network request fires to `/api/v1/boards/:boardId/search?q=sp` after the 300 ms debounce window.
- No earlier requests are fired while typing.

---

### UI-04 — Results panel shows matching items

**Preconditions:**
- Board has a card titled "Sprint planning" and a list titled "Sprint backlog".

**Steps:**
1. Type `"sprint"` into the search bar.
2. Wait for results.

**Expected:**
- Results panel is visible (`id="board-search-panel"`).
- At least one result with text "Sprint planning" appears with type label "Card".
- At least one result with text "Sprint backlog" appears with type label "List".
- All results are from the current board only.

---

### UI-05 — Empty results state

**Preconditions:** Board has no cards or lists matching "xyznotfound".  
**Steps:**
1. Type `"xyznotfound"` into the search bar.
2. Wait for results.

**Expected:**
- Results panel is visible.
- Element `[data-testid="board-search-no-results"]` is visible with text containing `"xyznotfound"`.
- No result items are shown.

---

### UI-06 — Escape key clears the input and closes the panel

**Preconditions:** User has typed `"sprint"` and the results panel is open.  
**Steps:**
1. Press `Escape`.

**Expected:**
- The input value becomes empty.
- The results panel closes (no longer visible).
- Focus returns to the search input.

---

### UI-07 — Clear button clears the input and closes the panel

**Preconditions:** User has typed `"sprint"` and the results panel is open.  
**Steps:**
1. Click the clear (×) button inside the search input.

**Expected:**
- The input value becomes empty.
- The results panel closes.

---

### UI-08 — Click outside closes the panel without clearing the input

**Preconditions:** User has typed `"sprint"` and the results panel is open.  
**Steps:**
1. Click anywhere outside the search bar container.

**Expected:**
- The results panel closes.
- The input still shows `"sprint"`.

---

### UI-09 — Selecting a result triggers onSelectResult callback

**Preconditions:** Board has a card titled "Deploy feature". User has searched "deploy" and sees results.  
**Steps:**
1. Click the "Deploy feature" card result.

**Expected:**
- The results panel closes.
- The application invokes the `onSelectResult` callback with the clicked `BoardSearchResult` object.
- (In the UI: the card modal opens for that card — verified in Iteration 3.)

---

### UI-10 — Search is board-scoped (no results from other boards)

**Preconditions:**
- Board A has card "Deploy feature".
- Board B (same workspace) has card "Deploy hotfix".
- User is on Board A's page.

**Steps:**
1. Search for `"deploy"` on Board A.

**Expected:**
- Results panel shows "Deploy feature".
- Results panel does NOT show "Deploy hotfix" (from Board B).

---

### UI-11 — Clicking a card result opens the card modal

**Preconditions:** Board has a card titled "Deploy feature". User has searched "deploy" and sees results.  
**Steps:**
1. Click the "Deploy feature" card result.

**Expected:**
- The results panel closes.
- The URL gains a `?card=<cardId>` query parameter.
- The card detail modal opens showing "Deploy feature".
- The modal contains the card's full details.

---

### UI-12 — Clicking a list result scrolls the list into view

**Preconditions:** Board has a list titled "Sprint backlog" that is off-screen (board has many lists). User has searched "sprint" and sees results.  
**Steps:**
1. Click the "Sprint backlog" list result.

**Expected:**
- The results panel closes.
- The board canvas scrolls horizontally so the "Sprint backlog" list column is visible.
- The list column element (`id="board-list-<listId>"`) is visible in the viewport.

---

### UI-13 — Search query persists in URL and restores on refresh

**Preconditions:** User is on a board page and has typed "sprint" into the search bar (results panel is open).  
**Steps:**
1. Observe the browser URL — it should contain `?boardSearch=sprint`.
2. Reload the page (F5 / Cmd+R).
3. Observe the search bar after reload.

**Expected:**
- After step 1: URL contains `boardSearch=sprint`.
- After step 2: page reloads and the search bar is pre-filled with "sprint".
- Search results panel re-opens and shows results for "sprint".
- The URL still contains `boardSearch=sprint`.

---

### UI-14 — Search state resets when switching to a different board

**Preconditions:**
- User is on Board A with "sprint" typed in the search bar.
- Results panel is open.

**Steps:**
1. Navigate to Board B (e.g., click a board link in the sidebar).

**Expected:**
- The search input is cleared (empty string).
- The results panel is closed.
- The URL for Board B does NOT contain `boardSearch=sprint` (the param was cleared).

---

### UI-15 — Matched text is highlighted in result titles

**Preconditions:** Board has a card titled "Sprint planning" and a list titled "Sprint backlog".  
**Steps:**
1. Search for "sprint" in the board search bar.
2. Observe the result titles.

**Expected:**
- In each result title, the matching substring "Sprint" is visually highlighted (e.g., wrapped in a `<mark>` element with a yellow background).
- The non-matching text remains unstyled.

---



| # | Criterion | Status |
|---|-----------|--------|
| AC-1 | Each board page renders a board-local search bar in the header | ✅ Done |
| AC-2 | Searching from board page returns only cards/lists from that board | ✅ Done (server-enforced + UI-10) |
| AC-3 | No result from other boards appears in board-local search | ✅ Done (server-enforced + UI-10) |
| AC-4 | Clicking a card result opens that card in the current board modal | ✅ Done (UI-11) |
| AC-5 | Query state restores on refresh and resets when board changes | ✅ Done (UI-13, UI-14) |
| AC-6 | Searching with fewer than 2 characters does not call the server | ✅ Done (UI-02, min-char guard) |
| AC-7 | Default result limit is 20; maximum is 50 | ✅ Done (server-enforced, API-09) |
| AC-8 | Results ordered by relevance (stable) | ✅ Done (server-enforced, API-11) |
