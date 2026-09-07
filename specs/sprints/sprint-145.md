# Sprint 145 — Trello Compatibility Layer: Lists

> **Status:** ⬜ Future
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 142 (Trello Compat Foundation), Sprint 143 (Trello Compat Boards)

---

## Goal

Implement the full Trello Lists API surface at `/trello/1/lists/*`, backed by ChimeDeck's `lists` and `cards` tables. Lists map directly to ChimeDeck lists — the main translation work is serializing the `position` field and mapping `archived` to `closed`.

---

## Endpoint Inventory

| Method | Trello path | ChimeDeck operation |
|--------|-------------|---------------------|
| `POST` | `/trello/1/lists` | Create list on a board |
| `GET` | `/trello/1/lists/{id}` | Get list by id |
| `PUT` | `/trello/1/lists/{id}` | Update list (name, closed, pos, idBoard) |
| `GET` | `/trello/1/lists/{id}/{field}` | Get single field of list |
| `PUT` | `/trello/1/lists/{id}/{field}` | Update single field |
| `PUT` | `/trello/1/lists/{id}/closed` | Archive or unarchive list |
| `PUT` | `/trello/1/lists/{id}/idBoard` | Move list to a different board |
| `GET` | `/trello/1/lists/{id}/board` | Get the board this list belongs to |
| `GET` | `/trello/1/lists/{id}/cards` | Get cards in list |
| `POST` | `/trello/1/lists/{id}/archiveAllCards` | Archive all cards in list |
| `POST` | `/trello/1/lists/{id}/moveAllCards` | Move all cards to another list |
| `GET` | `/trello/1/lists/{id}/actions` | Get actions for list (activity) |

---

## List Serializer

**File:** `server/extensions/trelloCompat/serializers/list.ts`

```ts
import type { TrelloList } from '../types/trello';
import { rankToPos } from './position';

export function serializeList(list: {
  id: string;
  board_id: string;
  title: string;
  archived: boolean;
  color?: string | null;
  _rank?: number;
}): TrelloList {
  return {
    id: list.id,
    closed: list.archived,
    color: list.color ?? null,
    idBoard: list.board_id,
    name: list.title,
    nodeId: list.id,
    pos: typeof list._rank === 'number' ? rankToPos(list._rank) : 65535,
    softLimit: null,
    status: null,
    subscribed: false,
  };
}
```

---

## Request Body Mappings

### `POST /trello/1/lists` (create)

| Trello param | ChimeDeck field | Required |
|-------------|-----------------|----------|
| `name` | `title` | yes |
| `idBoard` | `board_id` | yes |
| `pos` | `position` | no — `top` → before first list, `bottom` → after last, numeric → derive fractional index |

### `PUT /trello/1/lists/{id}` (update)

| Trello param | ChimeDeck field | Notes |
|-------------|-----------------|-------|
| `name` | `title` | |
| `closed` | `archived` | |
| `pos` | `position` | |
| `idBoard` | `board_id` | move list to another board |
| `subscribed` | — | accepted but ignored (no subscription concept in ChimeDeck) |

### `PUT /trello/1/lists/{id}/closed`

Body: `{ value: true | false }` — sets `archived` on the list.

### `PUT /trello/1/lists/{id}/idBoard`

Body: `{ value: boardId }` — moves list to target board.

### `POST /trello/1/lists/{id}/archiveAllCards`

No body. Sets `archived = true` on all non-archived cards in the list.

### `POST /trello/1/lists/{id}/moveAllCards`

Body: `{ idBoard: boardId, idList: targetListId }` — bulk-updates `list_id` on all active cards in the source list.

---

## `pos` Conversion

Trello clients can set `pos` to:
- `"top"` — place before all existing items (fractional index: before current first)
- `"bottom"` — place after all existing items (fractional index: after current last)
- A number — insert at the correct relative position

When reading back, `pos` is `rank × 65535` based on the sorted order of items in the board/list.

---

## Acceptance Criteria

1. `POST /trello/1/lists` with `{ name, idBoard }` creates a list and returns a `TrelloList` with correct `idBoard`, `closed: false`, and a non-zero `pos`.
2. `GET /trello/1/lists/{id}` returns a `TrelloList` with all required fields.
3. `PUT /trello/1/lists/{id}` with `{ name: "New Name" }` updates the name and returns the updated `TrelloList`.
4. `PUT /trello/1/lists/{id}/closed` with `{ value: true }` archives the list; response has `closed: true`.
5. `PUT /trello/1/lists/{id}/idBoard` with `{ value: newBoardId }` moves the list; response has updated `idBoard`.
6. `GET /trello/1/lists/{id}/cards` returns a `TrelloCard[]` of non-archived cards in that list.
7. `POST /trello/1/lists/{id}/archiveAllCards` archives all cards; returns `{}` with `200`.
8. `POST /trello/1/lists/{id}/moveAllCards` with `{ idBoard, idList }` moves all cards; returns `{}` with `200`.
9. `GET /trello/1/lists/{id}/board` returns the parent `TrelloBoard`.
10. `GET /trello/1/lists/{id}/{field}` — `GET /trello/1/lists/{id}/name` returns `"My List"`.

---

## Tests

**`tests/integration/trelloCompat/lists.test.ts`**

| Test | Assertion |
|------|-----------|
| `POST /trello/1/lists` | TrelloList shape; correct idBoard |
| `POST /trello/1/lists` — pos="top" | List inserted before existing first list |
| `POST /trello/1/lists` — pos="bottom" | List inserted after all existing |
| `GET /trello/1/lists/{id}` | TrelloList shape; all fields |
| `PUT /trello/1/lists/{id}` — name change | name updated in response |
| `PUT /trello/1/lists/{id}/closed` — true | closed=true |
| `PUT /trello/1/lists/{id}/closed` — false | closed=false (unarchive) |
| `PUT /trello/1/lists/{id}/idBoard` | idBoard updated |
| `GET /trello/1/lists/{id}/cards` | TrelloCard[] for non-archived cards |
| `POST /trello/1/lists/{id}/archiveAllCards` | 200 `{}`; cards archived |
| `POST /trello/1/lists/{id}/moveAllCards` | 200 `{}`; cards moved to target list |
| `GET /trello/1/lists/{id}/board` | TrelloBoard returned |
| `GET /trello/1/lists/{id}/name` | String `"My List"` returned |
| List not found | 404 `{ message, error }` |
