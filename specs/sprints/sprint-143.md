# Sprint 143 — Trello Compatibility Layer: Boards

> **Status:** ⬜ Future
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 142 (Trello Compat Foundation), Sprint 78 (Board Members), Sprint 46 (Board Extensions)

---

## Goal

Implement the full Trello Boards API surface at `/trello/1/boards/*`, backed by ChimeDeck's own `boards`, `lists`, `cards`, `board_members`, and `labels` tables. Any Trello client that reads or writes boards will work unchanged after switching the base URL.

---

## Endpoint Inventory

| Method | Trello path | ChimeDeck operation |
|--------|-------------|---------------------|
| `POST` | `/trello/1/boards/` | Create board in workspace |
| `GET` | `/trello/1/boards/{id}` | Get board by id |
| `PUT` | `/trello/1/boards/{id}` | Update board (name, desc, prefs, closed) |
| `DELETE` | `/trello/1/boards/{id}` | Delete board |
| `GET` | `/trello/1/boards/{id}/lists` | Get lists on board (filter: open, closed, all) |
| `POST` | `/trello/1/boards/{id}/lists` | Create list on board |
| `GET` | `/trello/1/boards/{id}/lists/{filter}` | Get filtered lists (alias for `?filter=`) |
| `GET` | `/trello/1/boards/{id}/cards` | Get cards on board |
| `GET` | `/trello/1/boards/{id}/cards/{filter}` | Get filtered cards |
| `GET` | `/trello/1/boards/{id}/members` | Get board members |
| `PUT` | `/trello/1/boards/{id}/members/{idMember}` | Add or update member role on board |
| `DELETE` | `/trello/1/boards/{id}/members/{idMember}` | Remove member from board |
| `GET` | `/trello/1/boards/{id}/labels` | Get labels on board |
| `POST` | `/trello/1/boards/{id}/labels` | Create label on board |
| `GET` | `/trello/1/boards/{id}/memberships` | Get membership objects |
| `GET` | `/trello/1/boards/{id}/actions` | Get board actions (activity feed) |
| `GET` | `/trello/1/boards/{id}/{field}` | Get single field of a board |

---

## Board Serializer

**File:** `server/extensions/trelloCompat/serializers/board.ts`

```ts
import type { TrelloBoard, TrelloBoardMembership } from '../types/trello';
import { serializeMember } from './member';
import { serializeLabel } from './label';

type VisibilityPermLevel = 'private' | 'org' | 'public';

function visibilityToPermLevel(v: string | null | undefined): VisibilityPermLevel {
  if (v === 'PUBLIC') return 'public';
  if (v === 'WORKSPACE') return 'org';
  return 'private';
}

export function serializeBoard(board: {
  id: string;
  title: string;
  description?: string | null;
  state: 'ACTIVE' | 'ARCHIVED';
  workspace_id: string;
  visibility?: string | null;
  background?: string | null;
  created_at?: Date | string | null;
  idMemberCreator?: string;
  memberships?: TrelloBoardMembership[];
}): TrelloBoard {
  const closed = board.state === 'ARCHIVED';
  const permissionLevel = visibilityToPermLevel(board.visibility);
  const background = board.background ?? 'blue';
  const shortLink = board.id.slice(0, 8);

  return {
    id: board.id,
    closed,
    creationMethod: null,
    dateLastActivity: board.created_at ? new Date(board.created_at).toISOString() : null,
    dateLastView: null,
    datePluginDisable: null,
    desc: board.description ?? '',
    descData: null,
    enterpriseOwned: false,
    idEnterprise: null,
    idMemberCreator: board.idMemberCreator ?? '',
    idOrganization: board.workspace_id,
    idTags: [],
    invitations: [],
    invited: false,
    labelNames: {
      green: '', yellow: '', orange: '', red: '',
      purple: '', blue: '', sky: '', lime: '', pink: '', black: '',
    },
    limits: {},
    memberships: board.memberships ?? [],
    name: board.title,
    nodeId: board.id,
    pinned: null,
    powerUps: [],
    prefs: {
      permissionLevel,
      hideVotes: false,
      voting: 'disabled',
      comments: 'members',
      invitations: 'members',
      selfJoin: false,
      cardCovers: true,
      isTemplate: false,
      cardAging: 'regular',
      calendarFeedEnabled: false,
      background,
      backgroundColor: null,
      backgroundImage: null,
      backgroundTile: false,
      backgroundBrightness: 'unknown',
      backgroundImageScaled: null,
      canBePublic: true,
      canBeEnterprise: false,
      canBeOrg: true,
      canBePrivate: true,
      canInvite: true,
    },
    shortLink,
    shortUrl: `/trello/1/b/${shortLink}`,
    starred: false,
    subscribed: false,
    templateGallery: null,
    url: `/trello/1/boards/${board.id}`,
  };
}
```

