# Chimedeck BDD Spec (Generated from Implemented App + Sprint/Test Assets)

> Scope: full-application behavior inventory for AI planning and executable verification.
> Generated from: `tests/e2e/*.spec.ts`, `specs/tests/*.md`, and sprint architecture docs.

## Sources of Truth

- Sprint plan and sprint definitions: `specs/sprints/`
- Implemented executable tests: `tests/e2e/*.spec.ts`
- Manual acceptance procedures: `specs/tests/*.md`
- API route contracts in server extension handlers

## Coverage Summary

- Automated Playwright-backed BDD scenarios: **182**
- Manual/spec-documented BDD scenarios: **142**
- Total scenarios in this document: **324**

## A) Automated Scenarios (Executable)

Each scenario below is mapped in `specs/bdd/bdd-playwright-map.json`.

### Feature: Attachment Panel


### Feature: Attachment Upload

#### Scenario BDD-AUTO-0001 — Test 1 — Initiate multipart upload returns 201 with uploadId and key
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/attachment-upload.spec.ts:30`

#### Scenario BDD-AUTO-0002 — Test 2 — Full multipart upload flow returns READY attachment
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/attachment-upload.spec.ts:50`

#### Scenario BDD-AUTO-0003 — Test 3 — Add attachment via URL returns 201 with URL type
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/attachment-upload.spec.ts:133`

#### Scenario BDD-AUTO-0004 — Test 4 — Reject disallowed MIME type returns 400 mime-type-not-allowed
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/attachment-upload.spec.ts:153`

#### Scenario BDD-AUTO-0005 — Test 5 — Reject file exceeding size limit returns 413 file-too-large
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/attachment-upload.spec.ts:171`

#### Scenario BDD-AUTO-0006 — Test 6 — Reject unauthenticated request returns 401
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/attachment-upload.spec.ts:189`

#### Scenario BDD-AUTO-0007 — Test 7 — UI displays attachment thumbnail after upload
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/attachment-upload.spec.ts:204`

#### Scenario BDD-AUTO-0008 — Test 8 — UI shows download link for URL attachment
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/attachment-upload.spec.ts:244`


### Feature: Board Presence

#### Scenario BDD-AUTO-0155 — Test 1 — GET /boards/:id/presence returns active viewer list
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/presence-board.spec.ts:36`

#### Scenario BDD-AUTO-0156 — Test 2 — POST /boards/:id/presence registers the current user as a viewer
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/presence-board.spec.ts:53`

#### Scenario BDD-AUTO-0157 — Test 3 — DELETE /boards/:id/presence deregisters the current user
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/presence-board.spec.ts:68`

#### Scenario BDD-AUTO-0158 — Test 4 — Second user joining the board is reflected in the presence list
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/presence-board.spec.ts:88`

#### Scenario BDD-AUTO-0159 — Test 5 — Unauthenticated presence request returns 401
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/presence-board.spec.ts:122`

#### Scenario BDD-AUTO-0160 — Test 6 — UI: Second user avatar appears in board header of first user
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/presence-board.spec.ts:140`


### Feature: Board View Preference API

#### Scenario BDD-AUTO-0019 — User logs in and gets default view preference
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/board-view-preference.spec.ts:46`

#### Scenario BDD-AUTO-0020 — User changes view and it persists
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/board-view-preference.spec.ts:58`

#### Scenario BDD-AUTO-0021 — Access denied without authentication
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/board-view-preference.spec.ts:78`

#### Scenario BDD-AUTO-0022 — Invalid view type returns error
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/board-view-preference.spec.ts:89`

#### Scenario BDD-AUTO-0023 — Multiple boards have independent preferences
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/board-view-preference.spec.ts:102`


### Feature: Board member API flows

#### Scenario BDD-AUTO-0014 — GET /boards/:id/members returns explicit board members
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/board-members.spec.ts:40`

#### Scenario BDD-AUTO-0015 — POST /boards/:id/members adds/updates member idempotently
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/board-members.spec.ts:58`

#### Scenario BDD-AUTO-0016 — PATCH /boards/:id/members/:userId changes role, rejects demotion of last ADMIN
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/board-members.spec.ts:77`

#### Scenario BDD-AUTO-0017 — DELETE /boards/:id/members/:userId removes member, rejects removal of last ADMIN
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/board-members.spec.ts:91`

#### Scenario BDD-AUTO-0018 — Board visibility: GUESTs see only boards with guest access
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/board-members.spec.ts:104`


### Feature: Board visibility access control

#### Scenario BDD-AUTO-0024 — PRIVATE board — unauthenticated request is rejected (401)
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/board-visibility.spec.ts:69`

#### Scenario BDD-AUTO-0025 — PRIVATE board — non-member authenticated request returns 403
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/board-visibility.spec.ts:78`

#### Scenario BDD-AUTO-0026 — PUBLIC board — accessible without an auth token
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/board-visibility.spec.ts:90`

#### Scenario BDD-AUTO-0027 — UI — PATCH visibility updates board and new visibility is applied
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/board-visibility.spec.ts:102`


### Feature: BoardNotificationTypePreferences

#### Scenario BDD-AUTO-0134 — notification type preferences component works correctly
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/notification-type-prefs.spec.ts:68`


### Feature: Business Logic Invariants

#### Scenario BDD-AUTO-0028 — PATCH /cards/:id returns 403 board-is-archived
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/business-logic-invariants.spec.ts:32`

#### Scenario BDD-AUTO-0029 — POST /lists/:listId/cards returns 403 board-is-archived
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/business-logic-invariants.spec.ts:43`

#### Scenario BDD-AUTO-0030 — POST /cards/:id/comments returns 403 board-is-archived
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/business-logic-invariants.spec.ts:54`

#### Scenario BDD-AUTO-0031 — GET /boards/:boardId/lists still works on archived board (200)
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/business-logic-invariants.spec.ts:65`

#### Scenario BDD-AUTO-0032 — DELETE last owner returns 422 workspace-must-have-one-owner
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/business-logic-invariants.spec.ts:94`

#### Scenario BDD-AUTO-0033 — PATCH role change for last owner returns 422
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/business-logic-invariants.spec.ts:109`

#### Scenario BDD-AUTO-0034 — Role change succeeds when a second OWNER is promoted first
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/business-logic-invariants.spec.ts:127`


### Feature: CSRF Origin Header Guard

#### Scenario BDD-AUTO-0052 — Test 1 — Mutating request with correct Origin passes
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/csrf-guard.spec.ts:30`

#### Scenario BDD-AUTO-0053 — Test 2 — Mutating request with mismatched Origin is blocked (403)
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/csrf-guard.spec.ts:45`

