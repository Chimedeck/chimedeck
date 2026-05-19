# Sprint 149 — Trello Adapter Response Normalization: Baseline & Contract Matrix

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 148 (Trello Compat: Actions, Search & CustomFields)
> **Status:** ⬜ Future

---

## Goal

Create a single normalization baseline for the Trello Compatible Adapter so responses from implemented endpoints (Sprints 142–148) match Trello REST contracts more closely without changing Native API behavior.

This sprint is planning and implementation scope for adapter-layer response shape only.

---

## Strict Boundary

1. Only files under `server/extensions/trelloCompat/**` are in scope.
2. Native API routes under `server/extensions/**` (outside `trelloCompat`) are out of scope.
3. DB schema changes are out of scope unless strictly required for Trello response parity and kept adapter-isolated.

---

## Scope

1. Build endpoint-by-endpoint normalization matrix for all implemented Trello adapter groups:
- Boards
- Cards
- Lists
- Checklists
- Labels
- Members
- Organizations
- Actions
- Search
- CustomFields

2. Define canonical adapter output contracts in one place:
- Trello ID handling (`id` and short id usage)
- Date serialization (`ISO-8601` everywhere Trello expects date strings)
- Boolean and enum normalization (`closed`, `memberType`, `state`, etc.)
- Empty object/array conventions (`{}` vs `[]` vs `null`) to mirror Trello behavior

3. Create contract-test scaffolding focused on response schema parity for existing adapter endpoints.

---

## Endpoint Normalization Mapping (Baseline Audit)

For every endpoint currently implemented in adapter, document:
1. Current payload shape (as-is)
2. Trello expected shape (from Atlassian docs/OpenAPI)
3. Required adapter-only transform
4. Backward-compat risk
5. Test cases needed

Output artifact:
- `specs/trello-adapter-normalization/matrix.md`
- `specs/trello-adapter-normalization/endpoint-response-checklist.md`

### Group Mapping from Implemented Surface (Sprints 142–148)

| Group | Implemented in adapter | Current source area | Normalization sprint |
|------|-------------------------|---------------------|----------------------|
| Actions | Yes | `api/actions`, `serializers/action` | Sprint 150 |
| Boards | Yes | `api/boards`, `serializers/board` | Sprint 151 |
| Cards | Yes | `api/cards`, `serializers/card` | Sprint 151 |
| Lists | Yes | `api/lists`, `serializers/list` | Sprint 151 |
| Checklists | Yes | `api/checklists`, `serializers/checklist` | Sprint 151 |
| Labels | Yes | `api/labels`, `serializers/label` | Sprint 151 |
| Members | Yes | `api/members`, `serializers/member` | Sprint 152 |
| Organizations | Yes | `api/organizations`, `serializers/organization` | Sprint 152 |
| Search | Yes | `api/search` | Sprint 152 |
| CustomFields | Yes | `api/customFields`, `serializers/customField` | Sprint 152 |

This mapping keeps normalization work strictly in the Trello adapter layer and avoids any Native API contract changes.

---

## Deliverables

1. Adapter normalization conventions doc
2. Endpoint parity matrix for all existing `/trello/1/*` routes
3. Contract tests for representative endpoints in each group
4. Gap list split by severity:
- P0: Breaks Trello clients
- P1: Shape mismatch but tolerated
- P2: Cosmetic parity differences

---

## Acceptance Criteria

1. Every implemented adapter endpoint from Sprints 142–148 appears in the matrix.
2. Each matrix row contains exact current-vs-target response shape delta.
3. No planned tasks require changes in Native API handlers.
4. Contract tests fail on current mismatches and pass once adapter normalization is applied in later sprints.

---

## Notes

Primary Trello contract sources:
- Trello REST docs
- Trello OpenAPI definition referenced from Atlassian docs
