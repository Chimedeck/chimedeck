# Sprint 158 — Subscriptions: Workspace Billing + Stripe Subscriptions

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 03 (Authentication), Sprint 04 (Workspace Lifecycle), Sprint 33 (Stripe Embedded Payments — reuses Stripe config module)
> **References:** [Stripe Billing / Subscriptions docs](https://stripe.com/docs/billing/subscriptions/overview), [Stripe Webhooks](https://stripe.com/docs/webhooks)
> **Status:** ⬜ Future

---

## Goal

Use the existing **workspace** as the billing boundary (workspace == organisation) and attach a **Stripe subscription** directly to each workspace. This sprint establishes the data model and Stripe integration only: each workspace has one subscription tier (`tier_1`–`tier_4`) synced from Stripe webhooks. **No gating or limit enforcement happens here** — that arrives in Sprints 159–162. The whole feature is gated behind `SUBSCRIPTIONS_ENABLED`; when off, every workspace behaves as the default unlimited tier.

---

## Strict Boundary

1. **No enforcement** of feature gates, resource limits, or rate limits in this sprint — only the model + Stripe sync.
2. No new billing entity is introduced. Workspace is the billing account and subscription owner.
3. Tier is derived **only** from the Stripe subscription state — there is no manual tier override API for end users (a platform-admin override is allowed, see §6).
4. Reuse the existing `server/extensions/payment/` Stripe client config — do **not** create a second Stripe SDK instance.
5. When `SUBSCRIPTIONS_ENABLED=false`, every read of "current tier" returns the configured **default unlimited tier** so existing behaviour is unchanged.

---

## Scope

### 1. Database Migration

File: `db/migrations/NNNN_subscriptions.ts`

```sql
-- Exactly one subscription row per workspace (1:1).
CREATE TABLE workspace_subscriptions (
  workspace_id            TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  tier                    TEXT NOT NULL DEFAULT 'tier_1',   -- tier_1 | tier_2 | tier_3 | tier_4
  status                  TEXT NOT NULL DEFAULT 'active',   -- active | trialing | past_due | canceled | incomplete
  stripe_customer_id      TEXT UNIQUE,                      -- null until first checkout
  stripe_subscription_id  TEXT UNIQUE,                      -- null on the free default tier
  stripe_price_id         TEXT,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN NOT NULL DEFAULT FALSE,
  admin_override_tier     TEXT,                             -- platform-admin manual override (§6); null = follow Stripe
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency log for Stripe webhook events.
CREATE TABLE stripe_webhook_events (
  id          TEXT PRIMARY KEY,             -- Stripe event id (evt_...)
  type        TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Backfill (inside the migration `up`):**

1. Insert one `workspace_subscriptions` row per existing workspace with `tier = 'tier_1'`, `status = 'active'`.
2. No changes are made to the `workspaces` schema.

> Tier 1 is the **free default** assigned to every workspace that has never checked out. It is a real, enforced tier (Sprint 161/162) — not "unlimited".

---

### 2. Server Module

```
server/extensions/subscription/
  api/
    index.ts            # mounts routes under /api/v1
    getWorkspaceSubscription.ts  # GET /api/v1/workspaces/:workspaceId/subscription — workspace subscription + tier
    createCheckout.ts            # POST /api/v1/workspaces/:workspaceId/subscription/checkout
    createPortal.ts              # POST /api/v1/workspaces/:workspaceId/subscription/portal
    webhook.ts          # POST /api/v1/stripe/webhook — raw-body Stripe signature verification
  common/
    workspaceResolver.ts  # resolveWorkspaceById(workspaceId), assertWorkspaceOwnerOrAdmin(userId, workspaceId)
    subscriptionRepo.ts   # read/write workspace_subscriptions
    syncFromStripe.ts    # maps a Stripe Subscription object → { tier, status, period, priceId }
    priceTierMap.ts      # resolve Stripe price_id → tier_n (built from env price ids)
    serializer.ts        # toWorkspaceSubscriptionResponse()
```

All env access (Stripe keys, price ids, webhook secret) goes through `server/config/env.ts` — never `Bun.env` directly.

---

### 3. Stripe Subscription Checkout

#### `POST /api/v1/workspaces/:workspaceId/subscription/checkout`

**Auth:** Workspace OWNER or ADMIN.

**Body:** `{ "tier": "tier_2" | "tier_3" | "tier_4" }` (tier_1 is free — rejected here).

**Behaviour:**
1. Resolve the target workspace; create a Stripe Customer if `stripe_customer_id` is null.
2. Map `tier` → `stripe_price_id` via `priceTierMap` (env-configured).
3. Create a Stripe Checkout Session in `mode: 'subscription'` with `success_url`/`cancel_url` pointing at the billing UI (Sprint 163).
4. Return `{ data: { url } }` — the client redirects to Stripe.

The subscription tier is **not** written on checkout creation — it is only applied when the `checkout.session.completed` / `customer.subscription.updated` webhook arrives (single source of truth = Stripe).

---

### 4. Stripe Billing Portal

#### `POST /api/v1/workspaces/:workspaceId/subscription/portal`

**Auth:** Workspace OWNER or ADMIN.

Creates a Stripe Billing Portal session for the workspace `stripe_customer_id` and returns `{ data: { url } }`. Used by the UI for upgrades, downgrades, payment-method changes, and cancellation.

---

### 5. Stripe Webhook Handler

#### `POST /api/v1/stripe/webhook`

- **Raw body** required for signature verification — this route is registered **before** any JSON body parsing and verified with `STRIPE_WEBHOOK_SECRET`.
- **Idempotent:** insert `event.id` into `stripe_webhook_events`; if it already exists, return `200` immediately (no re-processing).
- Handles:
  - `checkout.session.completed` → attach `stripe_subscription_id`, set tier from price.
  - `customer.subscription.created|updated` → sync `tier`, `status`, `current_period_end`, `cancel_at_period_end`.
  - `customer.subscription.deleted` → revert workspace to `tier_1` / `status = canceled`.
- All mapping flows through `syncFromStripe.ts`. On any unknown event type, log and return `200`.

> **Downgrade handling:** when Stripe reports a lower tier, the subscription row is updated immediately. Existing resources that now exceed the lower tier's limits are **not** deleted — they become read-only-over-limit and are enforced lazily by Sprints 161/162 (documented there). This sprint only records the tier change.

---

### 6. Platform-Admin Tier Override (optional manual control)

#### `PATCH /api/v1/admin/workspaces/:workspaceId/subscription`

**Auth:** Platform admin (`platformAdminGuard`).

**Body:** `{ "tier": "tier_3" | null }` — sets `admin_override_tier`. When non-null, `getCurrentTier()` returns the override and ignores Stripe; when `null`, tier follows Stripe again. Lets support staff grant/extend tiers without Stripe.

---

### 7. `getCurrentTier()` Resolver (shared contract)

`server/extensions/subscription/common/subscriptionRepo.ts` exposes the single function every later sprint depends on:

```ts
export async function getCurrentTier(workspaceId: string): Promise<TierId> {
  // 1. If SUBSCRIPTIONS_ENABLED is false → return env.SUBSCRIPTIONS_DEFAULT_UNLIMITED_TIER (default 'tier_4')
  // 2. If admin_override_tier is set → return it
  // 3. If status is active|trialing → return tier
  // 4. Otherwise (past_due/canceled/incomplete) → return 'tier_1'
}
```

This is the contract consumed by the config resolver (159), gating middleware (160), limit guards (161), and rate limiter (162).

---

### 8. Config / Env Additions

`server/config/env.ts`:

```ts
SUBSCRIPTIONS_ENABLED: Bun.env['SUBSCRIPTIONS_ENABLED'] === 'true',
// When subscriptions are disabled, getCurrentTier() returns this tier for everyone.
SUBSCRIPTIONS_DEFAULT_UNLIMITED_TIER: Bun.env['SUBSCRIPTIONS_DEFAULT_UNLIMITED_TIER'] ?? 'tier_4',
STRIPE_WEBHOOK_SECRET: Bun.env['STRIPE_WEBHOOK_SECRET'] ?? '',
STRIPE_PRICE_TIER_2: Bun.env['STRIPE_PRICE_TIER_2'] ?? '',
STRIPE_PRICE_TIER_3: Bun.env['STRIPE_PRICE_TIER_3'] ?? '',
STRIPE_PRICE_TIER_4: Bun.env['STRIPE_PRICE_TIER_4'] ?? '',
```

(`STRIPE_SECRET_KEY` already exists from Sprint 33.)

---

## Deliverables

1. Migration: `workspace_subscriptions` + `stripe_webhook_events` + workspace-row backfill.
2. `server/extensions/subscription/` module (api + common as above).
3. `GET /api/v1/workspaces/:workspaceId/subscription` returns workspace subscription + resolved tier.
4. Checkout, Billing Portal, and idempotent Webhook endpoints wired to Stripe (subscription mode).
5. `getCurrentTier(workspaceId)` resolver — the shared contract for Sprints 159–162.
6. Platform-admin override endpoint.
7. `SUBSCRIPTIONS_ENABLED` flag + Stripe env keys in `server/config/env.ts`.
8. Unit tests: webhook idempotency, `syncFromStripe` tier mapping, `getCurrentTier` precedence (flag → override → status → free fallback).

---

## Acceptance Criteria

1. Running the migration creates one `workspace_subscriptions` row per existing workspace.
2. Every workspace has exactly one `workspace_subscriptions` row defaulting to `tier_1` / `active`.
3. `POST /workspaces/:workspaceId/subscription/checkout` returns a Stripe Checkout URL in `subscription` mode for workspace OWNER/ADMIN; unauthorized users get `403`.
4. A `customer.subscription.updated` webhook with a tier-2 price updates the workspace to `tier_2`; replaying the same event id is a no-op (`200`, not re-processed).
5. `customer.subscription.deleted` reverts the workspace to `tier_1` / `canceled`.
6. `getCurrentTier` returns `SUBSCRIPTIONS_DEFAULT_UNLIMITED_TIER` for all workspaces when `SUBSCRIPTIONS_ENABLED=false`.
7. `admin_override_tier` takes precedence over Stripe status when set; clearing it (`null`) restores Stripe-derived tier.
8. Webhook signature verification rejects requests with a bad/missing signature (`400`).
9. No card-move, board, or workspace behaviour changes when `SUBSCRIPTIONS_ENABLED=false`.
