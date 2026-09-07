# Sprint 147 — Trello Compatibility Layer: Members & Organizations

> **Status:** ⬜ Future
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 142 (Trello Compat Foundation), Sprint 143 (Trello Compat Boards)

---

## Goal

Implement the Trello Members and Organizations API surfaces. Members at `/trello/1/members/*` map to ChimeDeck `users`, `board_members`, and `memberships`. Organizations at `/trello/1/organizations/*` map to ChimeDeck `workspaces` and `memberships`. This sprint also fully implements `GET /trello/1/members/me` (stubbed in Sprint 142) and exposes per-member board and card listings.

---

## Members

### Endpoint Inventory

| Method | Trello path | ChimeDeck operation |
|--------|-------------|---------------------|
| `GET` | `/trello/1/members/{id}` | Get member by id or username (or `me`) |
| `PUT` | `/trello/1/members/{id}` | Update member profile (fullName, bio) |
| `GET` | `/trello/1/members/{id}/{field}` | Get single field of a member |
| `GET` | `/trello/1/members/{id}/boards` | Get boards member belongs to |
| `GET` | `/trello/1/members/{id}/cards` | Get cards assigned to member |
| `GET` | `/trello/1/members/{id}/organizations` | Get organizations (workspaces) member belongs to |
| `GET` | `/trello/1/members/{id}/notifications` | Get notifications for member |
| `GET` | `/trello/1/members/{id}/actions` | Get actions (activity) for member |

### `me` shortcut

`GET /trello/1/members/me` resolves to the authenticated user's own record. Fully implemented in this sprint (stub was created in Sprint 142).

### `PUT /trello/1/members/{id}` request body

| Trello param | ChimeDeck field | Notes |
|-------------|-----------------|-------|
| `fullName` | `name` | |
| `bio` | — | accepted, silently ignored (ChimeDeck has no bio field) |
| `username` | — | accepted, silently ignored (derived from email) |
| `initials` | — | accepted, silently ignored |

Only the authenticated user may update their own member record. Return `401` if they attempt to update another user's record.

### Member Serializer

Already defined in Sprint 142. Extend to include `memberType` derived from `board_members.role` or `memberships.role` depending on context:

```ts
// When serializing a board member:
const memberType = bm.role === 'ADMIN' ? 'admin' : 'normal';

// When serializing an org member:
const memberType =
  m.role === 'OWNER' || m.role === 'ADMIN' ? 'admin' :
  m.role === 'VIEWER' ? 'observer' : 'normal';
```

---

## Organizations

### Endpoint Inventory

| Method | Trello path | ChimeDeck operation |
|--------|-------------|---------------------|
| `POST` | `/trello/1/organizations` | Create workspace |
| `GET` | `/trello/1/organizations/{id}` | Get organization (workspace) by id |
| `PUT` | `/trello/1/organizations/{id}` | Update workspace (displayName, desc, website) |
| `DELETE` | `/trello/1/organizations/{id}` | Delete workspace |
| `GET` | `/trello/1/organizations/{id}/{field}` | Get single field |
| `GET` | `/trello/1/organizations/{id}/boards` | Get boards in workspace |
| `GET` | `/trello/1/organizations/{id}/members` | Get members of workspace |
| `PUT` | `/trello/1/organizations/{id}/members` | Add member by email (invite) |
| `GET` | `/trello/1/organizations/{id}/memberships` | Get membership objects |
| `GET` | `/trello/1/organizations/{id}/memberships/{idMembership}` | Get specific membership |
| `PUT` | `/trello/1/organizations/{id}/members/{idMember}` | Update member role |
| `DELETE` | `/trello/1/organizations/{id}/members/{idMember}` | Remove member from workspace |

### Organization Serializer

**File:** `server/extensions/trelloCompat/serializers/organization.ts`

```ts
import type { TrelloOrganization, TrelloOrgMembership } from '../types/trello';

function roleToMemberType(role: string): 'admin' | 'normal' | 'observer' {
  if (role === 'OWNER' || role === 'ADMIN') return 'admin';
  if (role === 'VIEWER') return 'observer';
  return 'normal';
}

export function serializeOrganization(workspace: {
  id: string;
  name: string;
  owner_id?: string;
  memberships?: Array<{ id: string; user_id: string; role: string }>;
}): TrelloOrganization {
  const memberships: TrelloOrgMembership[] = (workspace.memberships ?? []).map((m, i) => ({
    id: `${workspace.id}-${m.user_id}`, // [why] ChimeDeck memberships have composite PK, not a UUID
    idMember: m.user_id,
    memberType: roleToMemberType(m.role),
    unconfirmed: false,
    deactivated: false,
  }));

  return {
    id: workspace.id,
    billableMemberCount: memberships.length,
    desc: '',
    descData: null,
    displayName: workspace.name,
    idEnterprise: null,
    idMemberCreator: workspace.owner_id ?? null,
    memberships,
    name: workspace.name.toLowerCase().replace(/\s+/g, ''),
    nodeId: workspace.id,
    powerUps: [],
    prefs: {
      permissionLevel: 'private',
      voting: 'disabled',
      comments: 'members',
      invitations: 'admins',
      selfJoin: false,
      cardCovers: true,
      isTemplate: false,
      cardAging: 'regular',
      calendarFeedEnabled: false,
    },
    products: [],
    url: `/trello/1/organizations/${workspace.id}`,
    website: null,
  };
}
```

