# Notifications and mobile push

For a fresh local test environment and verification commands, see [Test mobile push locally](MOBILE_PUSH_LOCAL.md).

Local setup is optional. To avoid Docker on the development Mac, deploy this branch and migration on an existing test/staging backend, configure its development Firebase sender, and use the mobile app or a Google Play-enabled Android emulator against that hosted API. The Mac then runs only Flutter/Android tools; the five-second push worker runs on the backend host.

The app includes a paginated bell inbox, read/unread actions, mark all read, delete/clear, account notification settings, and optional device alerts. Refresh/load-more keep confirmed rows. Card/comment notifications open the existing nested card/Activity/thread routes; Back returns to the inbox.

## Delivery paths

- REST remains the inbox authority. Existing notification APIs work without the new push sender. New server code adds an exact unread count; older servers use an unread dot.
- A foreground native WebSocket receives the existing user-scoped `notification_created` event. It authenticates by header, answers heartbeat, reconnects with backoff, and refreshes after reconnect. Disconnected foreground sessions poll every 30 seconds. Background polling is not used.
- Firebase Messaging receives native push. Foreground messages and WebSocket messages share persisted ID deduplication before displaying a local notification. Initial history fetches never generate alerts.
- Device alerts default off. The permission dialog appears only after the user enables Device notifications in Settings. Startup checks existing permission without prompting.
- Native FCM/APNs displays background notification payloads. The background Dart handler does not show another local notification. On resume, the app refreshes the inbox.
- Notification targets contain IDs, the recipient user, and development/production environment. The app rejects a target for a different account or environment. Realtime rows missing reply context are hydrated before opening a thread.
- Opt-in and deduplication storage are scoped to account/server/environment. The installation has a random revocation proof stored in secure storage; the backend keeps only its hash. Logout attempts server revocation, removes local alerts/token, and locks the app session even when offline. Delivery operations are serialized across account changes. Offline revocation can take effect later; lock-screen push copy contains no comment text or card title.

No global FCM topics expose private board activity. Board/card realtime editing and an offline mutation queue are not included.

## Backend installation

These changes extend the existing notification flow and remain disabled until configured. Review/apply the migration before deployment. The mobile client is maintained separately in the Chimedeck app repository.

1. Review/apply the backend changes and install its locked dependencies with `bun install --frozen-lockfile`.
2. Apply migration `0134_mobile_push.ts` using the backend's normal reviewed migration procedure. It creates `notification_devices` and `notification_push_jobs`. Apply it before enabling the sender.
3. Configure the backend environment shown below using private deployment configuration.
4. Restart the backend, verify authenticated `GET /api/v1/notifications/push-capabilities`, then enable device notifications from the app.

