# Sprint 146 — Trello Compatibility Layer: Checklists & Labels

> **Status:** ⬜ Future
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 142 (Trello Compat Foundation), Sprint 144 (Trello Compat Cards)

---

## Goal

Implement the Trello Checklists and Labels API surfaces. Checklists at `/trello/1/checklists/*` map to ChimeDeck's `checklists` and `checklist_items` tables. Labels at `/trello/1/labels/*` map to ChimeDeck's `labels` and `card_labels` tables.

---

## Checklists

### Endpoint Inventory

| Method | Trello path | ChimeDeck operation |
|--------|-------------|---------------------|
| `POST` | `/trello/1/checklists` | Create checklist on a card |
| `GET` | `/trello/1/checklists/{id}` | Get checklist with its check items |
| `PUT` | `/trello/1/checklists/{id}` | Update checklist (name, pos) |
| `DELETE` | `/trello/1/checklists/{id}` | Delete checklist |
| `GET` | `/trello/1/checklists/{id}/{field}` | Get a single field |
| `PUT` | `/trello/1/checklists/{id}/{field}` | Update a single field |
| `GET` | `/trello/1/checklists/{id}/board` | Get board for checklist |
| `GET` | `/trello/1/checklists/{id}/cards` | Get cards that use this checklist |
| `GET` | `/trello/1/checklists/{id}/checkItems` | Get check items in checklist |
| `POST` | `/trello/1/checklists/{id}/checkItems` | Create check item |
| `GET` | `/trello/1/checklists/{id}/checkItems/{idCheckItem}` | Get specific check item |
| `DELETE` | `/trello/1/checklists/{id}/checkItems/{idCheckItem}` | Delete check item |

### Checklist Serializer

**File:** `server/extensions/trelloCompat/serializers/checklist.ts`

```ts
import type { TrelloChecklist, TrelloCheckItem } from '../types/trello';
import { rankToPos } from './position';

export function serializeCheckItem(item: {
  id: string;
  checklist_id: string;
  card_id: string;
  title: string;
  checked: boolean;
  _rank?: number;
  due_date?: Date | string | null;
  assigned_user_id?: string | null;
}): TrelloCheckItem {
  return {
    id: item.id,
    idChecklist: item.checklist_id,
    idCard: item.card_id,
    name: item.title,
    pos: typeof item._rank === 'number' ? rankToPos(item._rank) : 65535,
    state: item.checked ? 'complete' : 'incomplete',
    due: item.due_date ? new Date(item.due_date).toISOString() : null,
    dueReminder: null,
    idMember: item.assigned_user_id ?? null,
  };
}

export function serializeChecklist(checklist: {
  id: string;
  card_id: string;
  board_id?: string;
  title: string;
  _rank?: number;
  checkItems?: ReturnType<typeof serializeCheckItem>[];
}): TrelloChecklist {
  return {
    id: checklist.id,
    idBoard: checklist.board_id ?? '',
    idCard: checklist.card_id,
    name: checklist.title,
    pos: typeof checklist._rank === 'number' ? rankToPos(checklist._rank) : 65535,
    checkItems: checklist.checkItems ?? [],
  };
}
```

### Request Body Mappings

**`POST /trello/1/checklists`** (create checklist)

| Trello param | ChimeDeck field | Required |
|-------------|-----------------|----------|
| `idCard` | `card_id` | yes |
| `name` | `title` | no — defaults to `"Checklist"` |
| `pos` | `position` | no |
| `idChecklistSource` | — | optional; if provided, copy check items from another checklist |

**`POST /trello/1/checklists/{id}/checkItems`** (create check item)

| Trello param | ChimeDeck field | Required |
|-------------|-----------------|----------|
| `name` | `title` | yes |
| `pos` | `position` | no — defaults to bottom |
| `checked` | `checked` | no — defaults to `false` |
| `due` | `due_date` | no |
| `idMember` | `assigned_user_id` | no |

**`PUT /trello/1/checklists/{id}`** (update checklist)

| Trello param | ChimeDeck field |
|-------------|-----------------|
| `name` | `title` |
| `pos` | `position` |

