# Sprint 163 — Subscriptions: Billing & Plan Management UI

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 158 (workspace + Stripe endpoints), Sprint 159 (`/workspaces/:workspaceId/entitlements`), Sprint 160 (402 feature-not-in-plan), Sprint 161 (402 limit-reached), Sprint 17 (App shell / sidebar), Sprint 96 (Settings tab layout)
> **Status:** ⬜ Future

---

## Goal

Give workspace owners/admins and members a **Billing** experience: a plan-comparison + management page, live usage meters against tier limits, Stripe Checkout / Billing Portal redirects, and a shared **Upgrade modal** that the whole app surfaces whenever the API returns a `402` (feature-not-in-plan or limit-reached). All numbers shown come straight from `GET /api/v1/workspaces/:workspaceId/entitlements` so the UI never hardcodes tier values.

---

## Strict Boundary

1. UI only — no new server endpoints (all consumed from Sprints 158–162). Tier numbers are **never** duplicated in client code; they come from the entitlements API.
2. Plan changes are performed through Stripe (Checkout for new subscriptions, Billing Portal for upgrades/downgrades/cancellation) — the client never writes a tier directly.
3. Members (non-admins/non-owners) see a **read-only** billing view; only workspace OWNER/ADMIN sees Checkout/Portal actions.
4. All strings go through the extension's `translations/en.json` (i18n convention).
5. Entire billing/subscription UI is controlled by `SUBSCRIPTIONS_ENABLED`: when `false`, billing routes and upgrade affordances are hidden/disabled and 402 plan-upgrade UX is not shown.

---

## Scope

### 1. Extension Structure

```
src/extensions/Subscription/
  api.ts                       # RTK Query: getEntitlements, createCheckout, createPortal
  config/
    planPresentation.ts        # display-only: tier label, blurb, highlight bullet copy (NOT limits)
  containers/
    BillingPage/
      BillingPage.tsx          # /workspaces/:workspaceId/settings/billing route
  components/
    PlanComparisonGrid.tsx     # 4 tier columns built from entitlements + planPresentation
    CurrentPlanCard.tsx        # active tier, renewal date, cancel-at-period-end banner
    UsageMeters.tsx            # progress bars: workspaces, boards, storage, etc.
    UpgradeModal.tsx           # shared modal triggered by 402 responses
    OverLimitBadge.tsx         # "Over plan limit" pill when current > limit
  hooks/
    usePlanGate.ts             # intercepts 402 errors → opens UpgradeModal
  translations/
    en.json
```

---

### 2. Billing Page (`/workspaces/:workspaceId/settings/billing`)

Added as a tab/entry in Workspace Settings and a sidebar link (owner/admin action, read-only for members):

- **CurrentPlanCard:** tier label, status, `current_period_end` ("Renews May 30, 2026"), and a warning ribbon when `cancel_at_period_end` is true ("Your plan ends on …").
- **UsageMeters:** one bar per limited resource from the `usage` block — workspaces, total boards, storage (GB used / GB allowed), plus per-board meters surfaced contextually. `'unlimited'` renders as "Unlimited" with no bar. Bars turn amber ≥80% and red at/over 100%, with an `OverLimitBadge` when `current > limit` (post-downgrade).
- **PlanComparisonGrid:** four columns (Starter / Team / Business / Enterprise) rendering each tier's limits and feature ticks from the entitlements config + display copy. The current tier is highlighted; each higher tier shows an **Upgrade** button (owner only).

---

### 3. Stripe Redirects

- **Upgrade/Subscribe (owner/admin):** `Upgrade` button → `POST /workspaces/:workspaceId/subscription/checkout { tier }` → redirect to returned Stripe Checkout `url`. Success/cancel URLs return to `/workspaces/:workspaceId/settings/billing?checkout=success|cancelled` and show a toast; on success the page refetches entitlements (the webhook may lag, so poll entitlements a few times with backoff).
- **Manage/Cancel/Downgrade (owner/admin):** `Manage billing` button → `POST /workspaces/:workspaceId/subscription/portal` → redirect to Stripe Billing Portal.
- Non-admin members see the grid and meters but no action buttons; a hint reads "Contact your workspace admin to change the plan."