### `POST /trello/1/organizations` request body

| Trello param | ChimeDeck field | Required |
|-------------|-----------------|----------|
| `displayName` | `name` | yes |
| `name` | — | accepted, ignored (ChimeDeck name is canonical) |
| `desc` | — | accepted, silently ignored |
| `website` | — | accepted, silently ignored |

Creates a workspace with the authenticated user as OWNER.

### `PUT /trello/1/organizations/{id}/members` (invite by email)

| Trello param | ChimeDeck field | Required |
|-------------|-----------------|----------|
| `email` | invited email address | yes |
| `type` | role | yes — `"admin"→'ADMIN'`, `"normal"→'MEMBER'`, `"observer"→'VIEWER'` |
| `fullName` | — | accepted, ignored |

Creates an invite record via the existing invite infrastructure (same as `POST /api/v1/workspaces/:id/invites`).

---

## Acceptance Criteria

### Members

1. `GET /trello/1/members/me` returns the authenticated user as a `TrelloMember`.
2. `GET /trello/1/members/{id}` returns the requested user's `TrelloMember` shape.
3. `GET /trello/1/members/me/boards` returns a `TrelloBoard[]` of all boards the user is a member of.
4. `GET /trello/1/members/me/cards` returns a `TrelloCard[]` of cards assigned to the user.
5. `GET /trello/1/members/me/organizations` returns a `TrelloOrganization[]` of workspaces the user belongs to.
6. `PUT /trello/1/members/me` with `{ fullName: "New Name" }` updates the user's name; updated `TrelloMember` returned.
7. `PUT /trello/1/members/{otherId}` by a different user returns `401`.

### Organizations

1. `POST /trello/1/organizations` with `{ displayName }` creates a workspace and returns `TrelloOrganization`.
2. `GET /trello/1/organizations/{id}` returns `TrelloOrganization` with `memberships` populated.
3. `GET /trello/1/organizations/{id}/boards` returns a `TrelloBoard[]` for the workspace.
4. `GET /trello/1/organizations/{id}/members` returns a `TrelloMember[]` for workspace members.
5. `PUT /trello/1/organizations/{id}/members` with `{ email, type: "normal" }` sends an invitation.
6. `PUT /trello/1/organizations/{id}/members/{idMember}` with `{ type: "admin" }` changes the member's role.
7. `DELETE /trello/1/organizations/{id}/members/{idMember}` removes the member from the workspace.
8. `DELETE /trello/1/organizations/{id}` deletes the workspace (workspace OWNER only).

---

## Tests

**`tests/integration/trelloCompat/members.test.ts`**

| Test | Assertion |
|------|-----------|
| `GET /trello/1/members/me` | TrelloMember, correct fullName, username |
| `GET /trello/1/members/{id}` — by UUID | TrelloMember |
| `GET /trello/1/members/me/boards` | TrelloBoard[] |
| `GET /trello/1/members/me/cards` | TrelloCard[] |
| `GET /trello/1/members/me/organizations` | TrelloOrganization[] |
| `PUT /trello/1/members/me` — fullName | name updated |
| `PUT /trello/1/members/{otherId}` — by non-owner | 401 |
| Member not found | 404 |

**`tests/integration/trelloCompat/organizations.test.ts`**

| Test | Assertion |
|------|-----------|
| `POST /trello/1/organizations` | TrelloOrganization shape |
| `GET /trello/1/organizations/{id}` | TrelloOrganization with memberships |
| `GET /trello/1/organizations/{id}/boards` | TrelloBoard[] |
| `GET /trello/1/organizations/{id}/members` | TrelloMember[] |
| `PUT /trello/1/organizations/{id}/members` — invite | 200; invite created |
| `PUT /trello/1/organizations/{id}/members/{id}` | Role updated |
| `DELETE /trello/1/organizations/{id}/members/{id}` | Member removed |
| `DELETE /trello/1/organizations/{id}` — by non-owner | 401 |
| Org not found | 404 |
