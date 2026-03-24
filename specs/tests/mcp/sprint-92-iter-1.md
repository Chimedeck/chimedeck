# Sprint 92 — Iteration 1: Plugins — Dashboard, Search, Register modal

Purpose
- Verify Plugins dashboard, search bar, and register modal UI copy comes from
  `src/extensions/Plugins/translations/en.json`.

Preconditions
- Dev server (MCP) is running and Plugins feature enabled.

Steps
1. Open the Plugins dashboard and assert the title `Plugins` and `Browse Plugins` button.
2. Use the PluginSearchBar and assert placeholder `Search plugins…` and `No matching plugins` text.
3. Open Register Plugin modal and assert placeholders and the `Register` / `Cancel` buttons.
4. When API key is revealed, assert copy `API Key (shown once)` and confirm `Copy` / `Copied!` behaviour.

Expected
- Dashboard, search, and register modal text match translation JSON and functions operate as expected.
