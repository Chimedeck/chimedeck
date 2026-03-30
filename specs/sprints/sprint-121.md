# Sprint 121 — Email Template Centralisation & Handlebars Migration

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 23 (Email Verification / SES), Sprint 41 (Forgot Password), Sprint 44 (Admin Invite Email)
> **Status:** ⬜ Future

---

## Goal

All email HTML is currently hardcoded as template literals inside `.ts` files, mixing logic with markup and using `${variable}` interpolation that is hard to read and style. This sprint extracts every email body into a dedicated `.html` file under `server/extensions/email/templates/html/`, switches data binding to Handlebars `{{variable}}` syntax, and introduces a thin `renderTemplate` helper that loads and compiles templates at runtime using `Bun.file`.

After this sprint, adding or editing an email means editing an `.html` file — no TypeScript changes required.

---

## Scope

### 1. New folder structure

```
server/extensions/email/
├── index.ts                        (unchanged)
├── mods/
│   └── ses.ts                      (unchanged)
├── templates/
│   ├── html/
│   │   ├── verification.html       (extracted from verificationEmail.ts)
│   │   └── adminInvite.html        (extracted from adminInvite.ts)
│   ├── render.ts                   (NEW — Handlebars compile helper)
│   ├── verificationEmail.ts        (updated — no inline HTML)
│   └── adminInvite.ts              (updated — no inline HTML)
```

Any future email templates (password reset, email change confirmation, notification emails from sprints 41, 72, 99, etc.) must follow this pattern from the start.

---

### 2. `render.ts` helper

Create `server/extensions/email/templates/render.ts`:

```ts
// render.ts
// Loads an HTML email template file and fills in {{variable}} placeholders.
// Uses Bun.file for file I/O — no Node fs module.
import Handlebars from 'handlebars';
import { resolve } from 'path';

const cache = new Map<string, HandlebarsTemplateDelegate>();

export async function renderTemplate(
  { templateName, data }: { templateName: string; data: Record<string, unknown> },
): Promise<string> {
  let compile = cache.get(templateName);
  if (!compile) {
    const filePath = resolve(import.meta.dir, 'html', `${templateName}.html`);
    const source = await Bun.file(filePath).text();
    compile = Handlebars.compile(source);
    cache.set(templateName, compile);
  }
  return compile(data);
}
```

- Template results are cached after first load so hot-path email sends skip disk I/O.
- `import.meta.dir` resolves relative to the `.ts` file, not the CWD.

---

### 3. HTML template files

#### `html/verification.html`

Full standalone HTML document. All inline styles preserved as-is (inline CSS is required for email client compatibility). Handlebars placeholder: `{{verificationUrl}}`.

```html
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
  <h1 style="font-size:24px;font-weight:700;margin-bottom:8px">Verify your email</h1>
  <p style="color:#475569;margin-bottom:24px">Click the button below to verify your email address. The link expires in 24 hours.</p>
  <a href="{{verificationUrl}}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Verify email</a>
  <p style="color:#94a3b8;font-size:13px;margin-top:24px">If you did not create an account, you can safely ignore this email.</p>
</body>
</html>
```

#### `html/adminInvite.html`

Placeholders: `{{inviterName}}`, `{{newUserEmail}}`, `{{plainPassword}}`, `{{loginUrl}}`.

```html
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
  <h1 style="font-size:24px;font-weight:700;margin-bottom:8px">You have been invited to Taskinate</h1>
  <p style="color:#475569;margin-bottom:16px">
    <strong>{{inviterName}}</strong> has created an account for you on Taskinate.
  </p>
  <table style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;background:#f8fafc;margin-bottom:24px;width:100%;border-collapse:collapse">
    <tr><td style="padding:6px 12px;font-weight:600;width:120px">Email</td><td style="padding:6px 12px">{{newUserEmail}}</td></tr>
    <tr><td style="padding:6px 12px;font-weight:600">Password</td><td style="padding:6px 12px;font-family:monospace">{{plainPassword}}</td></tr>
  </table>
  <a href="{{loginUrl}}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Log in to Taskinate</a>
  <p style="color:#94a3b8;font-size:13px;margin-top:24px">Please change your password after your first login.</p>
  <p style="color:#94a3b8;font-size:13px">If you did not expect this invitation, you can safely ignore this email.</p>
</body>
</html>
```

