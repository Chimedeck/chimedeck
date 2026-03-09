# Sprint 40 — Change Email (with Re-verification)

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 03 (Authentication), Sprint 23 (Email module / SES), Sprint 24 (Profile settings page)  
> **References:** [requirements §3 — Auth](../architecture/requirements.md)

---

## Goal

Allow authenticated users to change their email address from the profile settings page. Because the new address is unverified, the system sends a confirmation link to the **new** email before committing the change. If `EMAIL_VERIFICATION_ENABLED` is `false` the email change is applied immediately without a confirmation step.

---

## Feature Flags

| Flag | Default | Effect when `true` |
|---|---|---|
| `EMAIL_VERIFICATION_ENABLED` | `false` | Requires confirmation link to be clicked before new email is committed |
| `SES_ENABLED` | `false` | Routes confirmation email through AWS SES; falls back to console log when `false` |

Both flags are already defined in Sprint 23. No new flags required.

---

## Scope

### 1. Database Migration

```
db/migrations/0025_email_change.ts
```

New columns on `users`:

```sql
ALTER TABLE users
  ADD COLUMN pending_email                    TEXT,
  ADD COLUMN email_change_token               TEXT,
  ADD COLUMN email_change_token_expires_at    TIMESTAMPTZ;
```

`pending_email` stores the requested-but-unconfirmed new address until the token is verified.

---

### 2. Server — Auth Routes

```
server/extensions/auth/api/
  changeEmail.ts             # POST /api/v1/auth/change-email
  confirmEmailChange.ts      # GET  /api/v1/auth/confirm-email-change
```

#### `POST /api/v1/auth/change-email` (new, authenticated)

Request body:
```json
{ "email": "new@example.com", "currentPassword": "secret" }
```

- Requires valid JWT + `requireVerified` middleware
- Re-validates `currentPassword` against stored hash before proceeding
- Rejects if `email` is already taken by another account → `{ name: 'email-already-in-use' }` 409
- Rejects if `email` is the same as the current email → `{ name: 'email-unchanged' }` 422
- When `EMAIL_VERIFICATION_ENABLED` is `true`:
  - Store `pending_email`, generate cryptographically random 32-byte hex token → store as `email_change_token` + `email_change_token_expires_at = now + 24h`
  - Send confirmation email to the **new** address with link: `<APP_URL>/confirm-email-change?token=<token>`
  - Return `{ data: { requiresConfirmation: true, pendingEmail: "new@example.com" } }` 200
- When `EMAIL_VERIFICATION_ENABLED` is `false`:
  - Update `email` directly, clear pending fields
  - Return `{ data: { email: "new@example.com" } }` 200

Rate-limited to 3 requests per hour per user.

#### `GET /api/v1/auth/confirm-email-change?token=<token>` (new, public)

- Look up user by `email_change_token`
- Reject if expired or not found → `{ name: 'invalid-or-expired-token' }` 400
- Check `pending_email` is still not taken (re-check for race conditions) → `{ name: 'email-already-in-use' }` 409
- Swap `email` ← `pending_email`, clear `pending_email` + token fields
- Invalidate **all** existing refresh tokens for the user (email changed = re-login required)
- Return `{ data: { confirmed: true } }` 200 — client redirects to `/login` with toast

---

### 3. Server — Email Template

```
server/extensions/email/templates/
  emailChangeConfirmation.ts    # Subject + HTML + text body
```

Template variables: `{ newEmail, confirmUrl, expiresIn: '24 hours' }`.

---

### 4. Client — Change Email UI

```
src/extensions/Auth/
  containers/
    ConfirmEmailChangePage/
      ConfirmEmailChangePage.tsx      # calls GET /auth/confirm-email-change?token=... on mount
      ConfirmEmailChangePage.duck.ts
  components/
    ChangeEmailForm.tsx               # form section inside /settings/profile
    EmailChangePending.tsx            # banner shown after request submitted
```

#### `ChangeEmailForm` (embedded in `/settings/profile`)

