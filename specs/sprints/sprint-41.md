# Sprint 41 — Forgot Password / Password Reset

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 03 (Authentication), Sprint 23 (Email module / SES), Sprint 16 (Auth UI)  
> **References:** [requirements §3 — Auth](../architecture/requirements.md)

---

## Goal

Give unauthenticated users a self-service way to recover their account when they have forgotten their password. A time-limited reset link is emailed to the registered address; clicking it opens a page where the user sets a new password. The email is delivered via AWS SES when `SES_ENABLED` is `true`, otherwise logged to the console (dev mode).

---

## Feature Flags

| Flag | Default | Effect when `true` |
|---|---|---|
| `SES_ENABLED` | `false` | Routes reset email through AWS SES; falls back to console log when `false` |

Flag already defined in Sprint 23. No new flags required.

---

## Scope

### 1. Database Migration

```
db/migrations/0026_password_reset.ts
```

New columns on `users`:

```sql
ALTER TABLE users
  ADD COLUMN password_reset_token               TEXT,
  ADD COLUMN password_reset_token_expires_at    TIMESTAMPTZ;
```

---

### 2. Server — Auth Routes

```
server/extensions/auth/api/
  forgotPassword.ts       # POST /api/v1/auth/forgot-password
  resetPassword.ts        # POST /api/v1/auth/reset-password
```

#### `POST /api/v1/auth/forgot-password` (new, public)

Request body:
```json
{ "email": "user@example.com" }
```

- Always returns `{ data: { sent: true } }` 200 — even if no account exists for that email (prevents user enumeration)
- If an account **does** exist:
  - Generate cryptographically random 32-byte hex token → store as `password_reset_token` + `password_reset_token_expires_at = now + 1h`
  - Send reset email to the registered address with link: `<APP_URL>/reset-password?token=<token>`
  - `SES_ENABLED=false` → log email to console instead of sending
- Rate-limited to 5 requests per hour per IP address

#### `POST /api/v1/auth/reset-password` (new, public)

Request body:
```json
{ "token": "<reset-token>", "password": "newSecurePassword123" }
```

- Look up user by `password_reset_token`
- Reject if expired or not found → `{ name: 'invalid-or-expired-token' }` 400
- Validate new password: min 8 chars, at least one letter and one number → `{ name: 'password-too-weak' }` 422
- Hash and store new password
- Clear `password_reset_token` + `password_reset_token_expires_at`
- Invalidate **all** existing refresh tokens for the user (password changed = re-login required)
- Return `{ data: { reset: true } }` 200 — client redirects to `/login` with toast

---

### 3. Server — Email Template

```
server/extensions/email/templates/
  passwordResetEmail.ts    # Subject + HTML + text body
```

Template variables: `{ resetUrl, expiresIn: '1 hour' }`.

---

### 4. Client — Forgot / Reset Password UI

```
src/extensions/Auth/
  containers/
    ForgotPasswordPage/
      ForgotPasswordPage.tsx        # email input form
      ForgotPasswordPage.duck.ts
    ResetPasswordPage/
      ResetPasswordPage.tsx         # new password form (reads ?token= from URL)
      ResetPasswordPage.duck.ts
```

#### `ForgotPasswordPage` — Route `/forgot-password` (public)

- Single field: "Email address"
- On submit: `POST /api/v1/auth/forgot-password`
- After successful response (regardless of whether the account exists): show success state
  - "If an account exists for `<email>`, we've sent a password reset link. Check your inbox."
- Link back to `/login`

#### Login page update

- Add "Forgot password?" link below the password field → navigates to `/forgot-password`

#### `ResetPasswordPage` — Route `/reset-password` (public)

- On mount: extract `token` from URL query param
- Fields: "New password", "Confirm new password"
- Validates `password === confirmPassword` client-side before submitting
- On submit: `POST /api/v1/auth/reset-password` with `{ token, password }`
- Success → redirect to `/login` with toast "Password reset! Please log in."
- Failure (invalid/expired token) → show inline error with link to `/forgot-password` to request a new link

---

### 5. Translations

```
src/extensions/Auth/translations/en.json  (additions)
```

