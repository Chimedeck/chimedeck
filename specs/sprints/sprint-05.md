# Sprint 05 — Board Lifecycle

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **References:** [requirements §5.3](../architecture/requirements.md), [technical-decisions.md §§9, 3](../architecture/technical-decisions.md)

---

## Goal

Members can create, view, archive, delete, and duplicate boards within a workspace. The board entity anchors all future list and card work.

---

## Scope

### 1. Data Model

New Prisma model (per [requirements §7](../architecture/requirements.md)):

```prisma
model Board {
  id          String      @id @default(cuid())
  workspaceId String
  title       String
  state       BoardState  @default(ACTIVE)
  createdAt   DateTime    @default(now())

  workspace   Workspace   @relation(fields: [workspaceId], references: [id])
  lists       List[]
  activities  Activity[]
}

enum BoardState {
  ACTIVE
  ARCHIVED
}
```

> Hard delete is tracked by the absence of the DB row — no soft-delete flag needed.  
> `ARCHIVED` boards are read-only (enforced by `requireBoardWritable` middleware).

Migration: `0004_board`

### 2. Server Extension

```
server/extensions/board/
  api/
    index.ts
    create.ts           # POST /api/v1/workspaces/:id/boards
    list.ts             # GET  /api/v1/workspaces/:id/boards
    get.ts              # GET  /api/v1/boards/:id
    update.ts           # PATCH /api/v1/boards/:id
    archive.ts          # PATCH /api/v1/boards/:id/archive
    delete.ts           # DELETE /api/v1/boards/:id
    duplicate.ts        # POST /api/v1/boards/:id/duplicate
  middlewares/
    requireBoardWritable.ts   # 403 if board.state === ARCHIVED
  mods/
    duplicate/
      index.ts          # deep-copy lists + cards + metadata
```

### 3. API Routes

| Method | Path | Min Role | Description |
|--------|------|----------|-------------|
| `POST` | `/api/v1/workspaces/:id/boards` | MEMBER | Create board |
| `GET` | `/api/v1/workspaces/:id/boards` | VIEWER | List boards (active + archived) |
| `GET` | `/api/v1/boards/:id` | VIEWER | Get board + lists + cards (shallow) |
| `PATCH` | `/api/v1/boards/:id` | ADMIN | Rename board |
| `PATCH` | `/api/v1/boards/:id/archive` | ADMIN | Toggle archive state |
| `DELETE` | `/api/v1/boards/:id` | ADMIN | Hard delete |
| `POST` | `/api/v1/boards/:id/duplicate` | MEMBER | Deep copy |

### 4. Duplicate Board Logic

Per [requirements §5.3](../architecture/requirements.md) — duplicate copies lists + cards + metadata:

1. Create new `Board` with state `ACTIVE` and title `"Copy of <original>"`
2. For each `List` (ordered by `position`): create new `List` preserving `title` + `position`
3. For each `Card` in each list: create new `Card` preserving all scalar fields; reset `archived: false`
4. Labels, checklist items, and comments are **not** copied (scoped to sprint 07 / 10)
5. Entire operation runs inside a Prisma `$transaction` — partial failure leaves nothing

### 5. Board Load Response

`GET /api/v1/boards/:id` returns the full shallow board for the initial page render:

```ts
// Response shape (per technical-decisions.md §9)
{
  data: Board,
  includes: {
    lists: List[],      // ordered by position
    cards: Card[],      // all cards across all lists, ordered by position
  }
}
```

> Full card details (descriptions, comments, attachments) are lazy-loaded per card.  
> This keeps initial load < 2 s for 1000-card boards ([requirements §6](../architecture/requirements.md)).

### 6. Activity Events

Per [event_sourcing.md](../architecture/event_sourcing.md), every mutation produces ≥ 1 activity event:

- `board_created`
- `board_renamed`
- `board_archived`
- `board_deleted`
- `board_duplicated`

Activity model is defined in sprint 10; for now, write events to console (stub).

### 7. Frontend Extension

```
src/extensions/Board/
  components/
    BoardCard.tsx          # board summary tile
    BoardStateChip.tsx     # active / archived badge
    DuplicateBoardModal.tsx
  containers/
    BoardListPage/
      BoardListPage.tsx
      BoardListPage.duck.ts
    BoardPage/
      BoardPage.tsx
      BoardPage.duck.ts    # RTK Query: getBoard
  api.ts                   # RTK Query: createBoard, archiveBoard, etc.
  routes.ts
  translations/
    en.json
```

---

## Error Responses

| Name | HTTP | Trigger |
|------|------|---------|
| `board-not-found` | 404 | Invalid board ID |
| `board-archived` | 403 | Write attempt on archived board |
| `board-duplicate-failed` | 500 | Transaction rolled back during duplicate |

---

## Tests

- Unit: `duplicate/index.ts` deep-copy logic, `requireBoardWritable` middleware
- Integration: full CRUD cycle, duplicate produces identical list/card structure, archived board rejects mutations

---

## Acceptance Criteria

- [ ] Board creation associates with correct workspace and sets `state: ACTIVE`
- [ ] Archived board returns 403 for rename, card create, list create
- [ ] Hard delete removes board (404 on subsequent GET)
- [ ] Duplicate creates a new board with identical lists and cards
- [ ] Duplicate failure rolls back completely (no orphaned records)
- [ ] `GET /api/v1/boards/:id` returns lists and cards in `includes`
- [ ] VIEWER can read boards but not mutate them
