# Sprint 06 — Card Core

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **References:** [requirements §5.5](../architecture/requirements.md), [technical-decisions.md §§7, 9](../architecture/technical-decisions.md)

---

## Goal

Members can create, read, update, archive, move, and delete cards within lists. Cards are the primary unit of work in the system.

---

## Scope

### 1. Data Model

New Prisma model — core fields only (extended fields in sprint 07):

```prisma
model Card {
  id          String   @id @default(cuid())
  listId      String
  title       String   @db.VarChar(512)  // requirements §5.5 ≤ 512 chars
  description String?  @db.Text           // markdown
  position    String                      // fractional index (same as List)
  archived    Boolean  @default(false)
  dueDate     DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  list        List     @relation(fields: [listId], references: [id], onDelete: Cascade)
  comments    Comment[]
  attachments Attachment[]
  activities  Activity[]
  labels      CardLabel[]
  members     CardMember[]
  checklistItems ChecklistItem[]
}
```

> Relation models (`CardLabel`, `CardMember`, `ChecklistItem`) are added in sprint 07.

Migration: `0006_card`

### 2. Card Invariants

Per [requirements §5.5](../architecture/requirements.md):

- `title` is required and ≤ 512 characters (validated at API layer)
- Moving a card does **not** mutate its `id`
- Archived cards remain queryable (not deleted) — `GET /api/v1/cards/:id` works
- A card belongs to exactly 1 list at all times

### 3. Move Card Logic

`POST /api/v1/cards/:id/move`:

```ts
// Request body
{
  targetListId: string,
  afterCardId?: string | null  // null = prepend, omit = append
}
```

Steps:
1. Verify `targetListId` belongs to the same board as source list
2. Compute new `position` using fractional index (same algorithm as lists)
3. Update `listId` + `position` in a single transaction
4. Emit `card_moved` event (stubbed until sprint 08)

### 4. Server Extension

```
server/extensions/card/
  api/
    index.ts
    create.ts        # POST /api/v1/lists/:id/cards
    get.ts           # GET  /api/v1/cards/:id
    update.ts        # PATCH /api/v1/cards/:id
    archive.ts       # PATCH /api/v1/cards/:id/archive
    move.ts          # POST /api/v1/cards/:id/move
    duplicate.ts     # POST /api/v1/cards/:id/duplicate
    delete.ts        # DELETE /api/v1/cards/:id
  middlewares/
    requireCardWritable.ts   # 403 if card.archived or board.state === ARCHIVED
```

### 5. API Routes

| Method | Path | Min Role | Description |
|--------|------|----------|-------------|
| `POST` | `/api/v1/lists/:id/cards` | MEMBER | Create card |
| `GET` | `/api/v1/cards/:id` | VIEWER | Get full card detail |
| `PATCH` | `/api/v1/cards/:id` | MEMBER | Update title / description / due date |
| `PATCH` | `/api/v1/cards/:id/archive` | MEMBER | Toggle archive |
| `POST` | `/api/v1/cards/:id/move` | MEMBER | Move to another list |
| `POST` | `/api/v1/cards/:id/duplicate` | MEMBER | Duplicate within same list |
| `DELETE` | `/api/v1/cards/:id` | ADMIN | Hard delete |

### 6. Card Detail Response

`GET /api/v1/cards/:id` — full card envelope:

```ts
{
  data: Card,
  includes: {
    list: List,
    board: { id, title },
    labels: CardLabel[],
    members: User[],
    checklistItems: ChecklistItem[],
    comments: Comment[],      // latest 50
    attachments: Attachment[],
    activities: Activity[],   // latest 20
  }
}
```

> `includes` keys are entity type names per `copilot-instructions.md` conventions.

### 7. Frontend Extension

```
src/extensions/Card/
  components/
    CardTile.tsx              # compact card in list column
    CardModal.tsx             # full detail overlay
    CardTitleEditor.tsx
    CardDescriptionEditor.tsx # markdown textarea
    DueDatePicker.tsx
    MoveCardModal.tsx
  containers/
    CardModal/
      CardModal.tsx
      CardModal.duck.ts
  hooks/
    useCardDrag.ts            # drag within/between lists
  api.ts
  translations/
    en.json
```

Drag-and-drop between lists uses `@dnd-kit/sortable` (shared with sprint 05).

---

## Error Responses

| Name | HTTP | Trigger |
|------|------|---------|
| `card-not-found` | 404 | Invalid card ID |
| `card-title-too-long` | 400 | title > 512 chars |
| `card-archived` | 403 | Write on archived card |
| `target-list-not-found` | 404 | Move: invalid `targetListId` |
| `cross-board-move` | 400 | Move: lists belong to different boards |

---

## Tests

- Unit: `requireCardWritable`, title length validation, fractional position on move
- Integration: create → move (same list reorder, cross-list move), duplicate preserves all scalar fields, archived card blocks mutations

---

## Acceptance Criteria

- [ ] Card creation respects position (appended after last card by default)
- [ ] Moving a card between lists updates `listId` + `position` and preserves `id`
- [ ] Archived card: read succeeds, mutations return 403
- [ ] Duplicate produces identical scalar fields with a new `id` and `createdAt`
- [ ] title > 512 chars returns 400
- [ ] Cross-board move returns 400
- [ ] Drag-drop between lists is keyboard accessible
