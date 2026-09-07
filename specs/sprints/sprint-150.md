# Sprint 150 — Trello Adapter Response Normalization: Actions Group

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 149 (Normalization Baseline & Contract Matrix)
> **Status:** ⬜ Future

---

## Goal

Normalize all implemented Actions responses under `/trello/1/actions/*` to align with Trello Actions contracts.

Reference contract:
- https://developer.atlassian.com/cloud/trello/rest/api-group-actions/

---

## Strict Boundary

1. Adapter-only changes in `server/extensions/trelloCompat/**`.
2. No changes to native comment/activity endpoints.
3. No changes to non-adapter authentication middleware behavior outside adapter integration points.

---

## Scope

1. Normalize payload shape for currently implemented endpoints:
- `GET /actions/{id}`
- `PUT /actions/{id}`
- `DELETE /actions/{id}`
- `GET /actions/{id}/board`
- `GET /actions/{id}/card`
- `GET /actions/{id}/list`
- `GET /actions/{id}/member`
- `GET /actions/{id}/memberCreator`
- `PUT /actions/{id}/text`
- `POST /actions/{idAction}/reactions`
- `DELETE /actions/{idAction}/reactions/{id}`
- `GET /actions/{idAction}/reactionsSummary`

2. Add/normalize missing Actions endpoints required by Trello clients:
- `GET /actions/{id}/{field}`
- `GET /actions/{id}/organization`
- `GET /actions/{idAction}/reactions`
- `GET /actions/{idAction}/reactions/{id}`

3. Normalize query-parameter behavior:
- `fields`
- `member`
- `member_fields`
- `memberCreator`
- `memberCreator_fields`
- `display`
- `entities`

4. Normalize comment action mutation semantics:
- Keep Trello behavior that only comment actions are mutable/deletable
- Match Trello-style error status and response body for unsupported action types

---

## Endpoint Mapping Highlights

1. `GET /actions/{id}`:
- Ensure `data` includes Trello-consistent sub-entities for card/board/list when available
- Normalize `type`, `date`, `idMemberCreator`, `memberCreator`
- Include Trello-compatible `limits` and optional `display` envelope behavior when requested

2. `GET /actions/{id}/{field}`:
- Return single field payload according to Trello behavior
- Validate unsupported field values with Trello-style error response

3. Reactions endpoints:
- Normalize reaction object keys and nested member/emoji shapes
- Keep id semantics consistent for create/list/get/delete paths

---

## Deliverables

1. Updated adapter actions serializer and router normalization rules
2. Contract tests for each Actions endpoint and field projection path
3. Compatibility fixtures proving parity against Trello docs examples

---

## Acceptance Criteria

1. All Actions endpoints listed above return Trello-compatible response shapes.
2. Query flags (`fields`, `member*`, `display`, `entities`) behave consistently across Actions reads.
3. Reactions list/get/create/delete/reactionsSummary are shape-compatible and deterministic.
4. No Native API files are modified.
