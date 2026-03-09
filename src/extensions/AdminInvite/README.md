# AdminInvite Feature

Allows admin-domain users to provision external user accounts directly from the sidebar.

## Visibility

The "Invite External User" sidebar item is rendered **only** when the current user's email domain matches at least one entry in `ADMIN_EMAIL_DOMAINS` (fetched from `/api/v1/flags` on app boot). This is evaluated entirely on the client using Redux state — no extra API call on each render.

## Files

| File | Purpose |
|---|---|
| `api.ts` | Wraps `POST /api/v1/admin/users` using the shared `apiClient` |
| `adminInvite.slice.ts` | Redux slice — modal open/close state and credential store |
| `InviteExternalUserModal.tsx` | Form modal: email, display name, password mode, send-email toggle |
| `CredentialSheet.tsx` | Displays generated credentials after successful account creation |
| `types.ts` | Shared TypeScript types for API request/response and slice state |

## Feature Flags

Two server-side flags control invite email behaviour — both must be `true`:

- `SES_ENABLED` — global SES flag (managed via the feature-flag system)
- `ADMIN_INVITE_EMAIL_ENABLED` — opt-in flag specific to admin invite emails

When either flag is `false` the "Send login credentials by email" toggle is hidden and the credential sheet is always shown so the admin can share credentials manually.

## Usage

1. User with an `ADMIN_EMAIL_DOMAINS` email logs in.
2. "Invite External User" appears in the left sidebar.
3. Click to open the modal; fill in email, display name, and choose password mode.
4. Optionally enable the send-email toggle (only shown when both flags are `true`).
5. Submit — on success the modal switches to the credential sheet view.
6. Copy credentials to clipboard or note them down, then click "Done".

## Architecture

- State: `src/store/index.ts` → `adminInvite` key managed by `adminInvite.slice.ts`
- Global flags: `src/slices/featureFlagsSlice.ts` → `featureFlags` key, fetched in `AppShell`
- Modal is mounted globally in `AppShell` so it renders on top of all pages
