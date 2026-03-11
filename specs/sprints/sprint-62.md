# Sprint 62 — Automation: Triggers

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 61 (Automation Core Engine), Sprint 08 (Card Extended Fields)
> **References:** Trello Automation — https://trello.com/guide/automate-anything#rule-based-automation

---

## Goal

Register the full set of card and board event triggers in the automation engine's registry — so that rule-based automations can react to any meaningful state change on a board. Each trigger type maps to one or more existing event types emitted by the card/board/list pipelines.

---

## Scope

### 1. Trigger Type Registry

`server/extensions/automation/engine/triggers/`

Each trigger is a module that exports:
```ts
interface TriggerHandler {
  type: string;                              // e.g. 'card.moved_to_list'
  configSchema: ZodSchema;                   // validates trigger.config
  matches(event: BoardEvent, config: unknown): boolean;
}
```

#### Card Triggers

| `trigger_type` | Fires when | `config` fields |
|---|---|---|
| `card.created` | A new card is added to any list | `listId?` (optional — restrict to a specific list) |
| `card.moved_to_list` | A card is moved to a specific list | `listId` |
| `card.moved_from_list` | A card is moved away from a specific list | `listId` |
| `card.label_added` | A label is added to a card | `labelId?` |
| `card.label_removed` | A label is removed from a card | `labelId?` |
| `card.member_added` | A member is assigned to a card | `memberId?` |
| `card.member_removed` | A member is unassigned from a card | `memberId?` |
| `card.due_date_set` | A due date is set on a card | — |
| `card.due_date_removed` | A due date is removed from a card | — |
| `card.checklist_completed` | All items in a checklist are checked | `checklistId?` |
| `card.all_checklists_completed` | Every checklist on a card is 100% complete | — |
| `card.archived` | A card is archived | — |
| `card.comment_added` | A comment is posted on a card | — |

#### Board / List Triggers

| `trigger_type` | Fires when | `config` fields |
|---|---|---|
| `board.member_added` | A new member joins the board | `memberId?` |
| `list.card_added` | Any card lands in a specific list (create or move) | `listId` |

---

### 2. Trigger Validation

`server/extensions/automation/engine/triggers/validate.ts`

- Each trigger config is validated against its Zod schema at automation save time
- Unknown `trigger_type` → `{ name: 'trigger-type-unknown' }` (422)
- Invalid config → `{ name: 'trigger-config-invalid', data: zodError }` (422)

---

### 3. Matcher Integration

Update `server/extensions/automation/engine/matcher.ts` to iterate the trigger registry:

```ts
import { TRIGGER_REGISTRY } from './triggers';

export function matches(event: BoardEvent, trigger: AutomationTrigger): boolean {
  const handler = TRIGGER_REGISTRY[trigger.trigger_type];
  if (!handler) return false;
  return handler.matches(event, trigger.config);
}
```

---

### 4. Server Files

```
server/extensions/automation/engine/triggers/
  index.ts                         # TRIGGER_REGISTRY map + re-exports
  validate.ts
  card/
    created.ts
    movedToList.ts
    movedFromList.ts
    labelAdded.ts
    labelRemoved.ts
    memberAdded.ts
    memberRemoved.ts
    dueDateSet.ts
    dueDateRemoved.ts
    checklistCompleted.ts
    allChecklistsCompleted.ts
    archived.ts
    commentAdded.ts
  board/
    memberAdded.ts
  list/
    cardAdded.ts
```

---

### 5. API: Trigger Types Discovery Endpoint

```
GET /api/v1/automation/trigger-types
```

Returns the list of available trigger types with their config schema (JSON Schema format) so the UI can build a dynamic trigger picker without hardcoding:

```json
{
  "data": [
    {
      "type": "card.moved_to_list",
      "label": "Card moved to list",
      "configSchema": {
        "type": "object",
        "properties": { "listId": { "type": "string" } },
        "required": ["listId"]
      }
    },
    ...
  ]
}
```

---

## Acceptance Criteria

- [ ] All 15 trigger types listed above are registered and tested
- [ ] `matcher.matches()` returns `true` only for events that satisfy the trigger's predicate
- [ ] Invalid `trigger_type` at automation create/update time returns 422
- [ ] `GET /api/v1/automation/trigger-types` returns all registered types

---

## Tests

- `tests/integration/automation/triggers.test.ts` — one test per trigger type, both positive (should fire) and negative (should not fire) cases
