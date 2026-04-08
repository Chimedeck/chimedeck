# Tests

This directory contains all automated tests for the project, organised by test type.

## Directory Structure

```
tests/
├── integration/   # Bun unit / integration tests (.test.ts)
├── e2e/           # Playwright end-to-end tests (.spec.ts)
└── load/          # Load / performance scripts (.js)
```

### `integration/` — Bun tests

Run with the **bun:test** runner.  
**Allowed file types:** `.test.ts` only.

Each file (or sub-directory) exercises a single domain concept against a real (or in-process) database. Tests in this layer should not launch a browser and should not depend on a running HTTP server unless the test explicitly starts one.

```
integration/
├── boardLifecycle.test.ts
├── commentsActivity.test.ts
├── cardExtendedFields.test.ts
├── offlineCommentDraftRecovery.test.ts
├── apiToken/
│   └── apiToken.test.ts
├── card/
│   └── cardCRUD.test.ts
├── list/
│   └── listCRUD.test.ts
├── workspace/
│   └── workspaceCRUD.test.ts
├── search/
│   └── fullTextSearch.test.ts
├── payment/
│   └── cardMoney.test.ts
├── label/
│   └── labelCRUD.test.ts
└── comment/
    └── softDelete.test.ts
```

### `e2e/` — Playwright specs

Run with **Playwright** against a live server.  
**Allowed file types:** `.spec.ts` only (plus `_helpers.ts` for shared utilities).

Use the `{ request }` fixture for API-only scenarios and the `{ page }` fixture for browser UI scenarios. Tests must soft-skip gracefully when the server is not running so CI does not hard-fail on environment issues.

### `load/` — Load / performance scripts

**Allowed file types:** `.js` only.

These are standalone scripts that can be executed directly with `bun` or `node`. They are not part of any test runner suite.

---

## MCP Scenario Files

Human-readable scenario documents used by the AI MCP test runner live in **`specs/tests/`**, not here.

- `specs/tests/*.md` — feature scenario files (one per feature / sprint)
- `specs/tests/mcp/*.md` — per-tool MCP evaluation scenarios

When adding a new MCP scenario, create the `.md` file in `specs/tests/` (or `specs/tests/mcp/` for tool-level scenarios) and then, if browser automation is required, add a corresponding `.spec.ts` in `tests/e2e/`.

---

## Running Tests

### Unit / Integration (bun:test)

```bash
# All integration tests
bun run test:unit
# or directly:
bun test tests/integration

# Single file or sub-directory
bun test tests/integration/card
```

### E2E (Playwright)

```bash
# Full e2e suite
bun run test:e2e
# or directly:
npx playwright test --project=e2e

# Single spec file
npx playwright test tests/e2e/mcp-http-init.spec.ts

# Open HTML report after a run
npx playwright show-report
```

### MCP scenarios

```bash
bun run test:mcp
# or directly:
bash run-all-tests.sh
```

### All suites

```bash
bun run test:all
# or directly:
bash run-all-tests-full.sh
```

Set `SKIP_UNIT=1`, `SKIP_E2E=1`, or `SKIP_MCP=1` to skip individual modes.  
Set `BASE_URL` (or `TEST_BASE_URL`) to point at a non-default server address.

---

## File-Type Rules (summary)

| Directory       | Allowed extensions          | Runner              |
|-----------------|-----------------------------|---------------------|
| `integration/`  | `.test.ts`                  | `bun test`          |
| `e2e/`          | `.spec.ts`, `_helpers.ts`   | Playwright          |
| `load/`         | `.js`                       | `bun` / `node`      |

Do **not** place `.md` scenario files, `.spec.ts` files, or `.test.ts` files outside their designated directories.
