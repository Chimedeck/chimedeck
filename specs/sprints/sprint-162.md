# Sprint 162 — Subscriptions: Tier-Aware Workspace-Wide Rate Limiting

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 14 (Rate Limiting infra — `rateLimiter.ts`), Sprint 158 (`getCurrentTier`), Sprint 159 (tier limits config)
> **Status:** ⬜ Future

---

## Goal

Extend the existing Redis sliding-window rate limiter so that **READ** and **WRITE** request budgets are **per workspace, per minute**, with the ceiling taken from the active tier's `readRequestsPerMinute` / `writeRequestsPerMinute`. The budget is **shared across all members** of the workspace (not per-user), matching the requirement "X WRITE/READ request per minute for all members in the organisation" where workspace is the organisation. `'unlimited'` tiers bypass the limit.

---

## Strict Boundary

1. This sprint changes **only** the rate-limiting layer. It does not touch feature gating (160) or resource counts (161).
2. The budget key is the **workspace id**, not the user id — all members of a workspace draw from one shared bucket per class.
3. Two classes only: `read` (GET/HEAD) and `write` (POST/PUT/PATCH/DELETE). The existing `auth` and `upload` classes from Sprint 14 are preserved and remain **per-identifier** (not tier-scoped).
4. Gated behind both `RATE_LIMIT_ENABLED` (existing) **and** `SUBSCRIPTIONS_ENABLED`. If either is off, fall back to Sprint 14's static per-user limits.
5. Requires Redis. With Redis unavailable, degrade gracefully (allow traffic), exactly as Sprint 14 does today.

---

## Scope

### 1. Tier-Aware Limit Resolution

The limiter resolves the per-minute ceiling at request time from the workspace tier:

```ts
// server/middlewares/rateLimiter.ts (extended)
type WorkspaceRouteClass = 'read' | 'write';

async function workspaceLimitFor(workspaceId: string, cls: WorkspaceRouteClass): Promise<Limit> {
  const { limits } = await resolveEntitlements(workspaceId);
  return cls === 'read' ? limits.readRequestsPerMinute : limits.writeRequestsPerMinute;
}
```

`classifyRoute` is reused for `auth`/`upload`; everything else maps to `read` or `write`:

```ts
function classifyWorkspaceClass(method: string): WorkspaceRouteClass {
  return method === 'GET' || method === 'HEAD' ? 'read' : 'write';
}
```

---

### 2. Workspace-Scoped Sliding-Window Key

The Redis key switches from per-identifier to per-workspace for the read/write classes:

```
Key (Sprint 14, preserved for auth/upload):  rl:<userId|ip>:<class>:<windowEpoch>
Key (new, workspace-scoped read/write):       rl:ws:<workspaceId>:<read|write>:<windowEpoch>
```

The same atomic `INCR + EXPIRE` Lua script is reused — only the key and the limit value change. The window stays 60 seconds.

---

### 3. Applying the Limit

`applyRateLimit` is extended:

```ts
export async function applyRateLimit(req, ctx, client): Promise<Response | null> {
  if (!env.RATE_LIMIT_ENABLED || !client) return null;

  // auth / upload classes — unchanged Sprint 14 behaviour (per-identifier)
  // ...

  if (env.SUBSCRIPTIONS_ENABLED && ctx.workspaceId) {
    const cls = classifyWorkspaceClass(req.method);
    const limit = await workspaceLimitFor(ctx.workspaceId, cls);
    if (isUnlimited(limit)) return null;                       // tier-4 reads etc.
    const key = `rl:ws:${ctx.workspaceId}:${cls}:${windowEpoch()}`;
    const result = await checkLimit(client, key, limit);
    if (!result.allowed) return rateLimitResponse(result, cls);
  }
  return null;
}
```

`rateLimitResponse` returns the existing `429 rate-limit-exceeded` envelope with a `Retry-After` header, plus a `data` block:

```json
{ "error": { "code": "rate-limit-exceeded",
  "data": { "scope": "workspace", "class": "write", "limit": 20, "retryAfterSeconds": 12, "currentTier": "tier_1" } } }
```

---

### 4. Pipeline Ordering

The workspace-scoped limiter runs after `resolveWorkspaceContext` (Sprint 160) so `workspaceId` is known, and **before** feature gating so a flood of requests is shed cheaply:

```
authenticate → resolveWorkspaceContext → applyRateLimit (workspace-scoped) → applyFeatureGate → limitGuard (in handlers) → route
```

For board/card/list routes the rate budget is drawn from the resource's workspace (consistent with Sprint 160 §4), so guests acting on a higher-tier workspace draw from that workspace budget.

---

### 5. Observability

- Emit a counter/log when a workspace hits its read or write ceiling (`workspace_rate_limit_hit{tier,class}`) so operators can spot workspaces that should upgrade.
- Optional response header `X-RateLimit-Remaining-Workspace` exposing remaining budget in the current window (best-effort; computed as `limit - count`).

---

## Deliverables

1. `server/middlewares/rateLimiter.ts` extended with `workspaceLimitFor`, `classifyWorkspaceClass`, and workspace-scoped keying for read/write.
2. Workspace-scoped Redis key scheme (`rl:ws:<id>:<class>:<epoch>`) reusing the existing atomic Lua script.
3. `429 rate-limit-exceeded` envelope extended with `scope`, `class`, `limit`, `currentTier`.
4. Pipeline wiring after `resolveWorkspaceContext`, before feature gate.
5. `'unlimited'` bypass for high tiers; graceful Redis-down fallback preserved.
6. Tests: shared bucket across two users in one workspace, separate buckets across workspaces, read vs write separation, tier ceiling values (Tier 1: 20 write / 100 read; Tier 4: 1000 write / 10000 read), unlimited bypass, fallback to Sprint 14 limits when `SUBSCRIPTIONS_ENABLED=false`.

---

## Acceptance Criteria

1. Two different users in the same Tier-1 workspace share one write bucket: their combined 21st write in a minute gets `429`.
2. The 101st read in a minute for a Tier-1 workspace gets `429` (`limit: 100`, `class: 'read'`).
3. A Tier-4 workspace is limited at 1000 write / 10000 read per minute — and not before; a limit configured as `'unlimited'` would bypass this layer entirely.
4. Read and write budgets are independent (exhausting writes does not block reads).
5. Two separate workspaces never share a bucket.
6. `429` responses include `Retry-After` and the `scope: 'workspace'` data block.
7. When `SUBSCRIPTIONS_ENABLED=false`, the limiter falls back to Sprint 14 per-user static limits.
8. With Redis unavailable, requests pass through (logged), matching Sprint 14.
9. Board-scoped requests draw from the board workspace budget, not the caller's other workspace memberships.
