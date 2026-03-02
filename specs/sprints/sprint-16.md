# Sprint 16 — Authentication UI

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 15 (UI Foundation), Sprint 03 (auth API)  
> **References:** [requirements §5.1](../architecture/requirements.md)

---

## Goal

Deliver polished, accessible Login and Sign-up pages built with Tailwind CSS. Users can authenticate via email/password or OAuth (Google, GitHub). Tokens are persisted in Redux + memory (never `localStorage`). Authenticated state drives `PrivateRoute`.

---

## Scope

### 1. Design Language

All auth pages follow this visual style:

- Full-height centered card: `min-h-screen bg-slate-950 flex items-center justify-center`
- Card panel: `w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8`
- Input fields: `w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500`
- Primary button: `w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium rounded-lg py-2.5 transition-colors`
- Error text: `text-red-400 text-sm`
- OAuth button: `w-full flex items-center gap-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg px-4 py-2.5 transition-colors`

### 2. File Structure

```
src/extensions/Auth/
  components/
    LoginForm.tsx           # email + password form with inline validation
    SignupForm.tsx          # name + email + password + confirm password
    OAuthButton.tsx         # Google / GitHub button with provider icon
    AuthDivider.tsx         # "or continue with" divider line
    PasswordInput.tsx       # input with show/hide toggle (lucide Eye/EyeOff)
  pages/
    LoginPage.tsx           # full-page login view
    SignupPage.tsx          # full-page sign-up view
  slices/
    authSlice.ts            # extends base slice: login, signup, logout thunks
  api/
    auth.ts                 # typed wrappers: login(), signup(), refreshToken(), logout()
```

### 3. LoginPage Layout

```
┌─────────────────────────────────────┐
│         🟦 Kanban  (logo + name)    │
│                                     │
│   Welcome back                      │
│   Sign in to your account           │
│                                     │
│   [Email ___________________________]│
│   [Password ____________________👁] │
│                                     │
│   [         Sign in          ]      │
│                                     │
│   ─────────── or ───────────        │
│   [🔵 Continue with Google   ]      │
│   [⚫ Continue with GitHub   ]      │
│                                     │
│   Don't have an account? Sign up    │
└─────────────────────────────────────┘
```

### 4. Form Validation

Client-side validation runs on blur + submit (no external library — native `useState`):

| Field | Rules |
|-------|-------|
| Email | Required, valid format |
| Password (login) | Required, ≥ 1 char |
| Name (signup) | Required, 2–80 chars |
| Password (signup) | Required, ≥ 8 chars, ≥ 1 number |
| Confirm password | Must match password |

API errors (e.g. `invalid-credentials`, `email-already-taken`) map to field-level messages shown below the relevant input in `text-red-400`.

### 5. Auth Flow

```
LoginForm submit
  │
  ▼
POST /api/v1/auth/token
  ├─ 200 → dispatch loginSuccess({ user, accessToken })
  │        → navigate('/workspaces')
  └─ 401 → show "Invalid email or password" under form
```

`authSlice` thunks:
- `loginThunk(email, password)` — calls `auth.login()`, dispatches state
- `signupThunk(name, email, password)` — calls `auth.signup()`, auto-logs in on success
- `logoutThunk()` — calls `DELETE /api/v1/auth/session`, clears store, navigates `/login`

### 6. Token Refresh on Boot

`App.tsx` on mount dispatches `refreshTokenThunk()`:
- Calls `POST /api/v1/auth/refresh` (sends httpOnly cookie automatically)
- On success: populate `authSlice` with fresh `accessToken` + `user`
- On failure: set status `unauthenticated` — no redirect (let `PrivateRoute` handle it)

### 7. Acceptance Criteria

- [ ] Login page renders at `/login` with email, password fields and OAuth buttons
- [ ] Submitting valid credentials redirects to `/workspaces`
- [ ] Invalid credentials shows error message below form without page reload
- [ ] Sign-up page creates account and redirects to `/workspaces`
- [ ] Password field has working show/hide toggle
- [ ] Refreshing the browser page while authenticated keeps the user logged in (refresh token flow)
- [ ] Both pages are fully keyboard-navigable (Tab order, Enter submits)
- [ ] Mobile viewport (375 px wide) renders without horizontal scroll

### 8. Tests

```
specs/tests/
  auth-login.md       # Playwright: load /login, fill form, submit, land on /workspaces
  auth-signup.md      # Playwright: sign up new account, land on /workspaces
```

`specs/tests/auth-login.md` steps:
1. Navigate to `http://localhost:5173/login`
2. Verify the heading "Welcome back" is visible
3. Fill email field with `test@example.com`
4. Fill password field with `password123`
5. Click the "Sign in" button
6. Expected: URL changes to `/workspaces` and user avatar or name is visible in the header

---
