# Sprint 26 — Notifications for @Mentions

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 25 (@Mentions), Sprint 09 (Real-time infra), Sprint 20 (Real-time UI)  
> **References:** [requirements §5 — Collaboration](../architecture/requirements.md)

---

## Goal

Deliver an in-app notification system focused on `@mention` events. When a user is tagged in a card description or comment, they receive a real-time notification badge in the app header. Clicking the bell opens a notification panel listing recent mentions with links to the relevant card. Notifications can be individually marked as read or bulk-cleared.

---

## Scope

### 1. Database Migration

```
db/migrations/0017_notifications.ts
```

```sql
CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,          -- 'mention' (extensible)
  source_type  TEXT NOT NULL,          -- 'card_description' | 'comment'
  source_id    UUID NOT NULL,
  card_id      UUID REFERENCES cards(id) ON DELETE CASCADE,
  board_id     UUID REFERENCES boards(id) ON DELETE CASCADE,
  actor_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX notifications_user_unread_idx ON notifications (user_id, read, created_at DESC);
```

### 2. Server — Notification Creation (hooked from Sprint 25)

When `mention_created` events are emitted (Sprint 25, mention sync), for each new mentioned user:

1. Insert a row in `notifications` with `type = 'mention'`, `read = false`
2. Publish a real-time WS event to that user's personal channel `user:<userId>`:

```json
{
  "type": "notification_created",
  "payload": {
    "notification": {
      "id": "uuid",
      "type": "mention",
      "source_type": "comment",
      "source_id": "uuid",
      "card_id": "uuid",
      "board_id": "uuid",
      "actor": { "id": "uuid", "nickname": "jane_k", "avatar_url": "..." },
      "read": false,
      "created_at": "2026-03-03T10:00:00Z"
    }
  }
}
```

### 3. Server — Notification API

```
server/extensions/notifications/
  api/
    index.ts
    list.ts     # GET  /api/v1/notifications
    markRead.ts # PATCH /api/v1/notifications/:id/read
    markAllRead.ts # PATCH /api/v1/notifications/read-all
    delete.ts   # DELETE /api/v1/notifications/:id
```

#### `GET /api/v1/notifications`

Returns notifications for the authenticated user, most recent first.

Query params:
- `?unread=true` — only unread
- `?limit=20&cursor=<created_at>` — cursor pagination

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "mention",
      "source_type": "comment",
      "source_id": "uuid",
      "card_id": "uuid",
      "card_title": "Fix login bug",
      "board_id": "uuid",
      "board_title": "Q3 Roadmap",
      "actor": { "id": "uuid", "nickname": "jane_k", "name": "Jane Kim", "avatar_url": "..." },
      "read": false,
      "created_at": "2026-03-03T10:00:00Z"
    }
  ],
  "metadata": { "cursor": "2026-03-03T10:00:00Z", "hasMore": true }
}
```

#### `PATCH /api/v1/notifications/:id/read`

Sets `read = true` for a single notification owned by the current user.  
Returns `{ data: { id, read: true } }`.

#### `PATCH /api/v1/notifications/read-all`

Sets `read = true` for **all** notifications of the current user.  
Returns `{ data: { updated: <count> } }`.

#### `DELETE /api/v1/notifications/:id`

Deletes one notification owned by the current user.  
Returns `204 No Content`.

### 4. Server — Personal WebSocket Channel

```
server/extensions/realtime/
  userChannel.ts   # subscribe/publish helpers for user:<userId> channel
```

The existing WS infrastructure (Sprint 09) already supports arbitrary channel keys. `userChannel.ts` provides typed wrappers:
- `subscribeUserChannel(userId)` — called when a WS connection is established
- `publishToUser(userId, message)` — used by notification creation

The client subscribes to the user personal channel alongside the board channel.

### 5. Client — Notification Bell & Panel

```
src/extensions/Notification/
  components/
    NotificationBell.tsx      # bell icon with unread badge count
    NotificationPanel.tsx     # slide-in panel listing notifications
    NotificationItem.tsx      # single notification row
  containers/
    NotificationContainer.tsx # connects redux + WS, renders Bell + Panel
  hooks/
    useNotificationSync.ts    # listens to user WS channel for notification_created
  slices/
    notificationSlice.ts
  api/
    index.ts
