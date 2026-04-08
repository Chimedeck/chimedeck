# Sprint 123 — Sentry Monitoring (Client + Server)

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 15 (UI Foundation), Sprint 03 (Authentication), Sprint 58 (Observability)
> **Status:** ⬜ Future

---

## Goal

Add Sentry as the primary error monitoring and distributed tracing platform for both runtime layers:

- React client (browser errors, route transitions, UI performance)
- Bun server (API exceptions, unhandled errors, request traces)

After this sprint, production incidents should be visible in one place with environment and release tags, and stack traces should be deobfuscated through uploaded source maps.

---

## Scope

### 1. Sentry SDK wiring for client (React + Vite)

Add browser-side Sentry initialization with explicit opt-in via env/flag:

- `VITE_SENTRY_DSN`
- `VITE_SENTRY_ENVIRONMENT`
- `VITE_SENTRY_TRACES_SAMPLE_RATE`
- `VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE`
- `VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE`
- `VITE_SENTRY_CLIENT_ENABLED`

Client bootstrap requirements:

- Initialize Sentry before app render in `src/main.tsx`
- Add React integration (`@sentry/react`), browser tracing, and optional replay
- Ensure route-change transactions are captured through React Router instrumentation
- Add top-level error boundary so render/runtime errors are captured with component stack context

### 2. Sentry SDK wiring for server (Bun runtime)

Add server-side initialization and request/error capture using Bun-compatible Sentry SDK:

- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_RELEASE`
- `SENTRY_TRACES_SAMPLE_RATE`
- `SENTRY_SERVER_ENABLED`

Server bootstrap requirements:

- Initialize Sentry at process startup in server entry path before routes are mounted
- Capture unhandled errors and promise rejections
- Capture exceptions from API handlers and include request context (method, path, user id when available)
- Ensure auth middleware and global error middleware preserve existing response shape while still reporting to Sentry

### 3. Unified release and environment tagging

Client and server events must share the same:

- `environment` value (`local`, `staging`, `production`)
- `release` value (commit SHA or CI release id)

This enables cross-layer triage for the same incident (frontend error correlated with backend trace).

### 4. Source map strategy (client and server)

- Add Sentry Vite plugin for client build source map upload
- Ensure uploaded artifacts use the same `release` as runtime events
- Add CI step or build script to upload source maps during deploy
- Verify source map upload does not run in local dev by default

### 5. Privacy and filtering guards

Before events leave the app:

- Redact secrets/tokens in request headers and query params
- Avoid sending sensitive payload bodies by default
- Drop noisy known-non-actionable browser errors (extension/script noise)
- Keep user identification minimal (id/email hash policy documented)

### 6. Feature-flag behavior

Sentry must be safe to disable independently per tier:

- `SENTRY_CLIENT_ENABLED=false` => no browser Sentry initialization
- `SENTRY_SERVER_ENABLED=false` => no server Sentry initialization

When disabled, application behavior remains unchanged and no runtime errors are introduced.

---

## Files Affected

| File | Action |
| ---- | ------ |
| `src/main.tsx` | **Update** — initialize Sentry client and mount ErrorBoundary |
| `src/config/index.ts` | **Update** — centralize Vite Sentry env values |
| `vite.config.ts` | **Update** — Sentry Vite plugin + source map upload config |
| `server/index.ts` | **Update** — initialize Sentry server early in startup |
| `server/config/env.ts` | **Update** — add server Sentry env keys |
| `server/common/monitoring/sentry.ts` | **Create** — shared Sentry init and capture helpers |
| `server/common/middlewares/errorHandler.ts` (or current global error layer) | **Update** — capture exceptions before standard error envelope return |
| `package.json` | **Update** — add Sentry SDK and build plugin deps/scripts |
| `.env.example` (if present) | **Update** — document Sentry env variables |
| `README.md` | **Update** — setup and operational guidance |

---

## Acceptance Criteria

- [ ] Client errors thrown in React components appear in Sentry with environment and release tags
- [ ] Client route traces are visible when tracing is enabled
- [ ] Server exceptions (sync and async) are captured in Sentry with route metadata
- [ ] Existing API error response shape remains unchanged (`{ name, data? }`)
- [ ] Source maps are uploaded for deploy builds and stack traces are deobfuscated in Sentry
- [ ] `SENTRY_CLIENT_ENABLED=false` fully disables client SDK init
- [ ] `SENTRY_SERVER_ENABLED=false` fully disables server SDK init
- [ ] No auth tokens, secrets, or sensitive payload fields are sent to Sentry
- [ ] Manual smoke test confirms one intentional client error and one intentional server error both arrive in Sentry

---

## Validation Plan

No need to validate this