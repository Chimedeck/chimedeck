# Sprint 55 — Custom Fields

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 05 (Board), Sprint 07 (Card Core), Sprint 19 (Card Detail Modal)  
> **References:** [requirements §4, §5.5 — Custom Fields](../architecture/requirements.md)

---

## Goal

Allow workspace admins and board owners to define custom fields on a board. Each field has a type (text, number, date, checkbox, dropdown). Cards on that board can then have values assigned to each custom field. Custom field values are shown in the card detail modal and optionally as badges on card tiles.

---

## Scope

### 1. `db/migrations/0032_custom_fields.ts` (new)

```ts
// custom_fields: field definitions scoped to a board
table.uuid('id').primary();
table.uuid('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
table.string('name', 255).notNullable();
table.enu('field_type', ['TEXT', 'NUMBER', 'DATE', 'CHECKBOX', 'DROPDOWN']).notNullable();
table.jsonb('options').nullable();        // used for DROPDOWN: [{ id, label, color }]
table.boolean('show_on_card').notNullable().defaultTo(false); // show as tile badge
table.integer('position').notNullable().defaultTo(0);        // display order
table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

// card_custom_field_values: value per (card, custom_field) pair
table.uuid('id').primary();
table.uuid('card_id').notNullable().references('id').inTable('cards').onDelete('CASCADE');
table.uuid('custom_field_id').notNullable().references('id').inTable('custom_fields').onDelete('CASCADE');
table.text('value_text').nullable();
table.decimal('value_number', 15, 4).nullable();
table.timestamp('value_date').nullable();
table.boolean('value_checkbox').nullable();
table.string('value_option_id', 255).nullable(); // for DROPDOWN: references options[].id
table.unique(['card_id', 'custom_field_id']);
```

---

### 2. Custom Fields API

#### Board-scoped field definitions

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/boards/:id/custom-fields` | List all custom field definitions for a board |
| `POST` | `/api/v1/boards/:id/custom-fields` | Create a custom field (ADMIN+ only) |
| `PATCH` | `/api/v1/boards/:id/custom-fields/:fieldId` | Update a field definition |
| `DELETE` | `/api/v1/boards/:id/custom-fields/:fieldId` | Delete a field and all its values |

#### Card-scoped values

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/cards/:id/custom-field-values` | List all values for a card |
| `PUT` | `/api/v1/cards/:id/custom-field-values/:fieldId` | Upsert a value for a specific field |
| `DELETE` | `/api/v1/cards/:id/custom-field-values/:fieldId` | Clear a value |

`GET /api/v1/cards/:id` should include `customFieldValues` in its response under `includes`:

```json
{
  "data": { ...card },
  "includes": {
    "customFieldValues": [{ "fieldId": "...", "fieldName": "...", "fieldType": "TEXT", "value": "..." }]
  }
}
```

---

### 3. `src/extensions/CustomFields/` (new)

```
src/extensions/CustomFields/
  api.ts                           # RTK Query: field defs + values
  BoardCustomFieldsPanel.tsx       # Manage field definitions (board settings)
  CustomFieldValueEditor.tsx       # Type-aware value input (shown in card modal)
  CustomFieldBadge.tsx             # Tile badge for fields with show_on_card=true
  DropdownFieldEditor.tsx          # Dropdown with colour-coded options
  types.ts
```

#### Card Detail Modal integration

In `src/extensions/CardDetail/` (or `src/containers/CardDetailModal/`), add a **Custom Fields** section below the description. Each field is rendered with a type-appropriate input (`CustomFieldValueEditor`).

#### Card tile badge integration

In `src/components/CardTile/` (or equivalent), render `<CustomFieldBadge />` for each custom field with `show_on_card = true`.

---

## Acceptance Criteria

- [ ] `custom_fields` and `card_custom_field_values` tables exist and migrate cleanly
- [ ] `POST /boards/:id/custom-fields` creates a field; `GET` returns it
- [ ] `DELETE /boards/:id/custom-fields/:fieldId` removes the field and all associated values
- [ ] `PUT /cards/:id/custom-field-values/:fieldId` saves a value; `GET /cards/:id` includes it
- [ ] All 5 field types (TEXT, NUMBER, DATE, CHECKBOX, DROPDOWN) are handled by the API
- [ ] Custom Fields section renders in the card detail modal
- [ ] Each field type renders the correct editor (text input, number input, date picker, toggle, dropdown)
- [ ] Custom field badges appear on card tiles for fields with `show_on_card = true`
- [ ] Board settings panel allows creating, renaming, and deleting custom fields