#### Scenario BDD-AUTO-0054 — Test 3 — Mutating request with mismatched Referer is blocked (403)
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/csrf-guard.spec.ts:60`

#### Scenario BDD-AUTO-0055 — Test 4 — Mutating request with no Origin/Referer is allowed (non-browser client)
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/csrf-guard.spec.ts:79`

#### Scenario BDD-AUTO-0056 — Test 5 — Safe (GET) request with mismatched Origin is NOT blocked
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/csrf-guard.spec.ts:101`

#### Scenario BDD-AUTO-0057 — Test 6 — Auth cookies contain SameSite=Strict; Secure; HttpOnly flags
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/csrf-guard.spec.ts:115`


### Feature: Calendar View

#### Scenario BDD-AUTO-0035 — Switching to Calendar renders the monthly grid with current month title
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/calendar-view.spec.ts:114`

#### Scenario BDD-AUTO-0036 — Cards with due_date appear on correct day cells
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/calendar-view.spec.ts:132`

#### Scenario BDD-AUTO-0037 — "Cards without a due date" toolbar note is visible
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/calendar-view.spec.ts:157`

#### Scenario BDD-AUTO-0038 — Prev/next month navigation changes the month title
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/calendar-view.spec.ts:170`

#### Scenario BDD-AUTO-0039 — "+N more" overflow chip shown when day has > 3 cards
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/calendar-view.spec.ts:200`

#### Scenario BDD-AUTO-0040 — Toggling to weekly view renders the 7-column week grid
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/calendar-view.spec.ts:231`

#### Scenario BDD-AUTO-0041 — Prev/next week navigation changes the week title
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/calendar-view.spec.ts:249`

#### Scenario BDD-AUTO-0042 — Cards with due_date appear in the weekly view on correct day
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/calendar-view.spec.ts:273`

#### Scenario BDD-AUTO-0043 — Drag card to another day updates due_date via PATCH (monthly view)
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/calendar-view.spec.ts:295`

#### Scenario BDD-AUTO-0044 — Failed PATCH on drag reverts card and shows error toast
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/calendar-view.spec.ts:333`


### Feature: Card Description — Inline Click-to-Edit

#### Scenario BDD-AUTO-0045 — Test 1 — Enter edit mode by clicking description area
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/card-description-inline-edit.spec.ts:41`

#### Scenario BDD-AUTO-0046 — Test 2 — Save with Ctrl+Enter
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/card-description-inline-edit.spec.ts:64`

#### Scenario BDD-AUTO-0047 — Test 3 — Cancel with Escape restores original text
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/card-description-inline-edit.spec.ts:94`

#### Scenario BDD-AUTO-0048 — Test 4 — Save with Save button
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/card-description-inline-edit.spec.ts:116`

#### Scenario BDD-AUTO-0049 — Test 5 — Cancel with Cancel button
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/card-description-inline-edit.spec.ts:134`

#### Scenario BDD-AUTO-0050 — Test 6 — Empty description shows placeholder
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/card-description-inline-edit.spec.ts:158`

#### Scenario BDD-AUTO-0051 — Test 7 — Keyboard accessibility: Enter on view element enters edit mode
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/card-description-inline-edit.spec.ts:181`


### Feature: Custom Field Values API

#### Scenario BDD-AUTO-0058 — PUT — upsert TEXT value creates new record (201)
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-field-values-api.spec.ts:56`

#### Scenario BDD-AUTO-0059 — PUT — upsert TEXT value again updates record (200)
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-field-values-api.spec.ts:65`

#### Scenario BDD-AUTO-0060 — GET — retrieve custom field value directly
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-field-values-api.spec.ts:72`

#### Scenario BDD-AUTO-0061 — GET card — includes customFieldValues
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-field-values-api.spec.ts:82`

#### Scenario BDD-AUTO-0062 — POST board batch custom-field-values — accepts cardIds in request body
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-field-values-api.spec.ts:95`

#### Scenario BDD-AUTO-0063 — PUT — NUMBER value creates record
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-field-values-api.spec.ts:108`

#### Scenario BDD-AUTO-0064 — PUT — NUMBER value wrong type returns 400
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-field-values-api.spec.ts:121`

#### Scenario BDD-AUTO-0065 — PUT — CHECKBOX value creates record
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-field-values-api.spec.ts:134`

#### Scenario BDD-AUTO-0066 — PUT — CHECKBOX wrong type returns 400
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-field-values-api.spec.ts:147`

#### Scenario BDD-AUTO-0067 — PUT — DATE value creates record
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-field-values-api.spec.ts:160`

#### Scenario BDD-AUTO-0068 — PUT — DATE invalid value returns 400
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-field-values-api.spec.ts:173`

#### Scenario BDD-AUTO-0069 — PUT — DROPDOWN value creates record
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-field-values-api.spec.ts:186`

#### Scenario BDD-AUTO-0070 — DELETE — removes a custom field value
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-field-values-api.spec.ts:203`

#### Scenario BDD-AUTO-0071 — GET card — deleted value not in includes
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-field-values-api.spec.ts:219`

#### Scenario BDD-AUTO-0072 — PUT — field from different board returns 422
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-field-values-api.spec.ts:228`

#### Scenario BDD-AUTO-0073 — PUT — unauthenticated request returns 401
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-field-values-api.spec.ts:243`


### Feature: Custom Fields API

#### Scenario BDD-AUTO-0074 — POST — create a TEXT field
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-api.spec.ts:33`

#### Scenario BDD-AUTO-0075 — POST — create a DROPDOWN field with options
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-api.spec.ts:48`

#### Scenario BDD-AUTO-0076 — POST — create DATE, NUMBER, CHECKBOX fields
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-api.spec.ts:69`

#### Scenario BDD-AUTO-0077 — GET — list all fields returns at least 5 items
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-api.spec.ts:76`

#### Scenario BDD-AUTO-0078 — PATCH — rename a field
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-api.spec.ts:92`

#### Scenario BDD-AUTO-0079 — PATCH — update show_on_card
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-api.spec.ts:106`

#### Scenario BDD-AUTO-0080 — PATCH — update DROPDOWN options
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-api.spec.ts:119`

#### Scenario BDD-AUTO-0081 — POST — validation error: missing name
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-api.spec.ts:139`

#### Scenario BDD-AUTO-0082 — POST — validation error: invalid field_type
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-api.spec.ts:144`

#### Scenario BDD-AUTO-0083 — POST — validation error: options not array
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-api.spec.ts:149`

#### Scenario BDD-AUTO-0084 — PATCH — 404 for unknown field
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-api.spec.ts:158`

#### Scenario BDD-AUTO-0085 — DELETE — removes a field
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-api.spec.ts:171`

#### Scenario BDD-AUTO-0086 — DELETE — 404 for already-deleted field
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-api.spec.ts:185`

