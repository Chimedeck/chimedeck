# Port-back plan: JH experimental → Chimedeck (then retire JH) — 2026-10-05

## End state
Chimedeck/chimedeck = only repo. Its `main` = single line of development, carries ALL features.
Prod at journeyhorizon.chimedeck.com keeps running from its `stable` line, now with the JH
features ported back. M21 pipeline (TurtleCI: PR-head→dev e2e, merge→Internal Test,
promote→prod) built here. JH repo archived/restricted once ports land + are verified.

## Current state (verified 2026-10-05)
- CDB `stable` @ 1863cda1 = converged tree (main history + stable content + #341). PROD runs this.
- CDB `main` @ d60dc7c2 = old main line, NOT yet back-merged (in-progress local branch
  converge/content-main has the stable-wins merge commit d7945508, not pushed yet).
- JH `main` @ 706fd8b2 = JH `stable` @ bedeec45 (identical trees, converged there since Oct 1).
- Both repos share history to 42de531 (2026-05-21).
- File-truth deltas CDB-stable vs JH-main: 517 files (238 JH-only paths, 250 differing, 9+ migrations
  only on JH).

## Port inventory (JH-only VALUE, feature bundles)
1. Admin app: src/extensions/Admin (32) + server/extensions/admin (29) + 0131_admin_account
   migration + db/seeds/0131_admin_owner seed.
2. Trello import: server/extensions/trelloImport (28) + src TrelloImport (7) + db/trello-import
   extras + migrations 0132/0134/0135.
3. Card size summary modal (src/extensions/CardSize, 7).
4. Email extension (server/extensions/email, 10) + 0133_notification_reminder_email.
5. Card templates: 20260616_card_is_template + touchpoints (Card list/update/ducks/views).
6. Notifications unique constraint: 20260616_notifications_unique_constraint.
7. Attachment position: 0130_attachment_position + consumers.
8. Board GitHub BRANCH setting: 0122_board_github_branch + consumers (0121_board_github_project_url
   already in CDB).
9. CI/guard layer: .github/CODEOWNERS, workflows/copilot-review-gate.yml,
   workflows/stable-source-guard.yml, CONTRIBUTING branch-model, bug/PR templates.
10. Also differing paths on shared files (250): JH-side improvements in Board(21), Card(21),
    automation(11), notifications(9), Cards' optimistic updates etc. — decide per-file: many are
    JH's equivalents of fixes CDB converged differently; cherry-pick by FEATURE, not wholesale.

## Migration ledger rule (hard constraint)
CDB prod knex_migrations stamps stable's exact 98 filenames. JH's 9 migrations get NEW numbers
continuing CDB ledger (next numeric after 0130 stable's + date-named where JH used dates), files
byte-kept but RENAMED — migrations must apply as FRESH (never already-applied names). Verify no
table/column clashes: all 9 are additive (checked: none of them exist in CDB).

## Execution order (small PRs against CDB main, TurtleCI-relevant CI after)
- PR A: finish converge/content-main (back-merge stable→main, stable tree wins) → main = product.
  Push d7945508 + PR; reviews; merge.
- PR B: CI/guard layer port (docs/workflows/CODEOWNERS) — enables Copilot gate on CDB properly.
- PR C: notifications unique + attachment position + board github branch (small additive migrations
  renumbered) + their consumer code.
- PR D: card templates + card size modal.
- PR E: admin app + admin account seed/migration.
- PR F: trello import bundle.
- PR G: email extension + reminder email.
- After each: typecheck(592-baseline no-new), vitest(334/54 no-new), standalone bun tests green.
- PR H: JH-side M-path wins where JH's version is newer on shared files (per-file review, ~15 batches).
- Final: tag pre-archive state, restrict JH writes (archive repo in settings; read-only).

## Notes
- JH junk at root (.task, .task.resume, console-errors.txt, .agent-loop-current-log) NOT ported.
- .agents/.continue stripe skill sets: JH-only AI-config junk; drop (CDB doesn't use them).
- Keep .umbra deploy templates as-is on CDB (already there). JH's .umbra/commercial.yml identical.
- Business data: prod DB = source of truth; no data migration needed (features land as additive
  schema on prod via deploy pipeline).