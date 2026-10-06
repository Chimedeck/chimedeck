# Bug Workflow

This is the single source of truth for how a bug travels from report to a verified,
merged fix. It complements two things it does **not** duplicate:

- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — the agent-loop mechanics (Recap → Planning →
  Execute → Retest), sprint creation, manual-vs-loop routing, and commit conventions.
- The tracker's **Bug** card template — the stage-gated checklist that enforces these
  same steps on the board. This document explains the *why* and *how*; the card template
  is the *where you tick it off*. Keep the two in sync: if you change the pipeline here,
  update the card template, and vice versa.

The core idea: **a bug is not real until a failing automated test proves it, and not
fixed until that test goes green with evidence.** Everything below serves that rule.

---

## Principles

1. **Reproduce before you fix.** Write (or extend) an automated test that reproduces the
   defect and *fails* first. No red test → you have not yet demonstrated the bug.
2. **Validate the test, not just the bug.** Prove the new test is non-vacuous by fault
   injection: with the test failing, confirm it goes green only once the real fix lands;
   or temporarily disable the offending line and confirm the test fails for the right
   reason. A test that passes for unrelated reasons is worse than no test.
3. **Assert server-visible state, not just the UI.** UI assertions do not prove
   persistence. Poll the API / read the stored value; a mutation that only touches local
   state must still be caught.
4. **Smallest safe fix.** Do not mask the defect, weaken a control, or widen scope. If the
   fix wants to grow, it is a sprint, not a patch.
5. **Evidence over assertion.** Attach screenshots and an API round-trip (request +
   stored result), not "looks fixed on my machine".
6. **Never "fix" a test that is correctly catching a product bug.** If the test matches
   intended behaviour and the app disagrees, the app is wrong. Leave the test red, report
   the defect with evidence, and get a decision before changing durable behaviour.
   Adjusting the assertion to match the bug locks the bug in.
7. **Do not reason statically about what the code "would" do.** Open a real browser via
   the Playwright MCP tools and exercise the flow. Static reasoning is not validation.

---

## The pipeline

Seven steps. Steps 1–3 are *diagnosis* (prove the bug and name its cause). Step 4 routes
the work. Steps 5–7 are *delivery* (fix, verify, merge). The tracker's Bug card template
mirrors this across its stage checklists.

### 1. Raise

File the bug using [`.github/ISSUE_TEMPLATE/bug_report.md`](../.github/ISSUE_TEMPLATE/bug_report.md),
or open a Bug card on the tracker. Capture, at minimum:

- **Defect, impact, environment, evidence** — what breaks, who it affects, where (test vs
  production, web vs app), and the raw evidence (console error, Sentry link, screenshot).
