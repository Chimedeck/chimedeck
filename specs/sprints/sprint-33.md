# Sprint 33 — Stripe Embedded Payment Flows

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 30 (Card Money), Sprint 32 (Board Monetization Type)  
> **References:** [Stripe Embedded Checkout docs](https://stripe.com/docs/payments/accept-a-payment)

---

## Goal

When a board is in **`pay-to-paid`** mode and the containing list satisfies the column predicate (`payToPaidConfig.shouldShowPaymentButtons`), cards with a money amount display **payment buttons** that launch a **Stripe Embedded Checkout** session. Two default buttons are provided (10% and 100% of the card amount). Developers can register additional buttons through a configurable array — the only file to change is the payment buttons config.

---

## Scope

### 1. Config — `stripePaymentButtonsConfig.ts`

**File:** `src/extensions/Board/config/stripePaymentButtonsConfig.ts`

This is the **single file developers edit** to add, remove, or rename payment buttons. Each entry produces one button on the card tile.

```ts
/**
 * stripePaymentButtonsConfig — defines which payment buttons appear on cards
 * when the board is in 'pay-to-paid' mode and the column predicate passes.
 *
 * Each entry describes one button. The `amountFn` receives the card's full
 * amount (as a number) and returns the amount to charge (in the same currency).
 *
 * To add a new button, append an entry to this array.
 * To remove a button, delete or comment out its entry.
 * No other files need to change.
 */
export interface PaymentButtonConfig {
  /** Button label shown to the user. */
  label: string;
  /**
   * Returns the charge amount given the card's total amount.
   * Must return a positive number.
   */
  amountFn: (cardAmount: number) => number;
  /** Optional Tailwind classes to override button appearance. */
  className?: string;
}

export const PAYMENT_BUTTONS: PaymentButtonConfig[] = [
  {
    label: 'Pay 10%',
    amountFn: (total) => Math.round(total * 0.1 * 100) / 100,
  },
  {
    label: 'Pay in Full',
    amountFn: (total) => total,
  },
  // ── Add more buttons here ──────────────────────────────────────────────────
  // {
  //   label: 'Pay 50%',
  //   amountFn: (total) => Math.round(total * 0.5 * 100) / 100,
  // },
];
```

---

### 2. Server — Stripe PaymentIntent endpoint

**File:** `server/extensions/payment/api/index.ts`

New route: `POST /api/v1/payments/stripe/create-payment-intent`

#### Request body

```ts
interface CreatePaymentIntentBody {
  cardId: string;
  amount: number;    // exact charge amount in base currency units (e.g. 64.80)
  currency: string;  // ISO 4217, e.g. 'USD'
}
```

#### Implementation

```ts
import Stripe from 'stripe';
import { stripe } from '../config/stripe';

export async function createPaymentIntent({ body, currentUser }) {
  const { cardId, amount, currency } = body;

  // Guard: amount must be positive
  if (amount <= 0) {
    return { status: 400, name: 'invalid-amount', data: { message: 'Amount must be > 0' } };
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),   // Stripe expects integer cents
    currency: currency.toLowerCase(),
    metadata: { cardId, userId: currentUser.id },
    automatic_payment_methods: { enabled: true },
  });

  return {
    status: 200,
    data: {
      clientSecret: paymentIntent.client_secret,
    },
  };
}
```

#### Config

**File:** `server/extensions/payment/config/stripe.ts`

```ts
import Stripe from 'stripe';
import { config } from '../../common/config';

export const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});
```

**New env vars (add to `.env` and `.env.example`):**

```dotenv
STRIPE_SECRET_KEY=sk_test_…
```

Add to the server config module (`server/config/index.ts`):

```ts
STRIPE_SECRET_KEY: Bun.env.STRIPE_SECRET_KEY ?? '',
```

> The public/publishable key is a **client-only** value — it is exposed via the `VITE_` prefix and never loaded on the server.

> When `STRIPE_SECRET_KEY` is empty the endpoint returns `503 { name: 'stripe-not-configured' }`.

---

### 3. Client — `StripePaymentModal` component (new)

**File:** `src/extensions/Payment/components/StripePaymentModal.tsx`

Uses [`@stripe/react-stripe-js`](https://github.com/stripe/react-stripe-js) and [`@stripe/stripe-js`](https://github.com/stripe/stripe-js) with the **Embedded** Payment Element.

#### Props

```ts
interface StripePaymentModalProps {
  cardId: string;
  amount: number;         // charge amount (already computed by amountFn)
  currency: string;
  label: string;          // e.g. "Pay 10%" — shown in modal header
  onClose: () => void;
  onSuccess: () => void;
}
```

#### Flow

1. On mount, call `POST /api/v1/payments/stripe/create-payment-intent` with `{ cardId, amount, currency }`.
2. Receive `clientSecret`.
3. Render `<Elements stripe={stripePromise} options={{ clientSecret }}>` wrapping `<PaymentElement>`.
4. On form submit, call `stripe.confirmPayment(…)` with `return_url` set to the current page URL.
5. On success, call `onSuccess()` → close modal and show a toast "Payment successful".
6. On error, display Stripe's error message inline.

#### Layout

```
┌─── Pay 10% ─────────────────────── [X] ┐
│                                         │
│  Charging: $64.80 USD                   │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  [Stripe Payment Element]       │    │
│  └─────────────────────────────────┘    │
│                                         │
│              [Pay $64.80]   [Cancel]    │
└─────────────────────────────────────────┘
```

- Modal backdrop: `fixed inset-0 bg-black/60 z-50 flex items-center justify-center`
- Modal panel: `bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl`
- Header: `text-lg font-semibold text-white mb-1` + close button top-right
- Amount line: `text-sm text-slate-400 mb-4`
- Pay button: `w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors`
- Cancel button: `text-sm text-slate-400 hover:text-slate-200`
- Loading state: spinner inside the Pay button while `confirmPayment` is in flight.

#### Stripe instance

**File:** `src/extensions/Payment/config/stripeClient.ts`

```ts
import { loadStripe } from '@stripe/stripe-js';
import { config } from '~/config';

// Singleton — loadStripe must not be called inside a render.
export const stripePromise = loadStripe(config.STRIPE_PUBLIC_KEY);
```

Client config (`src/config/index.ts`) must expose:

```ts
STRIPE_PUBLIC_KEY: import.meta.env.VITE_STRIPE_PUBLIC_KEY ?? '',
```

Add to `.env`:

```dotenv
VITE_STRIPE_PUBLIC_KEY=pk_test_…
```

> Vite only exposes env vars prefixed with `VITE_` to the browser bundle. Never use non-`VITE_` vars in client code.

---

### 4. UI — `CardPaymentButtons` component (new)

**File:** `src/extensions/Payment/components/CardPaymentButtons.tsx`

Reads `PAYMENT_BUTTONS` from the config and renders one button per entry. Clicking a button opens `StripePaymentModal` for that specific amount.

```ts
interface CardPaymentButtonsProps {
  cardId: string;
  cardAmount: number;       // parsed float from card.amount
  currency: string;
}
```

```tsx
import { useState } from 'react';
import { PAYMENT_BUTTONS } from '~/extensions/Board/config/stripePaymentButtonsConfig';
import { StripePaymentModal } from './StripePaymentModal';

export const CardPaymentButtons = ({ cardId, cardAmount, currency }: CardPaymentButtonsProps) => {
  const [activeButton, setActiveButton] = useState<number | null>(null);

  return (
    <>
      <div className="flex gap-1.5 flex-wrap mt-2">
        {PAYMENT_BUTTONS.map((btn, i) => {
          const chargeAmount = btn.amountFn(cardAmount);
          return (
            <button
              key={i}
              type="button"
              className={
                btn.className ??
                'px-2 py-1 text-[11px] font-medium rounded-md bg-indigo-700/60 hover:bg-indigo-600 text-indigo-100 transition-colors'
              }
              onClick={(e) => {
                e.stopPropagation();
                setActiveButton(i);
              }}
            >
              {btn.label}
            </button>
          );
        })}
      </div>

      {activeButton !== null && (
        <StripePaymentModal
          cardId={cardId}
          amount={PAYMENT_BUTTONS[activeButton].amountFn(cardAmount)}
          currency={currency}
          label={PAYMENT_BUTTONS[activeButton].label}
          onClose={() => setActiveButton(null)}
          onSuccess={() => setActiveButton(null)}
        />
      )}
    </>
  );
};
```

---

### 5. UI — Wire `CardPaymentButtons` into `CardItem`

**File:** `src/extensions/Card/components/CardItem.tsx`

Use the `monetizationType` and `listName` props added in Sprint 32, plus the `shouldShowPaymentButtons` predicate:

```tsx
import { shouldShowPaymentButtons } from '~/extensions/Board/config/payToPaidConfig';
import { CardPaymentButtons } from '~/extensions/Payment/components/CardPaymentButtons';

// Inside CardItem render, after the money badge:
{monetizationType === 'pay-to-paid' &&
  card.amount &&
  listName &&
  shouldShowPaymentButtons(listName) && (
    <CardPaymentButtons
      cardId={card.id}
      cardAmount={parseFloat(card.amount)}
      currency={card.currency ?? 'USD'}
    />
  )}
```

- Buttons are **not** shown when `monetizationType` is `'pre-paid'` or `null`.
- Buttons are **not** shown when `card.amount` is null/zero.
- The predicate check (`shouldShowPaymentButtons`) is done at render time — no effect/state needed.

---

### 6. Packages to install

```
bun add stripe                        # server
bun add @stripe/stripe-js @stripe/react-stripe-js   # client
```

---

## Files Affected

### New files
| File | Purpose |
|------|---------|
| `src/extensions/Board/config/stripePaymentButtonsConfig.ts` | Configurable payment button definitions |
| `src/extensions/Payment/components/StripePaymentModal.tsx` | Stripe Embedded Checkout modal |
| `src/extensions/Payment/components/CardPaymentButtons.tsx` | Button row rendered on card tile |
| `src/extensions/Payment/config/stripeClient.ts` | Singleton `loadStripe` instance |
| `server/extensions/payment/api/index.ts` | `POST /api/v1/payments/stripe/create-payment-intent` |
| `server/extensions/payment/config/stripe.ts` | Stripe server SDK instance |

### Modified files
| File | Change |
|------|--------|
| `src/extensions/Card/components/CardItem.tsx` | Render `<CardPaymentButtons>` when predicate passes |
| `src/config/index.ts` | Expose `STRIPE_PUBLIC_KEY` (reads `VITE_STRIPE_PUBLIC_KEY`) |
| `server/config/index.ts` | Add `STRIPE_SECRET_KEY` |
| `.env` / `.env.example` | Add Stripe env vars |
| `server/index.ts` (router) | Register `POST /api/v1/payments/stripe/create-payment-intent` |

---

## Acceptance Criteria

- [ ] Board in `pay-to-paid` mode + card with amount in a qualifying column shows payment buttons
- [ ] "Pay 10%" button opens the modal pre-filled with 10% of the card amount
- [ ] "Pay in Full" button opens the modal pre-filled with the full card amount
- [ ] `PAYMENT_BUTTONS` array — adding a third entry (e.g. 50%) produces a third button with no other code changes
- [ ] Stripe Payment Element renders inside the modal
- [ ] Successful test payment (Stripe test card `4242 4242 4242 4242`) triggers `onSuccess` and modal closes
- [ ] Stripe error (e.g. declined card) displays inline error message
- [ ] Board in `pre-paid` mode shows **no** payment buttons
- [ ] Card with `amount = null` shows **no** payment buttons regardless of mode
- [ ] Column not matching the predicate shows no buttons even on a `pay-to-paid` board
- [ ] `STRIPE_SECRET_KEY` not set → `POST /api/v1/payments/stripe/create-payment-intent` returns `503`
- [ ] Payment buttons do not appear in Storybook/test env when Stripe keys are absent (fail gracefully)
