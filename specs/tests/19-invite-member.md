# 19. Invite Member to Board

**Prerequisites:** Flow 06 (Create Board) completed. On `Test Board`. A second account `TEST_CREDENTIALS.user.email` exists.  
**Continues from:** Board view.  
**Ends with:** `TEST_CREDENTIALS.user.email` is a member of `Test Board` with role `MEMBER`.

---

## Steps

1. Open the **Members** panel on the board (click the **Members** button or people icon in the board header).
   - **Expected:** Members panel slides open listing the current admin as the only member.

2. Click **Invite member** (or **+ Add member**).
   - **Expected:** An invite form appears with an email field and a role selector.

3. Fill in:
   - **Email:** `TEST_CREDENTIALS.user.email`
   - **Role:** `MEMBER`

4. Click **Send invite** (or **Add**).
   - **Expected:** The member appears in the list with role `MEMBER`.

5. Verify the member count in the board header updates.

---

## Notes

- Continue to flow **20-board-visibility** — still on `Test Board`.
