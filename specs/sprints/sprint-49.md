# Sprint 49 — Guest Role + Board Visibility Access Control

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 04 (Workspace Lifecycle), Sprint 05 (Board Lifecycle), Sprint 46 (Board Schema Extensions — `visibility` column)  
> **References:** [requirements §3 — Roles & Authorization](../architecture/requirements.md)

---

## Goal

Two access-control gaps are closed in this sprint:

1. **Guest role** — a fifth workspace membership level (`GUEST`) that grants scoped read access to specific boards without full workspace membership
2. **Board visibility enforcement** — the `visibility` column added in Sprint 46 is wired into every board access check so that `PRIVATE`, `WORKSPACE`, and `PUBLIC` boards are protected correctly

---

## Scope

### 1. Guest Role

#### 1a. DB migration — `0030_guest_role.ts`

Update the `membership_role` enum to add `GUEST`:

```ts
// Extend enum: OWNER | ADMIN | MEMBER | VIEWER | GUEST
await knex.schema.alterTable('memberships', (table) => {
  table.enu('role', ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'GUEST']).notNullable().alter();
});
```

#### 1b. `board_guest_access` join table

A guest is granted access to explicit boards rather than the entire workspace:

```ts
table.uuid('id').primary();
table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
table.uuid('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
table.timestamp('granted_at').notNullable().defaultTo(knex.fn.now());
table.uuid('granted_by').notNullable().references('id').inTable('users');
table.unique(['user_id', 'board_id']);
```

#### 1c. Guest permissions

| Action | GUEST |
|---|---|
| View board | ✅ (if in `board_guest_access`) |
| View cards | ✅ |
| Create / edit cards | ❌ |
| Comment | ❌ |
| Invite members | ❌ |
| Modify board settings | ❌ |

Guest access is entirely read-only. All mutation endpoints must reject `GUEST` role with `403 { name: "guest-role-insufficient-permissions" }`.

#### 1d. Guest invite API

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/boards/:id/guests` | Invite a user as a guest to a specific board (ADMIN+ only) |
| `DELETE` | `/api/v1/boards/:id/guests/:userId` | Revoke guest access |
| `GET` | `/api/v1/boards/:id/guests` | List current board guests |

---

### 2. Board Visibility Enforcement

#### 2a. Access rules

| `visibility` | Who can access |
|---|---|
| `PRIVATE` | Only workspace members who are also explicitly board members (`board_members` table) |
| `WORKSPACE` | Any workspace member (current default behaviour — no change needed) |
| `PUBLIC` | Anyone with the board URL — **no authentication required** |

#### 2b. Middleware guard

Create `server/middlewares/boardVisibility.ts` — a per-request guard applied to all board-scoped routes:

```ts
// Resolves board visibility and injects `req.boardAccess` with access level
// Throws 403 for PRIVATE boards unless caller is a board member
// Allows unauthenticated access for PUBLIC boards
```

Apply the guard to:
- `GET /api/v1/boards/:id`
- `GET /api/v1/boards/:id/lists`
- `GET /api/v1/boards/:id/activity`
- `GET /api/v1/boards/:id/comments`
- All card read endpoints scoped to a board

#### 2c. Share link for PUBLIC boards

`GET /api/v1/boards/:id` for a `PUBLIC` board must not require an `Authorization` header. The route guard falls through to allow when visibility is `PUBLIC`.

---

### 3. Board Settings UI — Visibility Selector

In the board settings panel (`src/extensions/BoardSettings/` or equivalent):

- Add a **Visibility** radio group: Private / Workspace / Public
- `PATCH /api/v1/boards/:id` with `{ "visibility": "..." }` on change

---

## Acceptance Criteria

- [ ] `memberships.role` enum includes `GUEST`
- [ ] `board_guest_access` table exists and is referenced in access checks
- [ ] Guest users can view assigned boards but all mutation endpoints return `403`
- [ ] `POST /boards/:id/guests` grants guest access; `DELETE` revokes it
- [ ] `PRIVATE` board returns `403` for workspace members not in `board_members`
- [ ] `PUBLIC` board is accessible without authentication
- [ ] `WORKSPACE` board behaviour is unchanged for existing members
- [ ] Visibility radio group in board settings saves and reflects correctly
