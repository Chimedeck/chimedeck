# api-token-overbroad-scope-and-horizontal-privilege-escalation

## Serveriy (Critical, High, Medium, Low, Warning)

High

## Explainnation on the impact

If API tokens are validated only for authenticity but not constrained by workspace and board authorization context, a user can use a valid token from Workspace A to perform read/write actions against resources in Workspace B. This creates horizontal privilege escalation, breaks multi-tenant isolation, and can result in unauthorized board membership changes, task/card mutations, and exposure of tenant-confidential project metadata.

## How to actually exploit the loop hole

1. Authenticate as a low-privilege user in Workspace A and generate an API token intended for limited automation use.
2. Capture valid API request shapes for board, card, and membership endpoints.
3. Replace authorized resource identifiers with known or guessed identifiers from another workspace.
4. Replay the same requests using the low-privilege token and observe whether the server accepts operations outside the token owner's tenant boundary.
5. Use the accepted cross-workspace access to enumerate additional resource IDs and chain further unauthorized actions.

## Step by step hypothesis to re-produce the loop whole

1. Prepare two isolated workspaces (Workspace A and Workspace B) with different users and boards.
2. Ensure the attacker user belongs only to Workspace A and has no membership or guest access in Workspace B.
3. Issue an API token for the attacker account from Workspace A.
4. Send baseline requests that legitimately access Workspace A resources to confirm the token works.
5. Repeat those requests with Workspace B board/card/member identifiers while keeping the same token.
6. Attempt both read and write operations (for example: board details read, card update, member add/remove).
7. Record any successful response (`200/201/204`) or visible state mutation on Workspace B resources.
8. Confirm the root condition by comparing behavior with session-based JWT checks and documenting scope enforcement mismatch for token-authenticated routes.

## Validation result

- Checked with script: `security/scripts/check-api-token-overbroad-scope.ts`
- Checked at: `2026-05-06T02:56:42.968Z`
- Base URL: `http://localhost:3000`
- Normal account: `replace-test-email@email.com`
- Admin account: `admin-email@email.com`
- Forbidden board short ID: `7WlfAtA7`
- Forbidden card short ID: `QqOnIdEz`

- Token setup:
	- API token created successfully: `true`
	- Baseline token validity check (`GET /api/v1/tokens` with API token): `200`

- JWT reference behavior (same user):
	- `GET /api/v1/boards/7WlfAtA7` -> `403`
	- `GET /api/v1/cards/QqOnIdEz` -> `403`
	- `POST /api/v1/boards/7WlfAtA7/follow` -> `403`

- API token behavior (same user):
	- `GET /api/v1/boards/7WlfAtA7` -> `403`
	- `GET /api/v1/cards/QqOnIdEz` -> `403`
	- `POST /api/v1/boards/7WlfAtA7/follow` -> `403`
	- Error payload on write probe: `board-access-denied`

- Script verdict: `vulnerable = false`

## Conclusion

For this run, the API token was valid but did **not** allow operations outside the token owner's tenant boundary on the tested forbidden resources. Read and write probes remained denied (`403`) and matched JWT session behavior, so this specific overbroad-scope / horizontal-privilege-escalation hypothesis was **not reproduced** in current environment.
