# Sprint 57 — Security Hardening

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 03 (Authentication), Sprint 01 (Project Setup — middleware stack)  
> **References:** [requirements §6 — Security](../architecture/requirements.md)

---

## Goal

Two security gaps identified against the requirements are addressed:

1. **CSRF protection** — REST API mutation routes (POST/PUT/PATCH/DELETE) must be protected against cross-site request forgery
2. **Input sanitization** — user-supplied text fields (card titles, descriptions, comments, board names, etc.) must be sanitized server-side to prevent stored XSS

---

## Scope

### 1. CSRF Protection

#### Strategy: `SameSite=Strict` cookies + `Origin` header check

The project uses JWT in `Authorization` headers for primary auth, which is inherently CSRF-safe. However, any route that reads auth from a cookie (e.g. OAuth callback, session cookie) is vulnerable.

**Approach:**

a. Ensure all auth cookies are set with `SameSite=Strict; Secure; HttpOnly`.

b. Add an `Origin` / `Referer` validation middleware for state-mutating routes:

```ts
// server/middlewares/csrfGuard.ts
export const csrfGuard = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.headers['origin'] ?? req.headers['referer'];
    const allowedOrigins = [config.APP_BASE_URL];
    if (origin && !allowedOrigins.some((o) => origin.startsWith(o))) {
      return res.status(403).json({
        error: { code: 'csrf-origin-mismatch', message: 'Cross-site request blocked.' },
      });
    }
  }
  next();
};
```

c. Apply `csrfGuard` globally in `server/index.ts` after the body-parser middleware.

d. Add `APP_BASE_URL` to `server/config/env.ts` if not already present.

#### Existing OAuth CSRF nonce

The OAuth state nonce from Sprint 03 remains as-is; it already covers the OAuth redirect flow. This sprint covers the broader REST surface.

---

### 2. Input Sanitization

#### Package

```bash
bun add dompurify
bun add -d @types/dompurify
# DOMPurify requires a DOM environment; use the server-side wrapper:
bun add isomorphic-dompurify
```

Alternatively use `sanitize-html` (lighter weight, no JSDOM dependency):

```bash
bun add sanitize-html
bun add -d @types/sanitize-html
```

#### `server/common/sanitize.ts` (new)

```ts
import sanitizeHtml from 'sanitize-html';

// Strip all HTML tags and attributes — plain text only
export const sanitizeText = (input: string): string =>
  sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} });

// Allow a safe subset of Markdown-rendered HTML (for card descriptions)
export const sanitizeRichText = (input: string): string =>
  sanitizeHtml(input, {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote'],
    allowedAttributes: { a: ['href', 'rel', 'target'] },
    allowedSchemes: ['https', 'mailto'],
  });
```

#### Fields to sanitize

| Field | Function |
|---|---|
| `cards.title` | `sanitizeText` |
| `cards.description` | `sanitizeRichText` |
| `comments.content` | `sanitizeRichText` |
| `boards.name` | `sanitizeText` |
| `boards.description` | `sanitizeRichText` |
| `lists.name` | `sanitizeText` |
| Custom field `value_text` | `sanitizeText` |

Apply sanitization in the request handler or a validation layer **before** writing to the database — never on read.

---

## Acceptance Criteria

- [ ] `Origin` header mismatch on POST/PUT/PATCH/DELETE returns `403 csrf-origin-mismatch`
- [ ] Requests from the correct origin pass the CSRF guard without error
- [ ] Auth cookies are set with `SameSite=Strict; Secure; HttpOnly`
- [ ] `sanitize-html` (or equivalent) is installed and in `package.json`
- [ ] `sanitizeText` strips all HTML tags
- [ ] `sanitizeRichText` allows a safe tag/attribute allowlist
- [ ] Submitting `<script>alert(1)</script>` as a card title stores the sanitized plain-text output
- [ ] Submitting a description with allowed Markdown HTML (`<strong>`, `<a href="https://...">`) is preserved
- [ ] Integration test covers sanitization of XSS payload in card title and description
