# Sprint 81 — Card Modal UI Overhaul

> **Status:** Ready for development
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 32 (Custom Fields), Sprint 11 (Comments & Activity), Sprint 33 (Attachments)
> **References:** Design screenshots attached to [ChimeDeck] Feature improvement card

---

## Goal

Redesign the card detail modal to match the new design: a two-column resizable layout where activity lives on the right, metadata actions are promoted to the top toolbar, the description supports direct inline editing with markdown preview, and a bottom action bar consolidates all secondary actions and panel toggles.

---

## Scope

### 1. Two-Column Resizable Layout

**`src/extensions/Card/components/CardModal.tsx`**

Replace the current fixed-width right sidebar (`md:w-52`) with a user-resizable two-column layout using a drag handle.

#### Behaviour

- Left column: card content (title, metadata strip, description, checklist, attachments, custom fields, plugins)
- Right column: activity feed + comment input
- A draggable vertical divider between the two columns lets the user resize freely
- The column ratio is persisted in `localStorage` under key `card_modal_column_ratio` as a decimal (e.g. `0.55`)
- The ratio is user-scoped — it applies to all card modals for this browser session/user but is **not** synced to the server and does not affect other users
- Default ratio: `0.55` (left) / `0.45` (right)
- Minimum column width: `280px` for both columns

#### Implementation notes

- Use a `ResizablePanels` component (`src/extensions/Card/components/ResizablePanels.tsx`) built with `mousedown` / `mousemove` / `mouseup` and `touchstart` / `touchmove` / `touchend` for mobile support
- Persist on mouse-up / touch-end only (not on every event)
- On mobile (`< 768px`) collapse to single-column vertical stack (no resize handle), activity below content

---

### 2. Activity Panel Moved to Right Column

**`src/extensions/Card/components/CardModal.tsx`**
**`src/extensions/Card/containers/CardModal/ActivityFeed.tsx`**

Move `ActivityFeed` out of the main scrollable content column and into the right column of the new two-column layout.

- The right column is independently scrollable
- It always shows the activity feed; the toggle in the bottom bar (see §6) shows/hides the entire right column
- When the right column is hidden the left column expands to fill the full modal width

---

### 3. Activity Feed — Sort Newest First

**`src/extensions/Card/containers/CardModal/ActivityFeed.tsx`**

Reverse the current sort so the newest items appear at the **top** of the feed.

```ts
// Before
const feed = [...commentItems, ...eventItems].sort(
  (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
);

// After
const feed = [...commentItems, ...eventItems].sort(
  (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
);
```

The "Add a comment" input box must stay **above** the feed (users see the input first, then scroll down through history).

Current layout in `ActivityFeed`:

```
[h3 Activity heading]
[feed items — ascending]
[CommentEditor at bottom]
```

New layout:

```
[h3 Activity heading]
[CommentEditor — always at top]
[feed items — descending (newest first)]
```

---

### 4. Metadata Top Strip (Labels · Members · Due Date)

**`src/extensions/Card/components/CardModal.tsx`**
**New: `src/extensions/Card/components/CardMetaStrip.tsx`**

Add a compact horizontal metadata strip immediately below the title/list breadcrumb and above the description. This replaces the sidebar sections for Labels, Members, Start Date, and Due Date.

```
[Label chips...] [+ Labels]  |  [Member avatars...] [+ Members]  |  [📅 Start] [📅 Due]
```

#### `CardMetaStrip` props

```ts
interface CardMetaStripProps {
  labels: Label[];
  allLabels: Label[];
  members: CardMember[];
  boardMembers: BoardMember[];
  cardId: string;
  currentUserId: string;
  startDate: string | null;
  dueDate: string | null;
  disabled?: boolean;
  onLabelAttach: (labelId: string) => Promise<void>;
  onLabelDetach: (labelId: string) => Promise<void>;
  onLabelCreate: (name: string, color: string) => Promise<void>;
  onMemberAssign: (userId: string) => Promise<void>;
  onMemberRemove: (userId: string) => Promise<void>;
  onStartDateChange: (date: string | null) => void;
  onDueDateChange: (date: string | null) => void;
}
```

#### Visual

- Each group is a pill-style button that opens its existing picker popover (reuse `LabelPicker`, `MemberAssignModal`, `CardDueDate`)
- If no labels: show `+ Labels` button only
- If labels present: show up to 3 label chips then `+ Labels` overflow button
- If no members: show `+ Members` button only
- If members present: show up to 3 member avatars then `+N` overflow
- Start/Due date buttons show the date text when set, calendar icon when not set

#### Sidebar cleanup

- Remove the `CardSidebarSection` blocks for Members, Labels, Start Date, and Due Date from the sidebar — they are now in the strip
- The sidebar is eliminated entirely; its remaining content (Value, Plugin badges, Plugin buttons) moves into the left column below the checklist section or into the `...` menu where appropriate

---

### 5. Inline Description Editing with Markdown

**`src/extensions/Card/components/CardDescription.tsx`**

Replace the current explicit edit button pattern with direct inline click-to-edit:

