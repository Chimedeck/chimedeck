# Sprint 43 — Configurable Email Domain Restriction

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 03 (Authentication), Sprint 16 (Auth UI), Sprint 40 (Change Email)  
> **References:** [requirements §3 — Auth](../architecture/requirements.md)

---

## Goal

Lock registration and email-change requests to a configurable allowlist of email domains. Out of the box the list contains a single entry (`journeyh.io`), but operators can extend it by setting an environment variable. This prevents accounts from being created with arbitrary external email addresses while keeping the restriction easy to relax in future.

---

## Feature Flags

| Flag | Default | Effect when `true` |
|---|---|---|
| `EMAIL_DOMAIN_RESTRICTION_ENABLED` | `true` | Reject registration / email-change requests whose domain is not in `ALLOWED_EMAIL_DOMAINS` |

---

## Scope

### 1. `server/config/env.ts`

Add two new env vars:

```typescript
// Comma-separated list of allowed email domains for registration and email change.
// Example: "journeyh.io,partner.com"
// Falls back to "journeyh.io" when not set.
ALLOWED_EMAIL_DOMAINS: Bun.env['ALLOWED_EMAIL_DOMAINS'] ?? 'journeyh.io',

// When true, registration and email-change are restricted to ALLOWED_EMAIL_DOMAINS.
EMAIL_DOMAIN_RESTRICTION_ENABLED: Bun.env['EMAIL_DOMAIN_RESTRICTION_ENABLED'] !== 'false',
```

---

### 2. `server/extensions/auth/common/emailDomain.ts` (new)

Shared helper used by registration and change-email routes:

```typescript
// Returns the domain part of an email address, lower-cased.
export const extractDomain = (email: string): string =>
  email.split('@')[1]?.toLowerCase() ?? '';

// Returns true when the email domain is in the configured allowlist,
// OR when domain restriction is disabled entirely.
export const isEmailDomainAllowed = (email: string): boolean => {
  if (!env.EMAIL_DOMAIN_RESTRICTION_ENABLED) return true;
  const allowed = env.ALLOWED_EMAIL_DOMAINS
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(extractDomain(email));
};
```

---

### 3. `server/extensions/auth/api/register.ts` — update

Add domain check before any database work:

```typescript
if (!isEmailDomainAllowed(body.email)) {
  return c.json({ name: 'email-domain-not-allowed' }, 422);
}
```

Error shape:
```json
{ "name": "email-domain-not-allowed" }
```

---

### 4. `server/extensions/auth/api/changeEmail.ts` — update (Sprint 40)

Add the same domain guard after credential validation and before token generation:

```typescript
if (!isEmailDomainAllowed(body.email)) {
  return c.json({ name: 'email-domain-not-allowed' }, 422);
}
```

---

### 5. Client — Signup Form (`src/extensions/Auth/`)

Map the new server error code to a human-readable message shown beneath the email field:

```typescript
// In the form error handler:
case 'email-domain-not-allowed':
  setFieldError('email', 'Only approved organisation email addresses may be used to register.');
  break;
```

---

### 6. Client — Change Email Form (`src/extensions/Profile/`)

Same mapping as above:

```typescript
case 'email-domain-not-allowed':
  setFieldError('email', 'Your new email address must use an approved organisation domain.');
  break;
```

---

## Error Catalogue

| Code | HTTP | Trigger |
|---|---|---|
| `email-domain-not-allowed` | 422 | Attempted registration or email change with a domain not in `ALLOWED_EMAIL_DOMAINS` |

---

## Tests

### Integration — `tests/integration/auth/emailDomainRestriction.test.ts`

| Scenario | Expected |
|---|---|
| Register with `user@journeyh.io` (default allowed) | 201 Created |
| Register with `user@gmail.com` | 422 `email-domain-not-allowed` |
| Register with domain from second entry in `ALLOWED_EMAIL_DOMAINS` | 201 Created |
| Change email to `new@journeyh.io` (authenticated) | 200 OK |
| Change email to `new@gmail.com` (authenticated) | 422 `email-domain-not-allowed` |
| `EMAIL_DOMAIN_RESTRICTION_ENABLED=false`, register with `user@gmail.com` | 201 Created |

---

## Acceptance Criteria

- [ ] `ALLOWED_EMAIL_DOMAINS` env var is parsed as a comma-separated list; leading/trailing whitespace per entry is trimmed
- [ ] Default behaviour (no env var set) allows only `@journeyh.io`
- [ ] Setting `EMAIL_DOMAIN_RESTRICTION_ENABLED=false` bypasses all domain checks
- [ ] Registration returns `422 email-domain-not-allowed` for disallowed domains
- [ ] Change-email returns `422 email-domain-not-allowed` for disallowed domains
- [ ] Signup form displays a clear inline error for disallowed domains
- [ ] Change-email form displays a clear inline error for disallowed domains
- [ ] All integration tests pass
