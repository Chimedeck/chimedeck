# Sprint 160 — Subscriptions: Conditional Feature-Gating Middleware

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 158 (`getCurrentTier`), Sprint 159 (`resolveEntitlements` + feature map)
> **Status:** ⬜ Future

---

## Goal

Add a **single conditional middleware** that sits on top of the API surface and gates endpoints by the caller's subscription tier. Whether an endpoint is allowed is driven entirely by a **declarative map** (endpoint → required feature), resolved against the tier→feature entitlements from Sprint 159. Blocked requests return a standard `402 Payment Required` envelope describing the feature and the minimum tier that unlocks it. This sprint handles **feature gating only** — resource counts (161) and rate limits (162) are separate.

---

## Strict Boundary

1. One middleware, one gate map. Individual route handlers are **not** edited to add `if (tier < x)` checks — all gating is declarative and centralised.
2. Gating is by **feature entitlement** (`features` map), not by resource count. "You used too many boards" is Sprint 161; "your tier can't use webhooks at all" is here.
3. The middleware runs **after** authentication (so the workspace context is known) and **before** the route handler.
4. When `SUBSCRIPTIONS_ENABLED=false`, the gate is a pass-through (default unlimited tier ⇒ all features true).

---

## Scope

### 1. Endpoint → Feature Gate Map — `server/config/feature-gates.ts`

A declarative, operator-editable map describing which feature key (from Sprint 159) protects which route prefix + method. Anything not listed is **ungated** (available on every tier).

```ts
// server/config/feature-gates.ts
import type { FeatureKey } from './subscription-tiers';

export interface GateRule {
  /** Method(s) this rule applies to. '*' matches all. */
  methods: ('GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | '*')[];
  /** Path prefix matched against the request pathname. */
  pathPrefix: string;
  /** Feature that must be `true` in the tier's entitlements. */
  feature: FeatureKey;
}

export const FEATURE_GATES: GateRule[] = [
  { methods: ['*'], pathPrefix: '/api/v1/automations',     feature: 'automations' },
  { methods: ['*'], pathPrefix: '/api/v1/webhooks',        feature: 'webhooks' },
  { methods: ['*'], pathPrefix: '/api/v1/plugins',         feature: 'plugins' },
  { methods: ['*'], pathPrefix: '/api/v1/custom-fields',   feature: 'customFields' },
  { methods: ['*'], pathPrefix: '/api/v1/tokens',          feature: 'apiTokens' },
  { methods: ['*'], pathPrefix: '/api/v1/boards/:id/state-transitions', feature: 'stateTransitions' },
  // calendarView / timelineView / healthCheck are client-route features —
  // gated on their data endpoints where applicable.
];
```

> The map is intentionally **prefix + method** based so adding a new gated feature is a one-line edit. Path params (`:id`) are matched segment-wise.

---

### 2. The Middleware — `server/middlewares/featureGate.ts`

```ts
export async function applyFeatureGate(
  req: Request,
  workspaceId: string | undefined,
): Promise<Response | null> {
  if (!env.SUBSCRIPTIONS_ENABLED || !workspaceId) return null;       // pass-through

  const { pathname } = new URL(req.url);
  const rule = matchGate(req.method, pathname, FEATURE_GATES);
  if (!rule) return null;                                                // ungated route

  const { tier, features } = await resolveEntitlements(workspaceId);
  if (features[rule.feature]) return null;                              // entitled → allow

  return Response.json(
    {
      error: {
        code: 'feature-not-in-plan',
        message: `Your plan does not include ${rule.feature}.`,
        data: {
          feature: rule.feature,
          currentTier: tier,
          requiredTier: minimumTierFor(rule.feature),   // lowest tier whose features[feature] === true
          upgradeUrl: '/settings/billing',
        },
      },
    },
    { status: 402 },
  );
}
```

- Returns `null` to continue the chain, or a `Response` to short-circuit.
- `matchGate` returns the **first** matching rule (most-specific prefixes listed first).
- `minimumTierFor(feature)` scans `SUBSCRIPTION_TIERS` in ascending order for the cheapest tier that enables the feature — surfaced so the client can say "Upgrade to Business".

---

### 3. Wiring into the Request Pipeline

In the server entrypoint (`server/index.ts`), the gate runs **after** `authenticate` (which must now also resolve `workspaceId` onto the request context) and **before** route dispatch:

```
authenticate → resolveWorkspaceContext → applyRateLimit (162) → applyFeatureGate → route handler
```

`resolveWorkspaceContext` resolves the target workspace once per request and memoizes it; for board/card/list routes it derives workspace from the path resource so tier checks always use the workspace that owns the resource.

---

### 4. Whose Tier Applies?

Feature gating uses the **workspace that owns the targeted resource**:

- Workspace/board/card/list routes → that workspace's subscription tier.
- Workspace-level account routes (e.g. tokens scoped to a workspace) → that workspace's tier.

This means a guest invited onto a Tier-3 workspace can use Tier-3 features on that workspace even if they belong to a different lower-tier workspace elsewhere.

---

### 5. Error Envelope & Client Contract

All gate rejections use the existing project error shape with a stable `code: 'feature-not-in-plan'` and a `402` status (distinct from `403` permission errors and `429` rate-limit errors). The `data` block always includes `feature`, `currentTier`, `requiredTier`, and `upgradeUrl` so the client (Sprint 163) can render a consistent upgrade modal without special-casing each feature.

---

## Deliverables

1. `server/config/feature-gates.ts` — declarative endpoint→feature gate map.
2. `server/middlewares/featureGate.ts` — `applyFeatureGate` + `matchGate` + `minimumTierFor`.
3. `resolveWorkspaceContext` step added to the request pipeline; `workspaceId` available on request context.
4. Gate wired into `server/index.ts` after auth, before dispatch.
5. `402 feature-not-in-plan` standardized error envelope.
6. Unit tests: gate matching (method + prefix + path params), entitlement pass/block, `minimumTierFor`, pass-through when flag off, correct workspace resolution for board-scoped vs workspace-scoped routes.

---

## Acceptance Criteria

1. A Tier-1 workspace calling `POST /api/v1/automations` gets `402 feature-not-in-plan` with `requiredTier: 'tier_2'` and `upgradeUrl`.
2. A Tier-2 workspace calling the same endpoint passes through to the handler.
3. A Tier-1 workspace calling `POST /api/v1/webhooks` gets `requiredTier: 'tier_3'`.
4. Ungated routes (e.g. `GET /api/v1/boards`) are never blocked by the gate regardless of tier.
5. When `SUBSCRIPTIONS_ENABLED=false`, no request is ever gated.
6. A guest from a Tier-1 workspace can hit a gated feature on a Tier-3 board because the gate resolves the board's workspace tier.
7. Adding a new gated feature requires only one new line in `feature-gates.ts` (plus the feature key existing in `subscription-tiers.ts`).
8. Gate rejections never leak which other tiers exist beyond `requiredTier`.
