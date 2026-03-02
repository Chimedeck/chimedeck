# Sprint 18 — Board View (Kanban)

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 17 (Dashboard), Sprints 05–07 (Board/List/Card APIs)  
> **References:** [requirements §§5.3, 5.4, 5.5](../architecture/requirements.md)

---

## Goal

Deliver the core Kanban board view: horizontally scrollable list columns, draggable cards within and between lists, inline card creation, inline list title editing, and board header with member avatars and settings menu.

---

## Scope

### 1. Board Page Layout

```
BOARD HEADER (bg-[boardColor]/80 backdrop-blur-sm sticky top-0 z-10)
  Board Title (editable on click) | Members | [Share] [⋯ Menu]

BOARD CANVAS (flex gap-3 p-4 overflow-x-auto min-h-[calc(100vh-112px)])
  ┌───────────────┐ ┌───────────────┐ ┌──────────────┐
  │ To Do (3)     │ │ In Progress(2)│ │ Done (5)     │  [+ Add list]
  │               │ │               │ │              │
  │ ┌───────────┐ │ │ ┌───────────┐ │ │ ┌──────────┐ │
  │ │Card title │ │ │ │Card title │ │ │ │Card title│ │
  │ │🏷 👤 📅  │ │ │ │          │ │ │ │🏷        │ │
  │ └───────────┘ │ │ └───────────┘ │ │ └──────────┘ │
  │               │ │               │ │              │
  │ + Add a card  │ │ + Add a card  │ │ + Add a card │
  └───────────────┘ └───────────────┘ └──────────────┘
```

### 2. Dependencies

Add `@dnd-kit/core` and `@dnd-kit/sortable` for drag-and-drop:

```json
{
  "dependencies": {
    "@dnd-kit/core": "^6",
    "@dnd-kit/sortable": "^8",
    "@dnd-kit/utilities": "^3"
  }
}
```

### 3. File Structure

```
src/extensions/Board/
  components/
    BoardHeader.tsx           # title, member avatars, action menu
    BoardCanvas.tsx           # DndContext wrapper + horizontal scroll container
    ListColumn.tsx            # single list column with SortableContext
    ListHeader.tsx            # editable list title + card count + ⋯ menu
    CardItem.tsx              # draggable card chip
    AddCardForm.tsx           # inline textarea + [Add] [✕] shown at column bottom
    AddListForm.tsx           # inline input shown after last column
    BoardMemberAvatars.tsx    # stacked avatars (max 5 + overflow badge)
  pages/
    BoardPage.tsx             # top-level board route
  slices/
    boardSlice.ts             # { board, lists[], cards{}, status }
  api/
    board.ts                  # getBoard(), updateBoardTitle()
    list.ts                   # getLists(), createList(), updateList(), deleteList(), reorderLists()
    card.ts                   # getCards(), createCard(), updateCard(), moveCard(), archiveCard()
```

### 4. Styling Reference

| Element | Tailwind classes |
|---------|-----------------|
| List column | `w-72 shrink-0 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl flex flex-col max-h-[calc(100vh-140px)]` |
| List header | `px-3 pt-3 pb-2 flex items-center justify-between` |
| List title input | `bg-transparent text-slate-100 font-semibold text-sm focus:outline-none focus:bg-slate-800 rounded px-1 py-0.5 w-full` |
| Card chip | `bg-slate-800 hover:bg-slate-700 border border-slate-700/50 rounded-lg p-2.5 cursor-pointer transition-colors` |
| Card title | `text-slate-200 text-sm leading-snug` |
| Drag overlay card | `rotate-2 scale-105 shadow-2xl opacity-90` |
| "Add a card" btn | `text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-sm rounded-lg px-2 py-1.5 w-full text-left transition-colors` |
| Add list column | `w-72 shrink-0 bg-slate-900/40 border border-dashed border-slate-700 rounded-xl p-3` |

### 5. Drag-and-Drop Behaviour

Using `@dnd-kit`:

- **Card within list:** `SortableContext` with `verticalListSortingStrategy` per column
- **Card between lists:** `DragOverlay` + `onDragOver` detects crossing column boundary, updates local state immediately (optimistic), calls `POST /api/v1/cards/:id/move` on `onDragEnd`
- **List reorder:** outer `SortableContext` with `horizontalListSortingStrategy`
- On drag end failure: dispatch rollback action restoring pre-drag snapshot

### 6. Redux State Shape

```ts
interface BoardState {
  board: Board | null;
  listOrder: string[];          // ordered list IDs
  lists: Record<string, List>;
  cardsByList: Record<string, string[]>; // listId → ordered card IDs
  cards: Record<string, Card>;
  status: 'idle' | 'loading' | 'error';
}
```

### 7. Inline Editing

- **List title:** click to edit, `Enter` or blur → `PATCH /api/v1/lists/:id`; `Escape` cancels
- **Board title:** same pattern, `PATCH /api/v1/boards/:id`
- **Add card:** clicking "+ Add a card" opens `AddCardForm` at column bottom; `Enter` submits, `Escape` closes

### 8. Acceptance Criteria

- [ ] Board loads and renders all lists and cards from the API
- [ ] Cards can be dragged within a column and reorder is persisted
- [ ] Cards can be dragged between columns and the move is persisted
- [ ] Lists can be reordered by dragging the list header
- [ ] Inline card creation adds a card to the correct column
- [ ] Inline list title edit persists on blur/Enter
- [ ] Archiving a card from the card chip menu removes it from the board view
- [ ] Board header shows all member avatars with a tooltip on hover
- [ ] Board canvas scrolls horizontally with 10+ lists without layout break

### 9. Tests

```
specs/tests/
  board-view.md             # Playwright: open board, verify lists and cards render
  board-drag-card.md        # Playwright: drag card between columns, verify new column
  board-add-card.md         # Playwright: click add card, type title, verify card appears
```

---