---

## Route Handlers

**File:** `server/extensions/trelloCompat/api/boards/index.ts`

### Request body mappings

**`POST /trello/1/boards/`** (create board)

Trello body → ChimeDeck fields:

| Trello param | ChimeDeck field | Notes |
|-------------|-----------------|-------|
| `name` | `title` | required |
| `desc` | `description` | optional |
| `idOrganization` | `workspace_id` | required — must be a workspace the user belongs to |
| `prefs_permissionLevel` | `visibility` | `'public'→'PUBLIC'`, `'org'→'WORKSPACE'`, `'private'→'PRIVATE'` |
| `prefs_background` | `background` | optional |
| `defaultLists` | — | if `true` (default), create three lists: "To Do", "In Progress", "Done" |

**`PUT /trello/1/boards/{id}`** (update board)

| Trello param | ChimeDeck field |
|-------------|-----------------|
| `name` | `title` |
| `desc` | `description` |
| `closed` | `state` (`true→'ARCHIVED'`, `false→'ACTIVE'`) |
| `prefs/permissionLevel` | `visibility` |
| `prefs/background` | `background` |

### Permission guard

All write operations require the authenticated user to be a board ADMIN or workspace OWNER/ADMIN. Return `{ message: "unauthorized permission requested", error: "UNAUTHORIZED" }` with 401 if not.

---

## Acceptance Criteria

1. `GET /trello/1/boards/{id}` returns a `TrelloBoard` object with `id`, `name`, `desc`, `closed`, `idOrganization`, `prefs.permissionLevel`, and `url` correctly set.
2. `POST /trello/1/boards/` with `{ name, idOrganization }` creates a board and returns the serialized `TrelloBoard`; if `defaultLists=true` (default), three lists are created.
3. `PUT /trello/1/boards/{id}` with `{ closed: true }` archives the board; response has `closed: true`.
4. `DELETE /trello/1/boards/{id}` removes the board; returns `200` with `{}`.
5. `GET /trello/1/boards/{id}/lists` returns an array of `TrelloList` objects for the board's non-archived lists.
6. `GET /trello/1/boards/{id}/lists?filter=closed` returns archived lists.
7. `GET /trello/1/boards/{id}/cards` returns all non-archived cards with `idList`, `idBoard`, `labels`, `idMembers` populated.
8. `GET /trello/1/boards/{id}/members` returns a `TrelloMember` array for board members.
9. `PUT /trello/1/boards/{id}/members/{idMember}` with `{ type: "normal" }` adds or updates the member's board role.
10. `DELETE /trello/1/boards/{id}/members/{idMember}` removes the member from the board.
11. `GET /trello/1/boards/{id}/labels` returns a `TrelloLabel` array.
12. Non-admin user attempting `DELETE /trello/1/boards/{id}` returns `401`.

---

## Tests

**`tests/integration/trelloCompat/boards.test.ts`**

| Test | Assertion |
|------|-----------|
| `GET /trello/1/boards/{id}` | TrelloBoard shape, correct field values |
| `GET /trello/1/boards/{id}` — board not found | 404 `{ message, error }` |
| `POST /trello/1/boards/` — defaultLists omitted | Creates board + 3 default lists |
| `POST /trello/1/boards/` — defaultLists=false | Creates board, no lists |
| `PUT /trello/1/boards/{id}` — name change | Response name updated |
| `PUT /trello/1/boards/{id}` — closed=true | Response closed=true |
| `DELETE /trello/1/boards/{id}` | 200 `{}` |
| `GET /trello/1/boards/{id}/lists` | Array of TrelloList |
| `GET /trello/1/boards/{id}/lists?filter=closed` | Only archived lists |
| `GET /trello/1/boards/{id}/cards` | Array of TrelloCard with idList, idBoard |
| `GET /trello/1/boards/{id}/members` | Array of TrelloMember |
| `PUT /trello/1/boards/{id}/members/{id}` | Member added/updated |
| `GET /trello/1/boards/{id}/labels` | Array of TrelloLabel |
| `GET /trello/1/boards/{id}/{field}` — `name` | Returns `"My Board"` string |
