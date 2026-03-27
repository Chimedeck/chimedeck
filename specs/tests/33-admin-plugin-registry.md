# 33. Admin Plugin Registry

**Prerequisites:** Flow 03 (Login) completed. Logged in as admin.  
**Continues from:** Plugins page (`{TEST_CREDENTIALS.baseUrl}/plugins`).  
**Ends with:** A plugin is registered, its API key revealed, edited, and deleted.

---

## Steps

### Register a Plugin

1. On the Plugins page, click **Register Plugin** (admin-only button).
   - **Expected:** A modal dialog opens with fields: Name, Slug, Description, Connector URL, Allowed Domains.

2. Fill in:
   - **Name:** `Test Plugin`
   - **Slug:** `test-plugin`
   - **Description:** `A plugin for testing.`
   - **Connector URL:** `https://example.com/plugin`

3. Click **Register Plugin** in the modal.
   - **Expected:** Plugin is registered and appears in the plugin list. Button briefly shows `Registering…`.

### Reveal API Key

4. Find `Test Plugin` in the list. Click the settings/edit icon.
   - **Expected:** An **Edit Plugin** modal opens.

5. Click the **API Key** or **Reveal API Key** option.
   - **Expected:** A modal shows `Plugin API Key` with the key value.

6. Click **Copy**.
   - **Expected:** `✓ Copied` feedback appears.

7. Click **I've saved the key — Done** to close.

### Edit Plugin

8. Open the edit modal for `Test Plugin` again.

9. Change the Description to `Updated description.` and click **Save Changes**.
   - **Expected:** Modal closes; plugin shows updated description.

### Delete Plugin

10. Open the edit modal and click **Delete Plugin**.
    - **Expected:** A confirmation dialog appears.

11. Confirm deletion.
    - **Expected:** Plugin is removed from the list.

---

## Notes

- Continue to flow **34-api-tokens**.
