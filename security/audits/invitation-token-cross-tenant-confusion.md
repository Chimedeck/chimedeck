# invitation-token-cross-tenant-confusion

## Serveriy (Critical, High, Medium, Low, Warning)

High

## Explainnation on the impact

This loophole maps to OWASP A01:2026 Broken Access Control and trust-boundary confusion. Invitation acceptance is a strict tenant boundary: token validity controls (signature, TTL, single-use) are not enough if the server does not enforce exact match between token claims (`workspaceId`, optional `boardId`, audience) and request tenant context (host/subdomain, workspace slug, route params, callback metadata). If any acceptance surface skips this context binding, an invite minted for Workspace B can be redeemed from Workspace A context, creating wrong-tenant membership, incorrect role assignment, or disclosure of Workspace B private board/workspace data. This violates isolation expectations that guests only access explicitly granted boards within the invited workspace.

## How to actually exploit the loop hole

1. Obtain one valid invitation token issued for Workspace B.
2. Authenticate as a user from Workspace A that has no membership in Workspace B.
3. Replay invite acceptance while keeping the Workspace B token constant and forcing Workspace A context (subdomain/host/slug/path/body/callback fields).
4. Mutate only one context dimension per request (workspace slug, host, board id, callback audience) to identify weakest validation path.
5. Repeat across all acceptance surfaces (UI route, direct API endpoint, callback flow, admin invite acceptance, plugin/extension-mediated flow if enabled).
6. The loophole is exploitable if any surface accepts the invite, creates `board_guest_access`/membership side effects, grants role, or discloses Workspace B private data without rejecting tenant-context mismatch.

## Step by step hypothesis to re-produce the loop whole

1. Prepare two isolated workspaces (A and B) with no shared members.
2. In Workspace B, issue one workspace invitation token and one board invitation token.
3. Authenticate as a Workspace A user and keep that session active.
4. Trigger acceptance of the Workspace B token from Workspace A URL/context.
5. Re-run acceptance by mutating one context input at a time: workspace slug, tenant/workspace id, board id, callback metadata/audience, and host/subdomain.
6. Execute the same token across all available acceptance entry points (UI, API, callback, admin invite path, plugin path if present).
7. Inspect database and API side effects after each attempt (`memberships`, `board_members`, `board_guest_access`, activity events) to detect wrong-tenant writes.
8. Confirm cross-tenant read impact by attempting to open Workspace B board/workspace data from the Workspace A session after acceptance.
9. Mark as vulnerable if any run creates membership, grants board/workspace role, or returns Workspace B private data while request context remains Workspace A.

## Validation result

- Checked with script: `security/scripts/check-invitation-token-cross-tenant-confusion.ts`
- Checked at: `2026-05-06T02:47:33.411Z`
- Base URL: `http://localhost:3000`
- Normal account: `replace-test-email@email.com`
- Admin account: `admin-email@email.com`
- Forbidden board short ID: `7WlfAtA7`
- Forbidden card short ID: `QqOnIdEz`
- Invite inspect: `200` (workspace_id: `journeyhorizon`, invite unused at inspect time)
- Baseline access before accept:
	- Board `GET /api/v1/boards/7WlfAtA7` -> `403`
	- Card `GET /api/v1/cards/QqOnIdEz` -> `403`
	- Workspace `GET /api/v1/workspaces/journeyhorizon` -> `200`
- Context-mismatched accept attempt:
	- Request: `POST /api/v1/invites/:token/accept`
	- Forced mismatched context hints in headers/body (host/slug/workspace/tenant/audience)
	- Response: `200`
- Post-accept access:
	- Board `GET /api/v1/boards/7WlfAtA7` -> `403`
	- Card `GET /api/v1/cards/QqOnIdEz` -> `403`
	- Workspace `GET /api/v1/workspaces/journeyhorizon` -> `200`
- Script verdict: `vulnerable = false`

## Validation result (latest run, isolated non-member account)

- Checked with script: `security/scripts/check-invitation-token-cross-tenant-confusion.ts`
- Checked at: `2026-05-06T02:52:55.960Z`
- Base URL: `http://localhost:3000`
- Normal account: `replace-test-email+test@email.com` (new account, not a workspace member before test)
- Admin account: `admin-email@email.com`
- Forbidden board short ID: `7WlfAtA7`
- Forbidden card short ID: `QqOnIdEz`
- Invite inspect: `200` (workspace_id: `journeyhorizon`, invite unused at inspect time)
- Baseline access before accept:
	- Board `GET /api/v1/boards/7WlfAtA7` -> `403`
	- Card `GET /api/v1/cards/QqOnIdEz` -> `403`
	- Workspace `GET /api/v1/workspaces/journeyhorizon` -> `403`
- Context-mismatched accept attempt:
	- Request: `POST /api/v1/invites/:token/accept`
	- Forced mismatched context hints in headers/body (host/slug/workspace/tenant/audience)
	- Response: `200`
- Post-accept access:
	- Board `GET /api/v1/boards/7WlfAtA7` -> `403`
	- Card `GET /api/v1/cards/QqOnIdEz` -> `403`
	- Workspace `GET /api/v1/workspaces/journeyhorizon` -> `200`
- Effect observed: workspace membership was granted after context-mismatched acceptance (`workspaceStatus 403 -> 200`)
- Script verdict: `vulnerable = true`

## Conclusion

Latest run indicates this issue is **reproducible** as Broken Access Control / trust-boundary confusion: a non-member account (`replace-test-email+test@email.com`) successfully accepted a workspace invite (`200`) even when the request carried intentionally mismatched tenant context hints, and gained workspace-level access (`GET /api/v1/workspaces/journeyhorizon` changed from `403` to `200`).

For this specific test, direct access to the provided forbidden board/card stayed denied (`403`), so the confirmed impact here is wrong-context membership grant rather than immediate board/card data disclosure.
