# Sprint 84 - Board-Scoped Search Bar

> **Status:** Future sprint - not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 13 (Search & Presence), Sprint 18 (Board View Kanban), Sprint 77 (Granular Search)
> **References:** [requirements.md](../architecture/requirements.md)

---

## Goal

Add a search bar inside each board so users can search only within the currently opened board context.

This sprint delivers:
- In-board search input in board header
- Board-scoped card/list search API query path
- Fast keyboard-driven result navigation inside current board only

---

## Scope

### 1. Board Header Search Input

Add a dedicated board-level search field in the board header area.

Behavior:
- Placeholder text: `Search in this board...`
- Debounced search (250-300 ms)
- `Escape` clears query and closes results popover
- Empty query shows no results panel

### 2. Board-Scoped Search Endpoint

Expose a board-scoped search query route:

```http
GET /api/v1/boards/:boardId/search?query=<text>&limit=<n>
```

Response shape:

```ts
interface Response {
  data: Array<{
    type: 'card' | 'list';
    id: string;
    title: string;
    listId?: string;
    cardId?: string;
  }>;
}
```

Rules:
- Query is always constrained to the current `boardId`
- User must have access to the board
- No cross-board fallback in this endpoint

### 3. In-Board Result UX

- Results include cards and lists from the current board only
- Clicking a card result opens that card in modal (`?card=<id>`) on the same board page
- Clicking a list result scrolls/focuses that list on board view
- Matched text in result label is highlighted

### 4. Client State and Routing

- Keep query in URL as optional `boardSearch` query param for shareable state
- Restore query from URL on page refresh
- Search state must reset when user switches to a different board

### 5. Performance and Guardrails

- Do not run server query for input length < 2
- Cap result count (default 20, max 50)
- Return stable ordering by relevance and updated timestamp

---

## File Checklist

| File | Change |
|------|--------|
| `server/extensions/search/api/index.ts` | Register board-scoped search route |
| `server/extensions/search/api/getBoardSearch.ts` | New board-only search handler |
| `server/extensions/search/mods/queryBoardSearch.ts` | Query builder constrained by `board_id` |
| `src/extensions/Board/components/BoardSearchBar.tsx` | New board header search UI |
| `src/extensions/Board/containers/BoardPageHeader.tsx` | Mount board search bar |
| `src/extensions/Search/api.ts` | Add `getBoardSearch` API client method |
| `specs/tests/board-scoped-search.md` | Manual/integration test scenarios |

---

## Acceptance Criteria

- [ ] Each board page renders a board-local search bar in the header
- [ ] Searching from board page returns only cards/lists from that board
- [ ] No result from other boards appears in board-local search
- [ ] Clicking a card result opens that card in the current board modal
- [ ] Query state restores on refresh and resets when board changes
- [ ] Searching with fewer than 2 characters does not call server

---

## Tests

```text
specs/tests/board-scoped-search.md
```
