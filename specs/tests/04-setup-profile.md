# 04. Profile Setup

**Prerequisites:** Flow 03 (Login) completed. Logged in as admin.  
**Continues from:** Dashboard.  
**Ends with:** Profile nickname and avatar updated; browser on profile settings page.

---

## Steps

1. Open the user profile menu (click the avatar / username in the top bar or sidebar).

2. Click **Profile Settings** (or navigate to `{TEST_CREDENTIALS.baseUrl}/profile`).
   - **Expected:** Profile settings page loads showing current display name and avatar.

3. Click the **Edit** control next to the display name (or the nickname field).

4. Clear the current name and type `Admin User`.
   - **Expected:** Field is updated.

5. Click **Save** (or equivalent).
   - **Expected:** Success confirmation. Display name updates in the header.

6. Click the avatar upload area / **Change avatar** button.

7. Upload any valid image file (PNG or JPEG, < 5 MB).
   - **Expected:** Avatar preview updates.

8. Save the avatar change.
   - **Expected:** New avatar is visible in the top bar.

---

## Notes

- If a profile picture upload dialog appears, select the file and confirm.
- Continue to flow **05-create-workspace** without logging out.
