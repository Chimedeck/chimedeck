# 32. Plugin Discovery & Board Enable

**Prerequisites:** Flow 06 (Create Board) completed. Logged in as admin.  
**Continues from:** Any page.  
**Ends with:** A plugin is enabled on `Test Board`. Plugin panel visible in board sidebar.

---

## Steps

### Browse Plugins

1. Navigate to **Plugins** via the sidebar or `{TEST_CREDENTIALS.baseUrl}/plugins`.
   - **Expected:** Plugin marketplace / registry page loads with heading `Plugins` and a `Browse Plugins` section.

2. Use the search input (placeholder `Search plugins…`) to type a partial name.
   - **Expected:** Plugin list filters in real time.

3. Clear the search. Verify the category dropdown is functional.

4. Confirm an empty search match shows the message `No plugins match your search.` with a **Clear search** option.

### Enable a Plugin on the Board

5. Navigate to `Test Board`.

6. Open the **Plugins** panel from the board sidebar (or **⋮** → **Plugins** / **Power-Ups**).
   - **Expected:** A list of available plugins is shown with **Enable** buttons.

7. Click **Enable** on any available plugin.
   - **Expected:** Button changes to `Enabling…` briefly, then `Disable`. Plugin appears in the board sidebar or toolbar.

8. Click **Disable** on the same plugin.
   - **Expected:** Button changes back to `Enable`. Plugin is removed from the board.

---

## Notes

- Admin plugin registration is covered in flow **33-admin-plugin-registry**.
- Continue to flow **33-admin-plugin-registry**.