---

## Labels

### Endpoint Inventory

| Method | Trello path | ChimeDeck operation |
|--------|-------------|---------------------|
| `POST` | `/trello/1/labels` | Create label on a board |
| `GET` | `/trello/1/labels/{id}` | Get label by id |
| `PUT` | `/trello/1/labels/{id}` | Update label (name, color) |
| `DELETE` | `/trello/1/labels/{id}` | Delete label |
| `PUT` | `/trello/1/labels/{id}/{field}` | Update a single field (name or color) |

### Label Serializer

Already defined in Sprint 142's `server/extensions/trelloCompat/serializers/label.ts`. No additional work needed.

### Request Body Mappings

**`POST /trello/1/labels`** (create)

| Trello param | ChimeDeck field | Required |
|-------------|-----------------|----------|
| `name` | `name` | yes |
| `color` | `color` | yes |
| `idBoard` | `board_id` | yes |

**`PUT /trello/1/labels/{id}`** (update)

| Trello param | ChimeDeck field |
|-------------|-----------------|
| `name` | `name` |
| `color` | `color` |

---

## Acceptance Criteria

### Checklists

1. `POST /trello/1/checklists` with `{ idCard, name }` creates a checklist and returns `TrelloChecklist` with `idCard`, `idBoard`, `name`, and empty `checkItems`.
2. `GET /trello/1/checklists/{id}` returns `TrelloChecklist` with nested `checkItems` array.
3. `POST /trello/1/checklists/{id}/checkItems` with `{ name }` creates a check item; response includes `state: "incomplete"`.
4. `PUT /trello/1/checklists/{id}/checkItems/{idCheckItem}` (via card endpoint) with `{ state: "complete" }` marks item complete.
5. `DELETE /trello/1/checklists/{id}/checkItems/{idCheckItem}` removes the item; `200 {}`.
6. `DELETE /trello/1/checklists/{id}` deletes the checklist and all its items; `200 {}`.
7. `GET /trello/1/checklists/{id}/board` returns the parent `TrelloBoard`.
8. `POST /trello/1/checklists` with `idChecklistSource` copies all check items from the source checklist.

### Labels

1. `POST /trello/1/labels` with `{ name, color, idBoard }` creates a label and returns `TrelloLabel`.
2. `GET /trello/1/labels/{id}` returns `TrelloLabel`.
3. `PUT /trello/1/labels/{id}` with `{ name: "Bug" }` updates the name.
4. `DELETE /trello/1/labels/{id}` deletes the label and all `card_labels` references; `200 {}`.
5. `PUT /trello/1/labels/{id}/color` with `{ value: "#FF5733" }` updates only the color.

---

## Tests

**`tests/integration/trelloCompat/checklists.test.ts`**

| Test | Assertion |
|------|-----------|
| `POST /trello/1/checklists` | TrelloChecklist shape; `idCard` and `idBoard` correct |
| `POST /trello/1/checklists` — idChecklistSource | Check items copied |
| `GET /trello/1/checklists/{id}` | checkItems array populated |
| `PUT /trello/1/checklists/{id}` — name | name updated |
| `POST /trello/1/checklists/{id}/checkItems` | state=incomplete |
| `GET /trello/1/checklists/{id}/checkItems` | Array of TrelloCheckItem |
| `DELETE /trello/1/checklists/{id}/checkItems/{id}` | 200 `{}`; item gone |
| `DELETE /trello/1/checklists/{id}` | 200 `{}`; checklist gone |
| `GET /trello/1/checklists/{id}/board` | TrelloBoard returned |
| Checklist not found | 404 |

**`tests/integration/trelloCompat/labels.test.ts`**

| Test | Assertion |
|------|-----------|
| `POST /trello/1/labels` | TrelloLabel shape |
| `GET /trello/1/labels/{id}` | Correct fields |
| `PUT /trello/1/labels/{id}` | Fields updated |
| `DELETE /trello/1/labels/{id}` | 200 `{}`; card references removed |
| `PUT /trello/1/labels/{id}/color` | Only color updated |
| Label not found | 404 |
