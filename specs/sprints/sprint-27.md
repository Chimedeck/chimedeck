# Sprint 27 — Collapsible Label Chips on Card Tiles

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 06 (Labels), Sprint 18 (Drag-and-drop card tiles)  
> **References:** [requirements §3 — Board](../architecture/requirements.md)

---

## Goal

Display labels directly on card tiles in the board view. Labels render in a **collapsed** state by default — showing only coloured bars/dots. A single click on the label strip **toggles** the expanded state, revealing each label's text. The expanded/collapsed preference persists per-board in `localStorage` so the user's choice survives page refreshes. No server changes are required.

---

## Scope

### 1. UI — `CardLabelChips` component (new)

```
src/extensions/Card/components/CardLabelChips.tsx
```

A **pure presentational** component that renders the label strip on a card tile.

#### Props

```ts
interface CardLabelChipsProps {
  labels: Array<{ id: string; name: string; color: string }>;
  expanded: boolean;
  onToggle: () => void;
}
```

#### Collapsed state (default)

- Each label renders as a short coloured pill: `h-2 rounded-full` with `background-color` set to `label.color`.
- Minimum width `28px`, maximum width `40px`.
- Chips sit in a horizontal `flex-wrap` row.
- Clicking anywhere on the row calls `onToggle()`.
- `aria-expanded={expanded}` on the container div.
- `title` attribute on each pill = label name (tooltip on hover).

#### Expanded state

- Each label renders as a wider pill with the label text inside:  
  `text-[11px] font-semibold text-white px-2 py-0.5 rounded-full truncate max-w-[120px]`.
- Background color = `label.color`.
- Clicking anywhere on the row calls `onToggle()`.

#### Animation

Transition between states with `transition-all duration-150`.

---

### 2. UI — `useCardLabelExpanded` hook (new)

```
src/extensions/Card/hooks/useCardLabelExpanded.ts
```

- Stores the global expanded-flag for a board in `localStorage` under key  
  `card-labels-expanded:<boardId>`.
- Returns `[expanded: boolean, toggle: () => void]`.
- Defaults to `false` (collapsed).

```ts
export function useCardLabelExpanded(boardId: string): [boolean, () => void];
```

---

### 3. UI — Integrate into `CardItem`

File: `src/extensions/Card/components/CardItem.tsx`

- Receive `labelsExpanded: boolean` and `onToggleLabels: () => void` as new props.
- When `card.labels` is a non-empty array, render `<CardLabelChips>` **above** the card title.
- The `Card` type already includes `labels: Label[]` from the API; use it directly.
- Ensure the click handler on `CardLabelChips` does **not** bubble up to the card's own `onClick` (use `e.stopPropagation()`).

Updated prop interface:

```ts
interface Props {
  card: Card;
  isOverlay?: boolean;
  onClick?: (cardId: string) => void;
  labelsExpanded: boolean;
  onToggleLabels: () => void;
}
```

---

### 4. UI — Integrate hook into board list/column

File: `src/extensions/Board/components/BoardCanvas.tsx` (or the list column component that renders `CardItem`)

- Call `useCardLabelExpanded(boardId)` once at the column/board level.
- Pass `labelsExpanded` and `onToggleLabels` down to every `CardItem`.

---

### 5. Ensure `Card` type includes labels

File: `src/extensions/Card/api/index.ts` (or wherever `Card` is typed)

Confirm or add:
```ts
export interface Card {
  // …existing fields…
  labels: Array<{ id: string; name: string; color: string }>;
}
```

If the card list API (`GET /api/v1/boards/:boardId/cards` or equivalent) does not yet return `labels`, extend the SQL query with a JSON aggregation and update the response type. No new migration needed — the `labels` table already exists.

---

## Acceptance Criteria

1. **Collapsed by default** — opening a board shows only coloured bars on each card; no text is visible.
2. **Toggle on click** — clicking the label strip on any card toggles the expanded state for **all** cards on the board simultaneously.
3. **Text visible when expanded** — each label chip shows the label name in the expanded state.
4. **Persistence** — refreshing the page restores the last expanded/collapsed state for that board.
5. **No interference with card click** — clicking the label strip does not open the card modal.
6. **Cards without labels** — no label row is rendered; no extra whitespace.
7. **Overlay drag card** — the drag overlay renders label chips in the same state as the original.

---

## Files

### New
- `src/extensions/Card/components/CardLabelChips.tsx`
- `src/extensions/Card/hooks/useCardLabelExpanded.ts`

### Modified
- `src/extensions/Card/components/CardItem.tsx`
- `src/extensions/Board/components/BoardCanvas.tsx` (or list column component)
- `src/extensions/Card/api/index.ts` (if labels missing from Card type / query)
