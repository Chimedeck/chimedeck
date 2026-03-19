# Sprint 90 — Iteration 3: Attachment translations (Playwright MCP test)

Purpose
- Verify Attachment(s) UI uses `src/extensions/Attachment(translations)/en.json`.

Preconditions
- Dev server (MCP) is running and reachable.

Steps
1. Open a card that has attachments or open the Attachments panel.
2. Assert the section title equals `Attachments`.
3. Assert add button reads `Add Attachment` and upload label reads `Upload a file`.
4. Check link placeholder and name placeholder texts (e.g. `Paste a URL…`).
5. Trigger an upload failure (if possible) and assert the error copy reads
   `Upload failed. Please try again.`.

Expected
- Attachments UI strings match the translation JSON and no regressions.
