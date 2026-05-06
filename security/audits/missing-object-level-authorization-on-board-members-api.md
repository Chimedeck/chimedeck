# missing-object-level-authorization-on-board-members-api

## Serveriy (Critical, High, Medium, Low, Warning)

Critical

## Explainnation on the impact

The board-members API is exposed to BOLA/BFLA risk when object-level checks validate token authenticity but do not verify the caller is authorized for the specific `boardId` and requested role mutation. An authenticated low-privilege user can add members, remove members, or promote roles on a board they should not control. In a multi-tenant environment this can collapse tenant boundaries, allow cross-workspace administration, and escalate privileges from member to owner/admin scope. Latest changelog entries in this repository describe documentation updates only for this area, so this loophole should still be treated as unremediated until code-level authorization controls are explicitly shipped. If authorization behavior differs by endpoint variant (REST handler, plugin hook, or event-driven consumer), that ambiguity increases exploitation risk because attackers can target the weakest path.

## How to actually exploit the loop hole

1. Sign in as a low-privilege user that has valid API access but no admin rights on the target board.
2. Capture a legitimate board-members API request (add, remove, or role update) from a board where the user has minimal access.
3. Replace identifiers in the request (for example `boardId` and/or `memberId`) with values belonging to another board outside the caller's authorization boundary.
4. Submit the modified request to the same endpoint with the caller's valid token.
5. Observe whether the server applies the board member mutation without enforcing board-level ownership/admin checks per target board.

## Step by step hypothesis to re-produce the loop whole

1. Prepare two separate workspaces/tenants with at least one board each; keep one board outside the attacking user's authorized scope.
2. Ensure the attacking user can authenticate normally and can issue board-members API calls in at least one allowed board context.
3. Intercept one board-members API request and record the exact request shape (path, method, payload fields, auth headers).
4. Re-send the same request while swapping target object identifiers to the unauthorized board and user/member targets.
5. Repeat for each board-members action surface: add member, remove member, and role change.
6. Check whether responses indicate success and whether member/role state changes occur on the unauthorized board.
7. Document authorization bypass evidence, including whether unauthorized role promotion (for example member -> admin) is accepted on a foreign board.
8. Note whether plugin-triggered or event-sourced membership updates bypass stricter checks in the primary API path; defer that overlap for dedicated follow-up audits.

## Validation result

- Checked with script: `security/scripts/check-board-member-modification-authorization.ts`
- Checked at: `2026-05-06T02:39:46.596Z`
- Base URL: `http://localhost:3000`
- Authenticated account: `replace-test-email@email.com`
- Target board short ID: `7WlfAtA7`
- Target member user ID: `65ee7377f5eb0ee4c72c104e`
- Attempted mutation: `PATCH /api/v1/boards/7WlfAtA7/members/65ee7377f5eb0ee4c72c104e` with body `{ "role": "ADMIN" }`
- Response status: `403`
- Response error: `board-access-denied` (`You do not have access to this board`)
- Mutation accepted: `false`
- Role changed: `false`
- Script verdict: `PASS` (mutation blocked)

## Conclusion

Based on this validation run, the reported board-members object-level authorization bypass was **not reproducible** for the tested account and target board/member combination. The server denied the role-mutation attempt with `403 board-access-denied`, and no member state change occurred.
