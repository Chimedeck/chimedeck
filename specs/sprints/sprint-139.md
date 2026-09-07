# Sprint 139 - Security Audit Wave 2: API Authorization and Privilege Controls

> Status: ⬜ Planned
> Scope: Security research only
> Rule: NO CODE should be created. ONLY CREATE AUDIT DOCUMENT.

---

## Goal

Identify object-level and function-level authorization weaknesses in API endpoints (OWASP Top 10 2026: Broken Access Control, Insecure Design, Security Logging and Monitoring Failures).

## Non-Negotiable Constraint

- NO CODE should be created.
- ONLY CREATE AUDIT DOCUMENT.
- All outputs must be markdown files under `security/audits/`.

## Audit Deliverables

- `missing-object-level-authorization-on-board-members-api.md`
- `api-token-overbroad-scope-and-horizontal-privilege-escalation.md`
- `search-index-cross-workspace-data-leak.md`

## Test Focus

1. Authorization checks per resource ownership.
2. API token scope overreach and lateral movement.
3. Search endpoint data exposure across tenant boundaries.

## Acceptance Criteria

1. Each loophole has its own audit file.
2. Each audit file uses the required structure exactly.
3. No server or client code changes are made.