#### Scenario BDD-AUTO-0087 — Permission guard — non-ADMIN cannot create fields
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-api.spec.ts:195`


### Feature: Custom Fields Board Settings Panel

#### Scenario BDD-AUTO-0088 — Open Board Settings and verify Custom Fields section is visible
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-board-panel.spec.ts:32`

#### Scenario BDD-AUTO-0089 — Create a TEXT custom field
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-board-panel.spec.ts:42`

#### Scenario BDD-AUTO-0090 — Create a DROPDOWN custom field with options
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-board-panel.spec.ts:58`

#### Scenario BDD-AUTO-0091 — Rename a custom field
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-board-panel.spec.ts:82`

#### Scenario BDD-AUTO-0092 — Toggle show_on_card checkbox
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-board-panel.spec.ts:107`

#### Scenario BDD-AUTO-0093 — Delete a custom field
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-board-panel.spec.ts:127`

#### Scenario BDD-AUTO-0094 — Close the Board Settings panel
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-board-panel.spec.ts:146`


### Feature: Custom Fields UI — Card Modal Value Editing

#### Scenario BDD-AUTO-0095 — TEXT field — edit and save value in card modal, badge on tile
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-ui.spec.ts:52`

#### Scenario BDD-AUTO-0096 — NUMBER field — edit value in card modal, badge on tile
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-ui.spec.ts:78`

#### Scenario BDD-AUTO-0097 — CHECKBOX field — toggle value in card modal
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-ui.spec.ts:101`

#### Scenario BDD-AUTO-0098 — DROPDOWN field — select option in card modal
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-ui.spec.ts:122`

#### Scenario BDD-AUTO-0099 — Clear a field value removes badge from tile
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-ui.spec.ts:148`

#### Scenario BDD-AUTO-0100 — show_on_card=false — no badge on tile
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/custom-fields-ui.spec.ts:178`


### Feature: Delete Confirmation Flag

#### Scenario BDD-AUTO-0101 — Test 1 — Board DELETE without confirm returns 409 when board has lists
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/delete-confirmation.spec.ts:21`

#### Scenario BDD-AUTO-0102 — Test 2 — Board DELETE with confirm:true succeeds when board has lists
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/delete-confirmation.spec.ts:35`

#### Scenario BDD-AUTO-0103 — Test 3 — Empty board DELETE proceeds without confirmation (204)
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/delete-confirmation.spec.ts:59`

#### Scenario BDD-AUTO-0104 — Test 4 — List DELETE without confirm returns 409 when list has cards
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/delete-confirmation.spec.ts:68`

#### Scenario BDD-AUTO-0105 — Test 5 — List DELETE with confirm:true succeeds when list has cards
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/delete-confirmation.spec.ts:83`

#### Scenario BDD-AUTO-0106 — Test 6 — Empty list DELETE proceeds without confirmation (204)
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/delete-confirmation.spec.ts:110`

#### Scenario BDD-AUTO-0107 — Test 7 — UI shows confirmation dialog for board with lists
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/delete-confirmation.spec.ts:120`

#### Scenario BDD-AUTO-0108 — Test 8 — UI confirms and deletes board, redirects to workspace list
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/delete-confirmation.spec.ts:157`

#### Scenario BDD-AUTO-0109 — Test 9 — UI shows confirmation dialog for list with cards
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/delete-confirmation.spec.ts:190`

#### Scenario BDD-AUTO-0110 — Test 10 — UI confirms and deletes list
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/delete-confirmation.spec.ts:223`


### Feature: Input Sanitization — XSS Prevention

#### Scenario BDD-AUTO-0111 — Test 1 — XSS payload in card title is stripped to plain text
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/input-sanitization.spec.ts:25`

#### Scenario BDD-AUTO-0112 — Test 2 — HTML injection in card title is stripped
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/input-sanitization.spec.ts:42`

#### Scenario BDD-AUTO-0113 — Test 3 — XSS in card description stripped; safe Markdown HTML preserved
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/input-sanitization.spec.ts:59`

#### Scenario BDD-AUTO-0114 — Test 4 — javascript: href in description link is stripped
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/input-sanitization.spec.ts:70`

#### Scenario BDD-AUTO-0115 — Test 5 — XSS payload in board name is stripped
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/input-sanitization.spec.ts:80`

#### Scenario BDD-AUTO-0116 — Test 6 — Board description: safe HTML preserved, script stripped
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/input-sanitization.spec.ts:92`

#### Scenario BDD-AUTO-0117 — Test 7 — XSS payload in list name is stripped
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/input-sanitization.spec.ts:103`

#### Scenario BDD-AUTO-0118 — Test 8 — XSS payload in list name update is stripped
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/input-sanitization.spec.ts:114`

#### Scenario BDD-AUTO-0119 — Test 9 — XSS in comment content stripped; safe Markdown preserved
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/input-sanitization.spec.ts:125`

#### Scenario BDD-AUTO-0120 — Test 10 — XSS payload in custom field value_text is stripped
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/input-sanitization.spec.ts:137`

#### Scenario BDD-AUTO-0121 — Test 11 — Normal plain text input is stored unchanged
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/input-sanitization.spec.ts:168`


### Feature: List Management

#### Scenario BDD-AUTO-0122 — Test 1 — Create list returns 201 with id and name
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/list-management.spec.ts:30`

#### Scenario BDD-AUTO-0123 — Test 2 — Rename list returns 200 with updated name
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/list-management.spec.ts:51`

#### Scenario BDD-AUTO-0124 — Test 3 — Reorder lists returns 200 with updated positions
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/list-management.spec.ts:74`

#### Scenario BDD-AUTO-0125 — Test 4 — Archive list returns 200 and list is excluded from active lists
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/list-management.spec.ts:104`

#### Scenario BDD-AUTO-0126 — Test 5 — Create list without auth returns 401
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/list-management.spec.ts:132`

#### Scenario BDD-AUTO-0127 — Test 6 — UI: Add list button creates a new list on the board
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/list-management.spec.ts:149`

#### Scenario BDD-AUTO-0128 — Test 7 — UI: Double-clicking list header allows renaming
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/list-management.spec.ts:194`

#### Scenario BDD-AUTO-0129 — Test 8 — UI: Dragging a list changes its position
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/list-management.spec.ts:238`


### Feature: MCP HTTP Init

#### Scenario BDD-AUTO-0130 — Unauthenticated POST returns 401
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/mcp-http-init.spec.ts:17`

#### Scenario BDD-AUTO-0131 — Valid POST initializes session and returns mcp-session-id
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/mcp-http-init.spec.ts:30`


### Feature: POST /api/v1/metrics/propagation

#### Scenario BDD-AUTO-0137 — returns 204 with a valid delayMs payload
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/otel-metrics.spec.ts:46`

