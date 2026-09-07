# cross-tenant-card-idor

## Serveriy (Critical, High, Medium, Low, Warning)

Critical

## Explainnation on the impact

This loophole maps to OWASP A01:2026 Broken Access Control (IDOR/BOLA). Multi-tenant requirements define that cards are strictly bound to their parent board and workspace authorization context. If the server resolves a `cardId` without enforcing tenant ownership and board-level membership checks, a user in Workspace A can read or modify cards that belong to Workspace B. Impact includes exposure of sensitive cross-tenant task data (titles, descriptions, assignees, due dates, comments, attachment metadata) and unauthorized state mutation (edit, move, archive, delete), directly violating confidentiality and data integrity.

## How to actually exploit the loop hole

1. Authenticate as a normal user in Workspace A.
2. Use a standard card endpoint that accepts a card identifier (read or write operation).
3. Obtain a valid `cardId` from Workspace B through any exposed identifier path.
4. Replace the original card identifier in the request with the Workspace B `cardId`.
5. Submit the modified request while keeping Workspace A authentication unchanged.
6. The loophole is confirmed if card data from Workspace B is returned or mutation is accepted.

## Step by step hypothesis to re-produce the loop whole

1. Prepare two isolated workspaces: Workspace A (attacker) and Workspace B (target), with no shared membership.
2. Ensure Workspace B contains one or more cards on a board inaccessible to Workspace A.
3. Authenticate as Workspace A only.
4. Send a normal card request for a Workspace A card and note the request structure.
5. Duplicate the request and replace only the identifier with a Workspace B `cardId`.
6. Submit the modified request with unchanged authentication context.
7. Observe whether Workspace B card content is returned or whether card state is modified.
8. If cross-tenant read or write succeeds, classify as confirmed cross-tenant card IDOR.

## Validation result

- Checked with script: `security/scripts/check-cross-tenant-board-card-idor.ts`
- Checked at: `2026-05-06T02:27:02.444Z`
- Authenticated account: `replace-test-email@email.com`
- Target card short ID: `QqOnIdEz`
- Request used: `GET /api/v1/cards/QqOnIdEz`
- Response status: `403`
- Response error: `board-access-denied` (`You do not have access to this board`)
- Verdict: **Not reproducible in this run** (no cross-tenant card access observed)
