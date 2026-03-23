# Sprint 100 — Board-Level Per-Type Notification Preferences

> **Status:** Planned
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 95 (Board-scoped Notification Preferences — global toggle), Sprint 96 (Profile Notifications Tab), Sprint 97 (New Notification Types)

---

## Goal

Sprint 95 introduced a per-board global on/off toggle (`board_notification_preferences.notifications_enabled`). This is insufficient: a user may want notifications from a board, but only for specific types. For example, they may want to know about `@mention` and `card_commented` events on a noisy board, but mute `card_updated` and `card_created`.

This sprint adds **per-type notification overrides at board level**. Board-level preferences act as a **refinement on top of the user's master config**:

```
Notify recipient?
  1. Global toggle OFF (Sprint 95)         → skip (silence everything)
  2. Board global toggle OFF (Sprint 95)   → skip (silence this board)
  3. Board per-type override exists        → use board-level in_app_enabled / email_enabled
  4. User-level preference exists          → use user-level in_app_enabled / email_enabled
  5. No preference row                     → treat as enabled (opt-out model)
```

---

## Acceptance Criteria

- [ ] DB table `board_notification_type_preferences` stores per-user, per-board, per-type channel preferences
- [ ] `GET /api/v1/boards/:boardId/notification-preferences/types` returns all types with resolved values for the current user
- [ ] `PATCH /api/v1/boards/:boardId/notification-preferences/types` upserts a single type row
- [ ] Server dispatch honours board-level type overrides before falling back to user-level
- [ ] Board settings "User settings" section shows a per-type toggle matrix (same shape as profile settings, scoped to this board)
- [ ] All 9 notification types are listed in the board-settings matrix
- [ ] "Reset to defaults" action removes all board-level type overrides for the current user on this board (falls back to user master config)

---

## Scope

### 1. DB Migration `0092_board_notification_type_preferences.ts`

```ts
await knex.schema.createTable('board_notification_type_preferences', (table) => {
  table.string('id').primary();
  table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
  table.string('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
  table.text('type').notNullable(); // same CHECK as notification_preferences
  table.boolean('in_app_enabled').notNullable().defaultTo(true);
  table.boolean('email_enabled').notNullable().defaultTo(true);
  table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  table.unique(['user_id', 'board_id', 'type']);
  table.index(['user_id', 'board_id']);
});

// Same type CHECK as notifications / notification_preferences tables.
await knex.raw(`
  ALTER TABLE board_notification_type_preferences
    ADD CONSTRAINT board_notification_type_prefs_type_check
    CHECK (${CHECK_EXPR});
`);
```

---

### 2. Server — Board Type Preferences API

**`server/extensions/notifications/api/boardTypePreferences/`**

```
boardTypePreferences/
  index.ts     # mounts GET + PATCH + DELETE routes
  get.ts       # GET  /api/v1/boards/:boardId/notification-preferences/types
  update.ts    # PATCH /api/v1/boards/:boardId/notification-preferences/types
  reset.ts     # DELETE /api/v1/boards/:boardId/notification-preferences/types  (reset all)
```

#### `GET /api/v1/boards/:boardId/notification-preferences/types`

Returns **resolved** preferences for the authenticated user. For each notification type, the response merges the board-level row (if any) with the user-level row (fallback):

```ts
// Response
{
  data: [
    {
      type: 'mention',
      in_app_enabled: true,
      email_enabled: false,
      source: 'board' | 'user' | 'default'
      // 'source' tells the UI whether this value comes from a board override,
      // the user master config, or the default (no row exists).
    },
    ...
  ]
}
```

The `source` field allows the UI to visually indicate which values are board-level overrides vs inherited.

#### `PATCH /api/v1/boards/:boardId/notification-preferences/types`

Body:
```ts
{ type: NotificationType; in_app_enabled?: boolean; email_enabled?: boolean }
```

Upserts a row in `board_notification_type_preferences`. Returns the updated array (same shape as GET).

#### `DELETE /api/v1/boards/:boardId/notification-preferences/types`

Deletes **all** `board_notification_type_preferences` rows for `(user_id, board_id)`. This resets the board to inherit from master config.

---

### 3. Server — Dispatch: honour board-level type overrides

**`server/extensions/notifications/mods/boardPreferenceGuard.ts`**

Extend (or create) per-type check logic:

```ts
/**
 * Returns the effective in_app_enabled / email_enabled for a given
 * (userId, boardId, type) triple, applying the override cascade:
 * board-type-pref → user-type-pref → default (true).
 */
export async function resolveNotificationChannels({
  userId,
  boardId,
  type,
}: {
  userId: string;
  boardId: string;
  type: string;
}): Promise<{ inApp: boolean; email: boolean }>
```

Call this function inside `boardActivityDispatch` for each recipient, replacing the current flat preference lookup.

---

### 4. Client — RTK Query slice

**`src/extensions/Notifications/NotificationPreferences/boardNotificationTypePreferences.slice.ts`**

