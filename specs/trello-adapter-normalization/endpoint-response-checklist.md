# Trello Adapter Endpoint Response Checklist

> Scope: Trello Compatible Adapter only (`/trello/1/*`)
> Out of scope: Native API contracts and payload shapes
> Primary external reference: https://developer.atlassian.com/cloud/trello/rest/api-group-actions/

---

## How to use this checklist

For each endpoint:
1. Confirm endpoint exists in adapter router.
2. Compare response payload against required keys listed below.
3. Mark status as `PASS`, `PARTIAL`, or `MISMATCH` in sprint execution logs.
4. Do not fix by changing Native API output; normalize only in adapter serializers/routers.

---

## Global rules

1. IDs are strings everywhere (`id*` fields).
2. Date/time fields are ISO-8601 strings.
3. Trello booleans remain booleans (`closed`, `subscribed`, `deactivated`, etc.).
4. Missing optional structures use Trello-compatible defaults (`null`, `[]`, `{}` as documented).
5. Field projection endpoints (`/{field}`) return scalar/object value for that field, not full entity.

---

## Actions Group

Source contract:
- https://developer.atlassian.com/cloud/trello/rest/api-group-actions/

### GET /actions/{id}
Required response keys:
- `id`
- `idMemberCreator`
- `data`
- `type`
- `date`
- `limits`
- `memberCreator` (object)
Optional but should be normalized when supported:
- `display`

### PUT /actions/{id}
Required response keys:
- same shape as `GET /actions/{id}` after update
Rule:
- only comment actions are mutable

### DELETE /actions/{id}
Required response keys:
- Trello-compatible empty success object `{}`
Rule:
- only comment actions are deletable

### GET /actions/{id}/{field}
Required behavior:
- returns only requested field payload
- unsupported field returns Trello-style error

### GET /actions/{id}/board
Required response keys (minimum):
- `id`, `name`, `desc`, `closed`, `idOrganization`, `prefs`, `shortLink`, `shortUrl`, `url`

### GET /actions/{id}/card
Required response keys (minimum):
- `id`, `name`, `desc`, `closed`, `idBoard`, `idList`, `idMembers`, `idLabels`, `badges`, `shortLink`, `shortUrl`, `url`

### GET /actions/{id}/list
Required response keys (minimum):
- `id`, `name`, `idBoard`, `closed`, `pos`

### GET /actions/{id}/member
Required response keys (minimum):
- `id`, `fullName`, `username`, `initials`, `memberType`, `avatarHash`, `avatarUrl`, `url`

### GET /actions/{id}/memberCreator
Required response keys:
- same as member payload above

### GET /actions/{id}/organization
Required response keys (minimum):
- `id`, `name`, `displayName`, `desc`, `prefs`, `url`

### PUT /actions/{id}/text
Required response keys:
- updated action object, Trello-compatible comment action shape

### GET /actions/{idAction}/reactions
Required response keys per item:
- `id`, `idMember`, `idModel`, `emoji` (or Trello-equivalent reaction payload), optional `member`

### POST /actions/{idAction}/reactions
Required response keys:
- created reaction object with stable `id`

### GET /actions/{idAction}/reactions/{id}
Required response keys:
- single reaction object in same shape as list item

### DELETE /actions/{idAction}/reactions/{id}
Required response keys:
- `{}`

### GET /actions/{idAction}/reactionsSummary
Required response keys:
- Trello-compatible summary grouped by emoji/reaction type with counts

---

## Boards Group

### Core board payload (`/boards/*` responses)
Required keys (minimum):
- `id`, `name`, `desc`, `closed`, `idMemberCreator`, `idOrganization`
- `prefs` object (with Trello-compatible nested keys)
- `labelNames`
- `memberships`
- `shortLink`, `shortUrl`, `url`
- `starred`, `subscribed`, `limits`

### Board field endpoints (`/boards/{id}/{field}`)
Required behavior:
- return field value only
- scalar/object matches Trello field semantics

---

## Cards Group

