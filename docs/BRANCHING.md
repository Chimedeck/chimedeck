# Branch policy: main is always the PR target

## Rule
Every PR — feature, fix, chore, Dependabot — targets `main`. Never open a PR against `stable`.

`stable` is the ship branch. It moves only by **promotion**: after a human inspects the merged
change on `main`, a promotion carries it to `stable`. `main` merges deploy nowhere; the promotion
to `stable` is what ships.

## Why
- `main` is the review surface. Reviewers (Copilot + independent review) see exactly what will ship.
- `stable` stays release-shaped: reviewed content only, no direct feature traffic.
- Direct-to-`stable` PRs bypass the human inspection gate (happened once: PR #336 in Oct 2026 —
  corrected by PR #338 which carried the same fix onto `main`).

## Flow
1. Branch from `main` → PR with `--base main`.
2. Copilot review + independent review + `verify` CI all green on the PR head.
3. Merge to `main`.
4. Human inspects the change on the PR diff or by running it locally from `main`
   (e.g. `bun run dev` + the app UI against the local stack — the same path used for QA before
   merging). `main` is never deployed, so inspection is diff/local-run only.
5. Promote to `stable` (promotion PR/merge) — this is the shipping step.