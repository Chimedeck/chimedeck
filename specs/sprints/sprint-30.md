# Sprint 30 — Card Money & Currency Fields (DB + API)

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 07 (Card Core), Sprint 08 (Card Extended Fields)  
> **References:** [requirements §3 — Board](../architecture/requirements.md)

---

## Goal

Cards can optionally carry a **monetary value** — a decimal amount and an ISO 4217 currency code. These fields are the foundation for the board monetization features built in Sprints 31–33. This sprint focuses exclusively on the **data layer and API**; UI display is handled in Sprint 31.

Default currency is **USD** when a currency code is not supplied.

---

## Scope

### 1. DB — Migration `0019_card_money.ts`

```
db/migrations/0019_card_money.ts
```

```ts
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cards', (t) => {
    // Stored as NUMERIC(19,4) — safe for financial arithmetic in PostgreSQL.
    // NULL = no money value attached.
    t.decimal('amount', 19, 4).nullable().defaultTo(null);

    // ISO 4217 three-letter code, e.g. 'USD', 'EUR', 'GBP'.
    // Defaults to 'USD' at DB level; application layer also applies this default.
    t.string('currency', 3).nullable().defaultTo('USD');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cards', (t) => {
    t.dropColumn('amount');
    t.dropColumn('currency');
  });
}
```

---

### 2. Server — Type updates

**File:** `server/extensions/card/types.ts` (or wherever `Card` is defined)

Add to the `Card` interface:

```ts
interface Card {
  // … existing fields …
  amount: string | null;    // NUMERIC comes back as string from pg driver
  currency: string | null;  // 'USD' by default (DB default), null only for pre-migration rows
}
```

---

### 3. Server — API changes

#### `GET /api/v1/cards/:id` and list variants

Include `amount` and `currency` in all card SELECT queries. No other changes.

```ts
// In the card select helper — add to the column list:
'cards.amount',
'cards.currency',
```

Response example:

```json
{
  "data": {
    "id": "…",
    "title": "On-call Support (16-18 Jan 2026)",
    "amount": "648.0000",
    "currency": "USD",
    …
  }
}
```

#### `PATCH /api/v1/cards/:id`

Accept optional `amount` and `currency` in the body.

**Validation rules:**

| Field | Rule |
|-------|------|
| `amount` | Numeric string or number ≥ 0; `null` to clear; max 15 integer digits + 4 decimal places |
| `currency` | Exactly 3 uppercase letters (ISO 4217); defaults to `"USD"` if `amount` is set but `currency` is omitted |

```ts
// Example Zod schema addition:
z.object({
  amount:   z.union([z.number().nonnegative(), z.null()]).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
})
```

**Persistence logic:**

```ts
if (body.amount !== undefined) {
  updates.amount   = body.amount;
  updates.currency = body.currency ?? (body.amount !== null ? 'USD' : null);
}
```

Always return the freshly persisted card (re-fetch from DB after update).

---

### 4. Server — Activity event on money change

Write an activity entry when `amount` or `currency` changes, using the event type `card.money.updated`. Include in metadata:

```ts
{
  previousAmount: string | null,
  previousCurrency: string | null,
  newAmount: string | null,
  newCurrency: string | null,
}
```

> Add `'card.money.updated'` to `server/extensions/activity/config/visibleEventTypes.ts` (Sprint 29) and `src/extensions/Card/config/activityEventsConfig.ts` once Sprint 29 is merged.

---

### 5. Real-time — Broadcast money change

When `amount` or `currency` changes, broadcast a `card:updated` WebSocket event (same pattern as other card field updates from Sprint 09/10). No new event type needed.

---

## Files Affected

### New files
| File | Purpose |
|------|---------|
| `db/migrations/0019_card_money.ts` | Add `amount` + `currency` columns to `cards` |

### Modified files
| File | Change |
|------|--------|
| `server/extensions/card/types.ts` | Add `amount`, `currency` fields to `Card` type |
| `server/extensions/card/api/get.ts` (and list variants) | Include `amount`, `currency` in SELECT |
| `server/extensions/card/api/patch.ts` | Validate + persist `amount` and `currency` |
| `server/extensions/activity/config/visibleEventTypes.ts` | Add `card.money.updated` |

---

## Acceptance Criteria

- [ ] Migration runs cleanly on a fresh DB and on a DB with existing card rows (existing rows get `amount = NULL`, `currency = 'USD'`)
- [ ] `GET /api/v1/cards/:id` returns `amount` and `currency` for all cards
- [ ] `PATCH /api/v1/cards/:id` with `{ "amount": 648 }` persists `"648.0000"` and `"USD"`
- [ ] `PATCH /api/v1/cards/:id` with `{ "amount": 200, "currency": "EUR" }` persists correctly
- [ ] `PATCH /api/v1/cards/:id` with `{ "amount": null }` clears the money fields
- [ ] Supplying `currency` without `amount` is a no-op (ignored, no error)
- [ ] Invalid `amount` (negative, non-numeric) returns `400`
- [ ] Invalid `currency` (e.g. `"USDD"`, `"us"`) returns `400`
- [ ] A `card.money.updated` activity entry is written when amount changes
- [ ] A `card:updated` WebSocket event is broadcast after a money field change
