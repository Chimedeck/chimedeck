# 29. Notification Preferences

**Prerequisites:** Flow 03 (Login) completed. Logged in as admin.  
**Continues from:** Any page.  
**Ends with:** Notification preferences verified and set back to defaults.

---

## Steps

### Global Preferences

1. Navigate to profile settings or notification settings page (e.g. `{TEST_CREDENTIALS.baseUrl}/profile` or via avatar menu → **Notification Preferences**).
   - **Expected:** A table of notification types with toggles for **In-App** and **Email** columns.

2. Verify column headers: `Notification`, `In-App`, `Email`.

3. Find the **Card assigned** row. Toggle the **Email** column off.
   - **Expected:** Toggle switches to off. Change is saved (no page reload required).

4. Toggle **Email** for **Card assigned** back on.
   - **Expected:** Toggle is on again.

### Board-Level Preferences

5. Navigate to `Test Board`.

6. Open board notification settings (bell icon or **⋮** → **Notification preference**).
   - **Expected:** Options appear: `All activity`, `Only mentions`, `Nothing` (or similar).

7. Select **Only mentions**.
   - **Expected:** Preference is saved. Confirmation or visual update shown.

8. Select **All activity** to restore default.

---

## Notes

- Continue to flow **30-realtime-updates**.
