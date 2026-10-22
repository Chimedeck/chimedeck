# Mobile push scenarios

Authority and acceptance criteria: [Mobile push delivery](../architecture/mobile-push.md).

Use only the isolated local database and synthetic accounts. Store temporary login material outside tracked files. Never run these scenarios against a shared database or real customer account.

1. Register locally and authenticate through the existing auth boundary. Verify a request without a token cannot register a device or read another user's unread total.
2. Register an installation with a strong proof and a synthetic FCM token. Inspect the database: the user comes from authentication, the proof is hashed, and only one environment/token mapping exists.
3. Rotate that installation's token with the same proof. Reject a different proof without changing the mapping.
4. Reassign the installation by logging in with another local account and the matching installation proof. Submit an expired-session revocation for the former account and confirm the new mapping stays enabled.
5. Revoke with the current proof and user. Wrong/unknown proofs have the same empty HTTP response, and malformed bodies return a bounded structured error.
6. Insert synthetic visible/hidden/read notification rows for the two accounts. Verify exact unread count includes only the caller's visible unread records.
7. Publish one existing notification-created envelope and verify one queued job per opted-in device, with duplicate publication deduplicated by the database unique key.
8. Claim/process the queued job with an injected fake Firebase sender in the focused test harness. Verify success removal, revoked/read/muted recipient suppression, invalid-token invalidation, transient retry/backoff, and final failure marking.
9. Run the local web app in a real browser: valid and rejected login, notification/API docs reachability, and no regression to the existing shell. Record screenshots/evidence outside source or as synthetic-only PR evidence.
10. With separately supplied Firebase credentials, register a real test device and trigger a board event from a second test account. Check foreground deduplication, background tap, permission denial, logout, and environment isolation. This scenario is not implied by mocked sends or console-only client testing.
