# Sprint 142 — Trello Compatibility Layer: Foundation

> **Status:** ⬜ Future
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 101 (API Token Infrastructure), Sprint 78 (Board Members), Sprint 46 (Board Extensions)

---

## Goal

Build a drop-in Trello API compatibility layer so that any client already integrated with the official Trello REST API can switch to ChimeDeck by **only changing the base URL** from `https://api.trello.com` to `https://<chimedeck-host>`. No code changes required on the client side.

The compatibility layer lives at `/trello/1/` and returns responses that exactly match Trello's documented JSON shapes. It reads and writes ChimeDeck's own database — it does **not** proxy to Trello.

This sprint delivers the shared foundation: authentication bridge, Trello response type definitions, entity serializers, and the router skeleton. Individual resource groups are implemented in Sprints 143–148.

---

## Architecture

```
Trello client (unchanged code)
  └─ GET https://<chimedeck>/trello/1/boards/{id}
       Header: Authorization: Bearer hf_xxxxxx
         │   (or ?token=hf_xxxxxx query param)
         ▼
  server/extensions/trelloCompat/middlewares/trelloAuth.ts
  ┌────────────────────────────────────────────────────────┐
  │  Extract token from ?token= OR Authorization header   │
  │  Call authenticate() from existing auth middleware    │
  │  Attach currentUser to request                        │
  └────────────────────────────────────────────────────────┘
         │
         ▼
  server/extensions/trelloCompat/api/<resource>/index.ts
  ┌────────────────────────────────────────────────────────┐
  │  Route handler reads from ChimeDeck DB via Knex       │
  │  Serializes result through trelloCompat serializer    │
  │  Returns Trello-shaped JSON                           │
  └────────────────────────────────────────────────────────┘
```

---

## Data Model Mapping

Every ChimeDeck entity maps to a Trello entity. IDs are ChimeDeck UUIDs used directly as opaque Trello IDs — Trello clients treat them as strings.

| ChimeDeck | Trello |
|-----------|--------|
| `workspaces` | Organizations |
| `boards` | Boards |
| `lists` | Lists |
| `cards` | Cards |
| `users` | Members |
| `memberships` | Organization memberships |
| `board_members` | Board memberships |
| `labels` | Labels |
| `checklists` | Checklists |
| `checklist_items` | CheckItems |
| `comments` | Actions (type `commentCard`) |
| Activity events | Actions (type `createCard`, `updateCard`, etc.) |
| `custom_fields` | CustomFields |
| `notifications` | Notifications |

### Field-level mapping

**Board:**

| ChimeDeck field | Trello field | Notes |
|-----------------|-------------|-------|
| `id` | `id` | UUID string |
| `workspace_id` | `idOrganization` | |
| `title` | `name` | |
| `description` | `desc` | nullable |
| `state = 'ARCHIVED'` | `closed = true` | |
| `visibility = 'PUBLIC'` | `prefs.permissionLevel = 'public'` | |
| `visibility = 'PRIVATE'` | `prefs.permissionLevel = 'private'` | |
| `visibility = 'WORKSPACE'` | `prefs.permissionLevel = 'org'` | |
| `background` | `prefs.background` | |
| `created_at` | `dateLastActivity` | |

**Card:**

| ChimeDeck field | Trello field | Notes |
|-----------------|-------------|-------|
| `id` | `id` | |
| `list_id` | `idList` | |
| `title` | `name` | |
| `description` | `desc` | |
| `archived` | `closed` | |
| `due_date` | `due` | ISO string or null |
| `due_complete` | `dueComplete` | bool |
| `start_date` | `start` | ISO string or null |
| `position` | `pos` | rank × 65535 |
| `updated_at` | `dateLastActivity` | |

**List:**

| ChimeDeck field | Trello field | Notes |
|-----------------|-------------|-------|
| `id` | `id` | |
| `board_id` | `idBoard` | |
| `title` | `name` | |
| `archived` | `closed` | |
| `position` | `pos` | rank × 65535 |

**User → Member:**

| ChimeDeck field | Trello field | Notes |
|-----------------|-------------|-------|
| `id` | `id` | |
| `name` | `fullName` | |
| `name` | `initials` | first letter of each word, max 3 chars |
| `email` | `username` | part before `@`, lowercased |
| `avatar_url` | `avatarUrl` | |

**Workspace → Organization:**