| Backend variable                           | Meaning                                                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MOBILE_PUSH_ENABLED`                      | Defaults false; set true only after migration and credential setup.                                                                               |
| `MOBILE_PUSH_DEVELOPMENT_CREDENTIALS_JSON` | Private Firebase Admin service-account JSON for the development Firebase project, or the literal `application-default` on an ADC-configured host. |
| `MOBILE_PUSH_PRODUCTION_CREDENTIALS_JSON`  | The corresponding production project credential/ADC option.                                                                                       |

Use an identity authorized to send Firebase Cloud Messaging messages to the intended project. Distribution-only permissions do not grant push delivery. Keep these values off the client and out of tracked files. See [Firebase sender authorization](https://firebase.google.com/docs/cloud-messaging/send/v1-api).

## Keep the Firebase credential private

Prefer Application Default Credentials (ADC) backed by a credential file mounted at runtime, or a workload identity supported by your host. Store the service-account JSON outside the checkout and restrict it to the backend runtime user. The development Firebase project and service account must match the app configuration and have FCM send permission.

For a locally running Bun server, set these in the ignored local environment (only a path is stored):

```dotenv
MOBILE_PUSH_ENABLED=true
MOBILE_PUSH_DEVELOPMENT_CREDENTIALS_JSON=application-default
GOOGLE_APPLICATION_CREDENTIALS=/absolute/private/path/firebase-development.json
```

For containers, `docker-compose.mobile-push.example.yml` shows a read-only runtime secret mount. Set its `MOBILE_PUSH_DEVELOPMENT_CREDENTIALS_FILE` interpolation variable to the external host file and combine it with the base Compose file used on that host. Ensure the non-root app user can read the mounted file. This does not upload a key or change an existing deployment by itself.

The current legacy Dockerfile copies `.env` into the image. Do not put the raw push private-key JSON in that file when building an image: supply the ADC marker/path through runtime configuration and mount the JSON separately. `.gitignore` and `.dockerignore` exclude `.secrets/`, service-account files, and generated `.env.json`; no credential is included in this PR. Base64 is an encoding, not protection for a private key.

If development and production use distinct Firebase projects on one process, use separately scoped injected credentials for each environment; the single `GOOGLE_APPLICATION_CREDENTIALS` ADC identity applies to both ADC-backed instances. Keep production sending unconfigured until its identity/target is explicitly set. On a compatible managed host, workload identity removes the need for a downloaded private key. See [Firebase ADC setup](https://firebase.google.com/docs/admin/setup).

## Delivery worker

The existing notification creation flow queues one job per enabled recipient device. A five-second worker claims jobs with database leases, rechecks device/account/read state and current global/board/type preferences, and sends through the Firebase Admin SDK. Invalid tokens disable only the matching attempted registration. Transient errors use exponential retry, with eight attempts before marking a job failed. Registered development and production devices use separate Firebase app instances/credentials.

Once queued, jobs survive restarts. Enqueue failures are logged safely and do not fail the originating card/comment write; inbox history remains available. This is best-effort push delivery, with possible duplicates after an uncertain send acknowledgement. FCM collapse IDs and client ID deduplication reduce repeats. No push sender or database migration was run against a deployed environment during local implementation.

## Native setup

Android includes notification permission, a high-importance Card activity channel, a monochrome small icon, disabled FCM auto-init until opt-in, and Java desugaring. Keep the private Firebase JSON matched to the selected environment. Android 13+ asks permission when Device notifications is enabled.

For each iOS bundle identifier:

1. Enable Push Notifications in Apple Developer identifiers.
2. Configure an APNs authentication key in the matching Firebase project's Cloud Messaging settings. This is separate from an App Store Connect upload key and the distribution certificate.
3. Reuse an existing valid signing profile if it already contains the matching App ID and `aps-environment` entitlement. Regenerate/download/replace it only when the required push entitlement is absent, the capability changed after profile generation, or the profile is invalid/expired. Creating an APNs authentication key alone does not require regenerating the profile.
4. Build with the corresponding native flavor and private Firebase plist. Debug uses the development APNs entitlement; Profile/Release use production. The app includes remote-notification background mode and the notification delegate needed for its scene lifecycle.

Follow [Firebase Flutter setup](https://firebase.google.com/docs/cloud-messaging/flutter/get-started). Existing signing profiles without push capability will need replacement. No App Store Connect, Apple Developer, Firebase console, or live signing-account changes were made by this task.

## API additions

Existing reads/actions retain their methods and envelopes. New backend endpoints are:

| Method/path                                      | Contract                                                                                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET `/api/v1/notifications/unread-count`         | Authenticated; `data.count` is the caller's unread total, excluding hidden `card_updated` records.                                                                                   |
| GET `/api/v1/notifications/push-capabilities`    | Authenticated; `data.development` / `data.production` indicate sender configuration.                                                                                                 |
| PUT `/api/v1/notifications/devices`              | Authenticated; installation ID/proof, FCM token, platform, environment. User ID comes from the authenticated session.                                                                |
| POST `/api/v1/notifications/devices/{id}/revoke` | Installation proof and expected user ID; permits revocation after the login session expires. Wrong/unknown proofs return the same empty response without modifying the registration. |

A later login can reassign its own installation only with the matching proof. A delayed old-account revocation cannot disable a registration already reassigned to a different account. Server credentials never appear in these responses.

## Device verification before rollout

After backend/APNs setup, use test accounts and devices to check mention/comment/reaction/move alerts, foreground deduplication, background/terminated taps into a reply thread, permission denial/re-enable, read state, token rotation, logout/account switching, and both environment builds. OS permission, connectivity, force-stop behavior, and platform delivery policy still apply; push is not a guaranteed immediate-delivery channel.

Local automated tests use fake Firebase delivery and an isolated loopback WebSocket. They do not establish live FCM/APNs delivery. Simulator builds were skipped by request.
