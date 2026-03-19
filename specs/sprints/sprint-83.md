# Sprint 83 - Offline Mode for Card Description and Comments

> **Status:** Future sprint - not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 11 (Comments & Activity), Sprint 20 (Real-Time UI), Sprint 58 (IndexedDB Offline Queue), Sprint 81 (Card Modal UI Overhaul)
> **References:** [requirements §6 - Reliability](../architecture/requirements.md), [real_time_sync_protocol.md](../architecture/real_time_sync_protocol.md)

---

## Goal

When a user loses connection while writing card description or comment content, their work is preserved as a private draft and can be resumed later from the same browser or another device after login. If they submit while offline, operations are queued and replayed once back online.

This sprint covers:
- Offline drafting for card description and comment
- Private (user-only) draft visibility
- Cross-device draft continuity via server-synced drafts
- Offline submit/save replay after reconnect

---

## Scope

### 1. User-Private Draft Domain (Server)

Add a server-managed draft store for card description and card comment drafts.

#### New DB table

```text
user_card_drafts
- id (uuid)
- user_id (uuid, not null)
- workspace_id (uuid, not null)
- board_id (uuid, not null)
- card_id (uuid, not null)
- draft_type (text: 'description' | 'comment')
- content_markdown (text, not null default '')
- intent (text: 'editing' | 'save_pending' | 'submit_pending')
- client_updated_at (timestamptz, nullable)
- synced_at (timestamptz, nullable)
- created_at (timestamptz)
- updated_at (timestamptz)

unique(user_id, card_id, draft_type)
index(user_id, updated_at desc)
index(card_id)
```

Notes:
- Drafts are always scoped to `user_id`
- No other board member can read another user's drafts
- Draft writes do not create activity feed events

### 2. Draft API (Server)

Create authenticated endpoints for current-user draft state.

```http
GET    /api/v1/cards/:cardId/drafts
PUT    /api/v1/cards/:cardId/drafts/description
PUT    /api/v1/cards/:cardId/drafts/comment
DELETE /api/v1/cards/:cardId/drafts/:type
```

#### Response conventions

- Success shape: `{ data: ... }`
- Error shape: `{ name: 'hyphenated-error-name', data?: ... }`

#### Access rules

- Caller must be authenticated and have access to the card
- Reads and writes are forcibly filtered by current `user_id`
- Any attempt to query another user's draft returns `404` (do not leak existence)

### 3. Local Offline Draft Store (Client)

Use IndexedDB as immediate local persistence for in-progress text.

- Persist description/comment draft text on debounce (for example, 400-800 ms)
- Key includes `userId + workspaceId + cardId + draftType`
- On app/card open, load local draft first for instant UX
- If online, reconcile with server draft and keep latest by `updated_at` (last-write-wins)

This extends the current offline queue foundation from Sprint 58, but for draft content, not only mutation replay.

### 4. Card Description Behavior

`CardDescriptionTiptap` draft flow:

- Typing updates local draft immediately
- If online, background sync updates server draft
- Draft remains private and is never visible to other users until saved to card
- If user closes modal/app without pressing Save, draft is preserved and restored later

When user presses **Save** while offline:

1. Keep draft as `save_pending`
2. Enqueue card description PATCH mutation
3. Show status: `Will save when back online`
4. On reconnect, replay queued PATCH
5. On success, clear description draft (local + server)

### 5. Comment Behavior

`CommentEditor` draft flow:

- Typing updates local draft immediately
- If online, background sync updates server draft
- Draft is private to current user until posted

When user presses **Comment** while offline:

1. Store draft as `submit_pending`
2. Enqueue comment create mutation with an idempotency key
3. Show status: `Will post when back online`
4. On reconnect, replay queued POST comment
5. On success, clear comment draft (local + server)

### 6. Cross-Device Continuity

Drafts must remain visible to the same user across devices/sessions:

- On login/open card, fetch server draft snapshot
- Merge local unsynced draft with server draft using latest update timestamp
- If one device goes offline, edits remain local until reconnect then sync upstream
- Another device logged in as same user should receive latest synced draft on refresh/open

### 7. Queue Replay and Conflict Handling

Replay behavior after reconnect:

- Replay in FIFO order per card
- Description save replay uses existing card patch route
- Comment submit replay uses existing comment create route

Conflict policy:

- If description replay hits conflict/validation error, keep draft and mark `sync_failed`
- UI shows recoverable state with actions: `Retry Save` and `Discard Draft`
- Comment replay failures keep `submit_pending` draft with `Retry Post`

### 8. UI States and UX Signals

Add explicit draft/sync states in card modal UI:

- `Draft saved locally`
- `Synced draft`
- `Will sync when online`
- `Sync failed - retry`

States appear in:
- Card description editor footer
- Comment editor footer

No draft content is rendered in the shared activity feed until comment is successfully posted.

---

## File Checklist

| File | Change |
|------|--------|
| `db/migrations/0083_user_card_drafts.ts` | New table + indexes for per-user card drafts |
| `server/extensions/offlineDrafts/api/index.ts` | New draft API routes |
| `server/extensions/offlineDrafts/mods/drafts.ts` | Draft upsert/get/delete service logic |
| `server/extensions/card/api/patch.ts` | Accept offline replay metadata for description save |
| `server/extensions/comment/api/create.ts` | Idempotent comment create replay support |
| `src/extensions/OfflineDrafts/api.ts` | Client draft API wrapper |
| `src/extensions/OfflineDrafts/storage.ts` | IndexedDB storage for local drafts |
| `src/extensions/OfflineDrafts/reconcile.ts` | Merge local/server drafts and conflict helpers |
| `src/extensions/Card/components/CardDescriptionTiptap.tsx` | Offline draft save + restore + status UI |
| `src/extensions/Comment/components/CommentEditor.tsx` | Offline draft save + queued submit + status UI |
| `src/extensions/Realtime/client/messageQueue.ts` | Queue metadata for draft save/post replay |

---

## Acceptance Criteria

- [ ] While offline, typing in card description persists locally and is restored after refresh
- [ ] While offline, typing in comment editor persists locally and is restored after refresh
- [ ] Unsaved description draft is visible only to the same user, never to other users
- [ ] Unposted comment draft is visible only to the same user, never to other users
- [ ] Same user logging in from another device can load the latest synced draft for description/comment
- [ ] Pressing Save on description while offline queues PATCH and applies it after reconnect
- [ ] Pressing Comment while offline queues POST and publishes after reconnect
- [ ] Successful replay clears the corresponding draft from local and server storage
- [ ] Replay failure keeps draft and shows retry action (no silent data loss)
- [ ] No duplicate comments are created during reconnect replay (idempotency enforced)

---

## Tests

```text
specs/tests/offline-description-draft-recovery.md
specs/tests/offline-comment-draft-recovery.md
specs/tests/offline-replay-save-and-comment.md
```

Test scenarios must verify:
- hard refresh while offline
- full logout/login cycle
- cross-device draft visibility for same user
- privacy between two different users on same card
- reconnect replay ordering and idempotent comment creation
