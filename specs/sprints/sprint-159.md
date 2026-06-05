# Sprint 159 — Subscriptions: Tier Entitlements Config + Resolver

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 158 (Subscription Infrastructure — provides `getCurrentTier`)
> **Status:** ⬜ Future

---

## Goal

Create the **single configurable source of truth** that maps each subscription tier to its **resource limits** and **feature entitlements**, plus the resolver + usage-aggregation helpers that later sprints consume. The config is a plain **map structure** (`tier → resource → limit`) that an operator can edit to re-tune any number — including changing a limit to the literal string `'unlimited'`. **No enforcement happens in this sprint**; it only produces the data and the `resolveEntitlements()` / `getUsage()` helpers.

---

## Strict Boundary

1. This sprint ships **config + read helpers only**. The middleware (160), resource guards (161), and rate limiter (162) consume these helpers but are out of scope here.
2. Every numeric limit must be operator-adjustable in one file; the sentinel for "no limit" is the literal string `'unlimited'`.
3. The config must be importable on both server and (read-only) client without side effects (no DB, no env-at-import beyond Stripe price ids).
4. Entire output of this sprint is controlled by `SUBSCRIPTIONS_ENABLED`: when `false`, `resolveEntitlements` must resolve to `SUBSCRIPTIONS_DEFAULT_UNLIMITED_TIER` and effectively disable subscription-driven limits/gates.

---

## Scope

### 1. Tier Limits Config — `server/config/subscription-tiers.ts`

The core deliverable: a single, fully-typed **map** of tier → limits. Every value is either a `number` or the literal `'unlimited'`.

