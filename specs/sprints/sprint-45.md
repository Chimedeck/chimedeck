# Sprint 45 — Admin: Invite External Users UI

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 17 (App shell / Sidebar), Sprint 44 (Admin Create User API)  
> **References:** [requirements §3 — Auth](../architecture/requirements.md)

---

## Goal

Surface the admin invite flow in the application sidebar. Users whose email belongs to an allowed admin domain see an **"Invite External User"** entry in the left sidebar. Clicking it opens a modal where the admin fills in the new user's details and chooses how to deliver the credentials: either by having the system email the new user directly, or by copying a formatted credential sheet to share manually.

---

## Visibility Rule

The sidebar entry and the modal are rendered **only** when the current user's email domain matches at least one entry in `ADMIN_EMAIL_DOMAINS`. This is evaluated entirely on the client using the profile data already in the Redux store; no extra API call is needed.

`ADMIN_EMAIL_DOMAINS` is separate from `ALLOWED_EMAIL_DOMAINS` (the self-registration allowlist from Sprint 43). A user from a partner org that was added to `ALLOWED_EMAIL_DOMAINS` will **not** see the invite entry unless their domain is also explicitly added to `ADMIN_EMAIL_DOMAINS`.

---

## Scope

### 1. Sidebar — `src/layout/Sidebar/`

Add a new navigation item below the existing items (see the attached screenshot — it should appear as a peer of "All Workspaces"):

```
[icon]  Invite External User
```

- Icon: `UserPlusIcon` (Heroicons outline)
- Visible only to admin-domain users (see visibility rule above)
- Clicking opens `<InviteExternalUserModal />`

---

### 2. `src/extensions/AdminInvite/` (new feature folder)

```
src/extensions/AdminInvite/
  api.ts                         # RTK Query endpoint wrapping POST /api/v1/admin/users
  InviteExternalUserModal.tsx    # Main modal component
  CredentialSheet.tsx            # Formatted copyable credential block
  adminInvite.slice.ts           # Redux slice (modal open/close state)
  types.ts
```

---

### 3. `src/extensions/AdminInvite/InviteExternalUserModal.tsx`

A modal (`Dialog` from Headless UI or equivalent) with:

#### Form fields

| Field | Type | Notes |
|---|---|---|
| Email address | `<input type="email">` | No domain restriction on external users |
| Display name | `<input type="text">` | Required |
| Password mode | Radio group | **"Generate automatically"** (default) / **"Set manually"** |
| Password | `<input type="password">` + strength bar | Shown only when "Set manually" is selected |

#### Send email toggle

Displayed only when **both** `SES_ENABLED` and `ADMIN_INVITE_EMAIL_ENABLED` are `true` (the client reads these from the feature-flags endpoint or a bundled config). Having `SES_ENABLED` alone is not enough — operators may use SES for other flows (verification, password reset) without wanting admin invite emails enabled:

```
toggle visible = SES_ENABLED === true && ADMIN_INVITE_EMAIL_ENABLED === true
```

When the toggle is hidden (either flag is `false`), the credential sheet is always shown after creation so the admin can share credentials manually.

```
☑  Send login credentials to the user by email
```

#### Submit

Button label: **"Create account"**

On success the form is replaced by the **Credential Sheet** view (§4).

---

### 4. `src/extensions/AdminInvite/CredentialSheet.tsx`

Shown inside the same modal after a successful account creation. Displays the generated credentials in a styled, copyable block:

```
┌─────────────────────────────────────────────────┐
│  New account created                            │
│                                                 │
│  Email:     contractor@example.com              │
│  Password:  G7xqP2mRkLwN4zVb                   │
│  Login URL: https://app.example.com/login       │
│                                                 │
│  [ Copy to clipboard ]   [ Done ]               │
└─────────────────────────────────────────────────┘
```

- **"Copy to clipboard"** copies the entire block as plain text (email, password, login URL on separate lines) via `navigator.clipboard.writeText`.
- **"Done"** closes the modal and resets it to the blank form state.
- The credential sheet is shown regardless of whether an email was sent. When `emailSent === true` a small notice is shown: _"Credentials have also been sent to the user's email address."_

---

### 5. `src/extensions/AdminInvite/api.ts`

RTK Query mutation:

```typescript
adminCreateUser: builder.mutation<AdminCreateUserResponse, AdminCreateUserRequest>({
  query: body => ({ url: '/admin/users', method: 'POST', body }),
}),
```

---

### 6. `src/extensions/AdminInvite/adminInvite.slice.ts`

Minimal slice managing modal visibility:

```typescript
interface AdminInviteState {
  isOpen: boolean;
}
```

Actions: `openInviteModal`, `closeInviteModal`.

---

### 7. `src/extensions.ts` — update

Register the `AdminInvite` reducer:

```typescript
adminInvite: adminInviteReducer,
```

---

## UX Details

### Password strength bar
When "Set manually" is selected a real-time strength bar (4 levels: very weak → strong) is displayed beneath the password field. The "Create account" button is disabled while the password is considered weak (`< 8 chars` or missing a letter/number).

### Loading & error states
- Spinner replaces button text during the API call.
- Inline field errors for `invalid-email`, `display-name-required`, `password-too-weak`.
- Toast error for `email-already-in-use` and unexpected server errors.

### Accessibility
- Modal traps focus; `Escape` closes the modal without submitting.
- All inputs have `<label>` elements.
- Success state is announced via an ARIA live region.

---

## Tests

### Integration — `tests/integration/adminInvite/`

| Scenario | Expected |
|---|---|
| Admin-domain user sees "Invite External User" sidebar item | Item rendered |
| Non-admin user does **not** see sidebar item | Item absent |
| Submit valid form (auto-generate password) | Modal shows credential sheet with `plainPassword` |
| Submit valid form (manual strong password) | Modal shows credential sheet |
| Submit weak manual password | Inline error, no submission |
| "Copy to clipboard" | Clipboard contains email + password + login URL |
| "Done" button | Modal closes, form resets |
| `emailSent: true` from API | Notice shown in credential sheet |
| `ADMIN_INVITE_EMAIL_ENABLED = false` | Toggle hidden, credential sheet always shown |

---

## Acceptance Criteria

- [ ] "Invite External User" sidebar item is visible only to admin-domain users
- [ ] Modal opens on click; `Escape` closes it without side effects
- [ ] "Generate automatically" is the default password mode
- [ ] Manual password mode shows a strength bar; submit is blocked for weak passwords
- [ ] Send-email toggle is only rendered when `ADMIN_INVITE_EMAIL_ENABLED` is `true`
- [ ] On success, the credential sheet shows email, password, and login URL
- [ ] "Copy to clipboard" copies all three fields as plain text
- [ ] When `emailSent: true`, the sheet includes a sent-confirmation notice
- [ ] "Done" resets the modal to its blank initial state
- [ ] All integration tests pass
