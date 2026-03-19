# Sprint 89 — Guest Role Split: VIEWER vs MEMBER

> **Status:** Future sprint - not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 49 (Guest Role + Board Visibility), Sprint 80 (Guest Experience UI)
> **References:** [requirements.md](../architecture/requirements.md)

---

## Goal

The current `GUEST` role is read-only (view only). This sprint splits the guest concept into two distinct types scoped to a specific board:

- **`VIEWER`** — read-only access; same behaviour as the original `GUEST` role
- **`MEMBER`** — full write/participate access within the board (create/edit cards, comment, assign members), but **no organisation-level access** (cannot see other boards, workspace settings, or member roster)

The separation is stored on `board_guest_access` as a `guest_type` column. The workspace-level `membership_role` enum value remains `GUEST` — the sub-type is purely board-scoped.

---

## Scope

### 1. DB — Migration

**File:** `db/migrations/0039_guest_role_type.ts`

```ts
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add guest_type column to board_guest_access
  // VIEWER = read-only (preserves original GUEST behaviour)
  // MEMBER = full write access within board scope only
  await knex.schema.alterTable('board_guest_access', (table) => {
    table
      .enu('guest_type', ['VIEWER', 'MEMBER'])
      .notNullable()
      .defaultTo('VIEWER'); // all existing guests default to read-only
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('board_guest_access', (table) => {
    table.dropColumn('guest_type');
  });
}
```

---

### 2. Server — Permission Matrix

| Action | GUEST + VIEWER | GUEST + MEMBER |
|---|---|---|
| View board | ✅ | ✅ |
| View cards / lists | ✅ | ✅ |
| Create / edit / move cards | ❌ | ✅ |
| Add / remove card labels | ❌ | ✅ |
| Assign members to cards | ❌ | ✅ |
| Post comments | ❌ | ✅ |
| Upload attachments | ❌ | ✅ |
| Close / reopen cards | ❌ | ✅ |
| Invite other members/guests | ❌ | ❌ |
| Modify board settings | ❌ | ❌ |
| View workspace member roster | ❌ | ❌ |
| Access other boards | ❌ | ❌ |

`GUEST + VIEWER` mutations must return `403 { name: "guest-viewer-insufficient-permissions" }`.  
Workspace-level actions attempted by any `GUEST` (VIEWER or MEMBER) return `403 { name: "guest-role-no-org-access" }`.

---

### 3. Server — Types

**File:** `server/extensions/board/types.ts`

```ts
export type GuestType = 'VIEWER' | 'MEMBER';

export interface BoardGuestAccess {
  id: string;
  user_id: string;
  board_id: string;
  guest_type: GuestType;
  granted_at: string;
  granted_by: string;
}
```

---

### 4. Server — Permission Helper

**File:** `server/extensions/board/mods/guestPermissions.ts`

```ts
import type { GuestType } from '../types';

// Returns true if a GUEST with the given type can perform write operations on the board.
export const guestCanWrite = (guestType: GuestType): boolean =>
  guestType === 'MEMBER';

// Returns the correct 403 error name for a denied guest action.
export const guestDeniedError = (guestType: GuestType) =>
  guestType === 'VIEWER'
    ? 'guest-viewer-insufficient-permissions'
    : 'guest-role-no-org-access';
```

---

### 5. Server — Middleware Update

**File:** `server/middlewares/boardVisibility.ts`

Extend existing board access middleware to resolve `guest_type` from `board_guest_access` and attach it to `req.guestType`. Downstream route handlers use `guestCanWrite(req.guestType)` to gate mutations.

```ts
// Attach to req when caller is a GUEST:
req.guestType = row.guest_type; // 'VIEWER' | 'MEMBER'
```

---

### 6. Server — API Changes

#### 6a. Invite endpoint — accept `guest_type`

`POST /api/v1/boards/:id/guests`

Request body:

```json
{
  "userId": "...",
  "guestType": "VIEWER" | "MEMBER"
}
```

