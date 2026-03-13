# Sprint 70 — Notification Preferences: DB + API

> **Status:** Future sprint — not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 26 (Mention Notifications), Sprint 23 (Email / SES)

---

## Goal

Give users granular control over which notifications they receive and via which channels. A `notification_preferences` table stores one row per user per notification type, with independent `in_app_enabled` and `email_enabled` flags. The existing notification dispatch pipeline (Sprint 26) is updated to consult preferences before creating a notification or sending an email.

---

## Notification Types

| Type | Trigger |
|---|---|
| `mention` | User is @mentioned in a card description or comment |
| `card_created` | A card is created in any board the user is a member of |
| `card_moved` | A card is moved to a different list in any board the user is a member of |
| `card_commented` | A comment is posted on any board the user is a member of |

---

## Scope

### 1. Database Migration

**`db/migrations/0031_notification_preferences.ts`**

```sql
CREATE TABLE notification_preferences (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,          -- 'mention' | 'card_created' | 'card_moved' | 'card_commented'
  in_app_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, type)
);

CREATE INDEX notification_preferences_user_idx ON notification_preferences (user_id);
```

**Default behaviour:** rows are created on first update only. If no row exists for a `(user_id, type)` pair the consumer treats both channels as enabled (opt-out model).

---

### 2. Server — Preferences API

```
server/extensions/notifications/api/
  preferences/
    index.ts       # mounts GET + PATCH routes
    get.ts         # GET  /api/v1/notifications/preferences
    update.ts      # PATCH /api/v1/notifications/preferences
```

#### `GET /api/v1/notifications/preferences`

Returns the full preference matrix for the authenticated user. Missing rows are represented with defaults.

**Response:**

```json
{
  "data": [
    { "type": "mention",        "in_app_enabled": true,  "email_enabled": true  },
    { "type": "card_created",   "in_app_enabled": true,  "email_enabled": false },
    { "type": "card_moved",     "in_app_enabled": true,  "email_enabled": false },
    { "type": "card_commented", "in_app_enabled": true,  "email_enabled": true  }
  ]
}
```

#### `PATCH /api/v1/notifications/preferences`

Upserts preferences for one or more types in a single request.

**Request body:**

```ts
interface UpdatePreferencesBody {
  preferences: Array<{
    type: 'mention' | 'card_created' | 'card_moved' | 'card_commented';
    in_app_enabled?: boolean;
    email_enabled?: boolean;
  }>;
}
```

Uses PostgreSQL `INSERT ... ON CONFLICT (user_id, type) DO UPDATE`.

**Response:** updated full matrix (same shape as GET).

---

### 3. Preference Guard Helper

**`server/extensions/notifications/mods/preferenceGuard.ts`**

```ts
// Returns effective preference for a given user + type.
// Falls back to { in_app_enabled: true, email_enabled: true } when no row exists.
async function getPreference({
  userId,
  type,
}: {
  userId: string;
  type: NotificationType;
}): Promise<{ in_app_enabled: boolean; email_enabled: boolean }>
```

Called by the notification dispatch pipeline before:
1. Inserting a `notifications` row (in-app)
2. Dispatching a SES email (email)

---

### 4. Update `server/extensions/notifications/` Dispatch

Wherever a notification is created (currently: Sprint 26 mention hook), wrap the creation with a preference check:

```ts
const pref = await getPreference({ userId, type: 'mention' });
if (pref.in_app_enabled) {
  await createNotification({ ... });
  await pubsub.publish(`user:${userId}`, { type: 'notification_created', payload: ... });
}
// email dispatch done in Sprint 72 — gated by pref.email_enabled
```

---

### 5. `NOTIFICATION_PREFERENCES_ENABLED` Feature Flag

Added to `server/mods/flags/providers/defaults.ts`:

```ts
NOTIFICATION_PREFERENCES_ENABLED: true
```

When `false`, the preference guard always returns `{ in_app_enabled: true, email_enabled: true }` (all channels enabled for everyone — maintains backward-compat with Sprint 26 behaviour).

---

## Files

| Path | Change |
|---|---|
| `db/migrations/0031_notification_preferences.ts` | New migration |
| `server/extensions/notifications/api/preferences/index.ts` | New route file |
| `server/extensions/notifications/api/preferences/get.ts` | GET preferences |
| `server/extensions/notifications/api/preferences/update.ts` | PATCH preferences |
| `server/extensions/notifications/mods/preferenceGuard.ts` | New — preference lookup helper |
| `server/extensions/notifications/api/index.ts` | Mount preferences sub-routes |
| `server/mods/flags/providers/defaults.ts` | Add `NOTIFICATION_PREFERENCES_ENABLED` |
| `server/config/env.ts` | Expose new flag |

---

## Acceptance Criteria

- [ ] `GET /api/v1/notifications/preferences` returns all 4 types with defaults for a brand-new user
- [ ] `PATCH /api/v1/notifications/preferences` correctly upserts and returns the updated matrix
- [ ] Disabling `in_app_enabled` for `mention` prevents notification row insertion and WS event
- [ ] When `NOTIFICATION_PREFERENCES_ENABLED=false`, all channels remain enabled regardless of rows in DB
- [ ] API requires authentication; unauthenticated requests return 401
