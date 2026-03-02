# Sprint 19 — Card Detail Modal

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 18 (Board View), Sprint 08 (Card Extended API)  
> **References:** [requirements §§5.5](../architecture/requirements.md)

---

## Goal

Clicking a card on the board opens a rich detail modal: editable title and description (Markdown), label management, member assignment, due date picker, checklist, and card actions menu. All edits are optimistic and sync with the server in the background.

---

## Scope

### 1. Modal Layout

Radix `<Dialog>` — max width `max-w-3xl`, full-height on mobile:

```
┌──────────────────────────────────────────────────────────┐
│ ■ [Card title — editable h1]                    [✕]     │
│   In list: In Progress                                   │
├─────────────────────────────────┬────────────────────────┤
│ MAIN (flex-1)                   │ SIDEBAR (w-52)         │
│                                 │                        │
│ Description                     │ MEMBERS                │
│ [markdown textarea / preview]   │ [+] Assign             │
│                                 │                        │
│ ──────────────────              │ LABELS                 │
│ Checklist (2/5)  [+ Add item]   │ [🟢 Feature] [🔴 Bug]  │
│ ☑ Write tests                   │ [+ Add label]          │
│ ☐ Deploy staging                │                        │
│ ☐ Notify team                   │ DUE DATE               │
│                                 │ 📅 Mar 15, 2026        │
│                                 │                        │
│                                 │ ACTIONS                │
│                                 │ Archive card           │
│                                 │ Delete card            │
│                                 │ Move to list…          │
└─────────────────────────────────┴────────────────────────┘
```

### 2. File Structure

```
src/extensions/Card/
  components/
    CardModal.tsx               # Radix Dialog wrapper, URL sync (?card=:id)
    CardTitle.tsx               # click-to-edit h1
    CardDescription.tsx         # Markdown editor/preview toggle (textarea ↔ rendered)
    CardChecklist.tsx           # checklist with progress bar
    ChecklistItem.tsx           # individual item with checkbox + inline edit
    CardLabels.tsx              # label chips + colour picker popover
    CardMembers.tsx             # assigned member avatars + assign popover
    CardDueDate.tsx             # native date input styled with Tailwind
    CardActionMenu.tsx          # archive, delete, move-to-list actions
    CardSidebarSection.tsx      # reusable labelled section wrapper for sidebar
  slices/
    cardDetailSlice.ts          # { openCardId, card, checklists, labels, members }
  api/
    cardDetail.ts               # updateCard(), updateChecklist(), assignLabel(), assignMember()
```

### 3. Styling Reference

| Element | Tailwind classes |
|---------|-----------------|
| Modal overlay | `fixed inset-0 bg-black/60 backdrop-blur-sm` |
| Modal panel | `bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col` |
| Card title | `text-xl font-bold text-slate-100 bg-transparent focus:outline-none focus:bg-slate-800 rounded px-2 py-1 w-full` |
| Description textarea | `w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-slate-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px]` |
| Checklist progress | `h-1.5 bg-slate-700 rounded-full overflow-hidden` + `h-full bg-emerald-500 transition-all` |
| Label chip | `inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium` (colour via dynamic bg) |
| Sidebar section header | `text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2` |
| Action button | `w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition-colors` |

### 4. Description — Markdown Editor

Two-mode toggle (Edit / Preview):
- **Edit:** `<textarea>` with monospace font, auto-resize via `scrollHeight`
- **Preview:** rendered with a minimal Markdown renderer (`marked` or `micromark`, ~8 kB)
- Toggle button: `text-slate-400 hover:text-slate-200 text-xs` top-right of description section
- Auto-save: debounce 800 ms → `PATCH /api/v1/cards/:id` with `{ description }`

### 5. Checklist

- Progress bar: `completedCount / totalCount * 100%` in emerald
- Add item: inline `<input>` at bottom of list, `Enter` submits → `POST /api/v1/cards/:id/checklist`
- Check/uncheck: immediate optimistic toggle → `PATCH /api/v1/checklists/:itemId`
- Delete item: trash icon shown on hover → `DELETE /api/v1/checklists/:itemId`

### 6. Label Picker Popover

Radix `<Popover>` on "+ Add label":
- Grid of 8 preset colours (slate, red, orange, yellow, green, teal, indigo, purple)
- Text input to name/search labels
- Selecting a colour + entering a name → `POST /api/v1/boards/:boardId/labels`
- Toggle assign/unassign existing label → `POST/DELETE /api/v1/cards/:id/labels/:labelId`

### 7. URL Sync

Card modal is URL-driven: opening a card sets `?card=:cardId` query param.  
This allows deep-linking and browser back-button to close the modal.

```ts
// BoardPage.tsx
const [searchParams] = useSearchParams();
const openCardId = searchParams.get('card');
// → renders <CardModal cardId={openCardId} /> when set
```

### 8. Acceptance Criteria

- [ ] Clicking a card opens the modal without a page navigation
- [ ] URL updates to `?card=:id` when modal opens and clears on close
- [ ] Card title is editable inline and persists on Enter/blur
- [ ] Description saves automatically with 800 ms debounce
- [ ] Markdown preview renders headings, bold, bullet lists correctly
- [ ] Checklist progress bar updates live when items are checked
- [ ] Labels can be created, assigned, and removed from a card
- [ ] Due date can be set and displays in the sidebar
- [ ] Archiving a card closes the modal and removes the card from board view

### 9. Tests

```
specs/tests/
  card-detail-modal.md      # Playwright: click card, verify modal opens, edit title
  card-checklist.md         # Playwright: add checklist item, check it, verify progress bar
  card-labels.md            # Playwright: open label picker, create label, assign to card
```

---