#### Scenario BDD-AUTO-0138 — returns 400 when delayMs is missing
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/otel-metrics.spec.ts:53`

#### Scenario BDD-AUTO-0139 — returns 400 when delayMs is negative
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/otel-metrics.spec.ts:60`

#### Scenario BDD-AUTO-0140 — returns 400 when body is invalid JSON text
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/otel-metrics.spec.ts:67`

#### Scenario BDD-AUTO-0141 — returns 204 with zero delayMs (no-error boundary)
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/otel-metrics.spec.ts:76`

#### Scenario BDD-AUTO-0142 — card move succeeds and board state is consistent
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/otel-metrics.spec.ts:85`


### Feature: Payment — Card Price

#### Scenario BDD-AUTO-0143 — Test 1 — Set card money fields returns 200 with persisted values
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/payment-card-price.spec.ts:31`

#### Scenario BDD-AUTO-0144 — Test 2 — Partial update (label only) preserves amount and currency
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/payment-card-price.spec.ts:52`

#### Scenario BDD-AUTO-0145 — Test 3 — Partial update (amount only) preserves currency
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/payment-card-price.spec.ts:77`

#### Scenario BDD-AUTO-0146 — Test 4 — Clear amount (null) also clears currency
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/payment-card-price.spec.ts:100`

#### Scenario BDD-AUTO-0147 — Test 5 — JWT token is accepted for money PATCH
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/payment-card-price.spec.ts:123`

#### Scenario BDD-AUTO-0148 — Test 6 — Reject negative amount returns 400 bad-request
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/payment-card-price.spec.ts:139`

#### Scenario BDD-AUTO-0149 — Test 7 — Reject lowercase currency returns 400 bad-request
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/payment-card-price.spec.ts:157`

#### Scenario BDD-AUTO-0150 — Test 8 — Reject empty body returns 400 bad-request
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/payment-card-price.spec.ts:175`

#### Scenario BDD-AUTO-0151 — Test 9 — Reject unauthenticated request returns 401
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/payment-card-price.spec.ts:193`

#### Scenario BDD-AUTO-0152 — Test 10 — Board monetisation flag can be toggled via PATCH
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/payment-card-price.spec.ts:208`

#### Scenario BDD-AUTO-0153 — Test 11 — UI displays price badge on card after money is set
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/payment-card-price.spec.ts:241`

#### Scenario BDD-AUTO-0154 — Test 12 — UI hides price badge when monetisation is disabled on board
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/payment-card-price.spec.ts:271`


### Feature: Search Filters

#### Scenario BDD-AUTO-0161 — Test 1 — Search returns cards matching the query term
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/search-filters.spec.ts:38`

#### Scenario BDD-AUTO-0162 — Test 2 — Search with type=card filter returns only card results
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/search-filters.spec.ts:57`

#### Scenario BDD-AUTO-0163 — Test 3 — Search scoped to a specific board excludes other-board cards
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/search-filters.spec.ts:80`

#### Scenario BDD-AUTO-0164 — Test 4 — Unauthenticated search returns 401
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/search-filters.spec.ts:104`

#### Scenario BDD-AUTO-0165 — Test 5 — UI search box filters visible cards by keyword
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/search-filters.spec.ts:117`

#### Scenario BDD-AUTO-0166 — Test 6 — UI type filter toggle shows only matching result type
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/search-filters.spec.ts:151`


### Feature: Table View

#### Scenario BDD-AUTO-0167 — Table view renders column headers after switching to TABLE
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/table-view.spec.ts:81`

#### Scenario BDD-AUTO-0168 — Table view renders card rows
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/table-view.spec.ts:126`

#### Scenario BDD-AUTO-0169 — Clicking a column header changes sort order
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/table-view.spec.ts:146`

#### Scenario BDD-AUTO-0170 — Clicking card title opens card detail modal
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/table-view.spec.ts:174`


### Feature: Timeline Bar Rendering

#### Scenario BDD-AUTO-0171 — Card with start_date and due_date renders as a bar in its swimlane
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/timeline-bar.spec.ts:96`

#### Scenario BDD-AUTO-0172 — Bar has left and right resize handles
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/timeline-bar.spec.ts:120`

#### Scenario BDD-AUTO-0173 — Bar title matches the card title
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/timeline-bar.spec.ts:137`

#### Scenario BDD-AUTO-0174 — Cards in different swimlanes render in their respective bar areas
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/timeline-bar.spec.ts:154`

#### Scenario BDD-AUTO-0175 — Card without dates is NOT rendered as a bar
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/timeline-bar.spec.ts:172`


### Feature: Timeline Drag / Resize

#### Scenario BDD-AUTO-0176 — Dragging the right handle extends due_date via PATCH
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/timeline-drag.spec.ts:119`

#### Scenario BDD-AUTO-0177 — Dragging the left handle moves start_date via PATCH
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/timeline-drag.spec.ts:148`

#### Scenario BDD-AUTO-0178 — Dragging the bar body shifts both dates via PATCH
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/timeline-drag.spec.ts:175`

#### Scenario BDD-AUTO-0179 — PATCH failure reverts bar dates and shows error toast
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/timeline-drag.spec.ts:217`


### Feature: Timeline View

#### Scenario BDD-AUTO-0180 — Switching to Timeline renders the timeline container
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/timeline-view.spec.ts:115`

#### Scenario BDD-AUTO-0181 — One swimlane row renders per list in the board
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/timeline-view.spec.ts:130`

#### Scenario BDD-AUTO-0182 — Card with both start_date and due_date is scheduled (bar area visible)
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/timeline-view.spec.ts:149`

#### Scenario BDD-AUTO-0183 — Card missing start_date appears as unscheduled chip below its swimlane
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/timeline-view.spec.ts:171`

#### Scenario BDD-AUTO-0184 — Card with no dates at all appears as unscheduled chip
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/timeline-view.spec.ts:191`

#### Scenario BDD-AUTO-0185 — Today button is clickable and does not throw
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/timeline-view.spec.ts:206`

#### Scenario BDD-AUTO-0186 — Zoom controls change axis granularity (day zoom renders wider columns)
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/timeline-view.spec.ts:221`

#### Scenario BDD-AUTO-0187 — Clicking an unscheduled chip opens the card detail modal
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/timeline-view.spec.ts:248`


### Feature: member_joined event

#### Scenario BDD-AUTO-0132 — inviting a board guest emits member_joined with scope:board and version field
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/member-joined-event.spec.ts:68`

#### Scenario BDD-AUTO-0133 — all board events include a version field
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/member-joined-event.spec.ts:105`


### Feature: offline mutation queue — IndexedDB persistence

