# Sprint 144 — Trello Compatibility Layer: Cards

> **Status:** ⬜ Future
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 142 (Trello Compat Foundation), Sprint 143 (Trello Compat Boards)

---

## Goal

Implement the full Trello Cards API surface at `/trello/1/cards/*`, backed by ChimeDeck's `cards`, `card_members`, `card_labels`, `checklists`, `checklist_items`, `comments`, and `attachments` tables. Cards are the largest and highest-traffic resource in any Trello integration — getting the serialized shape exactly right is critical for client compatibility.

---

## Endpoint Inventory

| Method | Trello path | ChimeDeck operation |
|--------|-------------|---------------------|
| `POST` | `/trello/1/cards` | Create card in a list |
| `GET` | `/trello/1/cards/{id}` | Get card by id |
| `PUT` | `/trello/1/cards/{id}` | Update card (name, desc, closed, due, pos, idList, …) |
| `DELETE` | `/trello/1/cards/{id}` | Delete card |
| `GET` | `/trello/1/cards/{id}/{field}` | Get a single field of a card |
| `GET` | `/trello/1/cards/{id}/board` | Get the board the card is on |
| `GET` | `/trello/1/cards/{id}/list` | Get the list the card is in |
| `GET` | `/trello/1/cards/{id}/actions` | Get card actions (comments + activity) |
| `POST` | `/trello/1/cards/{id}/actions/comments` | Add comment to card |
| `PUT` | `/trello/1/cards/{id}/actions/{idAction}/comments` | Edit a comment |
| `DELETE` | `/trello/1/cards/{id}/actions/{idAction}/comments` | Delete a comment |
| `GET` | `/trello/1/cards/{id}/checklists` | Get checklists on card |
| `POST` | `/trello/1/cards/{id}/checklists` | Create checklist on card |
| `DELETE` | `/trello/1/cards/{id}/checklists/{idChecklist}` | Remove checklist from card |
| `GET` | `/trello/1/cards/{id}/checkItemStates` | Get check item states |
| `GET` | `/trello/1/cards/{id}/checkItem/{idCheckItem}` | Get a check item |
| `PUT` | `/trello/1/cards/{id}/checkItem/{idCheckItem}` | Update a check item |
| `DELETE` | `/trello/1/cards/{id}/checkItem/{idCheckItem}` | Delete a check item |
| `PUT` | `/trello/1/cards/{id}/checklist/{idChecklist}/checkItem/{idCheckItem}` | Update check item state |
| `GET` | `/trello/1/cards/{id}/members` | Get members assigned to card |
| `POST` | `/trello/1/cards/{id}/idMembers` | Assign a member to card |
| `DELETE` | `/trello/1/cards/{id}/idMembers/{idMember}` | Remove member from card |
| `GET` | `/trello/1/cards/{id}/attachments` | Get attachments |
| `GET` | `/trello/1/cards/{id}/attachments/{idAttachment}` | Get a single attachment |
| `DELETE` | `/trello/1/cards/{id}/attachments/{idAttachment}` | Delete an attachment |
| `POST` | `/trello/1/cards/{id}/idLabels` | Add label to card |
| `DELETE` | `/trello/1/cards/{id}/idLabels/{idLabel}` | Remove label from card |
| `GET` | `/trello/1/cards/{id}/customFieldItems` | Get custom field values on card |

---

## Card Serializer

**File:** `server/extensions/trelloCompat/serializers/card.ts`

