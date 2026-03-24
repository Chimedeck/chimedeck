# Sprint 112 — Test Coverage Gap Analysis & Fill

> **Status:** Planned
> **Depends on:** Sprint 111 (clean directories in place)

---

## Goal

Systematically audit the existing feature surface against `specs/tests/*.md` MCP scenarios and
`tests/` TypeScript test files. Write all missing coverage so every server extension has at
minimum one MCP scenario description and one corresponding TypeScript test.

---

## Background

After Sprint 111 the directory structure is clean:
- `specs/tests/` — MCP scenario `.md` files only
- `tests/e2e/` — Playwright `.spec.ts` files only
- `tests/integration/` — bun:test `.test.ts` files only

A cross-reference of all **24 server extensions** (`server/extensions/`) against existing test
files reveals the gaps documented below.

---

## Gap Analysis

### Server extensions with NO integration test

| Extension | Notes |
|-----------|-------|
| `activity` | No integration test — only a `commentsActivity.test.ts` covering write immutability |
| `apiToken` | No integration test — only scenario .mds exist |
| `card` | No integration test — only e2e spec (business-logic-invariants) |
| `comment` | `commentsActivity.test.ts` is being moved in Sprint 111 but has unit-level coverage only |
| `customFields` | Being converted to e2e spec in Sprint 111 — no integration test |
| `email` | No integration test — partially covered by `notifications/emailNotifications.test.ts` |
| `events` | No integration test and no `.md` scenario |
| `label` | No integration test and no dedicated `.md` scenario |
| `list` | No integration test and no dedicated list CRUD `.md` scenario |
| `mcp` | MCP HTTP init spec being moved in Sprint 111 — no `.md` scenario |
| `offlineDrafts` | Being moved in Sprint 111 — unit-level only |
| `payment` | No integration test and no `.md` scenario |
| `plugins` | No integration test — only `plugins-sdk-mcp-evaluator.md` scenario |
| `presence` | No integration test and no `.md` scenario |
| `realtime` | No integration test — covered only by `.md` scenarios |
| `search` | No integration test — covered only by `.md` scenarios |
| `users` | No integration test — covered only by profile `.md` scenarios |
| `workspace` | No integration test |

### `specs/tests/` — missing MCP scenario `.md` files