| ChimeDeck field | Trello field | Notes |
|-----------------|-------------|-------|
| `id` | `id` | |
| `name` | `name` | |
| `name` | `displayName` | |

**Membership role:**

| ChimeDeck role | Trello memberType |
|----------------|------------------|
| `OWNER` | `admin` |
| `ADMIN` | `admin` |
| `MEMBER` | `normal` |
| `VIEWER` | `observer` |

**Label:**

| ChimeDeck field | Trello field |
|-----------------|-------------|
| `id` | `id` |
| `board_id` | `idBoard` |
| `name` | `name` |
| `color` | `color` |

**Checklist:**

| ChimeDeck field | Trello field |
|-----------------|-------------|
| `id` | `id` |
| `card_id` | `idCard` |
| `title` | `name` |
| `position` | `pos` |

**CheckItem:**

| ChimeDeck field | Trello field | Notes |
|-----------------|-------------|-------|
| `id` | `id` | |
| `checklist_id` | `idChecklist` | |
| `card_id` | `idCard` | |
| `title` | `name` | |
| `checked = true` | `state = 'complete'` | |
| `checked = false` | `state = 'incomplete'` | |
| `position` | `pos` | |

---

## Scope

---

### 1. Feature Flag

Add to `server/mods/flags/index.ts`:

```ts
TRELLO_COMPAT_ENABLED: Bun.env.TRELLO_COMPAT_ENABLED === 'true',
```

When `false`, all `/trello/1/*` routes return:
```json
{ "message": "Trello compatibility layer is not enabled on this server.", "error": "ERROR" }
```
HTTP status: `501`.

Add to `.env.example`:
```
TRELLO_COMPAT_ENABLED=false
```

---

### 2. Authentication Middleware

**File:** `server/extensions/trelloCompat/middlewares/trelloAuth.ts`

Trello clients send credentials in one of two ways:
- Query param: `?key=APP_KEY&token=hf_xxx`
- Header: `Authorization: Bearer hf_xxx`

The `key` param is an application key in Trello's system (not applicable to ChimeDeck). It is accepted and silently ignored. The `token` param or Bearer header value must be a valid ChimeDeck `hf_...` API token.

```ts
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';

// [why] Trello clients pass credentials as ?token= query param.
// We extract it and rewrite the Authorization header so the existing
// authenticate() middleware can validate it without modification.
export async function trelloAuth(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  const tokenParam = url.searchParams.get('token');

  let authReq = req;
  if (tokenParam && !req.headers.get('authorization')) {
    // Rewrite: promote ?token= to Authorization header
    const headers = new Headers(req.headers);
    headers.set('authorization', `Bearer ${tokenParam}`);
    authReq = new Request(req.url, { method: req.method, headers, body: req.body });
  }

  const authError = await authenticate(authReq as AuthenticatedRequest);
  if (authError) {
    // [why] Return Trello-shaped error rather than our internal format.
    return Response.json(
      { message: 'invalid token', error: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  // Propagate currentUser onto the original request object for downstream handlers.
  (req as AuthenticatedRequest).currentUser = (authReq as AuthenticatedRequest).currentUser;
  return null; // no error
}
```

---

### 3. Trello Response Types

**File:** `server/extensions/trelloCompat/types/trello.ts`

Define TypeScript interfaces that match Trello's documented response shapes. These are the shapes that serializers must produce.

