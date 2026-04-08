# Sprint 111 — Test Directory Cleanup: Enforce File Boundaries

> **Status:** Planned
> **Depends on:** Sprint 110

---

## Goal

Enforce the **two-layer test directory contract**:

| Directory | Allowed files | Purpose |
|-----------|---------------|---------|
| `specs/tests/` | `.md` only | Scenario descriptions read by AI agent / Playwright MCP |
| `tests/e2e/` | `.spec.ts` only | Playwright classic test code |
| `tests/integration/` | `.test.ts` only | bun:test unit & integration tests |

Currently both directories contain the wrong file types:

- **`specs/tests/`** contains 5 TypeScript files that should be in `tests/`
- **`tests/e2e/`** contains 9 Markdown files that should be converted to `.spec.ts`

---

## Background

### TypeScript files found in `specs/tests/` (must be moved)

| File | Target location | Test runner |
|------|-----------------|-------------|
| `board.test.ts` | `tests/integration/boardLifecycle.test.ts` | bun:test |
| `comments-activity.test.ts` | `tests/integration/commentsActivity.test.ts` | bun:test |
| `card-extended-fields.test.ts` | `tests/integration/cardExtendedFields.test.ts` | bun:test |
| `offline-comment-draft-recovery.test.ts` | `tests/integration/offlineCommentDraftRecovery.test.ts` | bun:test |
| `sprint-106-mcp-http-init.spec.ts` | `tests/e2e/mcp-http-init.spec.ts` | Playwright |

### Markdown files found in `tests/e2e/` (must be converted to `.spec.ts`)

| File | New TypeScript file |
|------|---------------------|
| `business-logic-invariants-1.md` | `tests/e2e/business-logic-invariants.spec.ts` |
| `custom-field-values-api.md` | `tests/e2e/custom-field-values-api.spec.ts` |
| `custom-fields-api.md` | `tests/e2e/custom-fields-api.spec.ts` |
| `custom-fields-board-panel.md` | `tests/e2e/custom-fields-board-panel.spec.ts` |
| `custom-fields-ui.md` | `tests/e2e/custom-fields-ui.spec.ts` |
| `card-description-inline-edit.md` | `tests/e2e/card-description-inline-edit.spec.ts` |
| `csrf-guard.md` | `tests/e2e/csrf-guard.spec.ts` |
| `delete-confirmation.md` | `tests/e2e/delete-confirmation.spec.ts` |
| `input-sanitization.md` | `tests/e2e/input-sanitization.spec.ts` |

After this sprint the `.md` files in `tests/e2e/` are **deleted** (their content is now
expressed as code). The original `.ts` files in `specs/tests/` are also **deleted** after
being moved. Their corresponding `.md` scenario counterparts (if not already present in
`specs/tests/`) should be created so the AI agent also has scenario coverage.

---

## Iterations

### Iteration 1 — Move bun:test Files Out of `specs/tests/`

**Objective:** Move the four `*.test.ts` bun:test files to `tests/integration/`.

Steps per file:
1. Copy content to new location under `tests/integration/`
2. Update any relative `import.meta.url` paths that reference `../../server/...` to adjust
   for the new depth (`../../../server/...` since integration tests are one level deeper)
3. Delete source file from `specs/tests/`

**Files:**
- `specs/tests/board.test.ts` → `tests/integration/boardLifecycle.test.ts`
- `specs/tests/comments-activity.test.ts` → `tests/integration/commentsActivity.test.ts`
- `specs/tests/card-extended-fields.test.ts` → `tests/integration/cardExtendedFields.test.ts`
- `specs/tests/offline-comment-draft-recovery.test.ts` → `tests/integration/offlineCommentDraftRecovery.test.ts`

**Acceptance criteria:**
- `bun test tests/integration` runs all four files without errors
- `specs/tests/` contains no `.ts` files

---

### Iteration 2 — Move Playwright `.spec.ts` Out of `specs/tests/`

**Objective:** Move `sprint-106-mcp-http-init.spec.ts` to `tests/e2e/` and rename it clearly.

**File:** `specs/tests/sprint-106-mcp-http-init.spec.ts` → `tests/e2e/mcp-http-init.spec.ts`

Also fix the bug on line 37 where `loginAndGetJwt` is called with `(email, password)` instead
of `(request, email, password)`.

