# Sprint 48 — Board Stars, Followers & Board-Level Views

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 05 (Board Lifecycle), Sprint 17 (App Shell / Sidebar), Sprint 21 (Comments & Activity UI), Sprint 46 (Board Schema Extensions)  
> **References:** [requirements §4 — Board Features](../architecture/requirements.md)

---

## Goal

Three related gaps in board-level UX are addressed together in this sprint:

1. **Board stars / favorites** — users can star a board for quick access and filter the boards grid to show only starred boards
2. **Board followers** — users can follow a board to opt in to all notifications emitted from that board
3. **Board-level views** — dedicated panels on the board page showing the board's full activity log, all comments, and all archived cards

---

## Scope

### 1. `db/migrations/0029_board_stars_followers.ts` (new)

```ts
// board_stars: one row per (user, board) pair that is starred
table.uuid('id').primary();
table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
table.uuid('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
table.unique(['user_id', 'board_id']);

// board_followers: one row per (user, board) pair where the user follows the board
table.uuid('id').primary();
table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
table.uuid('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
table.unique(['user_id', 'board_id']);
```

---

### 2. Board Stars API

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/boards/:id/star` | Star a board for the current user |
| `DELETE` | `/api/v1/boards/:id/star` | Unstar a board |

`GET /api/v1/workspaces/:id/boards` response should include a boolean `isStarred` field per board entry.

Add `GET /api/v1/me/starred-boards` — returns the list of boards starred by the current user across all workspaces (same shape as the boards list).

---

### 3. Board Followers API

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/boards/:id/follow` | Follow a board |
| `DELETE` | `/api/v1/boards/:id/follow` | Unfollow a board |

Board follow state drives the notification system — `board_followers` is the subscription list consulted when a board-scoped event is emitted.

---

### 4. Board-Level Views: Activity Log, Comments, Archived Cards

#### 4a. `server` — new query endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/boards/:id/activity` | Paginated activity entries scoped to the board (all lists + cards) |
| `GET` | `/api/v1/boards/:id/comments` | Paginated comments scoped to the board |
| `GET` | `/api/v1/boards/:id/archived-cards` | All archived cards belonging to the board |

---

#### 4b. `src/extensions/BoardViews/` (new)

```
src/extensions/BoardViews/
  api.ts                        # RTK Query endpoints for activity, comments, archived-cards
  BoardActivityPanel.tsx        # Full board activity feed (reuses ActivityEntry component)
  BoardCommentsPanel.tsx        # All comments across the board, newest first
  BoardArchivedCardsPanel.tsx   # Archived cards list with restore / delete permanently actions
  types.ts
```

Each panel is accessible via a tab or popover on the board toolbar — consistent with how Trello's board menu works.

---

### 5. Boards Dashboard UI — Starred Filter

In `src/extensions/WorkspaceDashboard/` (or equivalent boards grid), add:

- A star icon button on each board card tile — clicking toggles star state via the API
- A "⭐ Starred boards" filter tab / chip above the grid that, when active, filters the displayed list to only starred boards

---

## Acceptance Criteria

- [ ] Migration creates `board_stars` and `board_followers` tables without error
- [ ] `POST /boards/:id/star` and `DELETE /boards/:id/star` toggle star state; subsequent `GET /workspaces/:id/boards` reflects `isStarred` correctly
- [ ] `GET /me/starred-boards` returns only the current user's starred boards
- [ ] `POST/DELETE /boards/:id/follow` toggles follow state
- [ ] `GET /boards/:id/activity`, `GET /boards/:id/comments`, `GET /boards/:id/archived-cards` return paginated results
- [ ] Board ActivityPanel, CommentsPanel, and ArchivedCardsPanel render without error
- [ ] Star button on board tile is visible; clicking it persists the star state and updates the UI optimistically
- [ ] "Starred boards" filter on the dashboard shows only starred boards