- **View mode**: render `description` as parsed markdown (keep existing markdown rendering). Show a subtle `Edit` cursor on hover.
- **Edit mode**: clicking anywhere on the rendered description switches to a plain `<textarea>` showing the raw markdown source. No rich text editor / WYSIWYG.
- **Save**: `Ctrl+Enter` / `Cmd+Enter` saves and returns to view mode. A visible "Save" button is also available.
- **Cancel**: `Escape` or a "Cancel" button discards changes and returns to view mode.
- When `description` is empty, show a placeholder div `"Add a more detailed description…"` that on click opens the textarea.
- No change to how the markdown is stored or the `onSave` callback signature.

Remove the explicit "Edit" button that currently triggers editing mode.

---

### 6. Bottom Action Bar

**New: `src/extensions/Card/components/CardModalBottomBar.tsx`**
**`src/extensions/Card/components/CardModal.tsx`**

Add a fixed bottom bar inside the modal panel (sticky at the bottom of the modal container, not the viewport).

#### Layout

```
[ Power-ups ]  [ Automations ]  [ Actions ▾ ]          [ ≡ Activity ]
└──────────────────── left-aligned ───────────────────┘ └── right ──┘
```

- **Power-ups button**: opens `CardPluginButtons` as a popover (replaces sidebar section)
- **Automations button**: opens `CardButtonsSection` as a popover (replaces sidebar section)  
- **Actions `▾` button**: dropdown menu containing:
  - Archive / Unarchive card
  - Copy link
  - Delete card (destructive, shown in red)
  - Move card (existing move action if available)
- **Activity toggle button** (right-aligned): toggles the right column (activity panel) visible/hidden. Shows `≡ Activity` label with an icon. When hidden, icon changes to indicate off state.

#### State

- The activity panel visibility state is component-local (`useState`), defaulting to `true` (visible)
- It does **not** need to be persisted

#### Notes

- The bottom bar replaces the old `CardActionMenu` sidebar section and the sidebar plugin/automation buttons
- `CardActionMenu` component itself becomes the implementation of the "Actions" dropdown only — remove the wrapper `CardSidebarSection`

---

### 7. `...` Header Menu — Archive / Copy / Delete

**`src/extensions/Card/components/CardModal.tsx`**
**`src/extensions/Card/components/CardActionMenu.tsx`**

The `···` icon button currently in the modal header (top-right, next to close) should open a dropdown containing:

- Archive / Unarchive
- Copy link
- Delete card

This is the same set of actions as the "Actions" dropdown in the bottom bar (§6). Both menus share the same `CardActionMenu` component — the bottom bar uses `variant="dropdown"` and the `···` header button is removed in favour of the bottom bar being the canonical location.

> **Decision**: Remove the `···` header button entirely; the bottom bar "Actions" dropdown is the single entry point. The modal header only retains the close `✕` button.

---

### 8. Value / Plugin Badges in Left Column

**`src/extensions/Card/components/CardModal.tsx`**

Since the sidebar is removed, place the following in the left column, below the checklist and attachments:

- `CardValue` (money badge)
- `CardDetailPluginBadges`

They should be rendered in a small horizontal row / badge strip, not as full-width sections.

---

## File Checklist

| File | Change |
|------|--------|
| `src/extensions/Card/components/CardModal.tsx` | Major restructure: two-column layout, bottom bar, metadata strip, remove sidebar |
| `src/extensions/Card/components/CardDescription.tsx` | Inline click-to-edit, remove Edit button |
| `src/extensions/Card/containers/CardModal/ActivityFeed.tsx` | Sort descending; move CommentEditor above feed |
| `src/extensions/Card/components/CardMetaStrip.tsx` | **New** — labels · members · dates strip |
| `src/extensions/Card/components/ResizablePanels.tsx` | **New** — drag-to-resize two-panel layout, persists to localStorage |
| `src/extensions/Card/components/CardModalBottomBar.tsx` | **New** — bottom action bar with toggles |
| `src/extensions/Card/components/CardActionMenu.tsx` | Refactor to pure dropdown (no sidebar wrapper) |
| `src/extensions/Card/components/CardSidebarSection.tsx` | Can be removed or left unused |

---

## Acceptance Criteria

1. Opening a card modal shows a two-column layout: content left, activity right.
2. Dragging the divider resizes both columns; ratio persists after closing and reopening a card.
3. Activity feed shows newest entries at top; comment input is at top of feed.
4. Clicking on the description text (or placeholder) opens a textarea with raw markdown; `Ctrl+Enter` saves.
5. Labels, Members, Start Date, and Due Date are visible as buttons/chips directly below the card title.
6. The bottom bar is always visible; the "Activity" toggle button shows/hides the right column.
7. The "Actions" dropdown in the bottom bar contains Archive, Copy link, and Delete.
8. No sidebar column is rendered — all sidebar content has been redistributed.
9. On mobile (< 768px), layout is single-column; activity is below content; no resize handle.

---

## Technical Debt / Notes

- `CardSidebarSection` can be deleted once no usages remain.
- The resize handle uses only DOM events (no third-party resize library) to keep the bundle small.
- `localStorage` key `card_modal_column_ratio` — document in README if adding more persisted UI prefs.
