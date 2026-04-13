# Contributing

This project is developed primarily through an **AI agent loop** — a phased, model-driven iteration runner with human approval gates. This document describes the exact flow the agent goes through on every iteration, how to create sprints, how changelogs are written, and how humans fit into the process.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Context Files](#project-context-files)
- [The Agent Loop](#the-agent-loop)
  - [Running the Loop](#running-the-loop)
  - [Bootstrap Phase (new projects)](#bootstrap-phase-new-projects)
  - [Phase 1 — Recap](#phase-1--recap)
  - [Phase 2 — Planning](#phase-2--planning)
  - [Approval Gate](#approval-gate)
  - [Phase 3 — Execute](#phase-3--execute)
  - [Phase 4 — Retest](#phase-4--retest)
  - [Changelog (automatic)](#changelog-automatic)
- [Sprint Creation](#sprint-creation)
  - [Sprint file format](#sprint-file-format)
  - [Numbering and naming](#numbering-and-naming)
  - [Registering in the sprint plan](#registering-in-the-sprint-plan)
- [Changelog Format](#changelog-format)
- [Manual (Human) Contributions](#manual-human-contributions)
- [Commit Conventions](#commit-conventions)
- [Coding Conventions Reference](#coding-conventions-reference)

---

## Prerequisites

| Tool | Minimum version | Notes |
|------|----------------|-------|
| [Bun](https://bun.sh/) | 1.3.5+ | Runtime and package manager. Never use `npm`/`yarn`. |
| [GitHub Copilot CLI](https://githubnext.com/projects/copilot-cli/) | latest | The `copilot` executable that `start-agent-loop.sh` invokes. |
| Docker + Compose | v2+ | Required for local databases. |
| PostgreSQL client | any | For running `bun run db:migrate` outside Docker. |

Install project dependencies once:

```bash
bun install
```

---

## Project Context Files

The agent reads these files on **every** iteration. Keep them up to date — they are the agent's memory.

| File / folder | Purpose |
|---------------|---------|
| `specs/architecture/requirements.md` | Authoritative source of what the project must do. Do not contradict it without updating it first. |
| `specs/architecture/` | All architecture decision records (ADRs) and technical decisions. |
| `specs/changelog/` | Timestamped per-iteration changelogs. Newest entries (sorted by filename descending) describe current state. |
| `specs/sprints/sprint-plan.md` | Ordered list of all sprints with status labels. |
| `specs/sprints/sprint-N.md` | Detailed scope, acceptance criteria, and file list for each sprint. |
| `.github/copilot-instructions.md` | The workflow + coding conventions the agent follows. **Read this before contributing anything.** |
| `sample-project/` | Read-only reference repo. Never modify or run anything inside it. |

---

## The Agent Loop

### Running the Loop

```bash
# With guardrails (default) — pauses for human approval after Planning each iteration
bash start-agent-loop.sh "Your task description"

# Using a pre-written .task file (multi-iteration plan)
bash start-agent-loop.sh "$(cat .task)"

# Disable approval gates (autonomous mode — use with caution)
bash start-agent-loop.sh --no-guardrails "Your task description"
```

The loop runs up to 60 iterations. Each iteration executes four phases: **Recap → Planning → (approval) → Execute → Retest**, followed by automatic changelog generation.

The loop exits early when the Execute phase outputs `DONE_ALL_TASKS`.

---

### Bootstrap Phase (new projects)

Triggered automatically when `specs/architecture/architecture.md` does not exist or is fewer than 30 substantive lines, or no feature specs / ADRs exist beyond `architecture.md`.

**What happens:**

1. **Bootstrap Recap** (`gpt-4.1`) — reads `requirements.md` and the sample project; summarises what needs to be built.
2. **Bootstrap Planning** (`gpt-4.1`) — produces a full `specs/architecture/architecture.md` covering system overview, folder structure, modules, integrations, data flows, and an ordered iteration roadmap. No code is written.
3. The loop **stops** and asks you to review the architecture document before re-running.

Re-run the same command after reviewing and editing the architecture doc. The loop detects the completed architecture and proceeds to implementation.

---

### Phase 1 — Recap

**Model:** `gpt-4.1`

Reads:
- `specs/architecture/requirements.md`
- All files in `specs/architecture/`
- Recent changelogs in `specs/changelog/` (newest first)
- Relevant parts of `sample-project/` (read-only)

Produces a concise bullet list (5–10 bullets) covering:
- What has already been implemented (git log + changelog evidence)
- Outstanding technical debt or deferred items from prior iterations
- How `sample-project/` handles the same area (if relevant)
- What still needs to be done
- Blockers or risks

No code is written in this phase.

---

### Phase 2 — Planning

**Model:** `gpt-4.1`

Reads the Recap output plus `specs/architecture/` and recent changelogs.

Produces a numbered implementation plan covering:
1. Every file in **this project** to create or modify
2. A one-sentence description of the change per file
3. Any pattern borrowed from `sample-project/` and how it will be adapted
4. The architecture spec from `specs/architecture/` that governs the work
5. Tests that will verify the work
6. Edge cases or human decisions needed

**Scope constraint (strictly enforced):** at most 2 intertwined features or 1 standalone feature per iteration. Additional work is explicitly deferred and labelled "Next iteration".

No code is written in this phase.

---

### Approval Gate

When guardrails are enabled (default), the loop prints the first 40 lines of the plan and pauses:

```
╔══════════════════════════════════════════════════╗
║  HUMAN APPROVAL REQUIRED (guardrails are ON)     ║
╚══════════════════════════════════════════════════╝
  Continue? [y/N]
```

- **`y`** → proceeds to Execute
- **`N` (or Enter)** → loop stops; edit `specs/architecture/` or the task description and re-run

Use this gate to catch scope creep, wrong file choices, or missing constraints before any code is written.

---

### Phase 3 — Execute

**Model:** `claude-sonnet-4.6`

Implements exactly what the approved plan specifies — no scope creep.

Steps are followed in the numbered order from the plan. After finishing, the agent writes a short summary of what was changed.

The agent outputs `DONE_ALL_TASKS` only when **all** acceptance criteria across the entire multi-iteration task are fully met. It must never output this early — doing so terminates the loop immediately.

---

### Phase 4 — Retest

Two sub-phases run sequentially:

#### Scout pass (`gpt-4.1`)

Evaluates whether full browser testing is needed:

| Condition | Decision |
|-----------|----------|
| Pure docs, comments, or trivial copy changes | `PLAYWRIGHT_SKIP` |
| Config-only change + linter passes | `PLAYWRIGHT_SKIP` |
| Any UI change | `PLAYWRIGHT_REQUIRED` |
| Any API or route change | `PLAYWRIGHT_REQUIRED` |
| Any auth change | `PLAYWRIGHT_REQUIRED` |
| 3 or more files touched | `PLAYWRIGHT_REQUIRED` |

If `PLAYWRIGHT_SKIP`, the reason is logged and the loop moves to the Changelog phase.

#### Playwright MCP evaluation (`gpt-4.1`)

Only runs when the scout says `PLAYWRIGHT_REQUIRED`.

The evaluator **must** open a real browser via the Playwright MCP tools. Static reasoning about what the code "would" do is explicitly forbidden. Steps:

1. Start the dev server (`bun run dev`) in **this project** if not already running — never in `sample-project/`
2. Navigate to each affected view
3. Execute the happy-path scenario step by step, taking screenshots
4. Execute at least one edge or error scenario
5. Report `PASS` or `FAIL` for each flow with a screenshot reference

Test credentials are in `specs/tests/TEST_CREDENTIALS.md`.

Failed tests are documented so the next iteration can address them.

---

### Changelog (automatic)

**Model:** `gpt-4.1`

After Retest, the loop automatically writes a changelog file to:

```
specs/changelog/YYYYMMDD_HHMMSS.md
```

The file is generated from a synthesis of the Recap, Plan, Execution summary, and Test results. It always contains exactly four sections (see [Changelog Format](#changelog-format) below).

Human contributors must also write a changelog entry for any meaningful manual change.

---

## Sprint Creation

A sprint is a scoped unit of work tied to one or two tightly coupled features. Each sprint has a dedicated file and an entry in the master plan.

### Sprint file format

Create `specs/sprints/sprint-N.md` using this template:

```markdown
# Sprint N — <Feature Name>

> **Depends on:** Sprint X (<why>), Sprint Y (<why>)
> **Status:** ⬜ Future | 🔵 Blocked on N | 🟢 Ready to start | ✅ Done

---

## Goal

One paragraph describing what this sprint achieves and why it matters.
State any features that are explicitly OUT of scope.

---

## Scope

### 1. <Area>

- Bullet list of deliverables for this area
- Reference migration files, API routes, or UI components by name

### 2. <Area>

...

---

## Acceptance Criteria

- [ ] Criterion 1 — observable, binary (pass/fail)
- [ ] Criterion 2
- [ ] ...

---

## Files

| File | Action | Notes |
|------|--------|-------|
| `server/extensions/foo/api/index.ts` | Create | ... |
| `src/extensions/Foo/FooPage.tsx` | Create | ... |
| `db/migrations/NNNN_foo.ts` | Create | ... |

---

## Tests

List the test scenarios the agent loop's Retest phase will execute:

1. Happy path — <scenario>
2. Error case — <scenario>
```

### Numbering and naming

- Sprint numbers are sequential integers starting from 1.
- Use leading zeros only up to double digits (1–9 are `sprint-1.md`, not `sprint-01.md`… though the repo uses `sprint-01.md` for early sprints — be consistent with the existing pattern).
- Extension or correction sprints that target an existing sprint's scope can use descriptive suffixes (e.g. `sprint-69-do-later.md`).

### Registering in the sprint plan

Open `specs/sprints/sprint-plan.md` and add a row to the Sprint Overview table:

```markdown
| [N](./sprint-N.md) | Feature Name | Key deliverables | 🔵 Needs M |
```

Status labels:

| Label | Meaning |
|-------|---------|
| 🟢 Ready to start | All dependencies are met |
| 🔵 Blocked on N | Waiting on sprint N to complete |
| ✅ Done | Accepted and merged |
| ⬜ Future | Planned but not yet scheduled |

---

## Changelog Format

Every changelog file in `specs/changelog/` must have **exactly** these four sections with these exact headings:

```markdown
## Update
Changes made to existing code, features, or configuration.

## New
Newly added features, files, components, or capabilities.

## Technical Debt
Shortcuts taken, known issues introduced, or things to revisit.
Write "None" if there is nothing to report.

## What Should Be Done Next
Recommended follow-up tasks or deferred items from this iteration.
```

Rules:
- The file is named `YYYYMMDD_HHMMSS.md` using the UTC timestamp when the iteration completed.
- No preamble, no code fences wrapping the whole file — output only the four sections.
- The automated agent writes this file; humans must follow the same format for manual iterations.
- Skip the changelog only for trivial edits (typo fixes, comment corrections, README tweaks). If in doubt, write one.

---

## Manual (Human) Contributions

For small, targeted fixes that don't warrant running the full agent loop:

1. Read `.github/copilot-instructions.md` for coding conventions.
2. Read the 3 most recent `specs/changelog/*.md` files to understand current state.
3. Implement the change. Keep scope to ≤ 2 files unless it's a clearly atomic refactor.
4. Write a changelog entry in `specs/changelog/YYYYMMDD_HHMMSS.md`.
5. If you change a UI flow, API route, or auth logic — manually verify it in the browser or via `bun test`.
6. Commit using the [commit conventions](#commit-conventions) below.

**When to use the agent loop instead of a manual change:**

| Situation | Approach |
|-----------|----------|
| > 5 files need to change | Agent loop |
| New feature with its own sprint | Agent loop |
| Cross-system integration (DB + API + UI) | Agent loop |
| Quick bug fix or copy change in ≤ 2 files | Manual |
| Updating a spec or architecture doc only | Manual |

---

## Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>
```

| Type | When to use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `chore` | Tooling, config, dependencies |
| `docs` | Documentation only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or correcting tests |

Scope is the feature or sprint name in lowercase, e.g. `feat(card-modal): add checklist reorder`.

---

## Coding Conventions Reference

All coding conventions are defined in `.github/copilot-instructions.md`. Key highlights:

- **Runtime:** Bun (`#!/usr/bin/env bun`). Use `Bun.env`, `Bun.file`, `Bun.serve` over Node equivalents.
- **Package manager:** `bun install` / `bun add`. Never `npm` or `yarn`.
- **Folder structure:** group by feature, not by type. Each feature lives under `src/extensions/<FeatureName>/` (client) or `server/extensions/<featureName>/` (server).
- **HTTP methods:** use the correct verb — `GET` retrieves, `POST` creates, `PUT` replaces, `PATCH` partially updates, `DELETE` deletes.
- **API errors:** `{ name: 'hyphenated-error-name', data?: any }` — never a bare string or missing `name`.
- **API responses:** always wrap in `{ data: ... }`. Paginated responses include `{ data: [...], metadata: { ... } }`.
- **Environment variables:** access only via the `server/config/` module, never via `process.env` directly.
- **Module inputs:** single destructured object — never positional arguments.
- **Module outputs:** always include a `status` field alongside `data`/`includes`.
- **Comments:** explain *why*, not *what*. Mark intentional shortcuts with `// TODO:`.
- **`sample-project/`:** read-only reference. Never modify, never run.
