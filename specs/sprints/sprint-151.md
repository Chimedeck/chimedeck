# Sprint 151 — Trello Adapter Response Normalization: Boards, Cards, Lists, Checklists, Labels

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 149 (Normalization Baseline & Contract Matrix)
> **Status:** ⬜ Future

---

## Goal

Normalize core board-model adapter responses so Trello client integrations receive Trello-compatible payload shapes from existing endpoints introduced in Sprints 143–146.

---

## Strict Boundary

1. Adapter-only scope under `server/extensions/trelloCompat/**`.
2. Do not alter Native API response contracts.
3. No UI work in this sprint.

---

## Scope

1. Normalize board payloads:
- `GET /boards/{id}` and related board sub-resources already implemented
- `prefs`, `labelNames`, `memberships`, `limits`, URL fields, and booleans

2. Normalize card payloads:
- `badges`, `cover`, `idMembers`, `idLabels`, `idChecklists`, `descData`, `limits`, date fields, and short link/url fields
- Ensure consistency between card list endpoints and card detail endpoints

3. Normalize list payloads:
- `closed`, `idBoard`, `name`, `pos`, `subscribed`, `softLimit`, `limits`

4. Normalize checklist and checkItem payloads:
- `state` mapping, due/date fields, positional fields, id references

5. Normalize label payloads:
- `idBoard`, `name`, `color`, and empty-value behavior

6. Normalize field projection behavior where Trello supports `fields=` filters.

---

## Endpoint Mapping Focus

1. Preserve endpoint coverage from sprints 143–146 and improve shape parity only.
2. Remove payload drift between serializers used by different routers for the same entity type.
3. Ensure the same entity serialized in different endpoints has consistent Trello-compatible shape.

---

## Deliverables

1. Shared normalization helpers for board/card/list/checklist/label serializers
2. Contract tests for cross-endpoint payload consistency
3. Matrix updates that mark each endpoint as:
- Fully normalized
- Partially normalized
- Deferred with explicit reason

---

## Acceptance Criteria

1. Core entity responses are consistent with Trello schema expectations across all implemented routes in these groups.
2. `fields=` projection does not produce invalid shapes.
3. No Native API files are touched.
