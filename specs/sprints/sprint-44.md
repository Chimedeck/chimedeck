# Sprint 44 — Admin: Create External User API

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 03 (Authentication), Sprint 23 (Email / SES), Sprint 43 (Email Domain Restriction)  
> **References:** [requirements §3 — Auth](../architecture/requirements.md)

---

## Goal

Internal operators (users whose email belongs to an allowed admin domain — by default `@journeyh.io`) must be able to provision accounts for external collaborators without the external person needing to self-register. The API accepts an email address, a display name, and an optional password; when no password is supplied the server generates one automatically. Optionally an invitation email is sent to the new account's address via SES.

---

## Admin Identity

A request is considered "admin" when the authenticated user's email domain matches one of the domains in `ADMIN_EMAIL_DOMAINS`. This is a **separate list** from `ALLOWED_EMAIL_DOMAINS` (Sprint 43):

| Env var | Purpose |
|---|---|
| `ALLOWED_EMAIL_DOMAINS` | Controls which domains may **self-register** or change their own email |
| `ADMIN_EMAIL_DOMAINS` | Controls which domains may **create accounts on behalf of others** |

Keeping them separate means an operator can widen registration access to a partner org (`ALLOWED_EMAIL_DOMAINS`) without granting that org the ability to provision new accounts (`ADMIN_EMAIL_DOMAINS`).

No separate admin-role column is required at this stage.

---

## Feature Flags

| Flag | Default | Controls |
|---|---|---|
| `SES_ENABLED` | `false` | Master switch for all outgoing email via AWS SES (defined in Sprint 23). When `false`, no email is ever sent regardless of other flags. |
| `ADMIN_INVITE_EMAIL_ENABLED` | `false` | Opt-in specifically for admin invitation emails. When `false`, the invitation email is never sent even if `SES_ENABLED` is `true`. |

An invitation email is dispatched **only when both flags are `true`**. This lets operators run SES for other flows (email verification, password reset) without automatically enabling admin invitation emails.

```
email sent = sendEmail === true
          && SES_ENABLED === true
          && ADMIN_INVITE_EMAIL_ENABLED === true
```

---

## Scope

### 1. `server/config/env.ts` — update

```typescript
// Comma-separated list of email domains whose users may create accounts on behalf of others.
// Intentionally separate from ALLOWED_EMAIL_DOMAINS (self-registration allowlist).
// Falls back to "journeyh.io" when not set.
ADMIN_EMAIL_DOMAINS: Bun.env['ADMIN_EMAIL_DOMAINS'] ?? 'journeyh.io',

// Controls invitation emails for admin-created accounts specifically.
// SES_ENABLED must ALSO be true — this flag exists so operators can run SES
// for other flows (e.g. email verification, password reset) without
// automatically enabling admin invite emails.
ADMIN_INVITE_EMAIL_ENABLED: Bun.env['ADMIN_INVITE_EMAIL_ENABLED'] === 'true',
```

---

### 2. `server/extensions/auth/api/adminCreateUser.ts` (new)

#### `POST /api/v1/admin/users`

**Authentication:** JWT required — caller must be authenticated and must have an `ADMIN_EMAIL_DOMAINS` email.

**Request body:**

```typescript
interface AdminCreateUserBody {
  email: string;        // external user's email — no domain restriction enforced here
  displayName: string;  // full name shown in the UI
  password?: string;    // if omitted, a secure random password is generated
  sendEmail?: boolean;  // client-side opt-in to send the invitation email
                        // only takes effect when BOTH SES_ENABLED and
                        // ADMIN_INVITE_EMAIL_ENABLED are true
}
```

**Logic:**

1. Verify caller is authenticated and their email domain is in `ADMIN_EMAIL_DOMAINS` (use a new `isAdminEmailDomain()` helper, **not** `isEmailDomainAllowed()` from Sprint 43) — reject with `403 admin-access-required` otherwise.
2. Validate `email` is a valid email address; validate `displayName` is non-empty.
3. Check no existing user has the same `email` — reject with `409 email-already-in-use`.
4. Resolve password:
   - `password` provided → validate min 8 chars, at least one letter and one number → hash with bcrypt.
   - `password` omitted → generate 16-character random password (letters + digits, URL-safe) → hash.
5. Insert new user row (same table as normal registration). Set `email_verified = true` — admin-created accounts skip email verification.
6. Compose a `credentials` object: `{ email, plainPassword }`. `plainPassword` is the cleartext password (generated or provided). This is returned in the response so the admin can share it manually and is **never** stored.
7. Determine whether to send the invitation email:
   ```
   shouldSend = sendEmail === true
             && env.SES_ENABLED === true
             && env.ADMIN_INVITE_EMAIL_ENABLED === true
   ```
   If `shouldSend`: send invitation email to the new user's address (see §3 below).
   If `!shouldSend` for any reason: skip silently — the credential sheet in the UI covers manual delivery.
8. Return response (see §Response below).

**Response:**

```typescript
interface AdminCreateUserResponse {
  data: {
    id: string;
    email: string;
    displayName: string;
  };
  credentials: {
    email: string;
    plainPassword: string;  // cleartext — admin's responsibility to share securely
  };
  emailSent: boolean;         // true only when the SES email was actually dispatched
}
```

