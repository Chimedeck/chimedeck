# Sprint 132 — Comment Threaded Replies: UI

> **Depends on:** Sprint 131 (Replies DB + API), Sprint 130 (Reactions UI — so CommentItem is stable)
> **Status:** ⬜ Future

---

## Goal

Let users click a **Reply** button under any top-level comment to open an inline reply composer. Existing replies are loaded on demand and shown in a indented thread below the parent — matching the second mockup (thread of nested replies with avatars, timestamps, and their own Like/Reply/Share actions).

---

## Scope

### 1. Client API helper

File: `src/extensions/Comment/api.ts`

```ts
export async function getReplies(
  { api, commentId }: { api: ApiClient; commentId: string }
): Promise<CommentData[]>;

export async function postReply(
  { api, cardId, parentId, content }: {
    api: ApiClient; cardId: string; parentId: string; content: string;
  }
): Promise<CommentData>;
```

`getReplies` calls `GET /api/v1/comments/:commentId/replies`.
`postReply` calls `POST /api/v1/cards/:cardId/comments` with body `{ content, parent_id: parentId }`.

---

### 2. `Comment` type — extend client interface

In `src/extensions/Comment/components/CommentItem.tsx`:

```ts
export interface Comment {
  // …existing…
  parent_id: string | null;
  reply_count?: number;
  reactions?: ReactionSummary[];
}
```

---

### 3. `CommentReplyThread` component

File: `src/extensions/Comment/components/CommentReplyThread.tsx`

Manages load-on-demand replies for a single parent comment.

```
Props:
  parentComment: Comment
  cardId: string
  boardId?: string
  currentUserId: string
  isAdmin?: boolean
  onAddReply: (parentId: string, content: string) => Promise<void>
  onEditReply: (commentId: string, content: string) => Promise<void>
  onDeleteReply: (commentId: string) => Promise<void>
  onAddReaction?: (commentId: string, emoji: string) => Promise<void>
  onRemoveReaction?: (commentId: string, emoji: string) => Promise<void>
```

State:
- `replies: Comment[]` — loaded on expand.
- `expanded: boolean` — controlled by the "View N replies" / "Hide replies" toggle.
- `showReplyEditor: boolean` — controlled by the "Reply" button in the parent.
- `loading: boolean`

Behaviour:
- When `expanded` flips to `true`, call `getReplies` and set `replies`.
- The reply composer (`CommentEditor`) submits via `onAddReply(parentComment.id, content)`, then appends the new reply to local `replies` and increments `parentComment.reply_count`.

---

### 4. Reply trigger UI in `CommentItem`

Extend `src/extensions/Comment/components/CommentItem.tsx`:

1. Add new optional props:
   ```ts
   onReply?: (commentId: string) => void;  // called when user clicks Reply
   replyCount?: number;
   ```
2. In the inline action bar (below the comment bubble), add a **Reply** link after Edit/Delete:
   ```tsx
   {onReply && !comment.parent_id && (
     <>
       <span>·</span>
       <button onClick={() => onReply(comment.id)} className="hover:text-subtle hover:underline">
         {translations['comment.action.reply']}
       </button>
     </>
   )}
   ```
   Note: `onReply` is only rendered when `comment.parent_id` is null (no nested replies on replies).
3. Below the action bar, if `replyCount > 0` or `showReplyEditor`, render `<CommentReplyThread>`.

The reply thread open/close state lives in `CommentItem` itself.

---

### 5. Thread visual layout

`CommentReplyThread` layout:

```
── [View N replies ▼] ─────────────────────────────────
   │
   ├─ [Avatar] name · time
   │  reply text here
   │  [Like] [Reply] [Share]  ← future; stub as grayed for now
   │
   ├─ [Avatar] name · time
   │  second reply
   │
   └─ [Write a reply…] ← CommentEditor, compact (1 row placeholder)
```

