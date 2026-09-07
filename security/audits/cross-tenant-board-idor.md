# cross-tenant-board-idor

## Serveriy (Critical, High, Medium, Low, Warning)

High

## Explainnation on the impact

This loophole maps to OWASP A01:2026 Broken Access Control (IDOR/BOLA). Multi-tenant requirements define that boards are isolated by workspace and by board-level membership/visibility. If server authorization checks only whether a `boardId` exists and does not verify tenant context plus caller membership, a user from Workspace A can access or change a board owned by Workspace B. The impact is cross-tenant exposure of board metadata, activity, and membership details, plus unauthorized board mutation (rename, visibility changes, archival state changes, and member management), which breaks confidentiality and integrity guarantees.

## How to actually exploit the loop hole

1. Authenticate as a normal user in Workspace A.
2. Use any normal board endpoint that accepts a board identifier (read or write operation).
3. Obtain a valid `boardId` belonging to Workspace B from any exposed reference path.
4. Replace the original board identifier in the request with the Workspace B `boardId`.
5. Send the modified request while still authenticated only as the Workspace A user.
6. The loophole is confirmed if the server returns Workspace B board data or accepts board changes.

## Step by step hypothesis to re-produce the loop whole

1. Prepare two isolated workspaces with no shared members: Workspace A (attacker) and Workspace B (target).
2. Ensure Workspace B contains at least one private board.
3. Authenticate as a Workspace A user only.
4. Issue a valid board request for a board in Workspace A and record the request shape.
5. Duplicate that request and substitute only the identifier with Workspace B `boardId`.
6. Submit the modified request without changing authentication context.
7. Observe whether board data from Workspace B is returned or whether board state is changed.
8. If access or mutation succeeds across tenant boundaries, classify as confirmed cross-tenant board IDOR.

## Validation result

- Checked with script: `security/scripts/check-cross-tenant-board-card-idor.ts`
- Checked at: `2026-05-06T02:27:02.444Z`
- Authenticated account: `replace-test-email@email.com`
- Target board short ID: `7WlfAtA7`
- Request used: `GET /api/v1/boards/7WlfAtA7`
- Response status: `403`
- Response error: `board-access-denied` (`You do not have access to this board`)
- Verdict: **Not reproducible in this run** (no cross-tenant board access observed)