```

#### `NotificationBell`

- Bell icon (`🔔`) in the `AppShell` top bar (desktop md+) or mobile topbar
- Red badge showing unread count (max `"99+"`)
- Badge hidden when count is 0
- Click → toggles `NotificationPanel`

Styling:
```
relative p-2 rounded-full hover:bg-slate-800 transition-colors
```
Badge: `absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1`

#### `NotificationPanel`

Slide-in from top-right (or full-width on mobile):

```
┌─────────────────────────────────────┐
│  Notifications          Mark all read│
├─────────────────────────────────────┤
│  ● jane_k mentioned you in          │
│    "Fix login bug" · Q3 Roadmap     │
│    2 min ago            [×]         │
├─────────────────────────────────────┤
│    alice mentioned you in           │
│    "Update README" · DevOps         │
│    1 hour ago           [×]         │
├─────────────────────────────────────┤
│         Load more                   │
└─────────────────────────────────────┘
```

Styling:
- Panel: `absolute right-0 top-12 w-[380px] max-h-[480px] overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50`
- Unread row: `bg-slate-800/60`; read row: no background
- Unread indicator dot: `w-2 h-2 rounded-full bg-indigo-400 shrink-0`

Clicking a notification:
1. Marks it as read (`PATCH /notifications/:id/read`)
2. Navigates to `/boards/:boardId?card=:cardId`
3. Closes the panel

#### `NotificationItem` actions:
- `[×]` button: `DELETE /notifications/:id`
- "Mark all read" header button: `PATCH /notifications/read-all`

#### `useNotificationSync`

Hooks into the existing WebSocket connection in `AppShell`:
- Listens for `notification_created` events on the user personal channel
- Dispatches `notificationSlice.actions.addNotification(notification)`

#### `notificationSlice`

```ts
interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  status: 'idle' | 'loading' | 'error';
  hasMore: boolean;
  cursor: string | null;
}
```

Thunks:
- `fetchNotificationsThunk` → `GET /notifications`
- `markReadThunk(id)` → `PATCH /notifications/:id/read`
- `markAllReadThunk` → `PATCH /notifications/read-all`
- `deleteNotificationThunk(id)` → `DELETE /notifications/:id`

Fetched on `AppShell` mount. New notifications arrive via WS and are prepended.

### 6. AppShell Integration

Update `AppShell.tsx`:
- Subscribe to `user:<userId>` WS channel on mount
- Render `<NotificationContainer />` in the desktop top-right area

### 7. Translations

```
src/extensions/Notification/translations/en.json
```

```json
{
  "Notifications.title": "Notifications",
  "Notifications.markAllRead": "Mark all read",
  "Notifications.empty": "You have no notifications.",
  "Notifications.mention": "{actor} mentioned you in \"{cardTitle}\"",
  "Notifications.loadMore": "Load more",
  "Notifications.deleteAriaLabel": "Dismiss notification"
}
```

---

## Data Model

```
notifications
├── id            UUID PK
├── user_id       UUID → users.id
├── type          TEXT ('mention')
├── source_type   TEXT ('card_description' | 'comment')
├── source_id     UUID
├── card_id       UUID → cards.id
├── board_id      UUID → boards.id
├── actor_id      UUID → users.id
├── read          BOOLEAN DEFAULT FALSE
└── created_at    TIMESTAMPTZ
```

---

## API Routes Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/notifications` | JWT | List notifications (paginated) |
| `PATCH` | `/api/v1/notifications/:id/read` | JWT | Mark one notification read |
| `PATCH` | `/api/v1/notifications/read-all` | JWT | Mark all notifications read |
| `DELETE` | `/api/v1/notifications/:id` | JWT | Delete one notification |

---

## Acceptance Criteria

- [ ] User A mentions User B in a comment → User B sees a red badge on the bell within ~1 s (real-time via WS)
- [ ] Opening the notification panel shows the mention with the card title and board name
- [ ] Clicking the notification navigates to the correct board and opens the card modal
- [ ] Clicking `[×]` removes the notification from the panel
- [ ] "Mark all read" clears the badge and dims all rows
- [ ] Badge does not show when there are 0 unread notifications
- [ ] Unread count cap: badge shows `99+` when count exceeds 99
- [ ] Notifications persist across page reload (fetched from server on mount)
- [ ] Deleting the mentioned comment does not cause an orphan notification error (cascade delete)
- [ ] Editing a card description to remove a mention does not create a new notification for that user

---

## Tests

```
specs/tests/
  notifications-mention.md     # E2E: user A comments @userB → userB sees badge → clicks → card opens
  notifications-mark-read.md   # E2E: mark all read → badge disappears
  notifications-realtime.md    # Playwright two tabs: mention created → badge appears without reload
```

---

## Files

```
db/migrations/0017_notifications.ts
server/extensions/notifications/api/index.ts
server/extensions/notifications/api/list.ts
server/extensions/notifications/api/markRead.ts
server/extensions/notifications/api/markAllRead.ts
server/extensions/notifications/api/delete.ts
server/extensions/realtime/userChannel.ts
server/extensions/comment/api/create.ts          (updated — publish notification)
server/extensions/comment/api/update.ts          (updated — publish notification)
server/extensions/card/api/update.ts             (updated — publish notification on description save)
src/extensions/Notification/components/NotificationBell.tsx
src/extensions/Notification/components/NotificationPanel.tsx
src/extensions/Notification/components/NotificationItem.tsx
src/extensions/Notification/containers/NotificationContainer.tsx
src/extensions/Notification/hooks/useNotificationSync.ts
src/extensions/Notification/slices/notificationSlice.ts
src/extensions/Notification/api/index.ts
src/extensions/Notification/translations/en.json
src/layout/AppShell.tsx                           (updated — bell + user channel subscription)
```