```ts
export const boardNotificationTypePreferencesApi = createApi({
  reducerPath: 'boardNotificationTypePreferencesApi',
  baseQuery: fetchBaseQuery({ ... }),
  tagTypes: ['BoardNotificationTypePreferences'],
  endpoints: (builder) => ({
    getBoardTypePreferences: builder.query<ResolvedTypePreference[], { boardId: string }>({
      query: ({ boardId }) => `/boards/${boardId}/notification-preferences/types`,
      transformResponse: (res: { data: ResolvedTypePreference[] }) => res.data,
      providesTags: ['BoardNotificationTypePreferences'],
    }),
    updateBoardTypePreference: builder.mutation<...>({ ... }),
    resetBoardTypePreferences: builder.mutation<...>({ ... }),
  }),
});
```

---

### 5. Client — `BoardNotificationTypePreferences.tsx` component

**`src/extensions/Board/containers/BoardSettings/BoardNotificationTypePreferences.tsx`**

A toggle matrix rendered inside the board settings "User settings" section, below the existing global `BoardNotificationToggle`.

Layout:
```
Board notification preferences       [Reset to defaults]

 Notification       In-App    Email
 ─────────────────────────────────
 @Mentions          [●]       [○]
 Card created       [●]       [●]
 Card moved         [●]       [●]
 Card commented     [●]       [○]
 ...
```

- Values that come from `source: 'board'` show an indigo ring on the toggle (indicating a board-level override is set)  
- Values from `source: 'user'` or `source: 'default'` appear in the muted default style  
- Email column disabled when `SES_ENABLED=false` or `EMAIL_NOTIFICATIONS_ENABLED=false`
- "Reset to defaults" button calls `resetBoardTypePreferences` mutation + invalidates tags

**Integration into `BoardSettings.tsx`:**

```tsx
{/* User settings */}
<div className="border-t border-slate-700 pt-4">
  <div className="flex items-center gap-2 mb-3">
    <UserCircleIcon className="h-4 w-4 shrink-0 text-slate-400" />
    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
      User settings
    </h3>
  </div>
  {boardId && (
    <>
      <BoardNotificationToggle boardId={boardId} />
      <div className="mt-4">
        <BoardNotificationTypePreferences boardId={boardId} />
      </div>
    </>
  )}
</div>
```

---

### 6. Translations

**`src/extensions/Board/translations/en.json`**

```json
{
  "BoardSettings.notificationTypePreferences": "Board notification preferences",
  "BoardSettings.notificationTypePreferencesReset": "Reset to defaults",
  "BoardSettings.notificationTypePreferencesResetConfirm": "Reset board overrides?",
  "BoardSettings.notificationTypePreferencesSource.board": "Board override",
  "BoardSettings.notificationTypePreferencesSource.user": "From master config",
  "BoardSettings.notificationTypePreferencesSource.default": "Default (enabled)"
}
```

---

## File Checklist

| File | Change |
|------|--------|
| `db/migrations/0092_board_notification_type_preferences.ts` | New migration |
| `server/extensions/notifications/api/boardTypePreferences/index.ts` | Mount GET + PATCH + DELETE |
| `server/extensions/notifications/api/boardTypePreferences/get.ts` | Resolved preferences GET |
| `server/extensions/notifications/api/boardTypePreferences/update.ts` | Upsert PATCH |
| `server/extensions/notifications/api/boardTypePreferences/reset.ts` | DELETE all for (user, board) |
| `server/extensions/notifications/mods/boardPreferenceGuard.ts` | `resolveNotificationChannels` — override cascade |
| `server/extensions/notifications/mods/boardActivityDispatch.ts` | Use `resolveNotificationChannels` per recipient |
| `src/extensions/Notifications/NotificationPreferences/boardNotificationTypePreferences.slice.ts` | New RTK Query slice |
| `src/extensions/Board/containers/BoardSettings/BoardNotificationTypePreferences.tsx` | New component |
| `src/extensions/Board/containers/BoardSettings/BoardSettings.tsx` | Mount `BoardNotificationTypePreferences` |
| `src/extensions/Board/translations/en.json` | Add translation keys |

---

## Tests

| ID | Scenario | Expected |
|----|----------|---------|
| T1 | User sets board override `card_updated` in-app off | `resolveNotificationChannels` returns `inApp: false` even if user master says on |
| T2 | No board override row exists for type | Falls back to user-level preference |
| T3 | No user row and no board row | Returns `{ inApp: true, email: true }` (opt-out default) |
| T4 | GET endpoint returns `source: 'board'` for overridden types | Correct |
| T5 | DELETE (reset) endpoint | All board rows removed; GET returns `source: 'user'` or `'default'` |
| T6 | Global toggle OFF + board-type-pref ON | Notification still skipped (global takes precedence) |
| T7 | Board global toggle OFF + board-type-pref ON | Notification still skipped (board global takes precedence) |
| T8 | Board settings UI — toggle fires PATCH | Optimistic update + API call |
| T9 | Board override toggle shows indigo ring | Visual indicator of board-level override |