#### Scenario BDD-AUTO-0135 — mutation seeded in IndexedDB before page load is hydrated into queue on boot
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/offline-queue-persistence.spec.ts:142`

#### Scenario BDD-AUTO-0136 — mutation is removed from IndexedDB after successful replay
- Type: AUTO (Playwright)
- Evidence: `tests/e2e/offline-queue-persistence.spec.ts:184`


## B) Manual / Spec-Derived Scenarios (Backlog to Automate)

These scenarios are behavior contracts captured in spec docs; they are not all currently mapped to executable Playwright tests.

### Feature: 01. Sign Up

#### Scenario BDD-MAN-0001 — Navigate to `{TEST_CREDENTIALS.baseUrl}`.
- Type: MANUAL
- Source: `specs/tests/01-signup.md`

#### Scenario BDD-MAN-0002 — Click the **Sign Up** (or **Create account**) button.
- Type: MANUAL
- Source: `specs/tests/01-signup.md`

#### Scenario BDD-MAN-0003 — Fill in the form:
- Type: MANUAL
- Source: `specs/tests/01-signup.md`


### Feature: 02. Email Verification

#### Scenario BDD-MAN-0004 — Observe the verification banner on the dashboard (e.g. "Please verify your email address").
- Type: MANUAL
- Source: `specs/tests/02-verify-email.md`

#### Scenario BDD-MAN-0005 — Click **Resend verification email** inside the banner.
- Type: MANUAL
- Source: `specs/tests/02-verify-email.md`

#### Scenario BDD-MAN-0006 — Trigger email verification via the admin API (simulates clicking the link in the email):
- Type: MANUAL
- Source: `specs/tests/02-verify-email.md`


### Feature: 03. Login

#### Scenario BDD-MAN-0007 — Navigate to `{TEST_CREDENTIALS.baseUrl}`.
- Type: MANUAL
- Source: `specs/tests/03-login.md`

#### Scenario BDD-MAN-0008 — Click **Log in** if not already on the login form.
- Type: MANUAL
- Source: `specs/tests/03-login.md`

#### Scenario BDD-MAN-0009 — Fill in:
- Type: MANUAL
- Source: `specs/tests/03-login.md`


### Feature: 04. Profile Setup

#### Scenario BDD-MAN-0010 — Open the user profile menu (click the avatar / username in the top bar or sidebar).
- Type: MANUAL
- Source: `specs/tests/04-setup-profile.md`

#### Scenario BDD-MAN-0011 — Click **Profile Settings** (or navigate to `{TEST_CREDENTIALS.baseUrl}/profile`).
- Type: MANUAL
- Source: `specs/tests/04-setup-profile.md`

#### Scenario BDD-MAN-0012 — Click the **Edit** control next to the display name (or the nickname field).
- Type: MANUAL
- Source: `specs/tests/04-setup-profile.md`


### Feature: 05. Create Workspace

#### Scenario BDD-MAN-0013 — In the sidebar, click **+ Create workspace** (or the workspace switcher button).
- Type: MANUAL
- Source: `specs/tests/05-create-workspace.md`

#### Scenario BDD-MAN-0014 — Fill in:
- Type: MANUAL
- Source: `specs/tests/05-create-workspace.md`

#### Scenario BDD-MAN-0015 — Submit / click **Create**.
- Type: MANUAL
- Source: `specs/tests/05-create-workspace.md`


### Feature: 06. Create Board

#### Scenario BDD-MAN-0016 — Click **+ Create board** (or the "New board" button inside the workspace).
- Type: MANUAL
- Source: `specs/tests/06-create-board.md`

#### Scenario BDD-MAN-0017 — Fill in:
- Type: MANUAL
- Source: `specs/tests/06-create-board.md`

#### Scenario BDD-MAN-0018 — Click **Create** (or **Save**).
- Type: MANUAL
- Source: `specs/tests/06-create-board.md`


### Feature: 07. Manage Lists

#### Scenario BDD-MAN-0019 — Click **Add a list** (or **+ Add list**).
- Type: MANUAL
- Source: `specs/tests/07-manage-lists.md`

#### Scenario BDD-MAN-0020 — Type `To Do` and press **Enter** (or click **Add List**).
- Type: MANUAL
- Source: `specs/tests/07-manage-lists.md`

#### Scenario BDD-MAN-0021 — Click **Add a list** again and type `In Progress`, confirm.
- Type: MANUAL
- Source: `specs/tests/07-manage-lists.md`


### Feature: 08. Add Cards

#### Scenario BDD-MAN-0022 — In the `To Do` list, click **Add a card** (or **+**).
- Type: MANUAL
- Source: `specs/tests/08-add-cards.md`

#### Scenario BDD-MAN-0023 — Type `Test Card 1` and press **Enter** (or click **Add Card**).
- Type: MANUAL
- Source: `specs/tests/08-add-cards.md`

#### Scenario BDD-MAN-0024 — Click **Add a card** again in the same list.
- Type: MANUAL
- Source: `specs/tests/08-add-cards.md`


### Feature: 09. Card Detail

#### Scenario BDD-MAN-0025 — Click on `Test Card 1` card tile.
- Type: MANUAL
- Source: `specs/tests/09-card-detail.md`

#### Scenario BDD-MAN-0026 — Verify the following sections are visible in the modal:
- Type: MANUAL
- Source: `specs/tests/09-card-detail.md`

#### Scenario BDD-MAN-0027 — Verify the modal header shows the list name `To Do` (breadcrumb or subtitle).
- Type: MANUAL
- Source: `specs/tests/09-card-detail.md`


### Feature: 10. Edit Card Description

#### Scenario BDD-MAN-0028 — Click the description area inside the card modal (shows placeholder text or an empty editor).
- Type: MANUAL
- Source: `specs/tests/10-edit-card-description.md`

#### Scenario BDD-MAN-0029 — Type the following text:
- Type: MANUAL
- Source: `specs/tests/10-edit-card-description.md`

#### Scenario BDD-MAN-0030 — Select the word `description` and click the **Bold** button in the toolbar.
- Type: MANUAL
- Source: `specs/tests/10-edit-card-description.md`


### Feature: 11. Labels, Due Date, Start Date & Checklist

#### Scenario BDD-MAN-0031 — Click **Labels** (or the label icon) in the card sidebar/actions area.
- Type: MANUAL
- Source: `specs/tests/11-labels-dates-checklist.md`

#### Scenario BDD-MAN-0032 — Click **Create a new label**, enter the name `Bug`, choose a colour (e.g. red), and save.
- Type: MANUAL
- Source: `specs/tests/11-labels-dates-checklist.md`

#### Scenario BDD-MAN-0033 — Click the `Bug` label to apply it to the card.
- Type: MANUAL
- Source: `specs/tests/11-labels-dates-checklist.md`


### Feature: 12. Card Attachments

#### Scenario BDD-MAN-0034 — Click **Attach file** (or the paperclip icon / **Attachments** section **+** button).
- Type: MANUAL
- Source: `specs/tests/12-card-attachments.md`

#### Scenario BDD-MAN-0035 — Upload a small PNG or text file (< 1 MB).
- Type: MANUAL
- Source: `specs/tests/12-card-attachments.md`

#### Scenario BDD-MAN-0036 — Verify the attachment shows a status badge **Ready** (not Scanning / Rejected).
- Type: MANUAL
- Source: `specs/tests/12-card-attachments.md`


### Feature: 13. Card Comments & Mentions

#### Scenario BDD-MAN-0037 — Click the comment input at the bottom of the modal (placeholder: `Add a comment…`).
- Type: MANUAL
- Source: `specs/tests/13-card-comments.md`

#### Scenario BDD-MAN-0038 — Type `This is the first comment.` and click **Comment**.
- Type: MANUAL
- Source: `specs/tests/13-card-comments.md`

#### Scenario BDD-MAN-0039 — Hover over the comment to reveal the edit action (pencil icon or **Edit** option).
- Type: MANUAL
- Source: `specs/tests/13-card-comments.md`


### Feature: 14. Move Card

#### Scenario BDD-MAN-0040 — Close the card detail modal if it is open (press **Escape**).
- Type: MANUAL
- Source: `specs/tests/14-move-card.md`

#### Scenario BDD-MAN-0041 — Drag `Test Card 1` from the `To Do` column and drop it into the `In Progress` column.
- Type: MANUAL
- Source: `specs/tests/14-move-card.md`

#### Scenario BDD-MAN-0042 — Open `Test Card 1` by clicking it.
- Type: MANUAL
- Source: `specs/tests/14-move-card.md`


### Feature: 15. Card Short URL

#### Scenario BDD-MAN-0043 — Click on `Test Card 1` to open its detail modal.
- Type: MANUAL
- Source: `specs/tests/15-card-short-url.md`

#### Scenario BDD-MAN-0044 — Locate the **Copy link** button or the short URL display (in the modal footer, header, or share icon).
- Type: MANUAL
- Source: `specs/tests/15-card-short-url.md`

#### Scenario BDD-MAN-0045 — Click **Copy link**.
- Type: MANUAL
- Source: `specs/tests/15-card-short-url.md`


### Feature: 16. Card Price

#### Scenario BDD-MAN-0046 — Click on `Test Card 1` to open its detail modal if not already open.
- Type: MANUAL
- Source: `specs/tests/16-card-price.md`

#### Scenario BDD-MAN-0047 — Locate the **Price** or **Value** field in the card sidebar.
- Type: MANUAL
- Source: `specs/tests/16-card-price.md`

#### Scenario BDD-MAN-0048 — Click the price field and enter `49.99`.
- Type: MANUAL
- Source: `specs/tests/16-card-price.md`


### Feature: 17. Board Background

#### Scenario BDD-MAN-0049 — On the board, click the **Customize** button (or **⋮** → **Change background**).
- Type: MANUAL
- Source: `specs/tests/17-board-background.md`

#### Scenario BDD-MAN-0050 — Select a **solid colour** background (e.g. green or blue).
- Type: MANUAL
- Source: `specs/tests/17-board-background.md`

#### Scenario BDD-MAN-0051 — Select a different colour (e.g. red).
- Type: MANUAL
- Source: `specs/tests/17-board-background.md`


### Feature: 18. Star & Follow Board

#### Scenario BDD-MAN-0052 — Click the **☆ Star** icon in the board header (next to the board title).
- Type: MANUAL
- Source: `specs/tests/18-board-star-follow.md`

#### Scenario BDD-MAN-0053 — Navigate to the home / workspace page (click the workspace name in the sidebar).
- Type: MANUAL
- Source: `specs/tests/18-board-star-follow.md`

#### Scenario BDD-MAN-0054 — Navigate back to `Test Board`.
- Type: MANUAL
- Source: `specs/tests/18-board-star-follow.md`


### Feature: 19. Invite Member to Board

#### Scenario BDD-MAN-0055 — Open the **Members** panel on the board (click the **Members** button or people icon in the board header).
- Type: MANUAL
- Source: `specs/tests/19-invite-member.md`

#### Scenario BDD-MAN-0056 — Click **Invite member** (or **+ Add member**).
- Type: MANUAL
- Source: `specs/tests/19-invite-member.md`

#### Scenario BDD-MAN-0057 — Fill in:
- Type: MANUAL
- Source: `specs/tests/19-invite-member.md`


### Feature: 20. Board Visibility

#### Scenario BDD-MAN-0058 — Open board settings (click **⋮** → **Settings** or the visibility badge in the board header, e.g. `Workspace`).
- Type: MANUAL
- Source: `specs/tests/20-board-visibility.md`

#### Scenario BDD-MAN-0059 — Change visibility to **Private**.
- Type: MANUAL
- Source: `specs/tests/20-board-visibility.md`

#### Scenario BDD-MAN-0060 — Confirm the change is saved (page reload or API):
- Type: MANUAL
- Source: `specs/tests/20-board-visibility.md`


### Feature: 21. Board Member Roles

#### Scenario BDD-MAN-0061 — Open the **Members** panel on the board.
- Type: MANUAL
- Source: `specs/tests/21-board-member-roles.md`

#### Scenario BDD-MAN-0062 — Click the role badge next to `TEST_CREDENTIALS.user.email`.
- Type: MANUAL
- Source: `specs/tests/21-board-member-roles.md`

#### Scenario BDD-MAN-0063 — Select **VIEWER**.
- Type: MANUAL
- Source: `specs/tests/21-board-member-roles.md`


### Feature: 22. Guest Access Control

#### Scenario BDD-MAN-0064 — Open the **Members** panel and click **Invite member**.
- Type: MANUAL
- Source: `specs/tests/22-guest-access.md`

#### Scenario BDD-MAN-0065 — Enter `TEST_CREDENTIALS.guest.email` with role **VIEWER** (guest) and send.
- Type: MANUAL
- Source: `specs/tests/22-guest-access.md`

#### Scenario BDD-MAN-0066 — Log out. Log in as `TEST_CREDENTIALS.guest.email` / `TEST_CREDENTIALS.guest.password`.
- Type: MANUAL
- Source: `specs/tests/22-guest-access.md`


### Feature: 23. Search

#### Scenario BDD-MAN-0067 — Press **Cmd+K** (macOS) / **Ctrl+K** (Windows/Linux) or click the Search icon in the sidebar.
- Type: MANUAL
- Source: `specs/tests/23-search.md`

#### Scenario BDD-MAN-0068 — Type `Test Card`.
- Type: MANUAL
- Source: `specs/tests/23-search.md`

#### Scenario BDD-MAN-0069 — Click on `Test Card 1` in the results.
- Type: MANUAL
- Source: `specs/tests/23-search.md`


### Feature: 24. Board Views — Table

#### Scenario BDD-MAN-0070 — Locate the view switcher in the board header (icons for Kanban, Table, Calendar, Timeline).
- Type: MANUAL
- Source: `specs/tests/24-board-views-table.md`

#### Scenario BDD-MAN-0071 — Click the **Table** view icon.
- Type: MANUAL
- Source: `specs/tests/24-board-views-table.md`

#### Scenario BDD-MAN-0072 — Verify `Test Card 1` and `Test Card 2` appear as rows.
- Type: MANUAL
- Source: `specs/tests/24-board-views-table.md`


### Feature: 25. Board Views — Calendar

#### Scenario BDD-MAN-0073 — Click the **Calendar** view icon in the board header view switcher.
- Type: MANUAL
- Source: `specs/tests/25-board-views-calendar.md`

#### Scenario BDD-MAN-0074 — Find the due date of `Test Card 1` on the calendar.
- Type: MANUAL
- Source: `specs/tests/25-board-views-calendar.md`

#### Scenario BDD-MAN-0075 — Click the card chip.
- Type: MANUAL
- Source: `specs/tests/25-board-views-calendar.md`


### Feature: 26. Board Views — Timeline

#### Scenario BDD-MAN-0076 — Click the **Timeline** view icon in the board header view switcher.
- Type: MANUAL
- Source: `specs/tests/26-board-views-timeline.md`

#### Scenario BDD-MAN-0077 — Verify `Test Card 1` appears as a bar between its start and due dates.
- Type: MANUAL
- Source: `specs/tests/26-board-views-timeline.md`

#### Scenario BDD-MAN-0078 — Verify `Test Card 2` (no dates) appears in an **Unscheduled** row at the bottom.
- Type: MANUAL
- Source: `specs/tests/26-board-views-timeline.md`


### Feature: 27. Custom Fields

#### Scenario BDD-MAN-0079 — Open the **Custom Fields** panel (board sidebar or **⋮** → **Custom Fields**).
- Type: MANUAL
- Source: `specs/tests/27-custom-fields.md`

#### Scenario BDD-MAN-0080 — Click **+ Add custom field**.
- Type: MANUAL
- Source: `specs/tests/27-custom-fields.md`

#### Scenario BDD-MAN-0081 — Select type **Text** and name it `Notes`, then save.
- Type: MANUAL
- Source: `specs/tests/27-custom-fields.md`


### Feature: 28. Notifications

#### Scenario BDD-MAN-0082 — Look at the notification bell icon in the top bar.
- Type: MANUAL
- Source: `specs/tests/28-notifications.md`

#### Scenario BDD-MAN-0083 — The bell aria-label should read something like `Notifications — 1 unread`.
- Type: MANUAL
- Source: `specs/tests/28-notifications.md`

#### Scenario BDD-MAN-0084 — Click the notification bell.
- Type: MANUAL
- Source: `specs/tests/28-notifications.md`


### Feature: 29. Notification Preferences

#### Scenario BDD-MAN-0085 — Navigate to profile settings or notification settings page (e.g. `{TEST_CREDENTIALS.baseUrl}/profile` or via avatar menu → **Notification Preferences**).
- Type: MANUAL
- Source: `specs/tests/29-notification-preferences.md`

#### Scenario BDD-MAN-0086 — Verify column headers: `Notification`, `In-App`, `Email`.
- Type: MANUAL
- Source: `specs/tests/29-notification-preferences.md`

#### Scenario BDD-MAN-0087 — Find the **Card assigned** row. Toggle the **Email** column off.
- Type: MANUAL
- Source: `specs/tests/29-notification-preferences.md`


### Feature: 30. Realtime Updates & Presence

#### Scenario BDD-MAN-0088 — Open `Test Board` in **Tab A** (`{TEST_CREDENTIALS.baseUrl}/boards/$boardId`).
- Type: MANUAL
- Source: `specs/tests/30-realtime-updates.md`

#### Scenario BDD-MAN-0089 — Open a new browser tab (**Tab B**) and navigate to the same board URL.
- Type: MANUAL
- Source: `specs/tests/30-realtime-updates.md`

#### Scenario BDD-MAN-0090 — In **Tab A**, look at the board header for presence avatars (active members list).
- Type: MANUAL
- Source: `specs/tests/30-realtime-updates.md`


### Feature: 31. Offline Draft Recovery

#### Scenario BDD-MAN-0091 — Click on `Test Card 1` to open the card detail modal.
- Type: MANUAL
- Source: `specs/tests/31-offline-drafts.md`

#### Scenario BDD-MAN-0092 — Click the description area to activate the editor.
- Type: MANUAL
- Source: `specs/tests/31-offline-drafts.md`

#### Scenario BDD-MAN-0093 — Select all existing text and replace it with:
- Type: MANUAL
- Source: `specs/tests/31-offline-drafts.md`


### Feature: 32. Plugin Discovery & Board Enable

#### Scenario BDD-MAN-0094 — Navigate to **Plugins** via the sidebar or `{TEST_CREDENTIALS.baseUrl}/plugins`.
- Type: MANUAL
- Source: `specs/tests/32-plugins.md`

#### Scenario BDD-MAN-0095 — Use the search input (placeholder `Search plugins…`) to type a partial name.
- Type: MANUAL
- Source: `specs/tests/32-plugins.md`

#### Scenario BDD-MAN-0096 — Clear the search. Verify the category dropdown is functional.
- Type: MANUAL
- Source: `specs/tests/32-plugins.md`


### Feature: 33. Admin Plugin Registry

#### Scenario BDD-MAN-0097 — On the Plugins page, click **Register Plugin** (admin-only button).
- Type: MANUAL
- Source: `specs/tests/33-admin-plugin-registry.md`

#### Scenario BDD-MAN-0098 — Fill in:
- Type: MANUAL
- Source: `specs/tests/33-admin-plugin-registry.md`

#### Scenario BDD-MAN-0099 — Click **Register Plugin** in the modal.
- Type: MANUAL
- Source: `specs/tests/33-admin-plugin-registry.md`


### Feature: 34. API Token Settings

#### Scenario BDD-MAN-0100 — Open profile/account settings and navigate to the **API Tokens** section (or `{TEST_CREDENTIALS.baseUrl}/settings/api-tokens`).
- Type: MANUAL
- Source: `specs/tests/34-api-tokens.md`

#### Scenario BDD-MAN-0101 — Click **Create token** (or **Generate new token**).
- Type: MANUAL
- Source: `specs/tests/34-api-tokens.md`

#### Scenario BDD-MAN-0102 — Enter the name `Test Token` and confirm.
- Type: MANUAL
- Source: `specs/tests/34-api-tokens.md`


### Feature: 35. Admin — Invite External User

#### Scenario BDD-MAN-0103 — Click **Invite External User** in the sidebar (or `{TEST_CREDENTIALS.baseUrl}/admin/invite`).
- Type: MANUAL
- Source: `specs/tests/35-admin-invite-user.md`

#### Scenario BDD-MAN-0104 — Verify the close button (✕) is present.
- Type: MANUAL
- Source: `specs/tests/35-admin-invite-user.md`

#### Scenario BDD-MAN-0105 — Fill in:
- Type: MANUAL
- Source: `specs/tests/35-admin-invite-user.md`


### Feature: 36. Admin — Manual Email Verification

#### Scenario BDD-MAN-0106 — Navigate to the admin users list (e.g. `{TEST_CREDENTIALS.baseUrl}/admin/users`).
- Type: MANUAL
- Source: `specs/tests/36-admin-email-verification.md`

#### Scenario BDD-MAN-0107 — Find the test user created in flow 01 (`$newUserEmail`) whose email is unverified.
- Type: MANUAL
- Source: `specs/tests/36-admin-email-verification.md`

#### Scenario BDD-MAN-0108 — Click **Verify email** (or the verify action) for that user.
- Type: MANUAL
- Source: `specs/tests/36-admin-email-verification.md`


### Feature: 37. Forgot Password

#### Scenario BDD-MAN-0109 — Log out if currently logged in.
- Type: MANUAL
- Source: `specs/tests/37-forgot-password.md`

#### Scenario BDD-MAN-0110 — Navigate to `{TEST_CREDENTIALS.baseUrl}` and click **Log in**.
- Type: MANUAL
- Source: `specs/tests/37-forgot-password.md`

#### Scenario BDD-MAN-0111 — Click **Forgot password?** (below the login form).
- Type: MANUAL
- Source: `specs/tests/37-forgot-password.md`


### Feature: 38. Change Email

#### Scenario BDD-MAN-0112 — Navigate to profile settings (`{TEST_CREDENTIALS.baseUrl}/profile` or avatar → **Settings**).
- Type: MANUAL
- Source: `specs/tests/38-change-email.md`

#### Scenario BDD-MAN-0113 — Find the **Change Email** section.
- Type: MANUAL
- Source: `specs/tests/38-change-email.md`

#### Scenario BDD-MAN-0114 — Enter a new email: `admin-newemail+{timestamp}@example.com` and submit.
- Type: MANUAL
- Source: `specs/tests/38-change-email.md`


### Feature: MCP 01. get_boards

#### Scenario BDD-MAN-0116 — Call `get_boards` with the workspace ID:
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-01-get-boards.md`