```ts
// server/config/subscription-tiers.ts
// SINGLE SOURCE OF TRUTH for subscription tier limits and feature entitlements.
// Operators tune these numbers directly. Use the literal 'unlimited' to remove a cap.

export type Limit = number | 'unlimited';
export type TierId = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';

export interface TierLimits {
  /** Total workspaces a single owner account may own. */
  maxWorkspaces: Limit;
  /** Max boards within a single workspace. */
  maxBoardsPerWorkspace: Limit;
  /** Max boards across ALL workspaces owned by the same owner account. */
  maxBoardsTotal: Limit;
  /** Max lists/columns per board. */
  maxColumnsPerBoard: Limit;
  /** Max invited (non-guest) members per board. */
  maxInvitedMembersPerBoard: Limit;
  /** Max guests (VIEWER + MEMBER guest types) per board. */
  maxGuestsPerBoard: Limit;
  /** Combined attachment storage across all boards in the workspace, in gigabytes. */
  maxStorageGb: Limit;
  /** Workspace-wide WRITE (POST/PUT/PATCH/DELETE) requests per minute, summed across all members. */
  writeRequestsPerMinute: Limit;
  /** Workspace-wide READ (GET/HEAD) requests per minute, summed across all members. */
  readRequestsPerMinute: Limit;
}

export interface TierConfig {
  label: string;
  /** Stripe price id (env-injected). Null for the free default tier. */
  stripePriceEnvKey: string | null;
  limits: TierLimits;
  /** Feature entitlements consumed by the gating middleware (Sprint 160). */
  features: Record<FeatureKey, boolean>;
}

// Features that can be gated per tier (Sprint 160 maps endpoints → these keys).
export type FeatureKey =
  | 'automations'
  | 'webhooks'
  | 'plugins'
  | 'customFields'
  | 'calendarView'
  | 'timelineView'
  | 'healthCheck'
  | 'apiTokens'
  | 'stateTransitions';

export const SUBSCRIPTION_TIERS: Record<TierId, TierConfig> = {
  // ── Tier 1 — Starter (free default) ──────────────────────────────
  tier_1: {
    label: 'Starter',
    stripePriceEnvKey: null,
    limits: {
      maxWorkspaces: 1,
      maxBoardsPerWorkspace: 2,
      maxBoardsTotal: 2,
      maxColumnsPerBoard: 5,
      maxInvitedMembersPerBoard: 10,
      maxGuestsPerBoard: 2,
      maxStorageGb: 1,
      writeRequestsPerMinute: 20,
      readRequestsPerMinute: 100,
    },
    features: {
      automations: false,
      webhooks: false,
      plugins: false,
      customFields: false,
      calendarView: false,
      timelineView: false,
      healthCheck: false,
      apiTokens: false,
      stateTransitions: false,
    },
  },

  // ── Tier 2 — Team ────────────────────────────────────────────────
  tier_2: {
    label: 'Team',
    stripePriceEnvKey: 'STRIPE_PRICE_TIER_2',
    limits: {
      maxWorkspaces: 3,
      maxBoardsPerWorkspace: 20,
      maxBoardsTotal: 20,           // "3 workspace with maximum 20 board" → total cap
      maxColumnsPerBoard: 15,
      maxInvitedMembersPerBoard: 'unlimited',
      maxGuestsPerBoard: 'unlimited',
      maxStorageGb: 10,
      writeRequestsPerMinute: 40,
      readRequestsPerMinute: 200,
    },
    features: {
      automations: true,
      webhooks: false,
      plugins: false,
      customFields: true,
      calendarView: true,
      timelineView: false,
      healthCheck: false,
      apiTokens: true,
      stateTransitions: false,
    },
  },

  // ── Tier 3 — Business ────────────────────────────────────────────
  tier_3: {
    label: 'Business',
    stripePriceEnvKey: 'STRIPE_PRICE_TIER_3',
    limits: {
      maxWorkspaces: 3,
      maxBoardsPerWorkspace: 20,    // "20 board per workspace"
      maxBoardsTotal: 'unlimited',  // capped per-workspace, not in total
      maxColumnsPerBoard: 15,
      maxInvitedMembersPerBoard: 'unlimited',
      maxGuestsPerBoard: 'unlimited',
      maxStorageGb: 30,
      writeRequestsPerMinute: 100,
      readRequestsPerMinute: 200,
    },
    features: {
      automations: true,
      webhooks: true,
      plugins: true,
      customFields: true,
      calendarView: true,
      timelineView: true,
      healthCheck: true,
      apiTokens: true,
      stateTransitions: true,
    },
  },

  // ── Tier 4 — Enterprise ──────────────────────────────────────────
  tier_4: {
    label: 'Enterprise',
    stripePriceEnvKey: 'STRIPE_PRICE_TIER_4',
    limits: {
      maxWorkspaces: 'unlimited',
      maxBoardsPerWorkspace: 80,
      maxBoardsTotal: 'unlimited',
      maxColumnsPerBoard: 'unlimited',
      maxInvitedMembersPerBoard: 'unlimited',
      maxGuestsPerBoard: 'unlimited',
      maxStorageGb: 100,
      writeRequestsPerMinute: 1000,
      readRequestsPerMinute: 10000,
    },
    features: {
      automations: true,
      webhooks: true,
      plugins: true,
      customFields: true,
      calendarView: true,
      timelineView: true,
      healthCheck: true,
      apiTokens: true,
      stateTransitions: true,
    },
  },
};
```

> **Tier 1 quick reference (from requirements):** 1 workspace · max 2 boards · 5 columns/board · 10 invited members/board · 2 guests/board (VIEWER + MEMBER) · 1 GB combined storage · 20 WRITE/min · 100 READ/min (workspace-wide).

---

### 2. Limit Helpers — `server/common/limits.ts`

Small, pure utilities for working with the `Limit` type so no later sprint re-implements the `'unlimited'` check:

```ts
export const isUnlimited = (l: Limit): l is 'unlimited' => l === 'unlimited';

/** True when `current + delta` would exceed `limit`. 'unlimited' never exceeds. */
export function exceeds(limit: Limit, current: number, delta = 1): boolean {
  if (isUnlimited(limit)) return false;
  return current + delta > limit;
}

/** Remaining headroom, or Infinity for 'unlimited'. */
export function remaining(limit: Limit, current: number): number {
  return isUnlimited(limit) ? Infinity : Math.max(0, limit - current);
}
```

