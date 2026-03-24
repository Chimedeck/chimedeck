# Sprint 91 — Iteration 1: Automation — Rule Builder & Trigger/Action Pickers

Purpose
- Ensure Automation Rule Builder core UI and the Trigger/Action pickers are
  driven by `src/extensions/Automation/translations/en.json`.

Preconditions
- Dev server (MCP) is running and Automation feature enabled.

Steps
1. Open the Automation panel for a board/card.
2. Assert panel title equals `Automation`.
3. Open Rule Builder and assert `Rule name` placeholder and `Save Rule` / `Cancel` labels.
4. Open TriggerPicker: assert search placeholder `Search triggers…` and `No matching triggers` text.
5. Open ActionPicker: assert `Search actions…`, `Add action`, and `No matching actions` texts.

Expected
- Rule builder and pickers display copy from the translation JSON and remain functional.
