# Test: Profile — Avatar Upload

**Type:** Playwright end-to-end  
**Sprint:** 24 — Profile Settings: Avatar & Nickname

## Setup

- Log in as an existing user
- Navigate to `/settings/profile`

## Happy path — upload avatar

1. Assert the heading "Profile Settings" is visible
2. Assert the avatar placeholder shows the user's initials
3. Click "Change photo"
4. Select a valid JPEG file under 5 MB
5. Assert "Uploading…" overlay appears briefly on the avatar area
6. Assert the avatar image is updated (no longer shows initials)
7. Assert the new avatar appears in the sidebar user menu

## Remove avatar

1. (Continuing from above) Click "Remove photo"
2. Assert the avatar reverts to the initials placeholder
3. Assert the initials placeholder is shown in the sidebar user menu

## Error path — invalid file type

1. Navigate to `/settings/profile`
2. Trigger the file picker and select a non-image file (e.g. `.txt`)
3. Assert error message "Please upload a JPEG, PNG, WebP or GIF under 5 MB." is visible
4. Assert the avatar is unchanged

## Error path — file too large

1. Navigate to `/settings/profile`
2. Trigger the file picker and select an image file larger than 5 MB
3. Assert error message "Please upload a JPEG, PNG, WebP or GIF under 5 MB." is visible
4. Assert the avatar is unchanged

## Persistence

1. Upload a valid avatar
2. Reload the page
3. Assert the uploaded avatar is still shown (not initials)
