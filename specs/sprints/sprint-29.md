# Sprint 29 — Configurable Events in Activity Feed

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 11 (Comments & Activity), Sprint 21 (Comments UI)  
> **References:** [event_sourcing.md](../architecture/event_sourcing.md), [requirements §5 — Activity](../architecture/requirements.md)

---

## Goal

The activity/comment feed on a card currently shows only user-authored comments. This sprint surfaces **system events** (e.g. member added, due date set, card moved) inline with comments, in chronological order. Which event types appear is controlled by a **single configurable file** — teams can toggle event categories on or off without touching application logic.

---

## Scope

### 1. Config — `activityEventsConfig.ts` (new)

```
src/extensions/Card/config/activityEventsConfig.ts
```

A plain TypeScript module that exports the list of event types the feed should display. This is the **only file that needs to change** to control which events are visible.

```ts
/**
 * activityEventsConfig — controls which system event types appear in the
 * combined comment + activity feed on the card detail modal.
 *
 * Add or remove entries here to show/hide event categories for all users.
 * Each string must match the `event_type` value recorded by the activity log.
 */
export const VISIBLE_ACTIVITY_EVENT_TYPES: readonly string[] = [
  // ── Member events ─────────────────────────────────────────────────────────
  'card.member.added',
  'card.member.removed',

  // ── Due date events ────────────────────────────────────────────────────────
  'card.due_date.set',
  'card.due_date.updated',
  'card.due_date.cleared',

  // ── Card movement events ───────────────────────────────────────────────────
  'card.moved',           // moved between lists on the same board
  'card.archived',
  'card.unarchived',
] as const;
```

> **Convention:** strings follow `<entity>.<field>.<action>`. New event types can be registered server-side in `server/extensions/activity/eventTypes.ts` (Sprint 11 artifact) and then enabled here.

---

### 2. Server — Activity feed endpoint respects config

**File:** `server/extensions/activity/api/index.ts`  
(or wherever `GET /api/v1/cards/:id/activities` is handled)

Currently the endpoint returns all activity entries for a card. Add a server-side config mirror so callers do **not** need to filter client-side (avoids leaking suppressed events).

#### New server config file

```
server/extensions/activity/config/visibleEventTypes.ts
```

```ts
/**
 * Server-side mirror of the client config.
 * Keep in sync with src/extensions/Card/config/activityEventsConfig.ts.
 *
 * When VISIBLE_EVENT_TYPES is non-empty, the activity list endpoint returns
 * only rows whose `event_type` is in this list (plus all rows with
 * event_type = null, which are user comments).
 *
 * Set to an empty array [] to return all event types (useful during debugging).
 */
export const VISIBLE_EVENT_TYPES: string[] = [
  'card.member.added',
  'card.member.removed',
  'card.due_date.set',
  'card.due_date.updated',
  'card.due_date.cleared',
  'card.moved',
  'card.archived',
  'card.unarchived',
];
```

#### Query change

```ts
// server/extensions/activity/api/get.ts
import { VISIBLE_EVENT_TYPES } from '../config/visibleEventTypes';

// Apply filter only when list is non-empty
if (VISIBLE_EVENT_TYPES.length > 0) {
  query.where(function () {
    this.whereNull('event_type')                       // user comments
        .orWhereIn('event_type', VISIBLE_EVENT_TYPES); // allowed events
  });
}
```

#### Response shape (no changes to existing fields)

Each activity row already carries:

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | |
| `card_id` | string | |
| `user_id` | string \| null | null for system events |
| `event_type` | string \| null | null for comments |
| `content` | string \| null | comment body or serialised event summary |
| `metadata` | object \| null | extra structured data (member id, dates, etc.) |
| `created_at` | ISO string | |

---

### 2b. Server — `?include=activities` on card and board fetch endpoints

To avoid a separate round-trip when opening a card modal (or rendering a board with pre-loaded feed data), the existing **card** and **board** GET endpoints accept an optional `include` query parameter.

#### `GET /api/v1/cards/:id?include=activities`

When `include=activities` is present, the response shape gains an `includes` key:

```json
{
  "data": { /* card object */ },
  "includes": {
    "activities": [ /* same rows as GET /api/v1/cards/:id/activities */ ]
  }
}
```

The `activities` array is filtered through the same `VISIBLE_EVENT_TYPES` logic as the dedicated activity endpoint (see §2). The ordering is `created_at ASC`.

