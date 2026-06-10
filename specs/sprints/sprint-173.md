# Sprint 173 - Metadata Trigger Engine for Card Move Lifecycle

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 172 (Dynamic Workflow Phase Metadata on Columns), Sprint 154 (State Transitions: Card Move Enforcement), Sprint 159 (Subscriptions: Tier Entitlements Config + Resolver), Sprint 160 (Subscriptions: Conditional Feature-Gating Middleware)
> **Status:** ⬜ Future

---

## Goal

Execute deterministic, tier-aware phase triggers whenever a card enters a destination column with workflow metadata flags such as Sync Document, Ready for Dev, Generate Sprint, or Update As Built.

---

## Strict Boundary

1. Trigger orchestration and dispatch are implemented here.
2. Downstream content generation/edit engines are invoked but implemented in later sprints.
3. Card moves must remain low-latency using async job handoff.

---

## Scope

### 1. Move Event Trigger Evaluator

On successful move commit:

- inspect destination list metadata via `resolveColumnWorkflowPhases`
- evaluate service-tier eligibility
- enqueue trigger jobs for matched phases

Trigger mapping baseline:
- `SYNC_DOCUMENT` -> docs sync workflow
- `READY_FOR_DEV` -> docs sync workflow (strict mode)
- `GENERATE_SPRINT` -> sprint generation workflow
- `UPDATE_AS_BUILT` -> as-built sync workflow

### 2. Trigger Run Persistence

Create tables:

- `card_phase_trigger_runs`
- `card_phase_trigger_attempts`

Tracked fields:
- run status (`QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `SKIPPED`)
- failure reason envelope
- source move event id
- tier decision snapshot

### 3. Job Queue + Idempotency

- Queue worker for phase runs (Bun worker or existing queue layer)
- Idempotency key: `cardId + destinationListId + phase + moveEventId`
- Retry policy with exponential backoff
- Dead-letter log for repeated failures

### 4. Service Tier Gating

Use workspace entitlements to allow/deny phase execution:

- `SYNC_DOCUMENT`: minimum tier configurable
- `GENERATE_SPRINT`: minimum tier configurable
- `UPDATE_AS_BUILT`: minimum tier configurable

When denied:
- mark run `SKIPPED`
- emit user-visible reason and upgrade hint

### 5. Observability + Notification Hooks

Add events:

- `card_phase_trigger_queued`
- `card_phase_trigger_started`
- `card_phase_trigger_succeeded`
- `card_phase_trigger_failed`
- `card_phase_trigger_skipped_tier`

Expose status read API for UI timeline:
- `GET /api/v1/cards/:cardId/phase-trigger-runs`

---

## Deliverables

1. Deterministic move-time metadata trigger evaluator.
2. Persistent trigger run and attempt records.
3. Async worker with idempotent dispatch and retries.
4. Tier-aware gating for premium phases.
5. Trigger timeline API and audit events.

---

## Acceptance Criteria

1. Moving a card into phase-tagged columns enqueues matching phase jobs.
2. Trigger runs are persisted with statuses and attempt history.
3. Duplicate move replay does not execute duplicate phase side effects.
4. Tier-restricted phases are skipped with explicit reason and no hidden failure.
5. Trigger status can be queried and shown in card activity/timeline.