CSS:
- Thread container: `border-l-2 border-border ml-9 pl-3 mt-2 flex flex-col gap-3`
- Reply items use the same `CommentItem` component but receive no `onReply` prop (prevents infinite nesting).
- "View N replies" toggle: `text-xs font-semibold text-primary cursor-pointer hover:underline`

---

### 6. Collapsed state — reply count indicator

In `CommentItem`, when `reply_count > 0` and the thread is collapsed, show:

```tsx
<button onClick={() => setExpanded(true)} className="mt-1 text-xs font-semibold text-primary hover:underline">
  {reply_count === 1
    ? translations['comment.replies.viewOne']
    : translations['comment.replies.viewMany'].replace('{{count}}', String(reply_count))}
</button>
```

When expanded, replace with:
```tsx
<button onClick={() => setExpanded(false)} className="mt-1 text-xs font-semibold text-primary hover:underline">
  {translations['comment.replies.hide']}
</button>
```

---

### 7. Wire into `CommentThread` and `ActivityFeed`

**`CommentThread`** — add props:
```ts
onAddReply: (parentId: string, content: string) => Promise<void>;
onEditReply: (commentId: string, content: string) => Promise<void>;
onDeleteReply: (commentId: string) => Promise<void>;
```

Pass through to each `<CommentItem>` via the `onReply` callback and the nested `CommentReplyThread`.

**`ActivityFeed`** — add handlers:
```ts
const handleAddReply = useCallback(async (parentId: string, content: string) => {
  const reply = await postReply({ api, cardId, parentId, content });
  dispatch(cardDetailSliceActions.addReply({ parentId, reply }));
}, [api, cardId, dispatch]);
```

---

### 8. Redux slice actions

In `cardDetailSlice`:
```ts
addReply(state, { payload: { parentId, reply } }) {
  // Increment parent's reply_count
  // Store reply in a replies map keyed by parentId so the thread can render from store
}
```

---

### 9. Real-time reply sync

In the WS event handler, handle `comment_reply_added`:
```ts
case 'comment_reply_added':
  dispatch(cardDetailSliceActions.addReply({ parentId: event.parent_comment_id, reply: event.reply }));
```

---

### 10. Translations

Add to `src/extensions/Comment/translations/en.json`:
```json
"comment.action.reply": "Reply",
"comment.replies.viewOne": "View 1 reply",
"comment.replies.viewMany": "View {{count}} replies",
"comment.replies.hide": "Hide replies",
"comment.reply.placeholder": "Write a reply…",
"comment.reply.submit": "Reply"
```

---

## Files Affected

```
src/extensions/Comment/api.ts                                    (modified)
src/extensions/Comment/components/CommentItem.tsx                (modified)
src/extensions/Comment/components/CommentReplyThread.tsx         (new)
src/extensions/Comment/components/CommentThread.tsx              (modified)
src/extensions/Card/containers/CardModal/ActivityFeed.tsx        (modified)
src/extensions/Comment/translations/en.json                      (modified)
src/slices/cardDetailSlice.ts                                    (modified)
```

---

## Acceptance Criteria

- [ ] A "Reply" link appears below each top-level comment.
- [ ] Clicking Reply opens an inline `CommentEditor` composer with placeholder "Write a reply…".
- [ ] Submitting a reply appends it to the thread, shows the new reply immediately, and hides the composer.
- [ ] A collapsed thread shows "View N replies" when `reply_count > 0`.
- [ ] Expanding the thread fetches and displays replies in chronological order with avatars and timestamps.
- [ ] "Hide replies" collapses the thread back.
- [ ] Replies cannot themselves have a Reply button (one level deep only).
- [ ] Real-time: a reply added in browser A appears in browser B without reload.

---

## Tests

`tests/e2e/sprint-132-comment-replies.md` (Playwright MCP):
- Click Reply, write a reply, submit — verify reply appears in thread.
- Reload page — verify "View N replies" counter is correct.
- Open two browser sessions; post a reply in A; verify thread in B updates.
