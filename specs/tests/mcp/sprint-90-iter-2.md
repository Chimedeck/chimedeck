> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Sprint 90 — Iteration 2: Activity translations (Playwright MCP test)

Purpose
- Verify the Activity feature reads UI copy from
  `src/extensions/Activity/translations/en.json` and no hard-coded English
  strings remain.

Preconditions
- Dev server (MCP) is running and reachable.

Steps
1. Open Activity panel/feed in the app.
2. Assert the feed title equals `Activity`.
3. If feed empty, assert empty state reads `No activity yet`.
4. Assert filter labels `All`, `Comments`, `Events` are present.
5. Assert `Load more` label and `Today` / `Yesterday` labels appear as defined.

Expected
- Activity UI text matches translation JSON values and behaviour unchanged.