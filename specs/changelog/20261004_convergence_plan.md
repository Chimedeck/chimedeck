# Chimedeck: single-branch delivery + convergence plan

Written 2026-10-04. Target: one delivery flow exactly like the other repos, M21 replaces AWS.

## Current state (verified today)

- `main` (22cf71ce) and `stable` (592a50b8) are 8 months-diverged forks of merge-base 42de5311:
  - stable-only: 103 commits — subscription/commercial layer (`server/extensions/subscription`, tiers, checkout, billing, MCP board-list tool), client-side HTML sanitisation (`sanitizeUserGeneratedHtml`, `escapeScriptTags`), AI-assist chat features, deploy hardening (Aug 29), stable-PR-verify CI. Terraform envs: `stable`, `commercial`.
  - main-only: 327 direct commits + 4 merged PRs (#318–#331 e2e repairs, #338 fix, #339 policy) — mostly test/e2e/lint work. Terraform envs: `stable` only.
  - Tree diff: 1,553 files, ~73k insertions / ~12k deletions (server alone: 762 files).
- DB migrations: main stops at 0118 numeric; stable has 0119–0130 numeric + date-named 20260601–20260615. Stable has duplicate numbers (0097, 0121, 0122, 0124). Only content conflicts at 0001 (knex type import) and 0041 (down() signature) — both benign type/signature wobbles.
- No in-repo deploy CI. Deploys are triggered outside the repo (TurtleCI), scripts are `scripts/deploy.stable.sh` (ECR + SSM instance deploy), `scripts/deploy.asg.stable.sh` (terraform blue-green, `--env production`), `scripts/deploy-on-instance-staging.sh` (staging via local-db/local-s3 profiles).
- Branch protection on `main` and `stable`: `verify` + 1 approval + Copilot/review gates.
- AWS today (per memory): ChimeDeck account 708508158668; TurtleCI SSH deploys; EC2 + RDS + S3 + SES.

## Target process (from Matt, 2026-10-04)

1. Every PR targets `main`. CI runs build/verify + e2e **on the PR head against a hosted dev environment**.
2. Merge to `main` → TurtleCI auto-deploys to **Internal Test** (M21).
3. Promote to `stable` → TurtleCI deploys **Production** (M21).
4. Dev, Test, Production all on M21 (worker 10.21.0.131 / control 10.21.0.68 docker hosts).
5. When the M21 pipeline is proven, decommission ALL AWS infra (EC2, RDS, S3, SES or keep SES if needed).

## Convergence PR — the prerequisite

Goal: `main` becomes the superset (has commercial + sanitisation + everything), stable becomes a promotion ref.

1. Branch `converge/stable-into-main` from `origin/main`.
2. `git merge origin/stable` — expect conflicts:
   - `db/migrations/`: renumber stable's 0119–0130 + date-named migrations past main's 0118 (pick 0119+ sequential, keep stable's content; then date-named become numeric). Must reconcile with the LIVE DB in prod (knex_migrations table) — the prod DB currently has stable's migration ledger; renumbering is safe only because prod tracks stable; dev DBs get rebuilt.
   - Migration collisions at 0001/0041: accept stable's version (type-only).
   - Duplicate numbers on stable (0097/0121/0122/0124 pairs): rename with new sequential numbers on main; note in changelog; verify prod ledger order.
   - Code: subscription + commercial dirs, `BoardChat*`, `sanitizeUserGeneratedHtml.ts` imports — mostly additive; conflicts mainly where main refactored shared files (auth API, board api, eslint config).
   - `package.json`/`bun.lock`: keep union of deps; regen lockfile.
3. Post-merge: `bun run typecheck` (expect pre-existing tsc noise; gate on no NEW errors), build client, boot local stack, run e2e suite; targeted manual check of subscription pages + card description.
4. Gate: PR → Copilot + independent review + `verify` → merge to `main`.
5. After merge: `stable` gets promoted (full merge), production DB migrates 0119→… in ledger order. Verify app health + a smoke suite on prod before declaring.

## Pipeline setup (after convergence)

- **Dev env (M21)**: PR-head deploys. New workflow `pr-head-deploy.yml` on main:
  - triggers on PR (opened/synchronize), builds docker image tagged `pr-<number>-<sha>`, pushes to M21 registry/loads image, brings up `chimedeck-dev` compose stack on worker 10.21.0.131, runs e2e suite against it (Playwright `TEST_BASE_URL` pointed at the dev host), posts results to the PR. Teardown/reuse per PR number.
- **Internal Test (M21)**: merge-to-main auto-deploy. Workflow `main-deploy-test.yml`: build image `test-<sha>`, deploy to `chimedeck-test` stack on M21, health check, run e2e smoke on the deployed URL.
- **Production (M21)**: promotion to stable. Workflow `promote-stable.yml` (manual-approve gate): Matt inspects main first, then promotion PR main→stable; merge triggers build `prod-<sha>`, blue-green swap on M21.
- Runner/wiring: M21 hosts are only reachable from the office network/VPN; either self-hosted GitHub runner on the M21 host, or TurtleCI continues to do the actual deploys with M21 as SSH target. Decide based on jh-hermes-developer-box access patterns.

## Risks / notes for Matt

- Production DB ledger follows stable; the convergence must produce one migration ledger that matches what prod has already applied (adopt stable's order) or prod migrations will mis-fire. Plan includes reconciling `knex_migrations` rows against renumbered files.
- Commercial/subscription code has no e2e on stable — after convergence, subscription flows need smoke tests before the first M21 production deploy.
- SES email (verification, magic links) is AWS-bound; decide whether M21 keeps SES or switches to an internal SMTP before AWS decommission.
- TurtleCI deploys currently expect SSH/SSM EC2; the M21 switch needs new instance ids, new `AWS_INSTANCE_IDS`-equivalent config (or replacement with plain SSH deploy), and fresh `.env` handling (Secrets Manager replaced by M21 vault).
- Rollback: keep blue/fallback container pattern on M21 (already in the on-instance scripts).

## Milestones

- M1: convergence PR merged to main; stable promoted; prod healthy on AWS (no behaviour change, single ledger).
- M2: dev e2e-on-PR pipeline working on M21 (dev env).
- M3: merge → Internal Test auto-deploy working on M21.
- M4: promotion → production blue-green on M21; soak N days on M21 for prod.
- M5: cut over traffic, decommission AWS (EC2, RDS, S3 → MinIO on M21; keep only SES if unresolved), archive ECR images + Terraform state, note in wiki.