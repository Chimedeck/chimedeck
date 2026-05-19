# Sprint 152 — Trello Adapter Response Normalization: Members, Organizations, Search, CustomFields

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 149 (Normalization Baseline & Contract Matrix), Sprint 150 (Actions), Sprint 151 (Core Entities)
> **Status:** ⬜ Future

---

## Goal

Complete adapter response normalization for discovery and metadata surfaces so automation and migration clients can rely on Trello-compatible payload contracts.

---

## Strict Boundary

1. Adapter-only implementation under `server/extensions/trelloCompat/**`.
2. Native endpoints remain unchanged.
3. Search index internals are not redesigned; only adapter response and query-shape normalization are in scope.

---

## Scope

1. Members normalization:
- Normalize `fullName`, `username`, `initials`, avatar fields, status fields
- Align member object shape across member endpoints and embedded entities

2. Organizations normalization:
- Align workspace-to-organization serialization with Trello fields and prefs shape
- Normalize memberships and visibility-related fields

3. Search normalization:
- Normalize `/search` envelope and per-model arrays (`boards`, `cards`, `members`, `organizations`)
- Normalize model type parsing and default-limit behavior
- Ensure each returned entity shape matches the normalized serializers from prior sprints

4. CustomFields normalization:
- Normalize custom field definitions (`type`, `display`, `options`, `pos`, `fieldGroup`)
- Normalize custom field item values for text/number/date/checkbox/list
- Ensure option serialization and deletion side effects match Trello expectations

5. Error envelope normalization for Trello adapter only:
- Align adapter errors to Trello-style shape/status patterns where applicable

---

## Deliverables

1. Normalized member/org/search/custom field serializers and adapter routes
2. End-to-end contract tests for migration scenarios using these endpoints
3. Updated parity matrix with completion status per endpoint

---

## Acceptance Criteria

1. `/trello/1/members/*`, `/trello/1/organizations/*`, `/trello/1/search*`, and `/trello/1/customFields*` responses are Trello-compatible in shape.
2. Search results always return normalized entities, not router-specific variants.
3. Custom field option and item payloads are compatible with Trello client expectations.
4. No Native API file changes are required.