| Feature | Missing file |
|---------|-------------|
| Card attachment upload | `attachment-upload.md` |
| List CRUD (create, rename, reorder, archive) | `list-crud.md` |
| Card label create/assign/filter | `label-crud.md` |
| Payment (card price, monetisation) | `payment-card-price.md` |
| Presence (who's viewing a board) | `presence-board.md` |
| Events (card event log) | `events-card-log.md` |
| MCP HTTP session lifecycle | `mcp-http-session.md` (was only a `.spec.ts`, no `.md`) |
| Plugin install/uninstall | `plugin-install.md` |
| Board star / follow | `board-star-follow.md` |
| Card start date | `card-start-date.md` |
| Card short URL | `card-short-url.md` |
| Admin: user list management | `admin-user-list.md` |

### `tests/e2e/` — missing Playwright `.spec.ts` files

| Feature | Missing file |
|---------|-------------|
| Attachment upload via UI | `attachment-upload.spec.ts` |
| Payment — card price UI | `payment-card-price.spec.ts` |
| Search results with filters | `search-filters.spec.ts` |
| List management UI | `list-management.spec.ts` |
| Presence indicators in board header | `presence-board.spec.ts` |

### `tests/integration/` — missing bun:test `.test.ts` files

| Extension | Missing file |
|-----------|-------------|
| `activity` | `tests/integration/activity/writeActivity.test.ts` |
| `apiToken` | `tests/integration/apiToken/apiToken.test.ts` |
| `card` | `tests/integration/card/cardCRUD.test.ts` |
| `comment` | `tests/integration/comment/softDelete.test.ts` |
| `label` | `tests/integration/label/labelCRUD.test.ts` |
| `list` | `tests/integration/list/listCRUD.test.ts` |
| `mcp` | `tests/integration/mcp/mcpSession.test.ts` |
| `payment` | `tests/integration/payment/cardMoney.test.ts` |
| `plugins` | `tests/integration/plugins/pluginCRUD.test.ts` |
| `search` | `tests/integration/search/fullTextSearch.test.ts` |
| `workspace` | `tests/integration/workspace/workspaceCRUD.test.ts` |

---

## Iterations

### Iteration 1 — Write Missing MCP Scenario `.md` Files

**Objective:** Create the 12 missing `.md` scenario files in `specs/tests/`.

Each file must follow the established format:
- Title and brief overview
- Pre-conditions
- Numbered test steps with `**Assert**:` markers
- API paths and expected responses for API tests

**Files to create:**
1. `specs/tests/attachment-upload.md`
2. `specs/tests/list-crud.md`
3. `specs/tests/label-crud.md`
4. `specs/tests/payment-card-price.md`
5. `specs/tests/presence-board.md`
6. `specs/tests/events-card-log.md`
7. `specs/tests/mcp-http-session.md`
8. `specs/tests/plugin-install.md`
9. `specs/tests/board-star-follow.md`
10. `specs/tests/card-start-date.md`
11. `specs/tests/card-short-url.md`
12. `specs/tests/admin-user-list.md`

**Acceptance criteria:**
- Each `.md` file is self-contained and executable by the AI MCP runner
- `bash run-all-tests.sh` processes all 12 new files without errors

---

### Iteration 2 — Write Missing Integration Tests (high priority extensions)

**Objective:** Add integration test files for the most critical extensions that have zero
unit/integration test coverage.

Priority order (highest risk with no tests):

1. **`tests/integration/apiToken/apiToken.test.ts`**
   - Token creation with `hf_` prefix
   - Token authentication via API
   - Token revocation

2. **`tests/integration/card/cardCRUD.test.ts`**
   - Create card in a list
   - Move card to another list
   - Archive card
   - Card `due_date` and `start_date` fields

3. **`tests/integration/list/listCRUD.test.ts`**
   - Create list in a board
   - Rename list
   - Reorder lists
   - Archive list

4. **`tests/integration/workspace/workspaceCRUD.test.ts`**
   - Create workspace
   - Rename workspace
   - Workspace must-have-one-owner invariant
   - Delete workspace

5. **`tests/integration/search/fullTextSearch.test.ts`**
   - Search returns cards matching title
   - Search respects board access rights
   - Search scoped to workspace

6. **`tests/integration/payment/cardMoney.test.ts`**
   - Set card price
   - Get card price
   - Board monetisation flag

7. **`tests/integration/label/labelCRUD.test.ts`**
   - Create label on board
   - Assign label to card
   - Remove label from card

8. **`tests/integration/comment/softDelete.test.ts`**
   - Create comment
   - Edit comment increments version
   - Soft-delete sets `deleted: true` and content `[deleted]`

**Acceptance criteria:**
- `bun test tests/integration` passes all new test files
- Tests use mock DB state or lightweight integration helpers (no full server startup required)

---

### Iteration 3 — Write Missing Playwright E2E `.spec.ts` Files

**Objective:** Add the 5 missing Playwright spec files for features that have UI flows
but no automated browser test.

1. **`tests/e2e/attachment-upload.spec.ts`** — upload file, verify thumbnail, download link
2. **`tests/e2e/payment-card-price.spec.ts`** — set price on card, verify badge, disable monetisation
3. **`tests/e2e/search-filters.spec.ts`** — type in search box, apply type filter, scope to board
4. **`tests/e2e/list-management.spec.ts`** — create list, rename, drag to reorder, archive
5. **`tests/e2e/presence-board.spec.ts`** — two-session scenario: second user avatar appears in header

**Acceptance criteria:**
- `npx playwright test --project=e2e` processes all 5 new spec files
- Tests soft-skip (or are marked `test.fixme`) if the required server is not running

---

### Iteration 4 — Update `specs/tests/mcp/` with Scenario Variants

**Objective:** The `specs/tests/mcp/` subdirectory contains sprint-specific MCP evaluator
scenarios. Ensure it also contains general-purpose tool reference scenarios that are always valid
regardless of sprint, covering each of the 9 MCP tools:
- `get_boards`, `get_board`, `get_cards`, `get_card`, `create_card`, `move_card`,
  `add_comment`, `search_cards`, `get_members`

Each tool should have its own standalone `.md` evaluation scenario in `specs/tests/mcp/`.

---

## Files Affected (summary)

| Category | Count | Examples |
|----------|-------|---------|
| New `specs/tests/*.md` | 12 | `attachment-upload.md`, `list-crud.md`, `payment-card-price.md` |
| New `tests/integration/**/*.test.ts` | 8 | `apiToken.test.ts`, `cardCRUD.test.ts`, `workspaceCRUD.test.ts` |
| New `tests/e2e/*.spec.ts` | 5 | `attachment-upload.spec.ts`, `search-filters.spec.ts` |
| New `specs/tests/mcp/*.md` | 9 | One per MCP tool |

---

## What Should Be Done Next

- Set up CI pipeline to run `bun run test:all` on every PR (GitHub Actions workflow)
- Add coverage badge to README
- Consider using bun's `--coverage` output to track which server modules are untested