#### Scenario BDD-MAN-0117 — Verify `Test Board` is present in the array (from flow 06).
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-01-get-boards.md`

#### Scenario BDD-MAN-0118 — Call with a non-member token (log in as a user not in the workspace):
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-01-get-boards.md`


### Feature: MCP 02. get_board

#### Scenario BDD-MAN-0119 — Call `get_board` with the board ID:
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-02-get-board.md`

#### Scenario BDD-MAN-0120 — Verify lists `To Do`, `In Progress`, `Done` are present (from flow 07).
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-02-get-board.md`

#### Scenario BDD-MAN-0121 — Call with an invalid `boardId`:
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-02-get-board.md`


### Feature: MCP 03. get_members

#### Scenario BDD-MAN-0122 — Call `get_members` for the board:
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-03-get-members.md`

#### Scenario BDD-MAN-0123 — Verify roles are valid values: `ADMIN`, `MEMBER`, or `VIEWER`.
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-03-get-members.md`

#### Scenario BDD-MAN-0124 — Verify profile fields `username` and `email` are present. Confirm `password` and `passwordHash` are **not** returned.
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-03-get-members.md`


### Feature: MCP 04. get_cards

#### Scenario BDD-MAN-0125 — Call `get_cards` with the list ID:
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-04-get-cards.md`

#### Scenario BDD-MAN-0126 — Archive `Test Card 2` via the UI (or card menu → Archive). Call `get_cards` again.
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-04-get-cards.md`

