# Sprint 91 — Iteration 2: Automation — Buttons, Schedules, Run Log

Purpose
- Verify Automation card/board buttons, schedule builder, and run log UI use
  translation JSON values.

Preconditions
- Dev server (MCP) is running and Automation has sample data (buttons, schedules, runs).

Steps
1. Open Card/Board Buttons builder and assert name placeholders (e.g. `e.g. Mark as reviewed`).
2. Open ScheduleBuilder and assert labels `Save Schedule` / `Cancel`.
3. Open Run Log and assert status labels `Success`, `Failed`, `Skipped`, and `Load more`.
4. Assert quota copy and `runs remaining` text appear as defined.

Expected
- All listed copy is sourced from translations and UI behavior unchanged.
