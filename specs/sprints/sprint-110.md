# Sprint 110 — Test Infrastructure: Dual Mode Support + Commands

> **Status:** Planned
> **Depends on:** Sprint 109

---

## Goal

Establish clear, first-class support for **two separate testing modes** that currently coexist
without proper infrastructure:

| Mode | Tool | Test location | How tests are written |
|------|------|---------------|-----------------------|
| **MCP / AI-driven** | Playwright MCP via `run-test.sh` | `specs/tests/*.md` | Markdown scenario steps for AI agent |
| **Classic Playwright** | `@playwright/test` runner | `tests/e2e/*.spec.ts` | TypeScript `test()` blocks |

Add missing npm scripts and update `run-all-tests.sh` so **both modes can be triggered** from a
single command, and each mode can also be run independently.

---

## Background

Right now the project has no explicit `test:e2e` or `test:all` script. The `playwright.config.ts`
has a `specs` project pointing at `./specs/tests` that is intended for AI-run scenarios but
inadvertently picks up stray `.spec.ts` files that should not live there. The `run-all-tests.sh`
script only covers MCP-driven tests; classic Playwright tests have no equivalent aggregation
script. Developers and CI pipelines have no single command to run the full suite.

---

## Iterations

### Iteration 1 — Update `playwright.config.ts`

**Objective:** Remove the `specs` project (it was only needed because `.spec.ts` files were
mistakenly placed in `specs/tests/`; after Sprint 111 cleans that up, the project is obsolete).
Keep the `e2e` project pointing at `tests/e2e`. Expand timeout for CI reliability.

**File:** `playwright.config.ts`

Changes:
- Remove the `projects.specs` entry that points at `./specs/tests`
- Keep `projects.e2e` pointed at `./tests/e2e`
- Set `reporter` to `[['line'], ['html', { open: 'never' }]]` for CI-friendly HTML output
- Add `use: { baseURL: process.env.TEST_BASE_URL ?? 'http://localhost:3000' }` to avoid
  hardcoding in individual test files

**Acceptance criteria:**
- `npx playwright test` runs only the `e2e` project
- No Playwright errors about missing test directories

---

### Iteration 2 — Add npm Scripts for Each Testing Mode

**Objective:** Add explicit, purpose-named scripts to `package.json` so each testing mode
can be invoked without memorising shell commands.

**File:** `package.json` — add to `scripts`:

```jsonc
"test:unit":        "bun test tests/integration",
"test:e2e":         "playwright test --project=e2e",
"test:mcp":         "bash run-all-tests.sh",
"test:all":         "bash run-all-tests-full.sh"
```

**Acceptance criteria:**
- `bun run test:unit` runs bun integration tests
- `bun run test:e2e` runs Playwright classic e2e tests
- `bun run test:mcp` runs MCP/AI scenario tests
- `bun run test:all` runs all three in sequence

---

### Iteration 3 — Create `run-all-tests-full.sh`

**Objective:** A single orchestration script that runs all three test modes in sequence and
aggregates results. The original `run-all-tests.sh` is preserved unchanged (still runs only MCP
scenarios).

**File:** `run-all-tests-full.sh` (new)

Logic:
1. Run `bun test tests/integration` (unit/integration) — fail fast on error
2. Run `npx playwright test --project=e2e` (classic e2e) — collect pass/fail counts
3. Run `bash run-all-tests.sh` (MCP scenarios) — collect pass/fail counts
4. Print unified summary of all three modes
5. Exit non-zero if any mode had failures

**Environment variables supported:**
- `SKIP_UNIT=1` — skip unit/integration step
- `SKIP_E2E=1` — skip classic Playwright step
- `SKIP_MCP=1` — skip MCP scenario step
- `BASE_URL` — forwarded to both Playwright and run-all-tests.sh

**Acceptance criteria:**
- `bash run-all-tests-full.sh` runs all three modes
- Script exits 0 only when all modes pass
- Each mode clearly labelled in output with its own pass/fail summary

---

### Iteration 4 — Add a `test:e2e` Script to the Makefile (optional, nice-to-have)

If a `Makefile` entry for tests exists, add a `test-e2e` target:

```makefile
test-e2e:
	bun run test:e2e

test-all:
	bun run test:all
```

---

## Files Affected

| File | Change |
|------|--------|
| `playwright.config.ts` | Remove `specs` project, add `baseURL`, update reporter |
| `package.json` | Add `test:unit`, `test:e2e`, `test:mcp`, `test:all` scripts |
| `run-all-tests-full.sh` | New — unified orchestration script |
| `Makefile` | Add `test-e2e` and `test-all` targets |

---

## What Should Be Done Next

Sprint 111 — clean up misplaced files so `playwright.config.ts` changes above are safe to land.