#### Scenario BDD-MAN-0127 — Create an empty list. Call `get_cards` on it.
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-04-get-cards.md`


### Feature: MCP 05. get_card

#### Scenario BDD-MAN-0128 — Call `get_card`:
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-05-get-card.md`

#### Scenario BDD-MAN-0129 — Verify optional fields are present if set (from flow 11):
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-05-get-card.md`

#### Scenario BDD-MAN-0130 — Call with an invalid `cardId`:
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-05-get-card.md`


### Feature: MCP 06. create_card

#### Scenario BDD-MAN-0131 — Create a card with title only:
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-06-create-card.md`

#### Scenario BDD-MAN-0132 — Create a card with a description:
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-06-create-card.md`

#### Scenario BDD-MAN-0133 — Verify the card appears in the list via `get_cards $listId`.
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-06-create-card.md`


### Feature: MCP 07. move_card

#### Scenario BDD-MAN-0134 — Move `$cardId` to the `Done` list (`$doneListId`):
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-07-move-card.md`

#### Scenario BDD-MAN-0135 — Verify via `get_cards $doneListId` — card appears in destination.
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-07-move-card.md`

#### Scenario BDD-MAN-0136 — Verify via `get_cards $originalListId` — card is absent from source.
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-07-move-card.md`


### Feature: MCP 08. search_cards

