# Sprint 02 — Authentication

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **References:** [requirements §5.1](../architecture/requirements.md), [technical-decisions.md §6](../architecture/technical-decisions.md)

---

## Goal

Deliver a complete, secure authentication system supporting email/password and OAuth (Google, GitHub). All subsequent sprints depend on identity.

---

## Scope

### 1. Data Model

New Prisma models (per [requirements §7](../architecture/requirements.md) + [technical-decisions.md §6](../architecture/technical-decisions.md)):

```prisma
model User {
  id         String   @id @default(cuid())
  email      String   @unique
  name       String
  avatarUrl  String?
  passwordHash String?       // null for OAuth-only users
  createdAt  DateTime @default(now())

  refreshTokens RefreshToken[]
  memberships   Membership[]
}

model RefreshToken {
  id        String    @id @default(cuid())
  userId    String
  token     String    @unique  // opaque random bytes
  revokedAt DateTime?
  expiresAt DateTime
  createdAt DateTime  @default(now())

  user      User      @relation(fields: [userId], references: [id])
}
```

Migration: `0002_auth`

### 2. Server Extension Structure

```
server/extensions/auth/
  api/
    index.ts        # mounts all auth routes
    login.ts        # POST /api/v1/auth/token
    refresh.ts      # POST /api/v1/auth/refresh
    logout.ts       # DELETE /api/v1/auth/session
    oauth/
      index.ts      # GET /api/v1/auth/oauth/:provider
      callback.ts   # GET /api/v1/auth/oauth/:provider/callback
  common/
    config/
      jwt.ts        # RS256 key loading from Bun.env
      oauth.ts      # provider client IDs/secrets
  mods/
    token/
      issue.ts      # create access token (JWT RS256, 15 min)
      verify.ts     # verify + decode access token
      refresh.ts    # rotate refresh token
    password/
      hash.ts       # bcrypt hash
      verify.ts     # bcrypt compare
    oauth/
      google.ts     # exchange code → profile
      github.ts     # exchange code → profile
  middlewares/
    authentication.ts   # attaches req.currentUser from Bearer token
```

### 3. API Routes

Per [technical-decisions.md §9](../architecture/technical-decisions.md):

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/auth/token` | Email/password login |
| `POST` | `/api/v1/auth/refresh` | Rotate refresh token (reads httpOnly cookie) |
| `DELETE` | `/api/v1/auth/session` | Revoke refresh token, close WS sessions |
| `GET` | `/api/v1/auth/oauth/:provider` | Redirect to OAuth consent |
| `GET` | `/api/v1/auth/oauth/:provider/callback` | Exchange code, upsert user, issue tokens |
| `GET` | `/api/v1/users/me` | Return current user (requires auth) |
| `PATCH` | `/api/v1/users/me` | Update name / avatar |

### 4. Token Lifecycle

Per [requirements §5.1](../architecture/requirements.md) + [technical-decisions.md §6](../architecture/technical-decisions.md):

- Access token: RS256 JWT, 15-minute TTL, payload `{ sub, email, iat, exp }`
- Refresh token: opaque 32-byte hex, stored in `refresh_tokens`, httpOnly `Secure` cookie
- On every `POST /api/v1/auth/refresh`: old token marked `revokedAt`, new token issued
- Expired or revoked refresh token returns `HTTP 401` with error name `refresh-token-invalid`
- OAuth state nonce: stored in Redis (`invite:<nonce>`) with 10-minute TTL

### 5. Security

- `authentication.ts` middleware: deny by default, call `next()` only on valid token
- Passwords hashed with bcrypt cost factor 12
- Rate limiting on auth endpoints: 10 req/min per IP (per [technical-decisions.md §16](../architecture/technical-decisions.md))
- No `password_hash` field ever included in API responses

### 6. Frontend Extension

```
src/extensions/Auth/
  components/
    LoginForm.tsx
    OAuthButtons.tsx
  containers/
    LoginPage/
      LoginPage.tsx
      LoginPage.duck.ts     # Redux slice: login, logout, refresh
  api.ts                    # RTK Query endpoints for auth
  routes.ts
  translations/
    en.json
```

- Silent refresh: RTK Query intercepts `401` → calls `POST /api/v1/auth/refresh` → retries original request
- Failed silent refresh → dispatch `logout` → redirect to `/login`

---

## Error Responses

| Name | HTTP | Trigger |
|------|------|---------|
| `credentials-invalid` | 401 | Wrong email/password |
| `refresh-token-invalid` | 401 | Expired or revoked refresh token |
| `oauth-state-mismatch` | 400 | CSRF on OAuth callback |
| `oauth-provider-error` | 502 | Provider returned error |
| `user-not-found` | 404 | `GET /users/me` with deleted account |

---

## Tests

- Unit: `token/issue.ts`, `token/verify.ts`, `password/hash.ts`, `password/verify.ts`
- Integration: login flow, refresh rotation, revocation, OAuth callback upsert
- Security: expired token rejected, revoked token rejected, password not in response

---

## Acceptance Criteria

- [ ] Email/password login returns JWT + sets httpOnly refresh cookie
- [ ] Refresh rotates token and returns new JWT
- [ ] Logout revokes refresh token — subsequent refresh returns 401
- [ ] OAuth Google + GitHub flow completes and upserts `User`
- [ ] `GET /api/v1/users/me` with expired access token triggers silent refresh
- [ ] Rate limiting returns 429 after 10 login attempts per minute
- [ ] No `password_hash` ever appears in any API response