### Core card payload (`/cards/*` responses)
Required keys (minimum):
- `id`, `name`, `desc`, `closed`, `idBoard`, `idList`
- `idMembers`, `idLabels`, `idChecklists`
- `badges` object
- `due`, `dueComplete`, `start`
- `pos`, `shortLink`, `shortUrl`, `url`
- `cover`, `limits`

### Card field endpoints (`/cards/{id}/{field}`)
Required behavior:
- field-only response
- value shape matches full-card field type

### Card nested resources
- comments/actions/checklists/members/labels/customFieldItems must reuse normalized serializers

---

## Lists Group

### Core list payload (`/lists/*` responses)
Required keys (minimum):
- `id`, `name`, `idBoard`, `closed`, `pos`, `subscribed`
- optional: `softLimit`, `limits`

### List field endpoints (`/lists/{id}/{field}`)
Required behavior:
- field-only response with Trello-compatible scalar/object

### List sub-resources
- `/lists/{id}/cards*` returns normalized card objects
- `/lists/{id}/board` returns normalized board object
- `/lists/{id}/actions` should match Trello shape expectations when implemented

---

## Checklists Group

### Core checklist payload (`/checklists/*` responses)
Required keys (minimum):
- `id`, `name`, `idBoard`, `idCard`, `pos`, `checkItems`

### CheckItem payload
Required keys:
- `id`, `idChecklist`, `idCard`, `name`, `pos`, `state`, `due`, `idMember`

### Checklist field endpoints (`/checklists/{id}/{field}`)
Required behavior:
- field-only response with Trello-compatible value

---

## Labels Group

### Core label payload (`/labels/*` responses)
Required keys:
- `id`, `idBoard`, `name`, `color`

### Label field endpoints (`/labels/{id}/{field}`)
Required behavior:
- Trello-compatible field-only value for `name`, `color`

---

## Members Group

### Core member payload (`/members/*` responses)
Required keys (minimum):
- `id`, `fullName`, `username`, `initials`, `memberType`
- `avatarHash`, `avatarUrl`, `bio`, `url`
- `activityBlocked`, `confirmed`, `status`

### Member field endpoints (`/members/{id}/{field}`)
Required behavior:
- field-only response in Trello format

### Member sub-resources
- `/members/{id}/boards` returns normalized board objects
- `/members/{id}/cards` returns normalized card objects
- `/members/{id}/organizations` returns normalized organization objects

---

## Organizations Group

### Core organization payload (`/organizations/*` responses)
Required keys (minimum):
- `id`, `name`, `displayName`, `desc`, `prefs`, `url`
- `memberships`, `idMemberCreator`

### Organization field endpoints (`/organizations/{id}/{field}`)
Required behavior:
- field-only scalar/object in Trello format

### Organization sub-resources
- `/organizations/{id}/boards` returns normalized board objects
- `/organizations/{id}/members` returns normalized member objects
- `/organizations/{id}/memberships*` returns Trello membership shape

---

## Search Group

### GET /search
Required response keys:
- `boards`, `cards`, `members`, `organizations`
Rules:
- each array item must match that entity’s normalized serializer
- model type filters and limits must preserve Trello behavior

### GET /search/members
Required response shape:
- array of normalized member objects

---

## CustomFields Group

### Custom field payload (`/customFields/*` responses)
Required keys:
- `id`, `idModel`, `modelType`, `fieldGroup`, `name`, `type`, `pos`, `display`, `options`

### Option payload
Required keys:
- `id`, `idCustomField`, `value`, `color`, `pos`

### Card custom field item payload
Required keys:
- `id`, `idCustomField`, `idModel`, `modelType`, `value` (typed by field type)

---

## Execution tracking template

Use this table per sprint implementation PR:

| Endpoint | Implemented? | Required keys pass? | Query semantics pass? | Status |
|---------|---------------|---------------------|-----------------------|--------|
| /actions/{id} | Yes | Partial | Partial | PARTIAL |
| ... | ... | ... | ... | ... |

Status values:
- `PASS`: Trello-compatible for tested paths
- `PARTIAL`: works but has shape/query mismatches
- `MISMATCH`: significant contract drift