```ts
export interface TrelloMember {
  id: string;
  activityBlocked: boolean;
  avatarHash: string | null;
  avatarUrl: string | null;
  bio: string;
  confirmed: true;
  fullName: string;
  idEnterprise: null;
  idMemberReferrer: null;
  initials: string;
  memberType: 'admin' | 'normal' | 'observer' | 'ghost';
  nonPublic: Record<string, never>;
  nonPublicAvailable: false;
  products: never[];
  url: string;
  username: string;
  status: 'disconnected';
}

export interface TrelloLabel {
  id: string;
  idBoard: string;
  name: string;
  color: string;
}

export interface TrelloCheckItem {
  id: string;
  idChecklist: string;
  idCard: string;  // [why] Some Trello endpoints include idCard on checkItem for convenience
  name: string;
  pos: number;
  state: 'complete' | 'incomplete';
  due: string | null;
  dueReminder: number | null;
  idMember: string | null;
}

export interface TrelloChecklist {
  id: string;
  idBoard: string;
  idCard: string;
  name: string;
  pos: number;
  checkItems: TrelloCheckItem[];
}

export interface TrelloCard {
  id: string;
  address: null;
  badges: {
    attachmentsByType: { trello: { board: 0; card: 0 } };
    location: false;
    votes: 0;
    viewingMemberVoted: false;
    subscribed: false;
    dueComplete: boolean;
    due: string | null;
    start: string | null;
    description: boolean;
    attachments: number;
    comments: number;
    checkItems: number;
    checkItemsChecked: number;
    checkItemsEarliestDue: null;
    fogbugz: string;
  };
  checkItemStates: TrelloCheckItem[] | null;
  closed: boolean;
  coordinates: null;
  cover: {
    idAttachment: string | null;
    color: string | null;
    idUploadedBackground: null;
    size: 'normal' | 'full';
    brightness: 'dark' | 'light';
    isTemplate: boolean;
  };
  creationMethod: null;
  dateLastActivity: string;
  desc: string;
  descData: null;
  due: string | null;
  dueComplete: boolean;
  dueReminder: number | null;
  idAttachmentCover: string | null;
  idBoard: string;
  idChecklists: string[];
  idLabels: string[];
  idList: string;
  idMembers: string[];
  idMembersVoted: never[];
  idShort: number;
  labels: TrelloLabel[];
  limits: Record<string, never>;
  locationName: null;
  manualCoverAttachment: boolean;
  name: string;
  nodeId: string;
  pos: number;
  shortLink: string;
  shortUrl: string;
  start: string | null;
  subscribed: false;
  url: string;
}

export interface TrelloList {
  id: string;
  closed: boolean;
  color: string | null;
  idBoard: string;
  name: string;
  nodeId: string;
  pos: number;
  softLimit: null;
  status: null;
  subscribed: false;
}

export interface TrelloBoard {
  id: string;
  closed: boolean;
  creationMethod: null;
  dateLastActivity: string | null;
  dateLastView: null;
  datePluginDisable: null;
  desc: string;
  descData: null;
  enterpriseOwned: false;
  idEnterprise: null;
  idMemberCreator: string;
  idOrganization: string;
  idTags: never[];
  invitations: never[];
  invited: false;
  labelNames: {
    green: string; yellow: string; orange: string; red: string;
    purple: string; blue: string; sky: string; lime: string;
    pink: string; black: string;
  };
  limits: Record<string, never>;
  memberships: TrelloBoardMembership[];
  name: string;
  nodeId: string;
  pinned: null;
  powerUps: never[];
  prefs: {
    permissionLevel: 'private' | 'org' | 'public';
    hideVotes: false;
    voting: 'disabled';
    comments: 'members';
    invitations: 'members';
    selfJoin: false;
    cardCovers: true;
    isTemplate: false;
    cardAging: 'regular';
    calendarFeedEnabled: false;
    background: string;
    backgroundColor: string | null;
    backgroundImage: string | null;
    backgroundTile: false;
    backgroundBrightness: 'unknown';
    backgroundImageScaled: null;
    canBePublic: true;
    canBeEnterprise: false;
    canBeOrg: true;
    canBePrivate: true;
    canInvite: true;
  };
  shortLink: string;
  shortUrl: string;
  starred: false;
  subscribed: false;
  templateGallery: null;
  url: string;
}

export interface TrelloBoardMembership {
  id: string;
  idMember: string;
  memberType: 'admin' | 'normal' | 'observer';
  unconfirmed: false;
  deactivated: false;
}

export interface TrelloOrganization {
  id: string;
  billableMemberCount: number;
  desc: string;
  descData: null;
  displayName: string;
  idEnterprise: null;
  idMemberCreator: string | null;
  memberships: TrelloOrgMembership[];
  name: string;
  nodeId: string;
  powerUps: never[];
  prefs: {
    permissionLevel: 'private' | 'public';
    voting: 'disabled';
    comments: 'members';
    invitations: 'admins';
    selfJoin: false;
    cardCovers: true;
    isTemplate: false;
    cardAging: 'regular';
    calendarFeedEnabled: false;
  };
  products: never[];
  url: string;
  website: null;
}

export interface TrelloOrgMembership {
  id: string;
  idMember: string;
  memberType: 'admin' | 'normal' | 'observer';
  unconfirmed: false;
  deactivated: false;
}

export interface TrelloAction {
  id: string;
  idMemberCreator: string;
  data: Record<string, unknown>;
  appCreator: null;
  type: string;
  date: string;
  limits: Record<string, never>;
  memberCreator: TrelloMember;
}
```

