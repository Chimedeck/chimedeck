# Sprint 172 - Dynamic Workflow Phase Metadata on Columns

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 153 (State Transitions: DB + Core API), Sprint 155 (State Transitions: Graph Editor Foundation), Sprint 156 (State Transitions: Edges, Toolbar & Real-Time Sync), Sprint 157 (State Transitions: Kanban Enforcement UI + Copy to Board)
> **Status:** ⬜ Future

---

## Goal

Decouple automation from fixed list names by attaching workflow phase metadata directly to column nodes through the state transition diagram editor and exposing this metadata to move-time trigger evaluation.

---

## Strict Boundary

1. This sprint defines and persists phase metadata on columns.
2. This sprint does not execute full AI document-generation workflows.
3. Existing move enforcement rules remain intact and backward-compatible.

---

## Scope

### 1. Graph Schema Extension

Extend `board_state_transitions.graph` node schema:

```json
{
  "id": "list_<id>",
  "type": "column",
  "data": {
    "listId": "...",
    "title": "...",
    "workflowPhases": [
      "NEW_DRAFT",
      "REFINED_PENDING_REVIEW",
      "SYNC_DOCUMENT",
      "READY_FOR_DEV",
      "GENERATE_SPRINT",
      "UPDATE_AS_BUILT"
    ],
    "phaseConfig": {
      "serviceTierOverride": null,
      "autoRun": false,
      "requiresHumanApproval": true
    }
  }
}
```

### 2. Diagram Editor Metadata UX

In column rectangle edit panel:

- Add `Workflow Phases` multi-select control
- Add phase-specific config controls (`autoRun`, approval requirement, tier override)
- Validate incompatible combinations
- Render phase chips directly on column node for quick visual debugging

### 3. API and Validation

Add/update endpoints:

- `PUT /api/v1/boards/:boardId/state-transitions/graph`
- `GET /api/v1/boards/:boardId/state-transitions/rules`

Validation requirements:
- only known phase enum values accepted
- duplicate phases rejected
- malformed phase config rejected with `422`

### 4. Runtime Metadata Resolver

Add resolver utilities used by move handlers and agent orchestrator:

- `resolveColumnWorkflowPhases({ boardId, listId })`
- `resolvePhaseConfig({ boardId, listId, phase })`
- cache with invalidation on graph save WS event

### 5. Migration and Compatibility

- Existing boards without phase metadata should continue working
- Empty `workflowPhases` means no AI trigger
- Support incremental rollout under a feature flag

---

## Deliverables

1. Column metadata schema for workflow phases.
2. Diagram editor controls for phase configuration.
3. API validation and resolver helpers.
4. Runtime access layer for move-trigger evaluation.
5. Backward-compatible migration behavior.

---

## Acceptance Criteria

1. User can edit a column node and assign one or more workflow phases.
2. Saved metadata is persisted in state transition graph and reloads correctly.
3. Invalid phase values/configs are rejected with clear validation errors.
4. Move-time resolver returns destination-column phases deterministically.
5. Boards with no phase metadata continue to function without AI side effects.
