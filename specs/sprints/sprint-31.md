# Sprint 31 — Card Money Badge UI

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 30 (Card Money & Currency DB + API), Sprint 18 (Board View / Card Tiles), Sprint 19 (Card Detail Modal)  
> **References:** [mockup — card tile with money badge](../architecture/requirements.md)

---

## Goal

Surface the card's money value directly on the **card tile** in the board view and in the **card detail modal** as an editable field. When a card carries an `amount`, a compact money badge is displayed on the tile — matching the design mockup where `648` appears with a currency indicator. Cards without an amount show nothing.

---

## Scope

### 1. UI — `CardMoneyBadge` component (new)

```
src/extensions/Card/components/CardMoneyBadge.tsx
```

A small, self-contained badge rendered on the card tile.

#### Props

```ts
interface CardMoneyBadgeProps {
  amount: string | null;   // raw value from API, e.g. "648.0000"
  currency?: string | null; // ISO code, defaults to 'USD'
}
```

#### Rendering rules

- If `amount` is `null` or `"0.0000"` → render nothing (`null`).
- Format amount using `Intl.NumberFormat` with the `currency` option:

```ts
const formatted = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: currency ?? 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
}).format(parseFloat(amount));
// e.g. "$648" or "€200.50"
```

#### Visual design

```
┌──────────────────────────────────────┐
│ [Label chips]                        │
│ On-call Support (16-18 Jan 2026)     │  ← card title
│                                      │
│ $648          [CalendarIcon] 2026-01-18  👤👤 │  ← footer row
└──────────────────────────────────────┘
```

- Container: `inline-flex items-center gap-1 text-xs font-medium`
- Background pill: `bg-emerald-900/40 text-emerald-300 px-2 py-0.5 rounded-full`
- **No icon** — the formatted string (e.g. `$648`) is the only content. Do not add an emoji or any icon prefix.

---

### 2. UI — Integrate `CardMoneyBadge` into `CardItem`

**File:** `src/extensions/Card/components/CardItem.tsx`

Add to the card tile footer row alongside the due date and member avatars:

```tsx
import { CalendarIcon } from '@heroicons/react/24/outline';

{/* Footer row — due date / money / members */}
<div className="flex items-center gap-2 mt-2 flex-wrap">
  {card.due_date && (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
      <CalendarIcon className="h-3.5 w-3.5" />
      {new Date(card.due_date).toLocaleDateString()}
    </span>
  )}
  <CardMoneyBadge amount={card.amount ?? null} currency={card.currency} />
  {members.length > 0 && (
    <div className="ml-auto">
      <CardMemberAvatars … />
    </div>
  )}
</div>
```

> Use `@heroicons/react/24/outline` for all icons on card tiles. Import only what is used — do not import the full icon set.

- `CardMoneyBadge` renders nothing when `amount` is null, so no conditional wrapper needed.
- The `Card` API type must include `amount` and `currency` (added in Sprint 30).

---

### 3. UI — Money fields in Card Detail Modal

**File:** `src/extensions/Card/containers/CardModal/CardModal.tsx`  
(or the section component for card meta-fields)

Add an editable **"Value"** section in the card modal sidebar, next to Due Date, Members, Labels.

#### Layout

```
┌─── Value ────────────────────────┐
│  Amount:  [_______648_______]    │
│  Currency: [__USD__]             │
│                      [Save]      │
└──────────────────────────────────┘
```

#### Behaviour

- **Amount input:** `<input type="number" min="0" step="0.01">` — displays the numeric value without trailing zeros.
- **Currency input:** `<input type="text" maxLength="3" pattern="[A-Z]{3}">` with an uppercase transformer on change; defaults to `"USD"`.
- **Save button** calls `PATCH /api/v1/cards/:id` with `{ amount, currency }`.
- Optimistic update: update local Redux state immediately; rollback on server error.
- Clearing the amount field and saving sends `{ amount: null }` to erase the money value.
- Show inline validation: red border + error message if currency is not exactly 3 letters.

#### Section label styles (match existing modal sections)

```
text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1
```

---

### 4. Client — `Card` type update

**File:** `src/extensions/Card/api.ts` (or wherever the client-side `Card` type lives)

```ts
interface Card {
  // … existing …
  amount: string | null;
  currency: string | null;
}
```

---

## Files Affected

### New files
| File | Purpose |
|------|---------|
| `src/extensions/Card/components/CardMoneyBadge.tsx` | Money badge shown on card tile |

### Modified files
| File | Change |
|------|--------|
| `src/extensions/Card/components/CardItem.tsx` | Add `<CardMoneyBadge>` to footer row |
| `src/extensions/Card/containers/CardModal/CardModal.tsx` | Add Value (amount + currency) section |
| `src/extensions/Card/api.ts` | Add `amount`, `currency` to client `Card` type |

---

## Acceptance Criteria

- [ ] Card with `amount = "648.0000"`, `currency = "USD"` shows `$648` badge on tile
- [ ] Card with `amount = "200.5000"`, `currency = "EUR"` shows `€200.50` badge on tile
- [ ] Card with `amount = null` shows no badge on tile (no empty space)
- [ ] Badge sits in the footer row alongside due date and member avatars
- [ ] Card modal has an editable amount + currency section
- [ ] Saving from the modal updates the badge on the tile immediately (optimistic UI)
- [ ] Clearing the amount in the modal and saving removes the badge
- [ ] Invalid 3-letter currency shows inline validation error in the modal
- [ ] Badge and form display correctly on mobile (375 px viewport)
