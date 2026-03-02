# Card Feature

Card is the primary unit of work in the Collaborative Kanban board. Each card belongs to exactly one list and supports rich fields (title, description, due date, position).

## API Routes

| Method | Path | Min Role | Description |
|--------|------|----------|-------------|
| `POST` | `/api/v1/lists/:id/cards` | MEMBER | Create card |
| `GET` | `/api/v1/lists/:id/cards` | VIEWER | List active cards in a list |
| `GET` | `/api/v1/cards/:id` | VIEWER | Get full card detail |
| `PATCH` | `/api/v1/cards/:id` | MEMBER | Update title / description / due date |
| `PATCH` | `/api/v1/cards/:id/archive` | MEMBER | Toggle archive |
| `POST` | `/api/v1/cards/:id/move` | MEMBER | Move to another list |
| `POST` | `/api/v1/cards/:id/duplicate` | MEMBER | Duplicate within same list |
| `DELETE` | `/api/v1/cards/:id` | ADMIN | Hard delete |

## Data Model

```sql
cards (
  id          TEXT PRIMARY KEY,
  list_id     TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,          -- ≤ 512 chars
  description TEXT,                  -- markdown
  position    TEXT NOT NULL,         -- fractional lexicographic index
  archived    BOOLEAN NOT NULL DEFAULT false,
  due_date    TIMESTAMP,
  created_at  TIMESTAMP,
  updated_at  TIMESTAMP
)
```

## Position / Ordering

Cards use the same lexicographic fractional indexing as lists (see `server/extensions/list/mods/fractional/`). New cards are appended after the last active card in the target list.

## Move Logic

`POST /api/v1/cards/:id/move` accepts:
- `targetListId` (required) — must belong to the same board
- `afterCardId` (optional) — `null` = prepend; omit = append; string = after that card

## Error Responses

| Name | HTTP | Trigger |
|------|------|---------|
| `card-not-found` | 404 | Invalid card ID |
| `card-title-too-long` | 400 | title > 512 chars |
| `card-archived` | 403 | Write on archived card |
| `target-list-not-found` | 404 | Move: invalid `targetListId` |
| `cross-board-move` | 400 | Move: lists on different boards |

## Frontend Components

- `CardTile` — compact card tile rendered inside `ListColumn`
- `CardModal` — full detail overlay for editing
- `CreateCardForm` — inline creation form at the bottom of a list

## Extended Fields

Labels, assignees, due dates, and checklists are added in Sprint 08 (`db/migrations/0007_card_extended.ts`).
