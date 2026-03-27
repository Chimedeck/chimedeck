> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Sprint 90 — Iteration 1: Comment translations (Playwright MCP test)

Purpose
- Verify the Comment feature reads its UI copy from
  `src/extensions/Comment/translations/en.json` and that no hard-coded English
  strings remain in the Comment components.

Preconditions
- Dev server (MCP) is running and reachable.
- A card with an existing comment thread is available for the test.

Steps
1. Open the app and navigate to a card that has comments.
2. Open the comment editor.
3. Assert the comment input placeholder equals `Add a comment…`.
4. Assert edit placeholder equals `Edit comment…` when editing.
5. Assert Save/Cancel button labels read `Save` / `Cancel`.
6. Trigger the delete flow on a comment and assert the confirmation text
   equals `Delete this comment?`.
7. Optionally: scan visible comment component text nodes and ensure they
   match keys defined in `translations/en.json` (heuristic check for no
   remaining hard-coded copy).

Expected
- All UI text above matches the values defined in the translation JSON and
  there are no regressions in comment behaviour.