---

### 4. Serializers

**File:** `server/extensions/trelloCompat/serializers/position.ts`

```ts
// [why] ChimeDeck uses lexicographic fractional index strings for ordering.
// Trello clients expect a numeric pos. We convert rank (0-based array index)
// to a Trello-style position integer by multiplying by 65535.
export function rankToPos(rank: number): number {
  return (rank + 1) * 65535;
}
```

**File:** `server/extensions/trelloCompat/serializers/member.ts`

```ts
import type { TrelloMember } from '../types/trello';

function toInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 3);
}

function toUsername(email: string): string {
  return (email.split('@')[0] ?? email).toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export function serializeMember(user: {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  memberType?: 'admin' | 'normal' | 'observer';
}): TrelloMember {
  return {
    id: user.id,
    activityBlocked: false,
    avatarHash: null,
    avatarUrl: user.avatar_url ?? null,
    bio: '',
    confirmed: true,
    fullName: user.name,
    idEnterprise: null,
    idMemberReferrer: null,
    initials: toInitials(user.name),
    memberType: user.memberType ?? 'normal',
    nonPublic: {},
    nonPublicAvailable: false,
    products: [],
    url: `/trello/1/members/${user.id}`,
    username: toUsername(user.email),
    status: 'disconnected',
  };
}
```

**File:** `server/extensions/trelloCompat/serializers/label.ts`

```ts
import type { TrelloLabel } from '../types/trello';

export function serializeLabel(label: {
  id: string;
  board_id: string;
  name: string;
  color: string;
}): TrelloLabel {
  return {
    id: label.id,
    idBoard: label.board_id,
    name: label.name,
    color: label.color,
  };
}
```

---

### 5. Error Helpers

**File:** `server/extensions/trelloCompat/common/errors.ts`

```ts
// [why] Trello clients parse error responses differently than our internal API.
// Trello uses { message, error } shape for all error responses.
export function trelloError(message: string, status: number): Response {
  const error =
    status === 401 ? 'UNAUTHORIZED' :
    status === 403 ? 'UNAUTHORIZED' :
    status === 404 ? 'ERROR' :
    'ERROR';
  return Response.json({ message, error }, { status });
}

export const TRELLO_NOT_FOUND = () => trelloError('The requested resource was not found.', 404);
export const TRELLO_UNAUTHORIZED = () => trelloError('invalid token', 401);
export const TRELLO_FORBIDDEN = () => trelloError('unauthorized permission requested', 401);
export const TRELLO_INVALID_ID = () => trelloError('invalid id', 400);
```

---

### 6. Router

**File:** `server/extensions/trelloCompat/api/index.ts`

```ts
import { flags } from '../../../mods/flags';
import { trelloAuth } from '../middlewares/trelloAuth';
import type { AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { boardsRouter } from './boards';
import { cardsRouter } from './cards';
import { listsRouter } from './lists';
import { checklistsRouter } from './checklists';
import { labelsRouter } from './labels';
import { membersRouter } from './members';
import { organizationsRouter } from './organizations';
import { actionsRouter } from './actions';
import { searchRouter } from './search';

const DISABLED_RESPONSE = Response.json(
  { message: 'Trello compatibility layer is not enabled on this server.', error: 'ERROR' },
  { status: 501 },
);

export async function trelloCompatRouter(
  req: Request,
  pathname: string,
): Promise<Response | null> {
  if (!pathname.startsWith('/trello/1/')) return null;

  if (!flags.TRELLO_COMPAT_ENABLED) return DISABLED_RESPONSE;

  // Authenticate before any resource handler runs.
  const authError = await trelloAuth(req);
  if (authError) return authError;

  const path = pathname.slice('/trello/1'.length); // e.g. "/boards/abc"

  return (
    (await boardsRouter(req as AuthenticatedRequest, path)) ??
    (await cardsRouter(req as AuthenticatedRequest, path)) ??
    (await listsRouter(req as AuthenticatedRequest, path)) ??
    (await checklistsRouter(req as AuthenticatedRequest, path)) ??
    (await labelsRouter(req as AuthenticatedRequest, path)) ??
    (await membersRouter(req as AuthenticatedRequest, path)) ??
    (await organizationsRouter(req as AuthenticatedRequest, path)) ??
    (await actionsRouter(req as AuthenticatedRequest, path)) ??
    (await searchRouter(req as AuthenticatedRequest, path)) ??
    Response.json({ message: 'The requested resource was not found.', error: 'ERROR' }, { status: 404 })
  );
}
```