```ts
import type { TrelloCard, TrelloLabel } from '../types/trello';
import { rankToPos } from './position';

export function serializeCard(card: {
  id: string;
  list_id: string;
  board_id?: string;
  title: string;
  description?: string | null;
  archived: boolean;
  due_date?: Date | string | null;
  due_complete?: boolean;
  start_date?: Date | string | null;
  position?: string;
  _rank?: number;
  updated_at?: Date | string | null;
  created_at?: Date | string | null;
  short_id?: number | string | null;
  cover_attachment_id?: string | null;
  cover_color?: string | null;
  cover_size?: string | null;
  labels?: TrelloLabel[];
  idMembers?: string[];
  idChecklists?: string[];
  attachmentCount?: number;
  commentCount?: number;
  checkItemCount?: number;
  checkItemsChecked?: number;
}): TrelloCard {
  const pos = typeof card._rank === 'number' ? rankToPos(card._rank) : 65535;
  const shortLink = card.id.slice(0, 8);

  return {
    id: card.id,
    address: null,
    badges: {
      attachmentsByType: { trello: { board: 0, card: 0 } },
      location: false,
      votes: 0,
      viewingMemberVoted: false,
      subscribed: false,
      dueComplete: card.due_complete ?? false,
      due: card.due_date ? new Date(card.due_date).toISOString() : null,
      start: card.start_date ? new Date(card.start_date).toISOString() : null,
      description: !!(card.description && card.description.length > 0),
      attachments: card.attachmentCount ?? 0,
      comments: card.commentCount ?? 0,
      checkItems: card.checkItemCount ?? 0,
      checkItemsChecked: card.checkItemsChecked ?? 0,
      checkItemsEarliestDue: null,
      fogbugz: '',
    },
    checkItemStates: null,
    closed: card.archived,
    coordinates: null,
    cover: {
      idAttachment: card.cover_attachment_id ?? null,
      color: card.cover_color ?? null,
      idUploadedBackground: null,
      size: (card.cover_size as 'normal' | 'full') ?? 'normal',
      brightness: 'dark',
      isTemplate: false,
    },
    creationMethod: null,
    dateLastActivity: card.updated_at
      ? new Date(card.updated_at).toISOString()
      : new Date(card.created_at ?? Date.now()).toISOString(),
    desc: card.description ?? '',
    descData: null,
    due: card.due_date ? new Date(card.due_date).toISOString() : null,
    dueComplete: card.due_complete ?? false,
    dueReminder: null,
    idAttachmentCover: card.cover_attachment_id ?? null,
    idBoard: card.board_id ?? '',
    idChecklists: card.idChecklists ?? [],
    idLabels: (card.labels ?? []).map((l) => l.id),
    idList: card.list_id,
    idMembers: card.idMembers ?? [],
    idMembersVoted: [],
    idShort: typeof card.short_id === 'number' ? card.short_id : 0,
    labels: card.labels ?? [],
    limits: {},
    locationName: null,
    manualCoverAttachment: false,
    name: card.title,
    nodeId: card.id,
    pos,
    shortLink,
    shortUrl: `/trello/1/c/${shortLink}`,
    start: card.start_date ? new Date(card.start_date).toISOString() : null,
    subscribed: false,
    url: `/trello/1/cards/${card.id}`,
  };
}
```

---

## Request Body Mappings

### `POST /trello/1/cards` (create)

| Trello param | ChimeDeck field | Required |
|-------------|-----------------|----------|
| `name` | `title` | yes |
| `idList` | `list_id` | yes |
| `desc` | `description` | no |
| `due` | `due_date` | no — ISO string |
| `start` | `start_date` | no — ISO string |
| `pos` | `position` | no — numeric pos converted to fractional index |
| `idMembers` | card_members inserts | no — array of member UUIDs |
| `idLabels` | card_labels inserts | no — array of label UUIDs |

Response: newly created card in `TrelloCard` format.

### `PUT /trello/1/cards/{id}` (update)

| Trello param | ChimeDeck field | Notes |
|-------------|-----------------|-------|
| `name` | `title` | |
| `desc` | `description` | |
| `closed` | `archived` | `true→true`, `false→false` |
| `due` | `due_date` | ISO string or `null` to clear |
| `dueComplete` | `due_complete` | bool |
| `start` | `start_date` | |
| `idList` | `list_id` | moves card to another list |
| `pos` | `position` | top/bottom/numeric → fractional index |
| `idBoard` | — | moves card to another board (update `list_id` to first list of target board) |

### Comment body mappings

