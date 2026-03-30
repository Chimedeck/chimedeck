# Email Templates

This directory contains all email templates used by the Taskinate server.

## Pattern

Each email is composed of:

1. **A `.ts` builder file** (e.g. `verificationEmail.ts`) — exports an `async` function that builds `{ subject, html, text }`. The HTML body is rendered via `renderTemplate`.
2. **An `.html` template file** under `html/` — contains the full HTML document with [Handlebars](https://handlebarsjs.com/) `{{variable}}` placeholders for all dynamic values.

## Adding a new email template

1. Create `html/<templateName>.html` with the HTML content. Use `{{variableName}}` for dynamic values.
2. Create `<templateName>.ts` exporting an `async` builder function:

```ts
import { renderTemplate } from './render';

export async function buildMyEmail({ foo, bar }: Input): Promise<{ subject: string; html: string; text: string }> {
  const subject = 'My subject';
  const text = `Plain text fallback using ${foo}`;
  const html = await renderTemplate({ templateName: 'myEmail', data: { foo, bar } });
  return { subject, html, text };
}
```

3. Import and `await` the builder at the call site.

## Templates

| Template name               | Builder file                    | Description                              |
|-----------------------------|---------------------------------|------------------------------------------|
| `verification`              | `verificationEmail.ts`          | Email verification on signup             |
| `adminInvite`               | `adminInvite.ts`                | Admin invitation with temporary password |
| `emailChangeConfirmation`   | `emailChangeConfirmation.ts`    | Confirm a requested email address change |
| `passwordResetEmail`        | `passwordResetEmail.ts`         | Password reset link                      |

## renderTemplate helper

`render.ts` exposes `renderTemplate({ templateName, data })`:

- Reads the `.html` file from `html/<templateName>.html` using `Bun.file` (Bun-native I/O).
- Compiles the template with Handlebars and caches the compiled function in a module-level `Map` — subsequent sends skip disk I/O entirely.
- Uses `import.meta.dir` to resolve the `html/` path relative to this file, regardless of the process working directory.

## Why Handlebars instead of template literals?

- HTML lives in `.html` files, enabling editor syntax highlighting and lint tooling.
- `{{variable}}` syntax is auto-escaped by Handlebars, reducing XSS risk.
- Templates can be updated without touching TypeScript source.
- Supports conditionals (`{{#if}}`) and loops (`{{#each}}`) when needed, without polluting business logic.