- **Reproduction steps** with a clear **expected vs actual**.
- **Severity** and **classification** (see [Taxonomy](#taxonomy)).
- **Affected surface** — the code, data, API, and UI you believe are involved.
- The **related feature / scenario / test**, linked.

A report without expected-vs-actual and evidence is not ready to work — send it back.

### 2. Reproduce & validate (red)

Turn the report into a **failing test**:

- Prefer an end-to-end Playwright spec under `tests/e2e/` when the bug is user-visible;
  a unit or integration test when it is a pure logic or contract defect.
- Reproduce the **smallest failing slice** first — one spec, one scenario — before
  touching anything broad.
- Capture **screenshots** of the failing state.
- **Prove the test is non-vacuous** (Principle 2).
- **Assert the server-visible result** (Principle 3), not only the rendered DOM.

Run a single spec with explicit URLs (see [Running tests](#running-tests)). If you cannot
reproduce, say so explicitly and record it as "not yet reproducible" rather than guessing
at a fix.

### 3. Identify the specific problem

Confirm the **root cause**, or record the uncertainty honestly:

- Read the code that **writes** the value as well as the code that **reads** it. A
  plausible one-line framing ("this field is date-only", "it's a selector problem") is
  often wrong and leads to a fix that destroys data. One grep of the writer settles it.
- Name the exact **file and line**. "Somewhere in checkout" is not a root cause.
- Distinguish the defect from interacting failure modes and split them into separate
  cards/issues where they are genuinely separate bugs.

### 4. Route

Decide how the fix ships, per [`CONTRIBUTING.md`](../CONTRIBUTING.md#manual-human-contributions):

| Situation | Approach |
|-----------|----------|
| Quick fix in ≤ 2 files | **Manual change** — implement, changelog, verify, commit |
| > 5 files, or cross-system (DB + API + UI) | **Bug sprint** — see [Bug sprints](#bug-sprints) |
| New feature disguised as a bug | Feature sprint, not a bug fix |

### 5. Fix (green)

- Implement the **smallest safe fix** in a branch.
- The failing test from Step 2 now **passes**.
- Relevant unit, integration, and E2E tests pass. Run the targeted spec **twice
  consecutively** — a single pass can hide a flaky navigation race.
- Do not weaken assertions to get green. Align them with intended behaviour.

### 6. Verify & evidence

This is the Retest gate from [`CONTRIBUTING.md`](../CONTRIBUTING.md#phase-4--retest):

- Open a real browser via Playwright MCP. Run the **happy path** plus at least **one edge
  or error scenario**, taking screenshots.
- Re-confirm the **server-visible** result (API round-trip).
- Post the **PR URL, test evidence, and screenshots** as the fix's proof. Record any
  blockers explicitly.

Test credentials live in [`specs/tests/TEST_CREDENTIALS.md`](../specs/tests/TEST_CREDENTIALS.md).

### 7. Review & merge

- Commit using [Conventional Commits](../CONTRIBUTING.md#commit-conventions): `fix(<scope>): <summary>`.
- Author as `matthewvryanjh`; dispatch an **independent review**; approve/merge as
  `hermesrobinson-dev` only after APPROVE. Every follow-up commit needs its own review —
  pushing to an approved PR invalidates the approval for that commit.
- Write a changelog entry in `specs/changelog/YYYYMMDD_HHMMSS.md`
  (see [Changelog Format](../CONTRIBUTING.md#changelog-format)).
- `main` merges deploy nowhere; a forward PR to `stable` ships the fix.

---

## Bug sprints

A bug that needs more than a ≤ 2-file patch becomes a sprint, using the standard
[sprint file format](../CONTRIBUTING.md#sprint-creation) (`specs/sprints/sprint-N.md`).
For a bug sprint specifically:

- **Goal** states the defect and the observable behaviour once fixed.
- **Acceptance Criteria** are binary and must include:
  - [ ] A failing test reproduced the bug before the fix.
  - [ ] That test now passes.
  - [ ] A regression test is added where technically possible.
  - [ ] Root cause is confirmed (or uncertainty is recorded).
  - [ ] Server-visible state is asserted, not just the UI.
- **Tests** lists the reproduction scenario and the regression scenarios the Retest phase
  will execute.
- Register the sprint in [`specs/sprints/sprint-plan.md`](../specs/sprints/sprint-plan.md).

---

## Deferring a bug (parking)

If a real bug is found but will not be fixed now, do **not** leave the reproduction test
in either of these states:

- **Failing** — it breaks CI for unrelated work.
- **Skipping** — a permanent `test.skip` hides the coverage loss indefinitely and is how
  bugs get forgotten.

Instead: record the gap in a tracked issue / backlog entry with the concrete missing
wiring spelled out (file references, the shape/contract mismatch, the open question), and
write the test properly when the work is scheduled. Re-verify the entry's premise against
the code before acting on it later — the original framing may itself be wrong.

---

## Taxonomy

**Severity**

| Level | Meaning |
|-------|---------|
| Sev 1 — Fix Immediately | Production down, data loss/leak, or payment/auth broken |
| Sev 2 — High | Core flow broken, no safe workaround |
| Sev 3 — Medium | Feature degraded, workaround exists |
| Sev 4 — Low | Cosmetic or edge-case |

**Classification**

| Class | Meaning |
|-------|---------|
| `product_defect` | Behaviour disagrees with the intended/documented design |
| `data` | Bad or malformed data triggers the failure (e.g. field-length overflow) |
| `config` | Environment / configuration, not code |
| `regression` | Previously working behaviour broke |

A bug can carry a primary class plus an interacting mode (e.g. a `product_defect` whose
trigger is a `data` case); track genuinely separate bugs as separate cards.

---

## Running tests

Confirm the local servers first:

```bash
# API on 127.0.0.1:3000, UI on 127.0.0.1:5173
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/health
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5173/
```

Run a single spec with explicit URLs and the list reporter (never `line` — it hides which
specs are skipped):

```bash
TEST_BASE_URL=http://127.0.0.1:3000 TEST_UI_URL=http://127.0.0.1:5173 \
  bunx playwright test tests/e2e/<file>.spec.ts --project=e2e --reporter=list
```

Do not start with the broad BDD pack unless you are chasing final regression confidence.

---

## Anti-patterns

Hard-won; each has bitten a real fix on this repo:

- **Calling a spec green after fixing only the first selector timeout.** Selector drift is
  usually cascading — each fix exposes the next stale assumption. Re-run and re-read the
  fresh error context after every layer.
- **Trusting a UI assertion as proof of persistence.** Poll the write's endpoint; a drag
  or edit that only mutates local state will pass a UI-only check and still not persist.
- **Treating a soft-skip as a pass.** A `test.skip(true, ...)` whose condition can never
  fail is a dead test that reports as *skipped*, not failed. Triage every skip.
- **Weakening an assertion to go green.** That hides drift or locks in a bug.
- **Reasoning statically instead of opening the browser.** Validation means a real
  Playwright run with screenshots, not a description of what the code should do.
- **Building a fix on an unverified diagnosis** (a parked note, an old ticket, your own
  earlier summary). Verify the premise against the code — read the writer, not just the
  reader — before writing the fix.
