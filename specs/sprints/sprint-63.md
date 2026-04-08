# Sprint 63 — Automation: Actions

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 62 (Automation Triggers), Sprint 08 (Labels, members, due dates), Sprint 11 (Comments)
> **References:** Automation

---

## Goal

Implement the full library of automation action handlers — so that when a rule fires, the engine can atomically execute a sequence of card and board mutations. Each action re-uses existing service functions from other sprints; no new domain logic is invented here.

---

## Scope

### 1. Action Type Registry

`server/extensions/automation/engine/actions/`

Each action is a module that exports:
```ts
interface ActionHandler {
  type: string;                   // e.g. 'card.move_to_list'
  configSchema: ZodSchema;        // validates action.config at save time
  execute(context: ActionContext): Promise<void>;
}

interface ActionContext {
  cardId: string;
  boardId: string;
  actorId: string | null;         // system actor when running scheduled automation
  config: unknown;
  tx: Knex.Transaction;           // all actions inside one transaction per rule run
}
```

#### Card Actions

| `action_type` | What it does | `config` fields |
|---|---|---|
| `card.move_to_list` | Move card to a specific list | `listId`, `position?: 'top' \| 'bottom'` |
| `card.move_to_top` | Move card to position 0 in its current list | — |
| `card.move_to_bottom` | Move card to last position in its current list | — |
| `card.add_label` | Add a label to the card | `labelId` |
| `card.remove_label` | Remove a label from the card | `labelId` |
| `card.add_member` | Assign a member to the card | `memberId` |
| `card.remove_member` | Unassign a member from the card | `memberId` |
| `card.set_due_date` | Set due date (relative or absolute) | `offsetDays?: number`, `date?: ISO string` |
| `card.remove_due_date` | Clear the card's due date | — |
| `card.mark_due_complete` | Check the due date as complete | — |
| `card.add_comment` | Post a comment (supports variables) | `text` (supports `{cardName}`, `{boardName}`, `{date}`, `{dueDate}`) |
| `card.archive` | Archive the card | — |
| `card.add_checklist` | Add a new checklist with optional preset items | `name`, `items?: string[]` |
| `card.mention_members` | Post a comment that @-mentions specified members | `memberIds: string[]`, `text?` |

#### List Actions

| `action_type` | What it does | `config` fields |
|---|---|---|
| `list.sort_by_due_date` | Sort all cards in a list by due date (ascending) | `listId` |
| `list.sort_by_name` | Sort all cards in a list alphabetically | `listId` |
| `list.archive_all_cards` | Archive all cards in a list | `listId` |
| `list.move_all_cards` | Move all cards in a list to another list | `fromListId`, `toListId` |

---

### 2. Variable substitution

`server/extensions/automation/engine/actions/variables.ts`

Supports these variables inside action `text` fields:

| Variable | Resolves to |
|----------|-------------|
| `{cardName}` | Card title |
| `{boardName}` | Board name |
| `{listName}` | Current list name |
| `{date}` | Today's date (ISO) |
| `{dueDate}` | Card's due date (ISO, or empty string) |
| `{triggerMember}` | Display name of the user who triggered the automation |

Unrecognised variables are left as-is (no throw).

---

### 3. Executor Integration

Update `server/extensions/automation/engine/executor.ts`:

```ts
import { ACTION_REGISTRY } from './actions';

export async function execute(automation: Automation, context: EvalContext): Promise<void> {
  const actions = sortBy(automation.actions, 'position');
  let status: 'SUCCESS' | 'PARTIAL' | 'FAILED' = 'SUCCESS';

  await db.transaction(async (tx) => {
    for (const action of actions) {
      try {
        const handler = ACTION_REGISTRY[action.action_type];
        if (!handler) throw new Error(`Unknown action: ${action.action_type}`);
        await handler.execute({ ...context, config: action.config, tx });
      } catch (err) {
        status = 'PARTIAL';
        // log per-action error; continue remaining actions
      }
    }
  });

  await logger.write({ automationId: automation.id, status, context });
}
```

Action failures are isolated per-action; later actions still run.

---

### 4. API: Action Types Discovery Endpoint

```
GET /api/v1/automation/action-types
```

Same pattern as trigger types — returns all registered action types with their config JSON Schema for dynamic UI rendering:

```json
{
  "data": [
    {
      "type": "card.move_to_list",
      "label": "Move card to list",
      "category": "card",
      "configSchema": {
        "type": "object",
        "properties": {
          "listId": { "type": "string" },
          "position": { "type": "string", "enum": ["top", "bottom"] }
        },
        "required": ["listId"]
      }
    }
  ]
}
```

---

### 5. Server Files

```
server/extensions/automation/engine/actions/
  index.ts                        # ACTION_REGISTRY map
  variables.ts
  card/
    moveToList.ts
    moveToTop.ts
    moveToBottom.ts
    addLabel.ts
    removeLabel.ts
    addMember.ts
    removeMember.ts
    setDueDate.ts
    removeDueDate.ts
    markDueComplete.ts
    addComment.ts
    archive.ts
    addChecklist.ts
    mentionMembers.ts
  list/
    sortByDueDate.ts
    sortByName.ts
    archiveAllCards.ts
    moveAllCards.ts
```

---

## Acceptance Criteria

- [ ] All 18 action types above are implemented and registered
- [ ] All actions within a single rule run inside one DB transaction
- [ ] A failing action (e.g., target list not found) logs an error and execution continues
- [ ] `{cardName}` and other variables are substituted in `card.add_comment` text
- [ ] `GET /api/v1/automation/action-types` returns all registered types with config schemas

---

## Tests

- `tests/integration/automation/actions.test.ts` — one scenario per action type verifying DB state after execution
- `tests/integration/automation/variables.test.ts` — variable substitution edge cases