---

### 7. Entry Point & Mount

**File:** `server/extensions/trelloCompat/index.ts`

```ts
export { trelloCompatRouter } from './api/index';
```

Mount in `server/index.ts` **after** all `/api/*` routers so existing routes take priority:

```ts
import { trelloCompatRouter } from './extensions/trelloCompat';
// Add to the router chain:
(await trelloCompatRouter(req, pathname)) ??
```

---

### 8. Extension Layout

```
server/extensions/trelloCompat/
├── index.ts
├── api/
│   ├── index.ts              ← main router, matches /trello/1/*
│   ├── boards/index.ts       ← Sprint 143
│   ├── cards/index.ts        ← Sprint 144
│   ├── lists/index.ts        ← Sprint 145
│   ├── checklists/index.ts   ← Sprint 146
│   ├── labels/index.ts       ← Sprint 146
│   ├── members/index.ts      ← Sprint 147
│   ├── organizations/index.ts ← Sprint 147
│   ├── actions/index.ts      ← Sprint 148
│   └── search/index.ts       ← Sprint 148
├── common/
│   └── errors.ts
├── middlewares/
│   └── trelloAuth.ts
├── serializers/
│   ├── board.ts              ← Sprint 143
│   ├── card.ts               ← Sprint 144
│   ├── list.ts               ← Sprint 145
│   ├── checklist.ts          ← Sprint 146
│   ├── label.ts
│   ├── member.ts
│   ├── organization.ts       ← Sprint 147
│   ├── action.ts             ← Sprint 148
│   └── position.ts
└── types/
    └── trello.ts
```

---

### 9. `GET /trello/1/members/me`

This is the canonical Trello "are my credentials valid?" endpoint and the first concrete route to implement in this sprint.

- Returns the `TrelloMember` shape for the authenticated user.
- If auth fails, returns `401` in Trello error format.

**Handler (in `api/members/index.ts`, stub for Sprint 147):**

```ts
if (method === 'GET' && path === '/members/me') {
  const user = (req as AuthenticatedRequest).currentUser!;
  return Response.json(serializeMember(user));
}
```

---

## Acceptance Criteria

1. `GET /trello/1/members/me` with a valid `hf_...` Bearer token returns a `TrelloMember` JSON object.
2. `GET /trello/1/members/me` with `?token=hf_xxx` (Trello-style query param) also returns `200`.
3. `GET /trello/1/members/me` with an invalid token returns `{ message: "invalid token", error: "UNAUTHORIZED" }` with status `401`.
4. `GET /trello/1/anything` with `TRELLO_COMPAT_ENABLED=false` returns `501`.
5. Existing `/api/*` routes are completely unaffected.
6. The `?key=` Trello application key param is silently accepted and ignored.

---

## Tests

**`tests/integration/trelloCompat/auth.test.ts`**

| Test | Assertion |
|------|-----------|
| `GET /trello/1/members/me` — valid Bearer token | 200, `TrelloMember` shape with correct `fullName`, `username`, `initials` |
| `GET /trello/1/members/me` — valid `?token=hf_xxx` | 200, same as Bearer |
| `GET /trello/1/members/me` — `?key=APP_KEY&token=hf_xxx` | 200, key ignored |
| `GET /trello/1/members/me` — invalid token | 401, `{ message, error }` shape |
| `GET /trello/1/members/me` — no token | 401 |
| `TRELLO_COMPAT_ENABLED=false` | 501 on any `/trello/1/*` route |
| Existing `GET /api/v1/boards` | Unaffected by trelloCompat mount |

**`tests/unit/trelloCompat/serializers.test.ts`**

| Test | Assertion |
|------|-----------|
| `serializeMember` — fullName "John Doe" | `initials = "JD"`, `username = "john"` from `john@example.com` |
| `serializeMember` — name "Alice" | `initials = "A"` |
| `rankToPos(0)` | `65535` |
| `rankToPos(2)` | `196605` |
