# Mobile push delivery

Source of authority: the app owner's approved 2026-10-22 request to implement notification delivery, followed by approval to prepare the backend migration/PR and local development environment. This extends the notification architecture in `architecture.md` section 10; it does not change board permissions or the web notification model.

## Scope

- Project existing persisted, user-scoped in-app notifications to explicitly registered Android/iOS installations through Firebase Admin.
- Add exact unread totals, environment capability inspection, device registration/rotation, and proof-authenticated revocation after logout/session expiry.
- Keep database changes additive: `0134_mobile_push.ts` creates device and leased-job tables without editing the migration ledger or old migrations.
- Keep privileged credentials outside clients, source history, and new image layers. Prefer runtime-mounted ADC credentials; leave sending disabled by default.
- Provide an API reference, operator/local-test guide, and focused plus real-boundary verification evidence.

## Acceptance criteria

- [x] Unauthenticated device registration is rejected; a signed-in caller registers only their own mapping.
- [x] Reusing an installation requires its proof. Rotation/reassignment and logout share an installation lock; a former user's late logout cannot revoke a new user's mapping.
- [x] Revocation works with installation proof after session expiry and reveals no mapping for incorrect/unknown proofs.
- [x] Unread count excludes hidden `card_updated` rows and returns only the authenticated user's count.
- [x] Existing notification creation queues recipient-specific jobs only when sending is configured and an opted-in installation exists.
- [x] Delivery rechecks device/account/read state and existing notification preferences, includes only scoped routing IDs and generic lock-screen text, and retries transient failures with a bound.
- [x] Invalid-token handling disables only the token actually attempted, preserving concurrent rotation.
- [x] Migration up/down and real API/auth/database behaviour are verified against local test data; no shared database is modified.
- [ ] The branch targets `main`, follows the PR template, includes four-section changelog and explicit validation gaps, and contains no credentials or generated local artefacts.

Evidence for the implementation criteria: [verification results](../tests/mobile-push-verification.md). Live Firebase/APNs UAT is a separate rollout prerequisite. PR process completion is recorded by the PR itself and remains subject to independent review.

## Delivery semantics and exclusions

The database inbox is authoritative. Enqueue follows the existing notification publication hook and is best effort, rather than an atomic outbox with the original card mutation. Once inserted, jobs survive restarts and are claimed with PostgreSQL leases. An uncertain send acknowledgement can still cause duplicate delivery. Push is not a guaranteed immediate-delivery channel.

FCM is a projection of the in-app channel, subject to the same global/board/type preferences plus device opt-in. Email remains independent. No global FCM topics, public notification broadcast, new web notification preference, production deployment, automatic promotion to `stable`, or changes to payment/customer data are authorized by this PR.

Live Firebase/APNs sender validation needs a separately supplied private runtime identity and an opted-in test device. A successful client Firebase console test establishes client delivery only, not backend sender credentials. Any missing live proof is labelled explicitly in the PR evidence.
