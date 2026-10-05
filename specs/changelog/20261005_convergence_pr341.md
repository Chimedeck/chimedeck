# 2026-10-05 — Convergence PR #341: stable content + main history

## What
- Convergence branch `converge/main-into-stable` (PR #341, base `stable`): main's history merged so
  the repo moves to a single line of development before the dev/test/prod pipeline goes live on M21.
- Landed: seeds storage-flag honour, card-description fix, sanitize-html bump, 57 repaired test files,
  MCP test exclusion, adopt-test repairs.
- Correction (post-review 5409952383): the RUNTIME storage-flag + S3 split did NOT land — env.ts/s3.ts
  are byte-identical to stable. Follow-up PR needed before M21 flag-dependent work. My earlier message
  overstated this; the reviewer caught it.
- Migration ledger untouched by design (prod knex_migrations rows must keep matching filenames).

## Verification on head 90d97e47
- Fresh DB: 98 migrations clean.
- typecheck: 592 errors — identical set to stable's own baseline.
- vitest: same failing-file set as stable; 334 passing.
- bun test: 96 vs stable's 80 combined failures (pre-existing mock cross-contamination; all pass standalone).
- build:client green. PR CI verify: pass. Mergeable.

## Deferred
- 191 typing/lint files from main (normal small PRs later).
- MCP tool/test parity.
- Combined-run mock leakage cleanup.

## Next (per convergence plan)
- M1 done when #341 merges (human inspection per policy).
- M2: PR-head → hosted dev (M21) with e2e, TurtleCI-triggered; then merge→Internal Test; promotion→prod.