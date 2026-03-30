# Client Monitoring — Sentry React SDK

This module initialises and wraps the Sentry React SDK so that all monitoring concerns are isolated from feature code.

## Files

| File | Purpose |
|---|---|
| `sentryClient.ts` | `initSentry()` boot helper + `captureError` / `captureMessage` utilities + `beforeSend` noise filter |
| `ErrorBoundary.tsx` | Top-level React error boundary — catches render errors and shows recovery UI |

## Feature Flags

All Sentry behaviour is controlled via environment variables (exposed through `src/config/index.ts`).

| Variable | Default | Purpose |
|---|---|---|
| `VITE_SENTRY_CLIENT_ENABLED` | `false` | Master switch — Sentry is never initialised unless this is `true` |
| `VITE_SENTRY_CLIENT_DSN` | `` | Sentry project DSN; an empty string disables capture even when enabled |
| `VITE_SENTRY_ENV` | `development` | Environment tag sent with every event (`production`, `staging`, etc.) |
| `VITE_SENTRY_RELEASE` | `` | Release identifier (git SHA / semver) for source map correlation |
| `VITE_SENTRY_REPLAY_ENABLED` | `false` | Opt-in session replay (bandwidth-intensive; off by default) |

### Safe defaults

- Sentry is **never** initialised in local dev unless you explicitly set both flags in your `.env`.
- `sendDefaultPii` is `false` — Sentry will not auto-collect IP addresses or request bodies.
- Session Replay masks all text and blocks all media by default to prevent accidental PII capture.

## Usage

### ErrorBoundary

`<ErrorBoundary>` is wired at the root in `src/main.tsx`, wrapping the entire component tree. Any unhandled render error is caught, reported to Sentry, and replaced with a recovery UI so the user is never left with a blank screen.

```tsx
// Already in main.tsx — no action needed for the global boundary.
// For feature-level boundaries, import and reuse the same component:
import { ErrorBoundary } from '~/common/monitoring/ErrorBoundary';

<ErrorBoundary>
  <RiskyFeatureComponent />
</ErrorBoundary>
```

### Capturing errors manually

```ts
import { captureError, captureMessage } from '~/common/monitoring/sentryClient';

try {
  riskyOperation();
} catch (err) {
  captureError(err);
  throw err; // re-throw if the caller needs to handle it
}

// Informational messages
captureMessage('Payment flow reached retry state', 'warning');
```

## Noise filtering (`beforeSend`)

`sentryClient.ts` registers a `beforeSend` hook that drops known noisy browser errors before they reach Sentry's ingest. The following patterns are filtered:

| Pattern | Reason |
|---|---|
| `ResizeObserver loop limit exceeded` | Browser-internal, no stack, not actionable |
| `Failed to fetch / NetworkError / Load failed` | Network connectivity issues outside app control |
| `Script error.` | Cross-origin script errors with no usable info |
| `ChunkLoadError / Loading chunk N failed` | Stale bundle after deploy; a reload fixes it |
| `QuotaExceededError` | Safari private-browsing storage limit; not our bug |

> **To add a new filter:** append a `RegExp` to `IGNORED_ERROR_PATTERNS` in `sentryClient.ts` with a comment explaining why.

## Manual smoke test

1. Set in `.env`:
   ```
   VITE_SENTRY_CLIENT_ENABLED=true
   VITE_SENTRY_CLIENT_DSN=<your-dsn>
   VITE_SENTRY_ENV=development
   ```
2. Add a temporary throw inside a component render:
   ```ts
   throw new Error('Sentry smoke test');
   ```
3. Start dev server (`bun run dev`) — the ErrorBoundary recovery UI should appear and the event should show in Sentry.
4. Remove the throw and confirm no events are sent when `VITE_SENTRY_CLIENT_ENABLED=false`.
5. Test noise filtering: throw `new Error('Script error.')` and confirm it does **not** appear in Sentry.

## Privacy policy

- No PII is collected by default (`sendDefaultPii: false`).
- Replay sessions mask all visible text and block media.
- Do **not** log user passwords, tokens, or personal data via `captureMessage`.
- If you need to attach user context (e.g. for support triage), use `Sentry.setUser({ id })` — never include email or name unless your privacy policy explicitly permits it.
