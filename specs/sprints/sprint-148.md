# Sprint 148 — Trello Compatibility Layer: Actions, Search & CustomFields

> **Status:** ⬜ Future
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 142 (Trello Compat Foundation), Sprint 144 (Trello Compat Cards)

---

## Goal

Implement the remaining Trello API surfaces: **Actions** (ChimeDeck's activity + comments feed), **Search** (maps to ChimeDeck's existing search), and **CustomFields** (maps to ChimeDeck's `custom_fields` and `card_custom_field_values` tables). After this sprint the Trello compatibility layer covers every endpoint a typical Trello integration uses.

---

## Actions

Trello "actions" are immutable event records tied to boards, lists, cards, and members. In ChimeDeck they come from two sources:

1. **Comments** (`comments` table) → Trello `type: "commentCard"`
2. **Board activity events** (`board_activities` / `events` table) → mapped Trello action types

### Endpoint Inventory

| Method | Trello path | ChimeDeck source |
|--------|-------------|-----------------|
| `GET` | `/trello/1/actions/{id}` | Look up comment or activity by id |
| `PUT` | `/trello/1/actions/{id}` | Update comment text (comments only) |
| `DELETE` | `/trello/1/actions/{id}` | Delete comment (comments only) |
| `GET` | `/trello/1/actions/{id}/board` | Board the action belongs to |
| `GET` | `/trello/1/actions/{id}/card` | Card the action belongs to |
| `GET` | `/trello/1/actions/{id}/list` | List at time of action |
| `GET` | `/trello/1/actions/{id}/member` | Member who performed the action |
| `GET` | `/trello/1/actions/{id}/memberCreator` | Alias for member |
| `PUT` | `/trello/1/actions/{id}/text` | Update comment text (alias for PUT action) |
| `POST` | `/trello/1/actions/{id}/reactions` | Add emoji reaction to comment |
| `DELETE` | `/trello/1/actions/{id}/reactions/{id}` | Remove emoji reaction |
| `GET` | `/trello/1/actions/{id}/reactionsSummary` | Get emoji reaction summary |

### Action Serializer

**File:** `server/extensions/trelloCompat/serializers/action.ts`

```ts
import type { TrelloAction, TrelloMember } from '../types/trello';

type ActionType =
  | 'commentCard'
  | 'createCard'
  | 'updateCard'
  | 'addMemberToCard'
  | 'removeMemberFromCard'
  | 'createList'
  | 'addLabelToCard'
  | 'removeLabelFromCard';

// [why] ChimeDeck event types don't match Trello action types 1:1.
// This map is the single source of truth for the translation.
const EVENT_TYPE_MAP: Record<string, ActionType> = {
  card_created:           'createCard',
  card_updated:           'updateCard',
  card_moved:             'updateCard',
  card_member_assigned:   'addMemberToCard',
  card_member_unassigned: 'removeMemberFromCard',
  list_created:           'createList',
};

export function serializeCommentAction(comment: {
  id: string;
  card_id: string;
  board_id: string;
  user_id: string;
  content: string;
  created_at: Date | string;
  memberCreator: TrelloMember;
}): TrelloAction {
  return {
    id: comment.id,
    idMemberCreator: comment.user_id,
    data: {
      text: comment.content,
      card: { id: comment.card_id },
      board: { id: comment.board_id },
    },
    appCreator: null,
    type: 'commentCard',
    date: new Date(comment.created_at).toISOString(),
    limits: {},
    memberCreator: comment.memberCreator,
  };
}

export function serializeActivityAction(event: {
  id: string;
  type: string;
  card_id?: string | null;
  board_id?: string | null;
  user_id: string;
  payload?: Record<string, unknown> | null;
  created_at: Date | string;
  memberCreator: TrelloMember;
}): TrelloAction {
  const trelloType = (EVENT_TYPE_MAP[event.type] ?? 'updateCard') as ActionType;
  return {
    id: event.id,
    idMemberCreator: event.user_id,
    data: {
      ...(event.payload ?? {}),
      card: event.card_id ? { id: event.card_id } : undefined,
      board: event.board_id ? { id: event.board_id } : undefined,
    },
    appCreator: null,
    type: trelloType,
    date: new Date(event.created_at).toISOString(),
    limits: {},
    memberCreator: event.memberCreator,
  };
}
```

### Lookup strategy

`GET /trello/1/actions/{id}` must resolve the action id from either the `comments` table (if it's a comment) or the `board_activities` / `events` table (if it's an activity). Check both sources; return `404` if not in either.

### Comment mutations

`PUT /trello/1/actions/{id}` and `PUT /trello/1/actions/{id}/text` only work for `commentCard` actions. For activity events, return `{ message: "Action does not have an associated action text.", error: "ERROR" }` with `422`.

`DELETE /trello/1/actions/{id}` only works for `commentCard` actions. Permission: the authenticated user must be the comment's author or a board ADMIN.

---

## Search

### Endpoint Inventory

| Method | Trello path | ChimeDeck operation |
|--------|-------------|---------------------|
| `GET` | `/trello/1/search` | Search boards, cards, members, organizations |
| `GET` | `/trello/1/search/members/` | Search for members by name/username |

### `GET /trello/1/search` parameters

| Trello param | ChimeDeck equivalent | Notes |
|-------------|----------------------|-------|
| `query` | search query string | required |
| `modelTypes` | scope filter | `boards`, `cards`, `members`, `organizations` — comma-separated or `all` |
| `board_fields` | — | subset of board fields to return; respected for shape but all fields returned |
| `card_fields` | — | same |
| `member_fields` | — | same |
| `organization_fields` | — | same |
| `boards_limit` | limit for board results | default 10 |
| `cards_limit` | limit for card results | default 10 |
| `members_limit` | default 10 |
| `organizations_limit` | default 10 |

Response shape:
```json
{
  "boards": [ <TrelloBoard>, ... ],
  "cards": [ <TrelloCard>, ... ],
  "members": [ <TrelloMember>, ... ],
  "organizations": [ <TrelloOrganization>, ... ]
}
```

Uses ChimeDeck's existing search infrastructure (`server/extensions/search/`) for board and card results; direct DB queries for member and organization searches (ILIKE on `name` / `email`).

### `GET /trello/1/search/members/`

| Trello param | Notes |
|-------------|-------|
| `query` | Search string; match against `name` and `email` prefix |
| `limit` | default 8 |
| `onlyAlternateMethods` | ignored |

Returns `TrelloMember[]`.

---

## CustomFields

### Endpoint Inventory

| Method | Trello path | ChimeDeck operation |
|--------|-------------|---------------------|
| `POST` | `/trello/1/customFields` | Create custom field on a board |
| `GET` | `/trello/1/customFields/{id}` | Get custom field definition |
| `PUT` | `/trello/1/customFields/{id}` | Update custom field definition |
| `DELETE` | `/trello/1/customFields/{id}` | Delete custom field |
| `GET` | `/trello/1/customFields/{id}/options` | Get dropdown options |
| `POST` | `/trello/1/customFields/{id}/options` | Add dropdown option |
| `DELETE` | `/trello/1/customFields/{id}/options/{idOption}` | Remove dropdown option |
| `GET` | `/trello/1/cards/{id}/customFieldItems` | (already in Sprint 144) |
| `PUT` | `/trello/1/cards/{idCard}/customField/{idCustomField}/item` | Set a custom field value on a card |

### CustomField Serializer

Trello custom field types: `text`, `number`, `date`, `checkbox`, `list` (dropdown).  
ChimeDeck `custom_fields.field_type` values: map to the same names where possible.

```ts
export function serializeCustomField(cf: {
  id: string;
  board_id: string;
  name: string;
  field_type: string;
  position?: string;
  _rank?: number;
  options?: Array<{ id: string; value: string }>;
}): TrelloCustomField {
  return {
    id: cf.id,
    idModel: cf.board_id,
    modelType: 'board',
    fieldGroup: cf.id,
    display: { cardFront: false },
    name: cf.name,
    pos: typeof cf._rank === 'number' ? rankToPos(cf._rank) : 65535,
    options: cf.options ?? [],
    type: cf.field_type as TrelloCustomFieldType,
  };
}
```

Add `TrelloCustomField` and `TrelloCustomFieldItem` to `types/trello.ts`.

### `PUT /trello/1/cards/{idCard}/customField/{idCustomField}/item` body

| Trello param | ChimeDeck operation |
|-------------|---------------------|
| `value` | upsert into `card_custom_field_values` |

The `value` shape depends on field type: `{ text: "..." }`, `{ number: "42" }`, `{ date: "ISO" }`, `{ checked: "true" }`.

---

## Acceptance Criteria

### Actions

1. `GET /trello/1/actions/{id}` for a comment id returns `TrelloAction` with `type: "commentCard"` and `data.text` set.
2. `GET /trello/1/actions/{id}` for an activity event id returns `TrelloAction` with appropriate mapped type.
3. `PUT /trello/1/actions/{id}/text` with `{ value: "updated text" }` updates the comment content.
4. `DELETE /trello/1/actions/{id}` deletes the comment; `200 {}`.
5. `DELETE /trello/1/actions/{id}` for a non-comment activity returns `422`.
6. `PUT /trello/1/actions/{id}` by a non-author, non-admin returns `401`.
7. `POST /trello/1/actions/{id}/reactions` with `{ shortName: "👍" }` adds an emoji reaction.

### Search

1. `GET /trello/1/search?query=foo&modelTypes=boards,cards` returns `{ boards: TrelloBoard[], cards: TrelloCard[], members: [], organizations: [] }`.
2. `GET /trello/1/search?query=alice&modelTypes=members` returns `{ members: TrelloMember[], boards: [], cards: [], organizations: [] }`.
3. `GET /trello/1/search/members/?query=ali&limit=3` returns up to 3 matching `TrelloMember` objects.
4. Results are scoped to resources the authenticated user has access to (private boards hidden).

### CustomFields

1. `POST /trello/1/customFields` with `{ name, type: "text", idModel: boardId, modelType: "board" }` creates the field and returns `TrelloCustomField`.
2. `GET /trello/1/customFields/{id}` returns the field definition.
3. `PUT /trello/1/cards/{idCard}/customField/{idCustomField}/item` with `{ value: { text: "hello" } }` sets the value; `GET /trello/1/cards/{id}/customFieldItems` returns it.
4. `DELETE /trello/1/customFields/{id}` deletes the field and all card values; `200 {}`.

---

## Tests

**`tests/integration/trelloCompat/actions.test.ts`**

| Test | Assertion |
|------|-----------|
| `GET /trello/1/actions/{commentId}` | type=commentCard, data.text set |
| `GET /trello/1/actions/{activityId}` | Mapped type; date correct |
| `PUT /trello/1/actions/{id}/text` | Comment text updated |
| `DELETE /trello/1/actions/{id}` — own comment | 200 `{}` |
| `DELETE /trello/1/actions/{id}` — activity event | 422 |
| `PUT /trello/1/actions/{id}` — not author | 401 |

**`tests/integration/trelloCompat/search.test.ts`**

| Test | Assertion |
|------|-----------|
| `GET /trello/1/search?query=foo` | All four arrays present |
| `GET /trello/1/search?modelTypes=boards` | Only boards populated |
| `GET /trello/1/search/members/?query=alice` | TrelloMember[] |
| Private board excluded | Not in results for non-member |

**`tests/integration/trelloCompat/customFields.test.ts`**

| Test | Assertion |
|------|-----------|
| `POST /trello/1/customFields` | TrelloCustomField shape |
| `PUT /trello/1/cards/{id}/customField/{id}/item` | Value stored and returned |
| `GET /trello/1/cards/{id}/customFieldItems` | Values list |
| `DELETE /trello/1/customFields/{id}` | 200 `{}`; card values removed |
