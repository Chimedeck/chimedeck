# Sprint 168 - Board Setting: GitHub Project URL

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 79 (Board Member Management UI), Sprint 114 (Board Plugin Settings Patterns)
> **Status:** ⬜ Future

---

## Goal

Add a board setting named `Github Project Url` and restrict edits so only workspace members who belong to the board can set it.

---

## Strict Boundary

1. This sprint adds URL setting storage, API, and settings UI only.
2. No repository cloning/downloading logic in this sprint.
3. No GitHub App connection setup in this sprint.

---

## Scope

### 1. Data + API

Add board-level field `github_project_url` and expose:

- `GET /api/v1/boards/:boardId/settings/integrations`
- `PATCH /api/v1/boards/:boardId/settings/integrations`

Validation:
- Must be a valid GitHub project URL.
- Normalize trailing slash.

### 2. Permission Rules

- Workspace members on board may view the setting.
- Only workspace members with board ADMIN/OWNER may update.
- Guests cannot edit this setting.

### 3. Board Settings UI

Add section in board settings:

- Label: `Github Project Url`
- Input with save button and inline validation.
- Disabled state + explanatory copy for unauthorized users.

### 4. Auditing

Record an activity event when URL is changed:
- previous value hash/reference
- new value hash/reference
- actor and timestamp

### 5. Forward-Locked Integration Decisions (for Sprint 169-170)

This sprint does not implement repo sync, but it locks the integration contract for downstream sprints:

- Repository fetch must authenticate using GitHub App installation token.
- Commit/push must use app bot alias identity as author/committer.
- Initiating actor id must still be recorded in commit metadata/footer for audit traceability.
- Git operations must run via server-side Git service wrapper (no client-side git execution).

---

## Deliverables

1. Migration and board settings API update for `github_project_url`.
2. Board settings UI field and save flow.
3. RBAC enforcement for edit operations.
4. Change audit event on URL updates.
5. Tests for permissions and validation.
6. Documented downstream integration contract for installation-token fetch and bot-alias commits.

---

## Acceptance Criteria

1. Board settings displays `Github Project Url` field for eligible users.
2. Admin/owner workspace member can save valid GitHub URL.
3. Guest cannot modify URL and receives permission error if attempted via API.
4. Invalid URLs are rejected with `422` and clear error payload.
5. URL update emits board activity/audit record.
6. Sprint explicitly locks downstream fetch/commit auth model: installation-token fetch and bot-alias commit identity.