**Error catalogue:**

| Code | HTTP | Trigger |
|---|---|---|
| `admin-access-required` | 403 | Caller's email domain is not in `ALLOWED_EMAIL_DOMAINS` |
| `email-already-in-use` | 409 | A user with this email already exists |
| `invalid-email` | 422 | `email` field fails format validation |
| `display-name-required` | 422 | `displayName` is blank or missing |
| `password-too-weak` | 422 | Manual password provided but fails strength check |

---

### 3. `server/extensions/email/templates/adminInvite.ts` (new)

Plain-text + HTML email template for admin-created accounts.

**Subject:** `You have been invited to [App Name]`

**Body includes:**
- The inviter's name / email for context
- The new user's login email address
- The temporary password
- A direct link to the login page (`<APP_URL>/login`)
- A prompt to change the password after first login

```typescript
export const adminInviteEmail = ({
  inviterName,
  newUserEmail,
  plainPassword,
  loginUrl,
}: AdminInviteEmailParams): EmailPayload => ({ ... });
```

---

### 4. `server/extensions/auth/api/index.ts` — update

Mount the new route:

```typescript
// Admin: create external user (admin-domain callers only)
router.post('/admin/users', authenticate, adminCreateUser);
```

---

### 5. `server/extensions/auth/common/isAdminEmailDomain.ts` (new)

```typescript
// Returns true when the email's domain is in ADMIN_EMAIL_DOMAINS.
// Completely independent of ALLOWED_EMAIL_DOMAINS / isEmailDomainAllowed().
export const isAdminEmailDomain = (email: string): boolean => {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  const adminDomains = env.ADMIN_EMAIL_DOMAINS
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(Boolean);
  return adminDomains.includes(domain);
};
```

---

### 6. `server/extensions/auth/common/generatePassword.ts` (new)

```typescript
// Generates a cryptographically random URL-safe password of the given length.
// Default length: 16. Character set: a-z A-Z 0-9.
export const generatePassword = (length = 16): string => { ... };
```

---

## Security Notes

- `plainPassword` is **only** present in the API response to the requesting admin — it is never logged, never stored, and never sent again after this call.
- The new user's `email_verified` flag is set to `true` to bypass the normal verification gate since the admin is vouching for the address.
- The invitation email contains the plaintext password. Operators should instruct admins to ask external users to change it upon first login.

---

## Tests

### Integration — `tests/integration/auth/adminCreateUser.test.ts`

| Scenario | Expected |
|---|---|
| Authenticated `@journeyh.io` user creates external user (no password supplied) | 201, `credentials.plainPassword` is 16-char alphanumeric, `emailSent: false` |
| Authenticated `@journeyh.io` user creates external user with manual password | 201, `credentials.plainPassword` equals the supplied password |
| Weak manual password (`abc`) | 422 `password-too-weak` |
| `email-already-in-use` | 409 |
| Caller whose domain is in `ALLOWED_EMAIL_DOMAINS` but **not** `ADMIN_EMAIL_DOMAINS` | 403 `admin-access-required` |
| Non-admin caller (`@gmail.com` user) | 403 `admin-access-required` |
| Unauthenticated request | 401 |
| `sendEmail: true` with both `SES_ENABLED=true` and `ADMIN_INVITE_EMAIL_ENABLED=true` | 201, `emailSent: true` |
| `sendEmail: true` but `ADMIN_INVITE_EMAIL_ENABLED=false`, `SES_ENABLED=true` | 201, `emailSent: false` |
| `sendEmail: true` but `SES_ENABLED=false`, `ADMIN_INVITE_EMAIL_ENABLED=true` | 201, `emailSent: false` |
| `sendEmail: false` with both SES flags enabled | 201, `emailSent: false` |

---

## Acceptance Criteria

- [ ] `POST /api/v1/admin/users` is only accessible to authenticated users whose email domain is in `ADMIN_EMAIL_DOMAINS` (not `ALLOWED_EMAIL_DOMAINS`)
- [ ] A user whose domain is in `ALLOWED_EMAIL_DOMAINS` but not `ADMIN_EMAIL_DOMAINS` receives `403 admin-access-required`
- [ ] Omitting `password` generates a secure 16-character random password
- [ ] Weak manually-provided passwords are rejected with `422`
- [ ] `plainPassword` is present in the response and is the correct cleartext value
- [ ] `plainPassword` is not stored in the database
- [ ] New user's `email_verified` is `true` immediately
- [ ] Invitation email is sent only when all three conditions are true: `sendEmail === true`, `SES_ENABLED=true`, `ADMIN_INVITE_EMAIL_ENABLED=true`
- [ ] Setting `SES_ENABLED=true` alone (without `ADMIN_INVITE_EMAIL_ENABLED=true`) does **not** trigger invitation emails
- [ ] Setting `ADMIN_INVITE_EMAIL_ENABLED=true` alone (without `SES_ENABLED=true`) does **not** trigger invitation emails
- [ ] `emailSent` in the response accurately reflects whether SES was called
- [ ] All integration tests pass
