# Sprint 95 — Board-scoped Notification Preferences

> **Status:** Planned
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 70 (notification preferences), Sprint 73 (notification types)
> **References:** `server/extensions/notifications/`, `src/extensions/Notification/`, `src/extensions/Board/containers/BoardSettings/`

---

## Problem

Notifications are currently dispatched to **all workspace members** regardless of whether they are on the board where activity happens. This creates noise for users who are members of many boards and only want updates from boards they actively work on.

Two levels of control are needed:

1. **Per-board "User settings"** — A user can enable/disable notifications for a specific board from inside the board's settings panel (tri-dot menu → "Board settings" → "User settings" section).
2. **Global notification setting** — In the user's own profile settings (tri-dot avatar menu → "Settings"), a master toggle that mutes all board notifications regardless of per-board configuration.

---

## Scope

### Iteration 1 — DB: board notification preferences + user global setting

**New migration `0086_board_notification_preferences.ts`**

```ts
// board_notification_preferences
// (user_id, board_id) unique — opt-out model, missing row = notifications ON
table.string('id').primary()
table.string('user_id') → users.id CASCADE
table.string('board_id') → boards.id CASCADE
table.boolean('notifications_enabled').notNullable().defaultTo(true)
table.timestamp('updated_at')
UNIQUE (user_id, board_id)
```

**New migration `0087_user_notification_settings.ts`**

```ts
// user_notification_settings
// One row per user, opt-out model, missing row = global notifications ON
table.string('user_id').primary() → users.id CASCADE
table.boolean('global_notifications_enabled').notNullable().defaultTo(true)
table.timestamp('updated_at')
```

---

### Iteration 2 — Server: fix dispatch to board members + preference guards

**Files to change:**
- `server/extensions/notifications/mods/boardActivityDispatch.ts`
  - Replace workspace-members query with board-members query (join `board_members` table added in `0040_board_members.ts`)
  - After fetching recipients, filter out users who have disabled notifications for this board (`board_notification_preferences.notifications_enabled = false`)
  - Filter out users who have global notifications disabled (`user_notification_settings.global_notifications_enabled = false`)

**New file: `server/extensions/notifications/mods/boardPreferenceGuard.ts`**
```ts
// Returns true if the user has board-level notifications enabled (opt-out model)
export async function boardPreferenceGuard({ userId, boardId }): Promise<boolean>
```

**New file: `server/extensions/notifications/mods/globalPreferenceGuard.ts`**
```ts
// Returns true if the user's global notifications are enabled (opt-out model)
export async function globalPreferenceGuard({ userId }): Promise<boolean>
```

---

### Iteration 3 — Server API: board notification preference endpoints

**New files under `server/extensions/notifications/api/boardPreference/`:**

```
GET  /api/boards/:boardId/notification-preference
     → { data: { notifications_enabled: boolean } }

PATCH /api/boards/:boardId/notification-preference
      body: { notifications_enabled: boolean }
      → { data: { notifications_enabled: boolean } }
```

- Requires authentication (`requireAuth` middleware)
- Requires the user to be a board member (`requireBoardAccess`)
- Upsert into `board_notification_preferences`

Register routes in `server/extensions/notifications/api/index.ts` (or board api index).

---

### Iteration 4 — Client: "User settings" section in Board Settings

**Files to change:**
- `src/extensions/Board/containers/BoardSettings/BoardSettings.tsx`
  - Add a "User settings" collapsible section below the existing settings sections
  - Contains a single toggle: "Notifications for this board"
  - Calls `GET /api/boards/:boardId/notification-preference` on mount to get current state
  - `PATCH` on toggle change with optimistic update

**New file: `src/extensions/Board/containers/BoardSettings/BoardNotificationToggle.tsx`**
- Self-contained component that owns fetch/mutate logic
- Uses `apiClient` directly (no new Redux slice needed — local state is sufficient)
- Shows a loading spinner while fetching initial state
- Shows inline error on failure

**Translation key** in `src/extensions/Board/translations/en.json` (or create if missing):
```json
{
  "BoardSettings.userSettingsTitle": "User settings",
  "BoardSettings.notificationsToggleLabel": "Notifications for this board",
  "BoardSettings.notificationsToggleDescription": "Receive notifications for activity on this board"
}
```

---

### Iteration 5 — Server + Client: global notification setting

**Server new files:**
- `server/extensions/notifications/api/globalPreference/get.ts`
- `server/extensions/notifications/api/globalPreference/update.ts`
- `server/extensions/notifications/api/globalPreference/index.ts`

```
GET  /api/user/notification-settings
     → { data: { global_notifications_enabled: boolean } }

PATCH /api/user/notification-settings
      body: { global_notifications_enabled: boolean }
      → { data: { global_notifications_enabled: boolean } }
```

Registered in `server/extensions/notifications/api/index.ts`.

**Client changes:**
- Find the user profile/settings page (tri-dot avatar → "Settings")
- Add a "Notifications" section with a master toggle: "Enable notifications"
- Description: "When off, you will not receive any in-app notifications from any board"
- Calls the global preference API

---

### Iteration 6 — Playwright MCP tests

Write tests as Markdown files in `specs/tests/` (Playwright MCP format, not code):

**`specs/tests/board-notification-preference.md`**
1. Log in, open a board, open board settings (tri-dot → "Board settings")
2. Verify "User settings" section is visible with a notifications toggle defaulting to ON
3. Toggle OFF — verify toggle flips; reload page; verify toggle is still OFF
4. Toggle back ON — verify toggle flips

**`specs/tests/global-notification-setting.md`**
1. Log in, open profile settings (avatar menu → "Settings")
2. Verify "Notifications" section with master toggle defaulting to ON
3. Toggle OFF — verify toggle flips; reload; verify still OFF
4. Trigger board activity (create a card); verify no in-app notification appears
5. Toggle back ON