---

### 4. Shared Upgrade Modal (402 interception)

`usePlanGate` wraps RTK Query error handling: whenever any request returns `402` with `code: 'feature-not-in-plan'` or `'limit-reached'`, it opens `UpgradeModal` populated from the error `data`:

- **feature-not-in-plan:** "Automations are available on the Team plan and up." with the `requiredTier` highlighted and an **Upgrade to {tier}** CTA (owner/admin) / "Ask your workspace admin to upgrade" (member).
- **limit-reached:** "You've reached your plan's board limit (2 of 2). Upgrade for more." with current/limit from `data` and an **Upgrade** CTA.
- The modal links to `/workspaces/:workspaceId/settings/billing` and never blocks the rest of the UI (the originating action is simply aborted).

Because both error shapes carry `upgradeUrl`, `currentTier`, and (for features) `requiredTier`, the modal needs no per-feature special-casing.

---

### 5. Inline Upgrade Affordances

- Disabled/locked feature entry points (e.g. the Automation panel button, Webhooks settings) show a small `LockClosedIcon` + tooltip "Available on Team plan" when the current tier lacks the feature, derived from the cached `features` map — preventing the 402 round-trip for obvious cases while the 402 modal remains the backstop.
- Resource creation buttons (New Board, Add Column, Invite) show remaining headroom on hover ("1 of 2 boards used") when within 1 of the cap.

---

### 6. RTK Query Slice

```ts
// src/extensions/Subscription/api.ts
getEntitlements(workspaceId)         // GET /api/v1/workspaces/:workspaceId/entitlements  (tags: ['Entitlements'])
createCheckout({ workspaceId, tier }) // POST /workspaces/:workspaceId/subscription/checkout
createPortalSession(workspaceId)      // POST /workspaces/:workspaceId/subscription/portal
```

`getEntitlements` is invalidated after returning from Checkout and on a focused interval so usage meters stay current.

---

## Deliverables

1. `src/extensions/Subscription/` extension (api, containers, components, hooks, config, translations).
2. `/workspaces/:workspaceId/settings/billing` page with CurrentPlanCard, UsageMeters, PlanComparisonGrid.
3. Stripe Checkout + Billing Portal redirect flows (workspace owner/admin actions; member read-only view).
4. Shared `UpgradeModal` + `usePlanGate` 402 interceptor wired into the RTK Query base query.
5. Inline lock icons + headroom hints on gated features and near-cap creation buttons.
6. `OverLimitBadge` for post-downgrade over-limit resources.
7. i18n `en.json`; all numbers sourced from the entitlements API (zero hardcoded tier values).
8. UI-level feature-flag guard: `SUBSCRIPTIONS_ENABLED=false` hides billing navigation/route and disables upgrade modal triggers.

---

## Acceptance Criteria

1. `/workspaces/:workspaceId/settings/billing` shows the current tier, renewal date, and live usage meters matching `GET /workspaces/:workspaceId/entitlements`.
2. Plan comparison grid renders all four tiers with limits and feature ticks pulled from the API, current tier highlighted.
3. A workspace owner/admin clicking **Upgrade to Team** is redirected to Stripe Checkout; returning with `?checkout=success` refetches entitlements and reflects the new tier (after webhook lands, via polling).
4. A workspace owner/admin clicking **Manage billing** is redirected to the Stripe Billing Portal.
5. A non-admin member sees the grid and meters but no Checkout/Portal buttons.
6. Any `402 feature-not-in-plan` anywhere in the app opens the UpgradeModal with the correct feature + required tier.
7. Any `402 limit-reached` opens the UpgradeModal showing current/limit and an upgrade CTA.
8. `'unlimited'` limits render as "Unlimited" (no progress bar); over-limit resources after a downgrade show the `OverLimitBadge`.
9. Usage meters turn amber at ≥80% and red at ≥100%.
10. No tier number is hardcoded in client code — changing `subscription-tiers.ts` server-side updates the UI with no client edit.
11. When `SUBSCRIPTIONS_ENABLED=false`, billing UI entry points are hidden and no subscription-related modal/upgrade CTA is rendered.
