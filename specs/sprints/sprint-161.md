# Sprint 161 — Subscriptions: Resource Limit Enforcement

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 159 (`resolveEntitlements`, `usage`, `limits` helpers), Sprint 04 (Workspace), Sprint 05 (Board), Sprint 06 (List), Sprint 12 (Attachments), Sprint 78 (Board Members), Sprint 89 (Guest VIEWER/MEMBER split)
> **Status:** ⬜ Future

---

## Goal

Enforce the per-tier **resource limits** from `subscription-tiers.ts` at the moment a resource is created (or storage consumed). Each limited resource — workspaces, boards, columns, invited members, guests, and combined storage — gets a pre-create guard that compares **current usage** (Sprint 159 counters) against the workspace's (or workspace owner's) **limit**, returning a standard `402 limit-reached` envelope when the cap would be exceeded. `'unlimited'` limits always pass. All enforcement in this sprint is active only when `SUBSCRIPTIONS_ENABLED=true`.

---

## Strict Boundary

1. Enforcement is at **creation / consumption** boundaries only (POST/PUT/PATCH that add a resource or bytes). Existing over-limit resources after a downgrade become **read-only-over-limit**, never auto-deleted.
2. Storage is enforced at attachment **upload**, measured as the workspace-wide sum of attachment sizes against `maxStorageGb`.
3. Guests = `board_guest_access` rows (VIEWER + MEMBER guest types, Sprint 89). Invited members = `board_members` excluding guests.
4. All checks reuse `usage.ts` counters and the `exceeds()` helper — no ad-hoc counting in handlers.
5. When `SUBSCRIPTIONS_ENABLED=false`, every guard passes (default unlimited tier).
6. No endpoint in this sprint is allowed to perform subscription-tier checks without first honoring `SUBSCRIPTIONS_ENABLED`.

---

## Scope

### 1. Limit Guard Helper — `server/middlewares/limitGuard.ts`

A reusable guard invoked from creation handlers:

