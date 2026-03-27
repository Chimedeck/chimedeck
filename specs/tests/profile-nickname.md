> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: Profile — Nickname

**Type:** Playwright end-to-end  
**Sprint:** 24 — Profile Settings: Avatar & Nickname

## Setup

- Log in as an existing user
- Navigate to `/settings/profile`

## Happy path — set nickname

1. Assert the heading "Profile Settings" is visible
2. Locate the Nickname field (shows `@` prefix)
3. Clear any existing value and type `testuser42`
4. Click "Save Changes"
5. Assert the success message "Profile updated." appears
6. Assert the sidebar user menu displays `@testuser42`

## Happy path — update display name

1. Navigate to `/settings/profile`
2. Clear the "Display Name" field and type `Jane Kim`
3. Click "Save Changes"
4. Assert the success message "Profile updated." appears
5. Assert the sidebar shows `@testuser42` (or `Jane Kim` if no nickname)

## Error path — duplicate nickname

1. Log in as a second user in a separate browser context
2. Navigate to `/settings/profile`
3. Set the nickname to `testuser42` (already taken by the first user)
4. Click "Save Changes"
5. Assert the inline error "This nickname is already taken." appears below the nickname field
6. Assert the input still contains `testuser42` (not cleared)

## Error path — invalid nickname characters

1. Navigate to `/settings/profile`
2. Type `invalid nickname!` in the nickname field (spaces/special chars)
3. Assert the field does not accept spaces or `!` (input is filtered client-side)

## Persistence

1. Set a unique nickname and save
2. Reload the page
3. Assert the saved nickname is pre-populated in the nickname field
4. Assert the sidebar still shows the nickname