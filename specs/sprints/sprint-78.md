# Sprint 78 — Board Members Table + Visibility Access Control (Server)

> **Status:** Future sprint — not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 04 (Workspace Lifecycle), Sprint 05 (Board Lifecycle), Sprint 46 (Board Schema Extensions — `visibility` column), Sprint 49 (Guest Role + `board_guest_access` table)
> **References:** [requirements §3 — Roles & Authorization](../architecture/requirements.md), [architecture — Board Visibility Rules](../architecture/architecture.md)

---

## Goal

Sprint 49 introduced the Guest role and `board_guest_access`. This sprint completes the server-side access control story by:

1. **`board_members` table** — records explicit per-board membership (role: `ADMIN` | `MEMBER` | `VIEWER`) for use with `PRIVATE` boards. The board creator is auto-inserted as board `ADMIN` on creation.
2. **Board visibility enforcement middleware** — gates every board-scoped route against the three visibility modes.
3. **Board member management API** — CRUD for explicit board members, callable by board ADMIN or workspace OWNER/ADMIN.
4. **Guest edit permissions** — correct alignment: Guests can view **and edit** (create/update cards) on their granted boards; they cannot change board settings or invite others.

---

## Scope

### 1. DB Migration — `0031_board_members.ts`

Create the `board_members` table:

```ts
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('board_members', (table) => {
    table.string('id').primary();
    table.string('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
    table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    // role: ADMIN can manage the board; MEMBER can edit; VIEWER is read-only
    table.enu('role', ['ADMIN', 'MEMBER', 'VIEWER']).notNullable().defaultTo('MEMBER');
    table.string('added_by').notNullable().references('id').inTable('users');
    table.timestamp('added_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['board_id', 'user_id']);
    table.index(['board_id']);
    table.index(['user_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('board_members');
}
```

---

### 2. Board Visibility Enforcement Middleware

**`server/middlewares/boardVisibility.ts`**

Applied to every board-scoped route. Injects `req.boardAccess` with the resolved access level.

#### Access matrix

| Caller | `PRIVATE` board | `WORKSPACE` board | `PUBLIC` board |
|---|---|---|---|
| Unauthenticated | ❌ 403 | ❌ 403 | ✅ read-only |
| Workspace OWNER | ✅ full access | ✅ full access | ✅ full access |
| Workspace ADMIN | ✅ full access | ✅ full access | ✅ full access |
| Workspace MEMBER with `board_members` row | ✅ per board role | ✅ full access | ✅ full access |
| Workspace MEMBER without `board_members` row | ❌ 403 | ✅ full access | ✅ full access |
| Workspace VIEWER with `board_members` row | ✅ read-only | ✅ read-only | ✅ read-only |
| Workspace VIEWER without `board_members` row | ❌ 403 | ✅ read-only | ✅ read-only |
| Workspace GUEST with `board_guest_access` row | ✅ edit (cards only) | N/A | N/A |
| Workspace GUEST without `board_guest_access` row | ❌ 403 | ❌ 403 | ✅ read-only |

**Key rules:**
- `PRIVATE`: board creator + workspace OWNER/ADMIN always have access. Everyone else requires an explicit `board_members` entry (or `board_guest_access` for GUESTs).
- `WORKSPACE`: all workspace members have access automatically — no `board_members` entry needed.
- `PUBLIC`: no authentication required for reads. Edits require `board_members` entry or OWNER/ADMIN role.
- Guests browsing the workspace API receive only boards where they have a `board_guest_access` row. The workspace member list endpoint must return `403 { name: 'guest-cannot-view-members' }` for GUEST callers.

**Apply the guard to:**
- `GET /api/v1/boards/:id`
- `GET /api/v1/boards/:id/lists`
- `GET /api/v1/boards/:id/activity`
- `GET /api/v1/boards/:id/comments` (Sprint 11)
- All card read/write endpoints scoped to a board
- All list read/write endpoints scoped to a board

**Route guard for workspace member list:**
- `GET /api/v1/workspaces/:id/members` — reject GUEST callers with `403 { name: 'guest-cannot-view-members' }`

---

### 3. Board Creation — Auto-Insert Creator as Board ADMIN

Update `server/extensions/board/api/create.ts`:

After inserting the board row, always insert the creator into `board_members` with role `ADMIN`:

```ts
await db('board_members').insert({
  id: createId(),
  board_id: board.id,
  user_id: req.user.id,
  role: 'ADMIN',
  added_by: req.user.id,
});
```

This ensures the creator retains access even on `PRIVATE` boards and can manage other members.

---

### 4. Board Member Management API

**`server/extensions/board/api/members/`**

All endpoints require the caller to be a workspace OWNER, workspace ADMIN, or a board ADMIN.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/boards/:id/members` | List all explicit board members |
| `POST` | `/api/v1/boards/:id/members` | Add a workspace member to the board |
| `PATCH` | `/api/v1/boards/:id/members/:userId` | Change a board member's role |
| `DELETE` | `/api/v1/boards/:id/members/:userId` | Remove a board member |

**`POST` body** — provide one of `userId`, `email`, or `username`; server resolves to a user and validates workspace membership:
```ts
{ userId?: string; email?: string; username?: string; role: 'ADMIN' | 'MEMBER' | 'VIEWER' }
```

Similarly, `POST /api/v1/boards/:id/guests` (Sprint 49) accepts `{ userId?, email?, username? }` — server resolves identifier to a user, creates a stub account if only an email is supplied and no matching user exists.

**Rules:**
- The user being added must already be a workspace member (OWNER/ADMIN/MEMBER/VIEWER) — guests use the existing `POST /boards/:id/guests` endpoint from Sprint 49.
- Cannot remove the last ADMIN from a board.
- Cannot change your own role if you are the only ADMIN.
- Returns `{ data: { id, boardId, userId, role, addedAt } }`.

**Error names:**
- `board-member-not-found`
- `user-not-workspace-member` — when trying to add a non-member of the workspace
- `cannot-remove-last-admin`
- `insufficient-permissions`

---

### 5. Updated Workspace Boards List — Filter by Visibility for Guests

Update `GET /api/v1/workspaces/:id/boards`:

- For GUEST callers: return only boards where `board_guest_access.user_id = req.user.id`
- For MEMBER/VIEWER callers: return `WORKSPACE` + `PUBLIC` boards + any `PRIVATE` boards where they have a `board_members` row
- For ADMIN/OWNER: return all boards

---

## Acceptance Criteria

- [ ] `board_members` table created by migration `0031_board_members.ts`
- [ ] Board creator is auto-inserted as board `ADMIN` in `board_members` on creation
- [ ] `PRIVATE` board returns `403` for workspace MEMBER with no `board_members` row
- [ ] `PRIVATE` board is accessible to workspace OWNER/ADMIN without a `board_members` row
- [ ] `WORKSPACE` board accessible to all workspace members without explicit `board_members` row
- [ ] `PUBLIC` board accessible unauthenticated (read) and to board members (edit)
- [ ] GUEST sees only their granted boards in workspace boards list
- [ ] GUEST gets `403` on workspace member list
- [ ] Board member CRUD API works correctly with role enforcement
- [ ] Last ADMIN cannot be removed