---

### 4. Updated TypeScript template builders

Each `.ts` file drops the inline HTML block and calls `renderTemplate` instead. Subject and plain-text body stay in TypeScript (they are short strings, not worth externalising).

#### `verificationEmail.ts` (after)

```ts
import { renderTemplate } from './render';

export async function buildVerificationEmail({ verificationUrl }: { verificationUrl: string }) {
  const subject = 'Verify your email — Taskinate';
  const text = `Welcome to Taskinate!\n\nPlease verify your email address:\n\n${verificationUrl}\n\nThis link expires in 24 hours.\n\nIf you did not create an account, you can safely ignore this email.`;
  const html = await renderTemplate({ templateName: 'verification', data: { verificationUrl } });
  return { subject, html, text };
}
```

#### `adminInvite.ts` (after)

```ts
import { renderTemplate } from './render';

export async function adminInviteEmail({ inviterName, newUserEmail, plainPassword, loginUrl }: AdminInviteEmailParams) {
  const subject = 'You have been invited to Taskinate';
  const text = [ /* unchanged */ ].join('\n');
  const html = await renderTemplate({ templateName: 'adminInvite', data: { inviterName, newUserEmail, plainPassword, loginUrl } });
  return { subject, html, text };
}
```

> **Note:** Both functions become `async` because `renderTemplate` is async. All call sites that previously used them synchronously must be updated to `await` the result.

---

### 5. Install Handlebars

```sh
bun add handlebars
bun add -d @types/handlebars
```

Handlebars is a minimal, zero-dependency templating engine with no XSS surprises — variable interpolation is HTML-escaped by default (`{{var}}`). Use triple-stash `{{{var}}}` only for the `verificationUrl` and `loginUrl` hrefs where the URL must not be entity-encoded.

---

### 6. Call-site changes

Search for all callers of `buildVerificationEmail` and `adminInviteEmail` and ensure they `await` the now-async functions. Expected locations:

| File | Change |
|------|--------|
| `server/extensions/auth/api/verifyEmail.ts` (or equivalent) | `await buildVerificationEmail(...)` |
| `server/extensions/auth/api/adminCreateUser.ts` | `await adminInviteEmail(...)` |

---

## Files Affected

| File | Action |
|------|--------|
| `server/extensions/email/templates/html/verification.html` | **Create** |
| `server/extensions/email/templates/html/adminInvite.html` | **Create** |
| `server/extensions/email/templates/render.ts` | **Create** |
| `server/extensions/email/templates/verificationEmail.ts` | **Update** — remove inline HTML, call `renderTemplate` |
| `server/extensions/email/templates/adminInvite.ts` | **Update** — remove inline HTML, call `renderTemplate` |
| `server/extensions/auth/api/adminCreateUser.ts` | **Update** — await async `adminInviteEmail` |
| Any other call sites resolved by grep | **Update** — await async builders |
| `package.json` | **Update** — add `handlebars` dependency |

---

## Acceptance Criteria

- [ ] No `.ts` template file contains a `<!DOCTYPE` or `<html` literal string
- [ ] Every email HTML lives in `server/extensions/email/templates/html/*.html`
- [ ] Variables are bound with `{{...}}` (Handlebars) — no `${...}` inside HTML files
- [ ] `renderTemplate` caches compiled templates; a second call with the same `templateName` does not re-read the file
- [ ] All existing email flows (email verification, admin invite) continue to work end-to-end
- [ ] Future email templates (password reset, email-change confirmation, notification emails) must follow the same pattern — documented in a `README.md` in `server/extensions/email/templates/`
