# Sprint 74 — Admin: Auto-Verify External User Email

> **Status:** Future sprint — not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 44 (Admin: Create External User API), Sprint 45 (Admin: Invite External Users UI), Sprint 23 (Email Verification)

---

## Goal

When an admin invites an external user via the `POST /api/v1/admin/users` endpoint, they can optionally mark the new account as **already email-verified**. This is useful when the admin knows the address is valid (e.g. they own the inbox or have confirmed it out-of-band) and does not want the new user to be blocked by an email verification step before they can log in.

Setting this flag writes `email_verified_at = NOW()` directly in the database at creation time, bypassing the normal SES verification flow entirely.

---

## Scope

### 1. API — extend `POST /api/v1/admin/users`

**`server/extensions/auth/api/adminCreateUser.ts`**

Add an optional `autoVerifyEmail` field to the request body:

```ts
interface AdminCreateUserBody {
  email: string;
  displayName: string;
  password?: string;
  sendEmail?: boolean;
  autoVerifyEmail?: boolean;  // NEW — default: false
}
```

If `autoVerifyEmail === true`:
- Set `email_verified_at = NOW()` when inserting the user row.
- Do **not** create an email verification token.
- Do **not** send a verification email even if `EMAIL_VERIFICATION_ENABLED=true`.

This field can be freely combined with `sendEmail`: an admin can auto-verify the email **and** send the invitation credentials email in the same call.

**Response:** the returned user object now includes `email_verified_at` so the client can confirm the field was set.

---

### 2. No New Migration Needed

`email_verified_at` column already exists on the `users` table (added in Sprint 23). This sprint only changes when the column is populated — no schema change required.

---

### 3. UI — `InviteExternalUserModal.tsx`

**`src/extensions/AdminInvite/InviteExternalUserModal.tsx`**

Add a checkbox below the password fields:

```
☑  Mark email as verified
   (The user can log in immediately — no verification email required)
```

- Default: **checked** (true). Rationale: admins creating accounts on behalf of users almost always control the email address; forcing a verification step on an admin-provisioned account creates friction.
- When unchecked and `EMAIL_VERIFICATION_ENABLED=true`, the user will receive a verification email on first login (existing behaviour).
- When `EMAIL_VERIFICATION_ENABLED=false` (server flag), this checkbox is hidden — verification is not enforced anyway and `autoVerifyEmail` has no practical effect.

The checkbox value is forwarded as `autoVerifyEmail` in the API request body.

---

### 4. Redux / RTK Query — update types

**`src/extensions/AdminInvite/types.ts`**

```ts
interface AdminCreateUserRequest {
  email: string;
  displayName: string;
  password?: string;
  sendEmail?: boolean;
  autoVerifyEmail?: boolean;  // NEW
}

interface AdminCreateUserResponse {
  data: {
    id: string;
    email: string;
    displayName: string;
    email_verified_at: string | null;  // included in response
    credentials?: { password: string };
  };
}
```

---

### 5. Credential Sheet — show verification status

**`src/extensions/AdminInvite/CredentialSheet.tsx`**

After successful creation, the credential sheet gains one additional line:

```
Email verified:  ✅ Yes (auto-verified by admin)
```
or
```
Email verified:  ⚠️ Pending (user must verify email before logging in)
```

---

### 6. Integration Tests

**`tests/integration/auth/adminCreateUser.test.ts`** (extend existing)

| Scenario | Expected |
|---|---|
| `autoVerifyEmail: true` | `email_verified_at` is set in DB at creation time |
| `autoVerifyEmail: false` | `email_verified_at` is `null` in DB |
| `autoVerifyEmail: true` + `EMAIL_VERIFICATION_ENABLED=true` | User can log in immediately without verification step |
| `autoVerifyEmail: false` + `EMAIL_VERIFICATION_ENABLED=true` | User is blocked on login until email is verified |
| `autoVerifyEmail: true` + `sendEmail: true` | Invitation email sent, verification email NOT sent |

---

## Files

| Path | Change |
|---|---|
| `server/extensions/auth/api/adminCreateUser.ts` | Accept + apply `autoVerifyEmail` |
| `src/extensions/AdminInvite/InviteExternalUserModal.tsx` | Add "Mark email as verified" checkbox |
| `src/extensions/AdminInvite/types.ts` | Extend `AdminCreateUserRequest` + `AdminCreateUserResponse` |
| `src/extensions/AdminInvite/CredentialSheet.tsx` | Show verification status |
| `src/extensions/AdminInvite/api.ts` | Forward `autoVerifyEmail` in request |
| `tests/integration/auth/adminCreateUser.test.ts` | Extend with auto-verify scenarios |

---

## Acceptance Criteria

- [ ] `POST /api/v1/admin/users` with `autoVerifyEmail: true` sets `email_verified_at` in DB immediately
- [ ] User created with `autoVerifyEmail: true` can log in without a verification step, even when `EMAIL_VERIFICATION_ENABLED=true`
- [ ] `autoVerifyEmail: false` (default) leaves `email_verified_at` null — existing verification flow unchanged
- [ ] No verification email is ever sent for auto-verified accounts
- [ ] Modal checkbox defaults to checked; can be unchecked before submitting
- [ ] Checkbox is hidden when `EMAIL_VERIFICATION_ENABLED=false` (verification not enforced server-side)
- [ ] Credential sheet displays the verification status clearly after creation
