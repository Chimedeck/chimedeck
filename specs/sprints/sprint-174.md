# Sprint 174 - Deep Context Gathering and Impact Analysis Service

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 169 (Backend Repo Fetch + Specs Markdown Delivery), Sprint 170 (Specs Markdown Editor + Commit Sync), Sprint 173 (Metadata Trigger Engine for Card Move Lifecycle)
> **Status:** ⬜ Future

---

## Goal

Provide a reusable context service that gathers relevant documentation, code references, previous cards, and historical commits before any AI file generation/edit operation runs.

---

## Strict Boundary

1. This sprint builds context retrieval and ranking services.
2. This sprint does not perform final file writes or commits.
3. Returned context must be deterministic and auditable.

---

## Scope

### 1. Multi-Source Search Connectors

Implement connectors:

- repo docs search (`specs/**/*.md`)
- code search (`src/**`, `server/**`)
- historical cards search
- git history search (recent commits + changed paths)

Expose unified API:

- `POST /api/v1/cards/:cardId/ai/context/gather`

Input:
- card id
- intent (`sync_document`, `generate_sprint`, `update_as_built`)
- optional focus paths

Output:
- ranked context chunks with source metadata and confidence score

### 2. Duplicate Effort and Impact Heuristics

Heuristics to reduce redundant generation:

- near-duplicate card detection by semantic similarity
- overlap scoring against recently changed spec files
- impact map of likely files needing update based on changed entities

Output fields:
- `possibleDuplicateCards`
- `likelyImpactedFiles`
- `confidence`

### 3. File Scope Planner

Add planning utility:

- `POST /api/v1/cards/:cardId/ai/file-scope`

Returns:
- files to create
- files to edit
- files to leave unchanged
- rationale per file

### 4. Context Snapshot Storage

Persist context snapshots for traceability:

- `card_ai_context_snapshots` table
- stored search inputs, selected chunks, planner output
- immutable snapshot hash referenced by later execution runs

### 5. Latency and Safety Controls

- token/size budget management for context payloads
- path allowlist so only permitted repo zones are searched
- redact secrets from gathered context before model handoff

---

## Deliverables

1. Unified context gather API across docs, code, cards, and git history.
2. Duplicate-detection and impact-analysis heuristics.
3. File-scope planner API with create/edit/no-change decisions.
4. Context snapshot persistence for reproducibility.
5. Safety and budget controls for model prompts.

---

## Acceptance Criteria

1. Triggered workflows can retrieve ranked context in one API call.
2. Output includes related past cards and commit-level references when relevant.
3. File scope planner returns deterministic create/edit/no-change plan with rationale.
4. Every context gather call produces a persisted snapshot linked to card and intent.
5. Secret-like values are redacted from model-facing context payloads.
