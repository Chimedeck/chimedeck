# Sprint 23 — Email Verification via AWS SES

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 03 (Authentication), Sprint 14 (Feature Flags infra)  
> **References:** [requirements §3 — Auth](../architecture/requirements.md)

---

## Goal

Introduce optional email verification gated behind a feature flag (`EMAIL_VERIFICATION_ENABLED`). When enabled, new registrations receive a verification email via AWS SES before they can access the app. Existing users who are unverified see a resend-verification prompt. When the flag is disabled the system behaves exactly as before (no change to existing flows).

---

## Feature Flags

| Flag | Default | Effect when `true` |
|---|---|---|
| `EMAIL_VERIFICATION_ENABLED` | `false` | Requires email verification before login succeeds |
| `SES_ENABLED` | `false` | Routes email through AWS SES; falls back to console log when `false` |

Both flags are added to `server/config/flags.ts` and `server/mods/flags/`.

---

## Scope

### 1. Database Migration

```
db/migrations/
  0014_email_verification.ts
```

New columns on `users`:

```sql
ALTER TABLE users
  ADD COLUMN email_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN verification_token TEXT,
  ADD COLUMN verification_token_expires_at TIMESTAMPTZ;
```

Existing users: backfill `email_verified = true` (they pre-date verification).

### 2. Server — Email Module

```
server/extensions/email/
  index.ts                  # re-exports send()
  mods/
    ses.ts                  # AWS SES v3 SDK send wrapper
    console.ts              # dev fallback — logs email to stdout
  config/
    index.ts                # SES_REGION, SES_FROM_ADDRESS from env
  templates/
    verificationEmail.ts    # plain-text + HTML body builder
```

`send({ to, subject, html, text })` — selects transport based on `SES_ENABLED` flag.

Environment variables (added to `.env.example`):
```
SES_ENABLED=false
SES_REGION=us-east-1
SES_FROM_ADDRESS=noreply@example.com
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

### 3. Server — Auth Routes

#### `POST /api/v1/auth/register` (updated)

When `EMAIL_VERIFICATION_ENABLED` is `true`:
- Create user with `email_verified = false`
- Generate a cryptographically random 32-byte hex token → store as `verification_token` + `verification_token_expires_at = now + 24h`
- Send verification email with link: `<APP_URL>/verify-email?token=<token>`
- Return `{ data: { requiresVerification: true } }` with HTTP 201 (no JWT issued yet)

When flag is `false`: existing behaviour unchanged.

#### `GET /api/v1/auth/verify-email?token=<token>` (new)

- Look up user by `verification_token`
- Reject if expired or not found → `{ name: 'invalid-or-expired-token' }` 400
- Set `email_verified = true`, clear token fields
- Issue access + refresh tokens → same response shape as `/auth/login`

#### `POST /api/v1/auth/resend-verification` (new, authenticated)

- Requires valid JWT (user may be unverified)
- Rate-limited to 3 requests per hour per user
- Regenerates token, sends new email
- Returns `{ data: { sent: true } }` 200

#### `POST /api/v1/auth/login` (updated)

When `EMAIL_VERIFICATION_ENABLED` is `true` and `user.email_verified = false`:
- Return `{ name: 'email-not-verified', data: { message: 'Please verify your email before logging in.' } }` 403

### 4. Middleware Guard

```
server/middlewares/
  requireVerified.ts        # 403 if EMAIL_VERIFICATION_ENABLED && !user.email_verified
```

Applied to all private routes **after** `authenticate`. Skipped entirely when flag is `false`.

### 5. Client — Verify Email Page

```
src/extensions/Auth/
  containers/
    VerifyEmailPage/
      VerifyEmailPage.tsx     # calls GET /auth/verify-email?token=... on mount
      VerifyEmailPage.duck.ts
  components/
    VerificationPending.tsx   # banner shown after register when verification required
    ResendVerificationButton.tsx
```

**`VerifyEmailPage`** behaviour:
- On mount: extract `token` from URL, POST to server
- Success → redirect to `/login` with toast "Email verified! You can now log in."
- Failure → show error message + resend button

**`VerificationPending`** banner (shown on login page when `requiresVerification` error):
- "Check your inbox — we sent a verification link to `<email>`"
- "Resend email" button (calls `POST /auth/resend-verification`)
- Dismissible

Route added: `/verify-email` → `VerifyEmailPage` (public, no auth).

### 6. Translations

```
src/extensions/Auth/translations/en.json  (additions)
```

```json
{
  "VerifyEmail.title": "Verify your email",
  "VerifyEmail.success": "Email verified! You can now log in.",
  "VerifyEmail.invalidToken": "This link is invalid or has expired.",
  "VerifyEmail.pending": "Check your inbox — we sent a link to {email}",
  "VerifyEmail.resend": "Resend verification email",
  "VerifyEmail.resendSuccess": "A new verification email has been sent."
}
```

---

## Data Model

```
users (updated)
├── email_verified                BOOLEAN NOT NULL DEFAULT FALSE
├── verification_token            TEXT (nullable)
└── verification_token_expires_at TIMESTAMPTZ (nullable)
```

---

## API Routes Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/auth/register` | ✗ | Updated: sends verification email when flag on |
| `GET` | `/api/v1/auth/verify-email` | ✗ | Verify token, issue JWT |
| `POST` | `/api/v1/auth/resend-verification` | JWT (unverified OK) | Resend verification email |
| `POST` | `/api/v1/auth/login` | ✗ | Updated: 403 when unverified + flag on |

---

## Acceptance Criteria

- [ ] `EMAIL_VERIFICATION_ENABLED=false` (default): register + login work exactly as before with no regressions
- [ ] `EMAIL_VERIFICATION_ENABLED=true`, `SES_ENABLED=false`: verification email is logged to console instead of sent; flow still works
- [ ] `EMAIL_VERIFICATION_ENABLED=true`, `SES_ENABLED=true`: email is delivered via AWS SES
- [ ] Visiting `/verify-email?token=<valid>` verifies the user and issues a JWT
- [ ] Visiting `/verify-email?token=<expired>` returns an error page with a resend button
- [ ] Login with an unverified account returns 403 with the `email-not-verified` error name
- [ ] Resend is rate-limited (3 per hour)
- [ ] Existing users (backfilled `email_verified = true`) are not affected
- [ ] `<title>` on verify page: "Verify Email — ChimeDeck"

---

## Tests

```
specs/tests/
  email-verification.md   # E2E: register → check console log token → visit link → login succeeds
  email-verification-flag.md  # Unit: flag=false bypasses all verification logic
```

---

## Files

```
db/migrations/0014_email_verification.ts
server/extensions/email/index.ts
server/extensions/email/mods/ses.ts
server/extensions/email/mods/console.ts
server/extensions/email/config/index.ts
server/extensions/email/templates/verificationEmail.ts
server/extensions/auth/api/register.ts          (updated)
server/extensions/auth/api/login.ts             (updated)
server/extensions/auth/api/verifyEmail.ts       (new)
server/extensions/auth/api/resendVerification.ts (new)
server/middlewares/requireVerified.ts           (new)
server/config/flags.ts                          (updated)
src/extensions/Auth/containers/VerifyEmailPage/VerifyEmailPage.tsx
src/extensions/Auth/containers/VerifyEmailPage/VerifyEmailPage.duck.ts
src/extensions/Auth/components/VerificationPending.tsx
src/extensions/Auth/components/ResendVerificationButton.tsx
src/extensions/Auth/translations/en.json       (updated)
src/routing/index.tsx                           (updated — add /verify-email route)
.env.example                                    (updated)
```