```json
{
  "ForgotPassword.title": "Forgot your password?",
  "ForgotPassword.description": "Enter your email address and we'll send you a reset link.",
  "ForgotPassword.email": "Email address",
  "ForgotPassword.submit": "Send reset link",
  "ForgotPassword.sent": "If an account exists for {email}, we've sent a reset link.",
  "ForgotPassword.backToLogin": "Back to log in",
  "ResetPassword.title": "Reset your password",
  "ResetPassword.newPassword": "New password",
  "ResetPassword.confirmPassword": "Confirm new password",
  "ResetPassword.submit": "Reset password",
  "ResetPassword.mismatch": "Passwords do not match.",
  "ResetPassword.tooWeak": "Password must be at least 8 characters and contain a letter and a number.",
  "ResetPassword.success": "Password reset! Please log in.",
  "ResetPassword.invalidToken": "This reset link is invalid or has expired.",
  "ResetPassword.requestNew": "Request a new reset link",
  "LoginPage.forgotPassword": "Forgot password?"
}
```

---

## Data Model

```
users (updated)
├── password_reset_token               TEXT (nullable)
└── password_reset_token_expires_at    TIMESTAMPTZ (nullable)
```

---

## API Routes Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/auth/forgot-password` | ✗ | Request password reset email (always 200) |
| `POST` | `/api/v1/auth/reset-password` | ✗ | Verify token, set new password, invalidate sessions |

---

## Security Notes

- `POST /api/v1/auth/forgot-password` **always** returns the same response to prevent user enumeration attacks — never reveal whether an email is registered.
- Reset tokens expire in **1 hour** (shorter than email verification's 24 h, since password resets are higher-risk).
- After a successful password reset all existing refresh tokens are invalidated, forcing other sessions to log in again.
- Rate limiting on `/forgot-password` (5 req/hr per IP) prevents token-spam abuse.

---

## Acceptance Criteria

- [ ] `POST /api/v1/auth/forgot-password` returns 200 for both existing and non-existing emails
- [ ] A registered email receives a reset link (console log when `SES_ENABLED=false`, real email when `true`)
- [ ] Reset link token expires after 1 hour; visiting after expiry shows error page
- [ ] Visiting `/reset-password?token=<valid>` allows setting a new password
- [ ] Password strength validation enforced: min 8 chars, one letter, one number
- [ ] Mismatched confirm-password is caught client-side before submission
- [ ] All existing refresh tokens are invalidated after a successful password reset
- [ ] User can immediately log in with the new password after reset
- [ ] "Forgot password?" link visible on the login page
- [ ] Rate limit: max 5 forgot-password requests per hour per IP
- [ ] `<title>` on forgot-password page: "Forgot Password — Kanban"
- [ ] `<title>` on reset-password page: "Reset Password — Kanban"

---

## Tests

```
specs/tests/
  forgot-password.md           # E2E: login page → forgot → console log token → reset → login succeeds
  forgot-password-expired.md   # Unit: expired token rejected with correct error name
  forgot-password-unknown.md   # Unit: unknown email still returns sent:true (no enumeration)
  forgot-password-weak.md      # Unit: weak password rejected with password-too-weak
```

---

## Files

```
db/migrations/0026_password_reset.ts
server/extensions/auth/api/forgotPassword.ts                 (new)
server/extensions/auth/api/resetPassword.ts                  (new)
server/extensions/email/templates/passwordResetEmail.ts      (new)
server/extensions/auth/index.ts                              (updated — register new routes)
src/extensions/Auth/containers/ForgotPasswordPage/ForgotPasswordPage.tsx   (new)
src/extensions/Auth/containers/ForgotPasswordPage/ForgotPasswordPage.duck.ts (new)
src/extensions/Auth/containers/ResetPasswordPage/ResetPasswordPage.tsx     (new)
src/extensions/Auth/containers/ResetPasswordPage/ResetPasswordPage.duck.ts (new)
src/extensions/Auth/containers/LoginPage/LoginPage.tsx       (updated — add forgot-password link)
src/extensions/Auth/translations/en.json                     (updated)
src/routing/index.tsx                                        (updated — add /forgot-password, /reset-password routes)
```
