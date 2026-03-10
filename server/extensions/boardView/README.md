# Board View Preference

Persists per-user per-board view preference (Sprint 52 — E-VIEW-04).

## DB Schema

Table: `user_board_view_prefs`

| Column | Type | Notes |
|---|---|---|
| `id` | string (UUID v7) | Primary key |
| `user_id` | string | FK → users(id) CASCADE |
| `board_id` | string | FK → boards(id) CASCADE |
| `view_type` | enum | `KANBAN`, `TABLE`, `CALENDAR`, `TIMELINE` |
| `updated_at` | timestamp | Auto-set on update |

Unique constraint: `(user_id, board_id)`.

## API

### GET /api/v1/boards/:id/view-preference

Returns the current user's saved view type for this board.

Response: `{ "data": { "viewType": "KANBAN" } }`

Defaults to `KANBAN` if no preference exists yet.

### PUT /api/v1/boards/:id/view-preference

Upserts the view type for the current user and board.

Request body: `{ "viewType": "TABLE" }`

Response: `{ "data": { "viewType": "TABLE" } }`

## Auth

Both endpoints require a valid Bearer token. Users can only read/write their own preference.
