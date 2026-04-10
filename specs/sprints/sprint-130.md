# Sprint 130 — Comment Emoji Reactions: UI

> **Depends on:** Sprint 129 (Reactions DB + API), Sprint 21 (Comments UI)
> **Status:** ⬜ Future

---

## Goal

Render emoji reactions on comments and let users add or remove them through an emoji picker popover — matching the interaction in the first mockup (emoji picker anchored below a hover-revealed smiley-face button, with frequently-used emojis shown first).

---

## Scope

### 1. Client API — reaction helpers

File: `src/extensions/Comment/api.ts` (extend existing or create if absent)

```ts
export async function addReaction(
  { api, commentId, emoji }: { api: ApiClient; commentId: string; emoji: string }
): Promise<void>;

export async function removeReaction(
  { api, commentId, emoji }: { api: ApiClient; commentId: string; emoji: string }
): Promise<void>;
```

Both wrap `POST /api/v1/comments/:commentId/reactions` and `DELETE /api/v1/comments/:commentId/reactions/:encodedEmoji`. Encode the emoji with `encodeURIComponent` for the DELETE path.

---

### 2. Type update — `Comment` interface

In `src/extensions/Comment/components/CommentItem.tsx`, extend the `Comment` interface:

```ts
export interface ReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface Comment {
  // …existing fields…
  reactions?: ReactionSummary[];
}
```

---

### 3. `CommentReactions` component

File: `src/extensions/Comment/components/CommentReactions.tsx`

Renders the reaction pill row + the add-reaction trigger.

```
[👍 3] [❤️ 1] [😂 2]   [😀+]
```

Props:
```ts
interface Props {
  reactions: ReactionSummary[];
  currentUserId: string;
  onAdd: (emoji: string) => Promise<void>;
  onRemove: (emoji: string) => Promise<void>;
}
```

Layout rules:
- Reaction pills: `flex flex-wrap gap-1 items-center`
- Each pill: `inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs cursor-pointer select-none transition-colors`
  - When `reactedByMe`: `bg-primary/10 border-primary/30 text-primary`
  - Otherwise: `bg-bg-overlay text-base hover:bg-bg-sunken`
- Clicking a pill with `reactedByMe = true` calls `onRemove(emoji)`; otherwise calls `onAdd(emoji)`.
- Add-reaction button (`😀+`): ghost icon button, shown always.
  - On click: open `EmojiPickerPopover`.
  - Positioned relative to the trigger button using a `useRef` anchor.

---

### 4. `EmojiPickerPopover` component

File: `src/extensions/Comment/components/EmojiPickerPopover.tsx`

Wraps `@emoji-mart/react` `Picker` in a popover positioned anchored to a trigger element. The library is already installed (`@emoji-mart/data` is used in `CommentItem.tsx`).

```tsx
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

interface Props {
  anchorRef: React.RefObject<HTMLElement>;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}
```

Positioning:
- Absolute/fixed, anchored below-left of the trigger.
- `useEffect` with a `mousedown` listener on `document` closes the popover when clicking outside.
- `z-50` to float above card modal content.

Picker config:
```tsx
<Picker
  data={data}
  onEmojiSelect={(e: { native: string }) => { onSelect(e.native); onClose(); }}
  theme="dark"          // match app default; respect prefers-color-scheme via CSS var later
  previewPosition="none"
  skinTonePosition="none"
/>
```

---

### 5. Wire `CommentReactions` into `CommentItem`

In `src/extensions/Comment/components/CommentItem.tsx`:

1. Accept two new optional props:
   ```ts
   onAddReaction?: (commentId: string, emoji: string) => Promise<void>;
   onRemoveReaction?: (commentId: string, emoji: string) => Promise<void>;
   ```
2. Render `<CommentReactions>` below the comment bubble (above the inline action links), only when at least one of the props is provided:
   ```tsx
   {(onAddReaction || onRemoveReaction) && (
     <CommentReactions
       reactions={comment.reactions ?? []}
       currentUserId={currentUserId}
       onAdd={(emoji) => onAddReaction?.(comment.id, emoji) ?? Promise.resolve()}
       onRemove={(emoji) => onRemoveReaction?.(comment.id, emoji) ?? Promise.resolve()}
     />
   )}
   ```

---

### 6. Wire callbacks in `CommentThread` and `ActivityFeed`

**`CommentThread`** (`src/extensions/Comment/components/CommentThread.tsx`):

Add props:
```ts
onAddReaction?: (commentId: string, emoji: string) => Promise<void>;
onRemoveReaction?: (commentId: string, emoji: string) => Promise<void>;
```

Pass through to each `<CommentItem>`.

**`ActivityFeed`** (`src/extensions/Card/containers/CardModal/ActivityFeed.tsx`):

Add props and create handler functions that call the API helpers, then update local state optimistically:

```ts
const handleAddReaction = useCallback(async (commentId: string, emoji: string) => {
  // Optimistic update: increment count / set reactedByMe
  dispatch(cardDetailSliceActions.addReaction({ commentId, emoji, userId: currentUserId }));
  try {
    await addReaction({ api, commentId, emoji });
  } catch {
    dispatch(cardDetailSliceActions.removeReaction({ commentId, emoji, userId: currentUserId }));
  }
}, [api, currentUserId, dispatch]);
```

---

### 7. Redux slice actions (optional optimistic updates)

If `cardDetailSlice` stores comments, add two actions:

```ts
addReaction(state, { payload: { commentId, emoji, userId } }) { … }
removeReaction(state, { payload: { commentId, emoji, userId } }) { … }
```

Otherwise use local state in `ActivityFeed` — whichever approach is already used for comment list.

---

### 8. Real-time reaction sync

In the existing WebSocket event handler (wherever `comment_reaction_added` / `comment_reaction_removed` events are dispatched), dispatch the matching slice actions so all open clients see reaction changes live without reload.

---

### 9. Translations

Add to `src/extensions/Comment/translations/en.json`:
```json
"comment.reactions.add": "Add reaction",
"comment.reactions.aria.pill": "{{emoji}} {{count}} reaction{{plural}}, {{state}}"
```

---

## Files Affected

```
src/extensions/Comment/api.ts                              (modified or new)
src/extensions/Comment/components/CommentReactions.tsx     (new)
src/extensions/Comment/components/EmojiPickerPopover.tsx   (new)
src/extensions/Comment/components/CommentItem.tsx          (modified)
src/extensions/Comment/components/CommentThread.tsx        (modified)
src/extensions/Card/containers/CardModal/ActivityFeed.tsx  (modified)
src/extensions/Comment/translations/en.json                (modified)
src/slices/cardDetailSlice.ts                              (modified — two new actions)
```

---

## Acceptance Criteria

- [ ] Hovering a comment reveals a `😀+` button that opens the emoji picker popover.
- [ ] Selecting an emoji closes the picker and adds a reaction pill below the comment.
- [ ] The pill shows the emoji + count; `reactedByMe` pills are highlighted with the primary colour.
- [ ] Clicking an active pill removes the reaction.
- [ ] Clicking outside the picker closes it without adding a reaction.
- [ ] Real-time: a reaction added in browser A appears in browser B without reload.
- [ ] Accessibility: pills have `aria-label`; picker is focusable and closable via `Escape`.

---

## Tests

`tests/e2e/sprint-130-comment-reactions.md` (Playwright MCP):
- Add a reaction to a comment, verify pill appears.
- Click the highlighted pill, verify it disappears.
- Open two browser sessions; add a reaction in session A; verify it appears in session B (real-time).
