# Sprint 175 - Multi-Turn AI Editing Orchestrator for Specs Repo

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 173 (Metadata Trigger Engine for Card Move Lifecycle), Sprint 174 (Deep Context Gathering and Impact Analysis Service), Sprint 170 (Specs Markdown Editor + Commit Sync)
> **Status:** ⬜ Future

---

## Goal

Implement the required turn-by-turn AI editing execution flow:
`POST to EDIT -> Gather Context -> Determine file scope -> Create files -> Edit files -> Commit`.

---

## Strict Boundary

1. This sprint implements orchestration, not model-provider internals.
2. Only markdown and approved specs paths can be modified.
3. Every step must persist execution state for audit and resume.

---

## Scope

### 1. Orchestrator API and State Machine

Add API:

- `POST /api/v1/cards/:cardId/ai/edit`

Execution states:
- `REQUESTED`
- `CONTEXT_GATHERED`
- `FILE_SCOPE_PLANNED`
- `FILES_CREATED`
- `FILES_EDITED`
- `COMMITTED`
- `FAILED`

Persist in:
- `card_ai_edit_runs`
- `card_ai_edit_steps`

### 2. Step 1 and Step 2: Context + File Scope

- invoke Sprint 174 gather and planning services
- snapshot selected references
- require human-approval checkpoint when configured by phase metadata

### 3. Step 3: Create New Files

Create-only stage executes before edits:

- create files under allowed paths:
  - `specs/request_changelog/`
  - `specs/sprints/`
  - `specs/architecture/`
  - `specs/security/`
- reject out-of-scope paths with validation error

### 4. Step 4: Edit Existing Files

- apply structured edits to selected markdown files
- preserve YAML front-matter
- enforce schema checks for known doc types

### 5. Step 5: Commit

- stage only files touched in current edit run
- commit message includes card id and phase
- push using existing GitHub App path when enabled

### 6. Resume, Retry, and Human-in-the-Loop

- resume failed run from last successful step
- per-step retry with capped attempts
- manual approve/reject endpoint:
  - `POST /api/v1/cards/:cardId/ai/edit/:runId/approve`
  - `POST /api/v1/cards/:cardId/ai/edit/:runId/reject`

---

## Deliverables

1. End-to-end multi-step edit orchestrator and run persistence.
2. Ordered create-before-edit execution contract.
3. Path guards and markdown/front-matter validation.
4. Commit integration and audit trail per step.
5. Resume/retry and approval controls.

---

## Acceptance Criteria

1. `POST /ai/edit` creates an execution run and advances through all required steps.
2. File creation always occurs before edits in successful runs.
3. Only approved specs paths are modified.
4. Every step is auditable with timestamps, inputs, and outputs.
5. Failed runs can resume without repeating already completed steps.
6. Successful runs create a commit containing only run-scoped file changes.