- Fields: "New email address", "Current password"
- On submit: `POST /api/v1/auth/change-email`
- When `requiresConfirmation: true` response → show `EmailChangePending` banner and hide form
- When immediate (flag off) → show success toast, update displayed email

#### `EmailChangePending` banner

- "We sent a confirmation link to `<pendingEmail>`. Click the link to complete the change."
- Dismissible
- Shows until user re-logs in (after confirmation the old session is invalidated)

#### `ConfirmEmailChangePage`

- Route: `/confirm-email-change` (public, no auth)
- On mount: extract `token` from URL query, call `GET /api/v1/auth/confirm-email-change?token=<token>`
- Success → redirect to `/login` with toast "Email updated! Please log in with your new address."
- Failure → show inline error + link back to settings

---

### 5. Translations

```
src/extensions/Auth/translations/en.json  (additions)
```

```json
{
  "ChangeEmail.title": "Change email address",
  "ChangeEmail.newEmail": "New email address",
  "ChangeEmail.currentPassword": "Current password",
  "ChangeEmail.submit": "Request email change",
  "ChangeEmail.pending": "Confirmation email sent to {email}",
  "ChangeEmail.pendingDetail": "Click the link in the email to complete the change.",
  "ChangeEmail.confirmed": "Email updated! Please log in with your new address.",
  "ChangeEmail.invalidToken": "This confirmation link is invalid or has expired.",
  "ChangeEmail.emailInUse": "That email address is already in use.",
  "ChangeEmail.unchanged": "New email must be different from current email."
}
```

---

## Data Model

```
users (updated)
├── pending_email                    TEXT (nullable)
├── email_change_token               TEXT (nullable)
└── email_change_token_expires_at    TIMESTAMPTZ (nullable)
```

---

## API Routes Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/auth/change-email` | JWT (verified) | Request email change; sends confirmation to new address |
| `GET` | `/api/v1/auth/confirm-email-change` | ✗ | Verify token, commit new email, invalidate tokens |

---

## Acceptance Criteria

- [ ] `EMAIL_VERIFICATION_ENABLED=false`: email is changed immediately after password re-validation; no confirmation email sent
- [ ] `EMAIL_VERIFICATION_ENABLED=true`, `SES_ENABLED=false`: confirmation email logged to console; flow still works
- [ ] `EMAIL_VERIFICATION_ENABLED=true`, `SES_ENABLED=true`: confirmation email delivered via AWS SES
- [ ] Attempting to change to an already-taken email returns `email-already-in-use` 409
- [ ] Wrong current password is rejected before any token is generated
- [ ] Visiting `/confirm-email-change?token=<valid>` commits the email change and redirects to login
- [ ] Visiting `/confirm-email-change?token=<expired>` shows an error page
- [ ] All existing refresh tokens are invalidated after a successful email change
- [ ] Rate limit: max 3 change-email requests per hour per user
- [ ] Success toast "Email updated! Please log in with your new address." after confirmation

---

## Tests

```
specs/tests/
  change-email.md          # E2E: settings → change email form → console token → confirm link → re-login
  change-email-taken.md    # Unit: duplicate email rejected
  change-email-no-flag.md  # Unit: flag=false applies change immediately
```

---

## Files

```
db/migrations/0025_email_change.ts
server/extensions/auth/api/changeEmail.ts                   (new)
server/extensions/auth/api/confirmEmailChange.ts            (new)
server/extensions/email/templates/emailChangeConfirmation.ts (new)
server/extensions/auth/index.ts                             (updated — register new routes)
src/extensions/Auth/containers/ConfirmEmailChangePage/ConfirmEmailChangePage.tsx  (new)
src/extensions/Auth/containers/ConfirmEmailChangePage/ConfirmEmailChangePage.duck.ts (new)
src/extensions/Auth/components/ChangeEmailForm.tsx           (new)
src/extensions/Auth/components/EmailChangePending.tsx        (new)
src/extensions/Auth/translations/en.json                    (updated)
src/routing/index.tsx                                       (updated — add /confirm-email-change route)
```