```ts
export async function assertWithinLimit(opts: {
  workspaceId: string;
  limitKey: keyof TierLimits;
  current: number;          // from usage.ts
  delta?: number;           // default 1
  resource: string;         // for the error envelope, e.g. 'board'
}): Promise<Response | null> {
  if (!env.SUBSCRIPTIONS_ENABLED) return null;
  const { tier, limits } = await resolveEntitlements(opts.workspaceId);
  if (!exceeds(limits[opts.limitKey], opts.current, opts.delta ?? 1)) return null;
  return Response.json(
    {
      error: {
        code: 'limit-reached',
        message: `Your plan's ${opts.resource} limit has been reached.`,
        data: {
          resource: opts.resource,
          limit: limits[opts.limitKey],
          current: opts.current,
          currentTier: tier,
          upgradeUrl: '/settings/billing',
        },
      },
    },
    { status: 402 },
  );
}
```

Returns `null` (allow) or a `402` `Response` (block).

---

### 2. Enforcement Points

| Resource | Endpoint | Limit key(s) | Current usage source |
|----------|----------|--------------|----------------------|
| Workspace | `POST /api/v1/workspaces` | `maxWorkspaces` | `getWorkspaceCountForOwner(ownerId)` |
| Board | `POST /api/v1/workspaces/:id/boards` | `maxBoardsPerWorkspace` **and** `maxBoardsTotal` | `getBoardCountForWorkspace`, `getBoardCountTotalForOwner` |
| Column/List | `POST /api/v1/boards/:id/lists` | `maxColumnsPerBoard` | `getColumnCount(board)` |
| Invited member | `POST /api/v1/boards/:id/members` (+ workspace invite accept that grants board access) | `maxInvitedMembersPerBoard` | `getInvitedMemberCount(board)` |
| Guest | `POST /api/v1/boards/:id/guests` (VIEWER + MEMBER) | `maxGuestsPerBoard` | `getGuestCount(board)` |
| Storage | `POST /api/v1/cards/:id/attachments` (and any S3 upload init) | `maxStorageGb` | `getStorageBytesTotal(workspaceId)` |

**Board creation** checks **both** caps: per-workspace and owner-total (Tier 2 caps total at 20; Tier 3 caps per-workspace at 20 with unlimited total). The guard runs both `assertWithinLimit` calls; the first failure wins.

---

### 3. Storage Enforcement Detail

- Limit converted to bytes once: `maxStorageGb * 1024³` (skip when `'unlimited'`).
- Before accepting an upload, compute `getStorageBytesTotal(workspaceId) + incomingFileSize` and compare. For multipart/large uploads (Sprint 59), the check runs at **upload initiation** using the declared `Content-Length` / part sizes; a final reconciliation on completion rejects+cleans up if the declared size was understated.
- The workspace for an attachment is resolved via `card → list → board → workspace`.
- Error envelope uses `resource: 'storage'` and includes `limit` (GB), `current` (bytes), and `incoming` (bytes).

---

### 4. Membership / Guest Nuance

- The **invited-member** guard also fires on the path where accepting a workspace invite auto-grants board membership, so members can't be added in bulk to bypass the per-board cap.
- The **guest** guard counts both guest types (VIEWER + MEMBER) toward `maxGuestsPerBoard` — Tier 1 allows 2 guests per board total, regardless of guest type.
- Promoting a guest to a full member (Sprint workspace-guest-promotion) re-checks `maxInvitedMembersPerBoard` before committing.

---

### 5. Downgrade Behaviour (Read-Only-Over-Limit)

When a subscription downgrades (Sprint 158 webhook) and existing usage now exceeds the new tier:
- No data is deleted.
- Existing resources remain **viewable**, but **new** creations are blocked by the guards until usage drops below the cap.
- A `GET /api/v1/workspaces/:workspaceId/entitlements` (Sprint 159) `usage` block lets the UI flag which resources are over-limit (`current > limit`) so Sprint 163 can show "Over your plan limit" badges.

---

## Deliverables

1. `server/middlewares/limitGuard.ts` — `assertWithinLimit` helper.
2. Guards wired into the 6 creation/consumption endpoints in §2 (workspace, board ×2 caps, column, member, guest, storage).
3. Storage byte accounting via `getStorageBytesTotal` + upload-init + completion reconciliation.
4. Membership/guest edge-case coverage (invite-accept, guest promotion).
5. `402 limit-reached` standardized error envelope with `resource`, `limit`, `current`, `currentTier`, `upgradeUrl`.
6. Integration tests per resource + the dual board-cap logic + downgrade read-only behaviour.

---

## Acceptance Criteria

1. A Tier-1 owner creating a 2nd workspace gets `402 limit-reached` (`resource: 'workspace'`, `limit: 1`).
2. A Tier-1 workspace owner creating a 3rd board (across owned workspaces) is blocked (`maxBoardsTotal: 2`).
3. A Tier-2 owner creating a 21st board across owned workspaces is blocked by `maxBoardsTotal: 20`, even if a workspace has room.
4. A Tier-3 workspace is blocked at the 21st board **in one workspace** but may create boards in another workspace (per-workspace cap, unlimited total).
5. A Tier-1 board rejects a 6th column, an 11th invited member, and a 3rd guest.
6. A Tier-1 workspace is blocked from an upload that would push combined storage past 1 GB; the partial upload is cleaned up.
7. `'unlimited'` limits (e.g. Tier-4 columns) never block.
8. After a Tier-2→Tier-1 downgrade with 5 existing boards, all 5 remain readable but a 6th cannot be created until count drops below 2.
9. All guards pass when `SUBSCRIPTIONS_ENABLED=false`.
10. Every block uses the `402 limit-reached` envelope (distinct from `402 feature-not-in-plan` and `429`).