---

### 3. Entitlements Resolver — `server/extensions/subscription/common/entitlements.ts`

```ts
export interface Entitlements {
  tier: TierId;
  limits: TierLimits;
  features: Record<FeatureKey, boolean>;
}

/** Resolves a workspace's effective entitlements via getCurrentTier (Sprint 158). */
export async function resolveEntitlements(workspaceId: string): Promise<Entitlements> {
  const tier = await getCurrentTier(workspaceId);
  const cfg = SUBSCRIPTION_TIERS[tier];
  return { tier, limits: cfg.limits, features: cfg.features };
}
```

A request-scoped memo (per request id) avoids resolving the tier more than once per request.

---

### 4. Usage Aggregation — `server/extensions/subscription/common/usage.ts`

Read-only counters used by the limit guards (161) and the UI usage meters (163). Each is a single indexed query scoped to a workspace (or its owner where noted):

```ts
getWorkspaceCountForOwner(ownerId): Promise<number>
getBoardCountTotalForOwner(ownerId): Promise<number>
getBoardCountForWorkspace(workspaceId): Promise<number>
getColumnCount(boardId): Promise<number>
getInvitedMemberCount(boardId): Promise<number>   // board_members excluding guests
getGuestCount(boardId): Promise<number>            // board_guest_access (VIEWER + MEMBER)
getStorageBytesTotal(workspaceId): Promise<number>     // SUM(attachments.size_bytes) across workspace boards
```

`getUsageSummary(workspaceId)` composes these into one object for the UI.

---

### 5. Config Validation Test

A unit test asserts the config is internally consistent so a bad operator edit fails CI:
- Every `TierId` key present; every `FeatureKey` present in each tier's `features`.
- Every limit is a positive integer or the exact literal `'unlimited'`.
- Higher tiers are monotonically `>=` lower tiers for each numeric limit (warns, does not fail — operators may intentionally invert).

---

## Deliverables

1. `server/config/subscription-tiers.ts` — the editable tier→limit + tier→feature map (single source of truth).
2. `server/common/limits.ts` — `isUnlimited` / `exceeds` / `remaining` helpers.
3. `server/extensions/subscription/common/entitlements.ts` — `resolveEntitlements()` with per-request memo.
4. `server/extensions/subscription/common/usage.ts` — workspace-scoped usage counters + owner-scoped counters for `maxWorkspaces` / `maxBoardsTotal`.
5. `GET /api/v1/workspaces/:workspaceId/entitlements` — returns `{ data: { tier, limits, features, usage } }` for the workspace (powers the UI and upgrade prompts).
6. Config-consistency unit test.
7. Unit tests explicitly covering `SUBSCRIPTIONS_ENABLED=false` fallback behavior.

---

## Acceptance Criteria

1. All tier numbers match the requirements exactly (Tier 1: 1/2/5/10/2/1GB/20/100; Tier 2: 3/20/15/∞/∞/10GB/40/200; Tier 3: 3/20-per-ws/15/∞/∞/30GB/100/200; Tier 4: ∞/80/∞/∞/∞/100GB/1000/10000).
2. Changing any number (or setting it to `'unlimited'`) in `subscription-tiers.ts` is the **only** edit required to re-tune a limit — no code change elsewhere.
3. `exceeds('unlimited', 9999, 1)` is `false`; `exceeds(2, 2, 1)` is `true`; `exceeds(2, 1, 1)` is `false`.
4. `resolveEntitlements` returns the tier-4 (default unlimited) entitlements for every workspace when `SUBSCRIPTIONS_ENABLED=false`.
5. `GET /api/v1/workspaces/:workspaceId/entitlements` returns the resolved limits, features, and live usage for that workspace.
6. The config-consistency test fails if a tier is missing a feature key or a limit is neither a number nor `'unlimited'`.