**Implementation sketch:**

```ts
// server/extensions/card/api/get.ts
import { fetchActivitiesForCard } from '../../activity/api/get';

export async function getCard({ req, knex }) {
  const card = await queryCard(req.params.id, knex);

  const includes: Record<string, unknown> = {};
  if (req.query.include?.split(',').includes('activities')) {
    includes.activities = await fetchActivitiesForCard({ cardId: req.params.id, knex });
  }

  return {
    data: card,
    ...(Object.keys(includes).length > 0 ? { includes } : {}),
  };
}
```

> `fetchActivitiesForCard` is the shared helper that applies the `VISIBLE_EVENT_TYPES` filter — the same function used by `GET /api/v1/cards/:id/activities`. Extract it so both endpoints share one implementation.

---

#### `GET /api/v1/boards/:id?include=activities`

When `include=activities` is present on the board fetch, activities are sideloaded for **all cards** on that board in a single batched query. This is the preferred call when the board view first loads and needs to pre-populate feeds without per-card round trips.

Response shape:

```json
{
  "data": { /* board object with lists + cards */ },
  "includes": {
    "activities": [
      /* all visible activity entries for every card on this board,
         ordered by created_at ASC */
    ]
  }
}
```

The client indexes the `activities` array by `card_id` client-side.

**Implementation sketch:**

```ts
// server/extensions/board/api/get.ts
import { fetchActivitiesForCards } from '../../activity/api/get';

if (req.query.include?.split(',').includes('activities')) {
  const cardIds = board.lists.flatMap((l) => l.cards.map((c) => c.id));
  includes.activities = await fetchActivitiesForCards({ cardIds, knex });
}
```

`fetchActivitiesForCards` issues a single `WHERE card_id IN (...)` query, applies `VISIBLE_EVENT_TYPES` filtering, and returns all matching rows. **Max batch size: 500 card IDs** — for boards with more cards, activities are omitted from the sideload and the modal falls back to the dedicated per-card endpoint.

---

#### `include` parameter can be composed

Both endpoints support a comma-separated `include` list for future extensibility:

```
GET /api/v1/cards/:id?include=activities,attachments
GET /api/v1/boards/:id?include=activities
```

Only `activities` is implemented in this sprint; unrecognised values in the list are silently ignored.

---

#### Client-side usage (UI, Sprint 29 scope)

- When the **card modal** opens, call `GET /api/v1/cards/:id?include=activities` instead of two separate requests. Feed the `includes.activities` array directly to the `ActivityFeed` component as the initial data.
- The dedicated `GET /api/v1/cards/:id/activities` endpoint remains available for **polling / lazy loading more** entries after the initial render (no removal).
- If `includes.activities` is absent in the response (old server, or board with > 500 cards), fall back gracefully to a separate activities fetch.

---

### 3. UI — Combined feed renders event entries

**File:** `src/extensions/Card/containers/CardModal/ActivityFeed.tsx`  
(or `src/extensions/Card/containers/CardModal/CommentList.tsx`, whichever holds the feed)

#### Entry rendering rules

| `event_type` | Rendered as |
|---|---|
| `null` | Existing comment bubble (no change) |
| `card.member.added` | `«Name» added «Member» to this card` |
| `card.member.removed` | `«Name» removed «Member» from this card` |
| `card.due_date.set` | `«Name» set the due date to «date»` |
| `card.due_date.updated` | `«Name» changed the due date to «date»` |
| `card.due_date.cleared` | `«Name» removed the due date` |
| `card.moved` | `«Name» moved this card from «From List» to «To List»` |
| `card.archived` | `«Name» archived this card` |
| `card.unarchived` | `«Name» restored this card` |
| *(unknown type)* | `«Name» performed an action` (fallback) |

#### New helper — `src/extensions/Card/config/activityEventLabels.ts`

