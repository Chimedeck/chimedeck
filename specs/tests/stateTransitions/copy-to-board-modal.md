# State Transitions — Copy to Board Modal

**Prerequisites:** State transitions feature flag is enabled; at least two boards exist with partially matching list names; user is ADMIN/OWNER on at least one target board.  
**Continues from:** Board Settings → Enforceable State Transitions graph editor open.  
**Ends with:** Transitions copied to target board, including partial-copy toast behavior and `copyEnabled` handling.

---

## Steps

1. In graph editor header, click **Copy to Board**.
   - **Expected:** Copy modal opens with workspace and board selectors.

2. Verify workspace selector lists all workspaces where current user is a member.
   - **Expected:** Current board workspace is selected by default.

3. Switch workspace and inspect board selector options.
   - **Expected:** Only boards where current user is `ADMIN` or `OWNER` are listed; source board is excluded.

4. If no eligible board exists in selected workspace:
   - **Expected:** Board selector shows empty-state option (`No eligible boards available`) and confirm button is disabled.

5. Leave **Also copy "Enforce" setting** checked and copy to a fully matching board.
   - **Expected:** Success toast appears with link to open target board graph editor.
   - **Expected:** Target board graph has all matched nodes/edges.

6. Copy to a board where one or more list names do not match.
   - **Expected:** Info toast appears with excluded count (`Copied with X column(s) excluded...`).
   - **Expected:** Unmatched nodes and related edges are excluded in target graph.

7. Uncheck **Also copy "Enforce" setting** and copy to a target board with known enabled value.
   - **Expected:** Target board enabled flag stays unchanged after copy.
   - **Expected:** Graph data still updates from source mapping.
