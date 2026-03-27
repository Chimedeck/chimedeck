# 18. Star & Follow Board

**Prerequisites:** Flow 06 (Create Board) completed. On `Test Board`.  
**Continues from:** Board view.  
**Ends with:** `Test Board` is starred and visible in the starred section of the sidebar.

---

## Steps

### Star

1. Click the **☆ Star** icon in the board header (next to the board title).
   - **Expected:** Icon becomes filled (★). A "Starred" confirmation may briefly appear.

2. Navigate to the home / workspace page (click the workspace name in the sidebar).
   - **Expected:** `Test Board` appears under a **Starred Boards** section in the sidebar.

3. Navigate back to `Test Board`.

4. Click the ★ icon again to unstar.
   - **Expected:** Icon returns to ☆. Board is no longer in the Starred section.

5. Re-star the board (click ☆ again) so it remains starred for future flows.

### Follow

6. If a **Follow** button is present (separate from star):
   a. Click **Follow**.
   - **Expected:** Button changes to **Following** or **Unfollow**.
   b. Click again to unfollow.
   - **Expected:** Returns to **Follow** state.

---

## Notes

- Continue to flow **19-invite-member** — still on `Test Board`.
