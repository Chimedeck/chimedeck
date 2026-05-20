# State Transitions — Transitions Active Banner

**Prerequisites:** State transitions feature flag is enabled; board has lists and saved transitions.  
**Continues from:** Board page in Kanban view.  
**Ends with:** Banner visibility and dismissal behavior verified per board/session.

---

## Steps

1. Ensure board state transitions enforcement is enabled in graph editor.
   - **Expected:** Returning to Kanban view shows banner: `State transitions are enforced on this board...`.

2. Click **View rules** on the banner.
   - **Expected:** State transitions graph editor overlay opens for the same board.

3. Close graph editor and click **Dismiss** on the banner.
   - **Expected:** Banner hides immediately.
   - **Expected:** `sessionStorage` contains key `state-transitions-banner-dismissed-{boardId}` with value `1`.

4. Refresh the page in the same tab/session.
   - **Expected:** Banner remains hidden for the dismissed board.

5. Open a different board with enforcement enabled.
   - **Expected:** Banner appears (dismissal is scoped per board key).

6. Disable enforcement on current board.
   - **Expected:** Banner is not shown.

7. Re-enable enforcement and clear session storage key for board.
   - **Expected:** Banner reappears.