#### Scenario BDD-MAN-0137 — Search by title keyword:
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-08-search-cards.md`

#### Scenario BDD-MAN-0138 — Search by description keyword (from flow 10 — description contains "description"):
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-08-search-cards.md`

#### Scenario BDD-MAN-0139 — Verify access control — PRIVATE board cards are not returned when searching as a non-member.
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-08-search-cards.md`


### Feature: MCP 09. add_comment

#### Scenario BDD-MAN-0140 — Add a comment to `$cardId`:
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-09-add-comment.md`

#### Scenario BDD-MAN-0141 — Verify comment appears in the card's activity feed via the UI or:
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-09-add-comment.md`

#### Scenario BDD-MAN-0142 — Submit with empty content `""`:
- Type: MANUAL
- Source: `specs/tests/mcp/mcp-09-add-comment.md`


### Feature: TEST_CREDENTIALS

#### Scenario BDD-MAN-0115 — Manual scenario documented in referenced test spec
- Type: MANUAL
- Source: `specs/tests/TEST_CREDENTIALS.md`


## Pipeline Rules

1. Every AUTO scenario ID must exist in `bdd-playwright-map.json`.
2. Every mapped AUTO ID must exist in this BDD spec.
3. Mapped test file must exist and contain the mapped test title string.
4. `test:bdd-daily` runs only scenarios flagged `daily=true` in the mapping.
