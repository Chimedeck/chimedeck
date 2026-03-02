# Sprint 08 — Card Extended Fields

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **References:** [requirements §5.5](../architecture/requirements.md), [technical-decisions.md §9](../architecture/technical-decisions.md)

---

## Goal

Enrich cards with labels, member assignments, and checklist items. These are the productivity features that complete the card as a work unit.

---

## Scope

### 1. Data Model

New Knex migration:

```typescript
// db/migrations/0007_card_extended.ts
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('labels', (table) => {
    table.string('id').primary();
    table.string('workspace_id').notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('color').notNullable();  // hex e.g. "#FF5733"
  });

  await knex.schema.createTable('card_labels', (table) => {
    table.string('card_id').notNullable()
      .references('id').inTable('cards').onDelete('CASCADE');
    table.string('label_id').notNullable()
      .references('id').inTable('labels').onDelete('CASCADE');
    table.primary(['card_id', 'label_id']);
  });

  await knex.schema.createTable('card_members', (table) => {
    table.string('card_id').notNullable()
      .references('id').inTable('cards').onDelete('CASCADE');
    table.string('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.primary(['card_id', 'user_id']);
  });

  await knex.schema.createTable('checklist_items', (table) => {
    table.string('id').primary();
    table.string('card_id').notNullable()
      .references('id').inTable('cards').onDelete('CASCADE');
    table.string('title').notNullable();
    table.boolean('checked').notNullable().defaultTo(false);
    table.string('position').notNullable();  // fractional index for reordering
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('checklist_items');
  await knex.schema.dropTable('card_members');
  await knex.schema.dropTable('card_labels');
  await knex.schema.dropTable('labels');
}
```

Invariant: a card can have max 20 labels ([requirements §5.5](../architecture/requirements.md)). Enforced server-side.

Migration file: `db/migrations/0007_card_extended.ts`

### 2. Label Management

Labels are workspace-scoped (shared across all boards in the workspace):

```
server/extensions/label/
  api/
    index.ts
    create.ts     # POST /api/v1/workspaces/:id/labels
    list.ts       # GET  /api/v1/workspaces/:id/labels
    update.ts     # PATCH /api/v1/labels/:id
    delete.ts     # DELETE /api/v1/labels/:id  (cascades CardLabel)
```

### 3. Card Sub-Resource Routes

Per [technical-decisions.md §9](../architecture/technical-decisions.md):

| Method | Path | Min Role | Description |
|--------|------|----------|-------------|
| `POST` | `/api/v1/workspaces/:id/labels` | ADMIN | Create label |
| `GET` | `/api/v1/workspaces/:id/labels` | VIEWER | List workspace labels |
| `PATCH` | `/api/v1/labels/:id` | ADMIN | Update label name/color |
| `DELETE` | `/api/v1/labels/:id` | ADMIN | Delete label |
| `POST` | `/api/v1/cards/:id/labels` | MEMBER | Assign label to card |
| `DELETE` | `/api/v1/cards/:id/labels/:labelId` | MEMBER | Remove label from card |
| `POST` | `/api/v1/cards/:id/members` | MEMBER | Assign user to card |
| `DELETE` | `/api/v1/cards/:id/members/:userId` | MEMBER | Remove user from card |
| `POST` | `/api/v1/cards/:id/checklist` | MEMBER | Add checklist item |
| `PATCH` | `/api/v1/checklist-items/:id` | MEMBER | Update title / toggle checked |
| `DELETE` | `/api/v1/checklist-items/:id` | MEMBER | Delete checklist item |

### 4. Server Extension

```
server/extensions/card/
  api/
    labels.ts          # add/remove labels
    members.ts         # assign/remove members
    checklist.ts       # CRUD checklist items
  mods/
    labels/
      validate.ts      # max 20 per card check
```

### 5. Checklist Item Ordering

Checklist items use the same fractional indexing algorithm (`server/mods/fractional/`) as lists and cards. No separate reorder endpoint is needed; `PATCH /api/v1/checklist-items/:id` accepts `{ position: string }` computed by the client (server validates via `between()` bounds check).

### 6. Due Date Notifications (stub)

`dueDate` is already on `Card` from sprint 06. In this sprint, add:
- `GET /api/v1/workspaces/:id/cards/due?before=<ISO8601>` — returns cards with `dueDate < before` for the current user's assigned cards
- Full notification system is part of the future extensions ([requirements §13](../architecture/requirements.md))

### 7. Frontend Extension

```
src/extensions/Card/
  components/
    LabelPicker.tsx          # multi-select from workspace labels
    LabelChip.tsx            # colored badge
    CardMemberAvatars.tsx    # avatar stack
    MemberAssignModal.tsx
    ChecklistSection.tsx
    ChecklistItem.tsx
    ChecklistProgress.tsx    # "3 / 5" progress bar
  containers/
    CardModal/               # extend sprint 07's CardModal
      sections/
        LabelsSection.tsx
        MembersSection.tsx
        ChecklistSection.tsx
        DueDateSection.tsx
```

---

## Error Responses

| Name | HTTP | Trigger |
|------|------|---------|
| `label-not-found` | 404 | Invalid label ID |
| `label-not-in-workspace` | 400 | Label belongs to different workspace |
| `card-label-limit` | 400 | Card already has 20 labels |
| `member-not-in-workspace` | 400 | Assigned user not a workspace member |
| `checklist-item-not-found` | 404 | Invalid checklist item ID |

---

## Tests

- Unit: max-label validation, member-in-workspace check
- Integration: add/remove labels, assign member (non-member rejected), checklist reorder, due date query

---

## Acceptance Criteria

- [ ] Labels are workspace-scoped and shareable across boards
- [ ] Assigning the 21st label to a card returns 400
- [ ] Only workspace members can be assigned to cards
- [ ] Checklist item positions are stable and sortable
- [ ] `GET /api/v1/cards/:id` `includes.labels`, `includes.members`, `includes.checklistItems` are populated
- [ ] Deleting a workspace label cascades to all `CardLabel` rows