Default to `"VIEWER"` when `guestType` is omitted.

#### 6b. Update guest type

`PATCH /api/v1/boards/:id/guests/:userId`

```json
{ "guestType": "VIEWER" | "MEMBER" }
```

Only ADMIN+ workspace members may promote a guest from VIEWER to MEMBER or vice versa.

#### 6c. List guests — include `guest_type`

`GET /api/v1/boards/:id/guests`

Response shape:

```json
{
  "data": [
    {
      "userId": "...",
      "guestType": "VIEWER",
      "grantedAt": "...",
      "grantedBy": "..."
    }
  ]
}
```

---

### 7. Client — Guest Invite Modal

**File:** `src/extensions/GuestInvite/components/GuestInviteModal.tsx` (or existing invite modal)

- Add a **Guest type** toggle/radio group: `Viewer` / `Member`
- Default selection: `Viewer`
- Persist selection with the invite request body as `guestType`

---

### 8. Client — Guest Management Panel

**File:** `src/extensions/BoardSettings/components/GuestList.tsx` (or existing guest list)

- Display `guest_type` badge next to each guest: `VIEWER` or `MEMBER`
- Allow ADMIN+ to change a guest's type via inline dropdown → calls `PATCH /api/v1/boards/:id/guests/:userId`

---

### 9. Client — Permission Guards

**File:** `src/extensions/Board/mods/guestPermissions.ts`

```ts
// Centralise client-side guest permission checks so UI elements are hidden for VIEWER guests.
export const canBoardGuestWrite = (guestType: 'VIEWER' | 'MEMBER' | null): boolean =>
  guestType === 'MEMBER';
```

Apply guards to:
- Card create button / drag-to-create
- Comment input
- Attachment upload button
- Card edit pencil / inline edit
- Assign member button on card

---

## File Checklist

| File | Change |
|------|--------|
| `db/migrations/0039_guest_role_type.ts` | Add `guest_type` column to `board_guest_access` |
| `server/extensions/board/types.ts` | Add `GuestType`, update `BoardGuestAccess` |
| `server/extensions/board/mods/guestPermissions.ts` | New — `guestCanWrite`, `guestDeniedError` helpers |
| `server/middlewares/boardVisibility.ts` | Attach `req.guestType` from `board_guest_access` |
| `server/extensions/board/api/inviteGuest.ts` | Accept + validate `guestType` in POST body |
| `server/extensions/board/api/updateGuest.ts` | New — PATCH to change `guest_type` |
| `server/extensions/board/api/listGuests.ts` | Include `guest_type` in response |
| `src/extensions/GuestInvite/components/GuestInviteModal.tsx` | Add Viewer / Member toggle |
| `src/extensions/BoardSettings/components/GuestList.tsx` | Show type badge + inline type change |
| `src/extensions/Board/mods/guestPermissions.ts` | New — client-side write-permission check |
| `specs/tests/guest-role-split.md` | Test scenarios for VIEWER and MEMBER guest flows |

---

## Acceptance Criteria

- [ ] `board_guest_access` table has a non-nullable `guest_type` column defaulting to `VIEWER`
- [ ] Existing guest rows are migrated to `VIEWER` without data loss
- [ ] `GUEST + VIEWER` cannot create/edit cards, comment, or upload — returns `403 guest-viewer-insufficient-permissions`
- [ ] `GUEST + MEMBER` can create/edit cards, comment, and upload within the board
- [ ] `GUEST + MEMBER` cannot invite members, change board settings, or access other boards
- [ ] `POST /boards/:id/guests` accepts `guestType`; defaults to `VIEWER` when omitted
- [ ] `PATCH /boards/:id/guests/:userId` updates `guest_type`; only ADMIN+ may call it
- [ ] `GET /boards/:id/guests` returns `guestType` per entry
- [ ] Guest invite modal shows Viewer / Member selection
- [ ] Board settings guest list displays type badge and allows ADMIN+ to change it
- [ ] Client permission guards hide write-action UI for VIEWER guests
