# Sprint 32 — Board Monetization Type

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 30 (Card Money & Currency DB + API), Sprint 31 (Card Money Badge UI), Sprint 05 (Board Lifecycle)  
> **References:** [requirements §3 — Board](../architecture/requirements.md)

---

## Goal

Each board can be assigned a **monetization type** that controls how card money values are treated in the UI. Two modes are supported:

- **`pre-paid`** — money on a card is informational only; the money badge is displayed as-is.
- **`pay-to-paid`** — payment actions become available on cards once a configurable column predicate returns `true`. Payment buttons are rendered on the card tile and/or modal.

This sprint delivers the DB column, API, and the board settings UI to select the type. The Stripe payment buttons themselves are wired up in Sprint 33.

---

## Scope

### 1. DB — Migration `0020_board_monetization.ts`

```
db/migrations/0020_board_monetization.ts
```

```ts
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('boards', (t) => {
    // NULL = no monetization (legacy boards / feature disabled).
    // 'pre-paid' | 'pay-to-paid'
    t.string('monetization_type', 20).nullable().defaultTo(null);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('boards', (t) => {
    t.dropColumn('monetization_type');
  });
}
```

---

### 2. Server — Type + API updates

#### Type

```ts
// server/extensions/board/types.ts
type MonetizationType = 'pre-paid' | 'pay-to-paid' | null;

interface Board {
  // … existing fields …
  monetization_type: MonetizationType;
}
```

#### `GET /api/v1/boards/:id`

Include `monetization_type` in the SELECT. No other changes.

#### `PATCH /api/v1/boards/:id`

Accept `monetization_type` in the body.

**Validation:**

```ts
z.object({
  monetization_type: z.enum(['pre-paid', 'pay-to-paid']).nullable().optional(),
})
```

- `null` clears the monetization setting (reverts board to no monetization).
- Any other value returns `400`.
- Only board admins / workspace owners may change this field (existing RBAC middleware applies).

Always return the freshly persisted board after update.

---

### 3. Client — `Board` type update

```ts
// src/extensions/Board/api.ts (or wherever the client Board type lives)
type MonetizationType = 'pre-paid' | 'pay-to-paid' | null;

interface Board {
  // … existing …
  monetization_type: MonetizationType;
}
```

---

### 4. UI — Board Settings panel: Monetization section

**File:** `src/extensions/Board/containers/BoardSettings/BoardSettings.tsx`  
(or wherever the board settings/menu panel lives; create if it doesn't exist yet)

Add a **"Monetization"** section:

```
┌─── Monetization ──────────────────────────────────┐
│                                                    │
│  How are card values used on this board?           │
│                                                    │
│  ○ None          (no payment features)             │
│  ○ Pre-paid      (show money badge only) -> Default│
│  ○ Pay to Paid   (enable payment buttons)          │
│                                                    │
│                              [Save]                │
└────────────────────────────────────────────────────┘
```

- Rendered as a radio group.
- "None" maps to `null`, "Pre-paid" → `'pre-paid'`, "Pay to Paid" → `'pay-to-paid'`.
- Save calls `PATCH /api/v1/boards/:id` with `{ monetization_type }`.
- Optimistic update + rollback on error (same pattern as other board settings).
- Show a brief description under each option:
  - **None:** "Card values are stored but no payment UI is shown."
  - **Pre-paid:** "Card money amounts are displayed as badges on each card."
  - **Pay to Paid:** "Payment buttons appear on cards in qualifying columns."
- Default must be Pre-paid

#### Styles

Radio item container: `flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-slate-700/50`  
Selected: add `bg-slate-700/70 ring-1 ring-indigo-500`  
Label: `text-sm font-medium text-slate-200`  
Description: `text-xs text-slate-400 mt-0.5`

---

### 5. Config — `pay-to-paid` column predicate

**File:** `src/extensions/Board/config/payToPaidConfig.ts`

```ts
/**
 * payToPaidConfig — configures which columns trigger payment button visibility
 * when the board's monetization_type is 'pay-to-paid'.
 *
 * `shouldShowPaymentButtons` receives the list name (string) and returns true
 * when payment buttons should be rendered on cards in that column.
 *
 * Replace the body of this function to match your board's column naming
 * convention — no other files need to change.
 *
 * Examples:
 *   return listName === 'Done';
 *   return ['Ready to Invoice', 'Completed'].includes(listName);
 *   return listName.toLowerCase().includes('paid');
 */
export function shouldShowPaymentButtons(listName: string): boolean {
  // Default: show payment buttons in any column whose name contains "Done"
  // (case-insensitive). Customise this predicate for your workflow.
  return listName.toLowerCase().includes('done');
}
```

> This is intentionally a plain synchronous function — no async, no API calls. The board view passes the list name at render time.

---

### 6. UI — Pass monetization context down to `CardItem`

The board view (`BoardView` / `KanbanBoard`) already has access to the board object and each list's name. Thread the relevant props downward:

```
BoardView
  → per-list: listName, monetizationType
    → CardColumn (or ListColumn)
      → CardItem receives:
          monetizationType: MonetizationType
          listName: string
```

`CardItem` uses this in Sprint 33 to decide whether to render payment buttons. No payment rendering in this sprint — just pass the props through and document the expected interface so Sprint 33 can slot in.

**Prop additions to `CardItem`:**

```ts
interface CardItemProps {
  // … existing …
  monetizationType?: MonetizationType;   // from board
  listName?: string;                     // name of the containing list
}
```

---

## Files Affected

### New files
| File | Purpose |
|------|---------|
| `db/migrations/0020_board_monetization.ts` | Add `monetization_type` to `boards` |
| `src/extensions/Board/config/payToPaidConfig.ts` | Configurable column predicate |

### Modified files
| File | Change |
|------|--------|
| `server/extensions/board/types.ts` | Add `monetization_type` |
| `server/extensions/board/api/get.ts` | Include `monetization_type` in SELECT |
| `server/extensions/board/api/patch.ts` | Validate + persist `monetization_type` |
| `src/extensions/Board/api.ts` | Add `monetization_type` to client `Board` type |
| `src/extensions/Board/containers/BoardSettings/BoardSettings.tsx` | Add Monetization radio section |
| `src/extensions/Card/components/CardItem.tsx` | Add `monetizationType` + `listName` props (pass-through only) |
| `src/extensions/Board/containers/BoardView` (or equivalent) | Thread `monetizationType` + `listName` into `CardItem` |

---

## Acceptance Criteria

- [ ] Migration runs cleanly; existing boards get `monetization_type = NULL`
- [ ] `GET /api/v1/boards/:id` returns `monetization_type` field
- [ ] `PATCH /api/v1/boards/:id` with `{ "monetization_type": "pre-paid" }` persists correctly
- [ ] `PATCH /api/v1/boards/:id` with `{ "monetization_type": null }` clears the field
- [ ] Invalid value (e.g. `"monthly"`) returns `400`
- [ ] Board settings panel shows the Monetization section with 3 radio options
- [ ] Selecting a radio and saving updates the board's `monetization_type`
- [ ] `payToPaidConfig.ts` — changing the predicate body changes which columns trigger payment button visibility (verified manually in Sprint 33)
- [ ] `CardItem` accepts `monetizationType` and `listName` props without errors (Sprint 33 will use them)
- [ ] Non-admin users cannot change `monetization_type` (403 response)
