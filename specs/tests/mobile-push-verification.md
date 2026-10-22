# Mobile push verification — 2026-10-22

Authority: [approved mobile push scope](../architecture/mobile-push.md). Scenarios: [mobile push scenarios](mobile-push-scenarios.md). Base: `ec9c55db` on `main`. This evidence covers the backend contribution; the mobile client is a separate repository.

## Environment and isolation

- macOS ARM64; Bun 1.4.3; Docker Desktop 4.93.0 / engine 29.8.1 / Compose 5.5.1; local Chrome through Playwright 1.58.2.
- Local Compose PostgreSQL and LocalStack are healthy. All 105 migrations, including `0134_mobile_push`, applied to the fresh development and isolated test databases.
- Integration tests require the exact loopback database `chimedeck_mobile_push_test`; generated users, notifications, devices and jobs are removed after the suite. Migration down/up runs inside a rolled-back test transaction.
- Browser proof creates a synthetic, retained local account. Its login and screenshot stay in ignored `.secrets/`; no customer data, real FCM token or private credential is used.
- API health returned `{"status":"ok"}`; the Vite page returned HTTP 200. The normal local server has push sending disabled. Only the isolated test process enables queueing and injects a fake sender.

## Results

| Gate                     | Command / proof                                                                                                       | Result                                                                                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Locked install           | `bun install --frozen-lockfile`                                                                                       | PASS                                                                                                                                                                                 |
| Focused tests            | `bun test server/extensions/notifications/push`                                                                       | PASS — 11 tests, 52 assertions                                                                                                                                                       |
| Real API / DB / auth     | Local test database and enabled test-only queue configuration; `bun test specs/tests/mobile-push.integration.test.ts` | PASS — 7 tests, 41 assertions                                                                                                                                                        |
| Browser / Playwright     | `bun run specs/tests/mobile-push.browser.ts` with local dev server and push disabled                                  | PASS — UI signup, rejected and valid login, bell inbox, rendered API reference, browser API auth denial/count/capabilities, disabled-sender and malformed-body paths; no page errors |
| Client build             | `bun run build:client`                                                                                                | PASS — existing chunk-size warnings                                                                                                                                                  |
| Typecheck / server build | `bun run typecheck`                                                                                                   | BLOCKED — known baseline; same 456 normalized diagnostics as `ec9c55db`, zero added diagnostics                                                                                      |
| Lint                     | `bun run lint`                                                                                                        | BLOCKED — known baseline; ESLint cannot import the undeclared `typescript-eslint` package on both base and feature                                                                   |
| Change hygiene           | Scoped Prettier, `git diff --check`, staged-file and secret inspection                                                | PASS; private environment, login, screenshots and Firebase credentials excluded                                                                                                      |
| Live backend FCM / APNs  | Real runtime sender identity and opted-in device                                                                      | NOT RUN — owner supplies credential/device and completes rollout scenario 10                                                                                                         |

The isolated suite exercises real HTTP, RS256 authentication, PostgreSQL device ownership/conflict/reassignment and expired-session revocation, unread count isolation, real publication-to-queue deduplication, leases, preference/read suppression, invalid-token rotation and persisted transient retry. Only the final Firebase network call is replaced. Focused tests additionally cover malformed inputs, bounded retry exhaustion and payload privacy. These results do not establish live Firebase/APNs delivery.

## Baseline evidence

The feature and detached base checkout were checked with the same installed dependency tree to isolate source changes. Compare complete TypeScript diagnostic lines after replacing only `(line,column)` locations, keeping duplicates, then sorting. Both produce **456 diagnostics** and SHA-256:

```text
c1be0069adba745431c0a4d4aeaf12235937018551fefe6a8475925c0ea865a6
```

Representative unchanged base errors include `server/extensions/aiContext/api/fileScope/index.ts` (`AuthenticatedRequest` missing and `exactOptionalPropertyTypes` incompatibilities). No diagnostic originates in the new push module. The complete command outputs remain local; this committed digest records their reproducible comparison without publishing machine paths.

Both lint runs stop before examining source:

```text
ESLint: 9.39.3
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'typescript-eslint' imported from eslint.config.js
```

Owner: maintainers of the existing typecheck/lint baseline. Next check: fix or explicitly disposition those upstream gates, then rerun the standard commands. This PR does not claim a green full build or full test suite, and does not change unrelated AI/auth/client source to hide baseline failures.

## Review and rollout limits

No shared database, deployment, production identity or live sender was changed. Feature PRs target `main`; deployment to a shared environment and promotion to `stable` need separate approval. Independent review is pending; the author does not record an approval on behalf of a reviewer.

The app owner owns live two-account/device UAT and runtime credential provisioning. Before enabling a shared sender, apply migration 0134 through the normal reviewed procedure, mount the private credential at runtime, and execute [scenario 10](mobile-push-scenarios.md). The capability endpoint reports configuration presence only. Enqueue is best effort rather than an atomic outbox, and uncertain send acknowledgements can duplicate delivery.