**Acceptance criteria:**
- `npx playwright test tests/e2e/mcp-http-init.spec.ts` runs without import errors
- No `.spec.ts` files remain in `specs/tests/`

---

### Iteration 3 — Convert `.md` Files in `tests/e2e/` to Playwright `.spec.ts`

**Objective:** Translate each Markdown scenario file in `tests/e2e/` into a working Playwright
TypeScript test file. Follow the established pattern from `tests/e2e/board-members.spec.ts`.

Conventions to apply:
- `import { test, expect, APIRequestContext } from '@playwright/test'`
- `const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000'`
- Helper functions (`registerAndLogin`, `createWorkspace`, `createBoard`) extracted per file or
  imported from a shared `tests/e2e/_helpers.ts` helper (create if needed)
- Each "Test N" section in the `.md` becomes one `test('...', ...)` block
- API-only scenarios (`csrf-guard.md`, `input-sanitization.md`, `custom-fields-api.md`,
  `custom-field-values-api.md`) use `{ request }` fixture only — no browser needed
- UI scenarios (`custom-fields-board-panel.md`, `custom-fields-ui.md`,
  `card-description-inline-edit.md`, `delete-confirmation.md`) use `{ page }` fixture

After each `.ts` file is created and verified, **delete the corresponding `.md` file**.

The MD content must also be added (or already exists) as a matching file in `specs/tests/` so
the AI MCP runner still has the scenario.

**Acceptance criteria:**
- `npx playwright test --project=e2e` runs without errors on all new spec files
  (tests may skip or soft-fail if dev server is not running — that is acceptable)
- No `.md` files remain in `tests/e2e/`
- Each converted scenario has a corresponding `.md` file in `specs/tests/`

---

### Iteration 4 — Add `tests/e2e/README.md` Convention Doc

**Objective:** Document the test directory conventions so future developers know the rules.

**File:** `tests/README.md` (new)

Content:
- Explain the three-directory structure (`integration/`, `e2e/`, `load/`)
- State the file-type rules for each directory
- Point to `specs/tests/` for MCP scenario descriptions
- Show how to run each suite (`bun run test:unit`, `bun run test:e2e`, `bun run test:mcp`)

---

## Files Affected

| File | Change |
|------|--------|
| `specs/tests/board.test.ts` | Deleted (moved) |
| `specs/tests/comments-activity.test.ts` | Deleted (moved) |
| `specs/tests/card-extended-fields.test.ts` | Deleted (moved) |
| `specs/tests/offline-comment-draft-recovery.test.ts` | Deleted (moved) |
| `specs/tests/sprint-106-mcp-http-init.spec.ts` | Deleted (moved) |
| `tests/integration/boardLifecycle.test.ts` | New (moved from specs/tests) |
| `tests/integration/commentsActivity.test.ts` | New (moved from specs/tests) |
| `tests/integration/cardExtendedFields.test.ts` | New (moved from specs/tests) |
| `tests/integration/offlineCommentDraftRecovery.test.ts` | New (moved from specs/tests) |
| `tests/e2e/mcp-http-init.spec.ts` | New (moved + bug-fixed from specs/tests) |
| `tests/e2e/business-logic-invariants.spec.ts` | New (converted from .md) |
| `tests/e2e/custom-field-values-api.spec.ts` | New (converted from .md) |
| `tests/e2e/custom-fields-api.spec.ts` | New (converted from .md) |
| `tests/e2e/custom-fields-board-panel.spec.ts` | New (converted from .md) |
| `tests/e2e/custom-fields-ui.spec.ts` | New (converted from .md) |
| `tests/e2e/card-description-inline-edit.spec.ts` | New (converted from .md) |
| `tests/e2e/csrf-guard.spec.ts` | New (converted from .md) |
| `tests/e2e/delete-confirmation.spec.ts` | New (converted from .md) |
| `tests/e2e/input-sanitization.spec.ts` | New (converted from .md) |
| `tests/e2e/*.md` (9 files) | Deleted after TypeScript conversion |
| `tests/README.md` | New |

---

## What Should Be Done Next

Sprint 112 — audit for test coverage gaps; add any missing `.md` scenario files and `.spec.ts`
test files for features that have no test coverage at all.