| Trello param | ChimeDeck field |
|-------------|-----------------|
| `text` | `content` |

---

## Actions on a Card

`GET /trello/1/cards/{id}/actions` returns an array of `TrelloAction` objects. ChimeDeck sources:

1. **Comments** (`comments` table) → Trello `type: "commentCard"`
2. **Activity events** (`board_activities` or `events` table) scoped to the card → Trello action types:

| ChimeDeck event type | Trello action type |
|----------------------|-------------------|
| `card_created` | `createCard` |
| `card_updated` | `updateCard` |
| `card_moved` | `updateCard` (with `listBefore`/`listAfter`) |
| `card_member_assigned` | `addMemberToCard` |
| `card_member_unassigned` | `removeMemberFromCard` |

---

## Acceptance Criteria

1. `POST /trello/1/cards` with `{ name, idList }` creates a card and returns `TrelloCard` with correct `idList`, `idBoard`, `pos`, `url`.
2. `GET /trello/1/cards/{id}` returns `TrelloCard` with `labels`, `idMembers`, `idChecklists`, `badges.comments`, `badges.attachments` all populated.
3. `PUT /trello/1/cards/{id}` with `{ idList: newListId }` moves the card; response has updated `idList`.
4. `PUT /trello/1/cards/{id}` with `{ closed: true }` archives the card; response `closed: true`.
5. `DELETE /trello/1/cards/{id}` returns `{}` with status `200`.
6. `POST /trello/1/cards/{id}/actions/comments` with `{ text: "hello" }` creates a comment; action returned with `type: "commentCard"`.
7. `GET /trello/1/cards/{id}/actions` returns an array of `TrelloAction` objects including comments.
8. `POST /trello/1/cards/{id}/idMembers` with `{ value: memberId }` assigns the member; `idMembers` includes them.
9. `DELETE /trello/1/cards/{id}/idMembers/{id}` removes the member.
10. `POST /trello/1/cards/{id}/idLabels` with `{ value: labelId }` adds label; `idLabels` and `labels` updated.
11. `GET /trello/1/cards/{id}/board` returns the parent `TrelloBoard`.
12. `GET /trello/1/cards/{id}/list` returns the parent `TrelloList`.
13. `GET /trello/1/cards/{id}/checklists` returns `TrelloChecklist[]` with nested `checkItems`.

---

## Tests

**`tests/integration/trelloCompat/cards.test.ts`**

| Test | Assertion |
|------|-----------|
| `POST /trello/1/cards` — minimal | TrelloCard shape; `idList`, `idBoard` correct |
| `POST /trello/1/cards` — with `idLabels`, `idMembers` | Labels and members on returned card |
| `GET /trello/1/cards/{id}` | Full TrelloCard; badges populated |
| `PUT /trello/1/cards/{id}` — name change | Response name updated |
| `PUT /trello/1/cards/{id}` — move to new list | `idList` updated in response |
| `PUT /trello/1/cards/{id}` — due date set | `due` ISO string in response |
| `PUT /trello/1/cards/{id}` — closed=true | `closed=true` in response |
| `DELETE /trello/1/cards/{id}` | 200 `{}` |
| `POST /trello/1/cards/{id}/actions/comments` | Action returned with `type: "commentCard"` |
| `GET /trello/1/cards/{id}/actions` | Array includes comment actions |
| `POST /trello/1/cards/{id}/idMembers` | Member in `idMembers` |
| `DELETE /trello/1/cards/{id}/idMembers/{id}` | Member removed from `idMembers` |
| `POST /trello/1/cards/{id}/idLabels` | Label in `labels` |
| `DELETE /trello/1/cards/{id}/idLabels/{id}` | Label removed |
| `GET /trello/1/cards/{id}/board` | TrelloBoard returned |
| `GET /trello/1/cards/{id}/list` | TrelloList returned |
| `GET /trello/1/cards/{id}/checklists` | TrelloChecklist[] with checkItems |
| Card not found | 404 `{ message, error }` |