```ts
/**
 * Human-readable label builders for each event type.
 * Keys match VISIBLE_ACTIVITY_EVENT_TYPES; add an entry here whenever a
 * new event type is surfaced in activityEventsConfig.ts.
 */
import type { ActivityEntry } from '../api';

type LabelFn = (entry: ActivityEntry, actorName: string) => string;

export const ACTIVITY_EVENT_LABELS: Record<string, LabelFn> = {
  'card.member.added': (e, actor) =>
    `${actor} added ${e.metadata?.memberName ?? 'a member'} to this card`,
  'card.member.removed': (e, actor) =>
    `${actor} removed ${e.metadata?.memberName ?? 'a member'} from this card`,
  'card.due_date.set': (e, actor) =>
    `${actor} set the due date to ${e.metadata?.date ?? ''}`,
  'card.due_date.updated': (e, actor) =>
    `${actor} changed the due date to ${e.metadata?.date ?? ''}`,
  'card.due_date.cleared': (_e, actor) =>
    `${actor} removed the due date`,
  'card.moved': (e, actor) =>
    `${actor} moved this card from "${e.metadata?.fromList ?? '?'}" to "${e.metadata?.toList ?? '?'}"`,
  'card.archived': (_e, actor) => `${actor} archived this card`,
  'card.unarchived': (_e, actor) => `${actor} restored this card`,
};

/** Returns the label string for an activity entry, with fallback. */
export function buildActivityLabel(entry: ActivityEntry, actorName: string): string {
  const fn = ACTIVITY_EVENT_LABELS[entry.event_type ?? ''];
  return fn ? fn(entry, actorName) : `${actorName} performed an action`;
}
```

#### Visual style for event entries

- Render as a compact **single-line row** (not a comment bubble).
- Layout: `flex items-center gap-2 py-1 text-xs text-slate-400`
- Left: small icon or coloured dot indicating the event category:
  - member events → indigo
  - due date events → amber
  - movement/lifecycle → slate
- Text: the label string from `buildActivityLabel`.
- Timestamp: `text-slate-500 ml-auto` (right-aligned, relative time e.g. "2h ago").
- No edit/delete controls on event rows (they are immutable).

```
┌──────────────────────────────────────────────────────┐
│ ● Alice added Bob to this card             2h ago    │  ← event row
│ ┌──────────────────────────────────────────────┐     │
│ │  Charlie                                     │     │  ← comment bubble
│ │  LGTM, moving forward.                       │     │
│ └──────────────────────────────────────────────┘     │
│ ● Alice changed the due date to 2026-03-10  1h ago   │  ← event row
└──────────────────────────────────────────────────────┘
```

---

### 4. Server — Record metadata on existing activity writes

Some activity writes may already exist from Sprint 11. Ensure the following `metadata` fields are populated when writing each event:

| Event | Required metadata fields |
|-------|--------------------------|
| `card.member.added` | `{ memberId, memberName }` |
| `card.member.removed` | `{ memberId, memberName }` |
| `card.due_date.set` | `{ date: ISO string }` |
| `card.due_date.updated` | `{ date: ISO string, previousDate: ISO string }` |
| `card.due_date.cleared` | `{ previousDate: ISO string }` |
| `card.moved` | `{ fromListId, fromList, toListId, toList }` |
| `card.archived` / `card.unarchived` | `{}` (no extra data needed) |

If existing writes already produce these fields — no server changes needed. Add `TODO` comments on any that don't.

---

## Files Affected

### New files
| File | Purpose |
|------|---------|
| `src/extensions/Card/config/activityEventsConfig.ts` | Client-side list of visible event types |
| `src/extensions/Card/config/activityEventLabels.ts` | Human-readable label builders |
| `server/extensions/activity/config/visibleEventTypes.ts` | Server-side filter list |

### Modified files
| File | Change |
|------|--------|
| `server/extensions/activity/api/get.ts` (or equivalent) | Apply `VISIBLE_EVENT_TYPES` filter to query |
| `src/extensions/Card/containers/CardModal/ActivityFeed.tsx` | Render event rows inline with comments |

---

## Acceptance Criteria

- [ ] Moving a card to a different list produces a `card.moved` entry visible in the feed
- [ ] Adding / removing a member produces visible feed entries
- [ ] Setting, updating, and clearing a due date each produce a visible entry
- [ ] Removing `'card.moved'` from `VISIBLE_ACTIVITY_EVENT_TYPES` in the config hides move events from the feed without any other code change
- [ ] User comments appear exactly as before (no visual regression)
- [ ] Event rows are visually distinct from comment bubbles (single-line, muted colour)
- [ ] Feed is sorted by `created_at` ascending (oldest at top), merging comments and events correctly
- [ ] No event rows appear for event types not in `VISIBLE_ACTIVITY_EVENT_TYPES`
