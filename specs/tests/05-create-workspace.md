# 05. Create Workspace

**Prerequisites:** Flow 03 (Login) completed. Logged in as admin.  
**Continues from:** Dashboard.  
**Ends with:** A new workspace `Test Workspace` exists and is selected in the sidebar. `$workspaceId` is stored.

---

## Steps

1. In the sidebar, click **+ Create workspace** (or the workspace switcher button).
   - **Expected:** A "Create workspace" dialog or page appears.

2. Fill in:
   - **Name:** `Test Workspace`

3. Submit / click **Create**.
   - **Expected:** Workspace is created. The app shows the workspace view (empty boards list). The sidebar shows `Test Workspace`.

4. Store the workspace ID as `$workspaceId` (visible in the URL or via `GET {TEST_CREDENTIALS.baseUrl}/api/v1/workspaces`).

---

## Notes

- If a workspace already exists from a previous run, reuse it by selecting it in the sidebar; skip creation.
- Continue to flow **06-create-board** — still inside the new workspace.
