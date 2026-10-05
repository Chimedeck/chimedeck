# 2026-10-05 — Convergence PR #341: stable content + main history

## What
- Convergence branch `converge/main-into-stable` (PR #341, base `stable`): main's history merged so
  the repo moves to a single line of development before the dev/test/prod pipeline goes live on M21.
- Landed: complete FLAG_USE_LOCAL_STORAGE (seed + runtime), card-description fix, sanitize-html bump, 57 repaired test files,
  MCP test exclusion, adopt-test repairs.
- Correction history: initial summary overstated the re-landed scope (review 5409952383 caught it);
  then commit 593e54d9 LANDED the runtime half for real — env.ts resolveS3Env() + s3.ts WHEN_REQUIRED
  checksums + localstack 3.8.1 pin, seed↔runtime consistent. Still deferred: s3ServerClient direct-op
  split (main 398f10ef, 14 consumers).
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