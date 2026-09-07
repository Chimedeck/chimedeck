# search-index-cross-workspace-data-leak

## Serveriy (Critical, High, Medium, Low, Warning)

High

## Explainnation on the impact

When the search index or query layer does not hard-filter by the caller's workspace/tenant boundary before returning hits, users can discover board names, card titles, snippets, labels, assignees, and IDs from other workspaces. This is a cross-tenant data leak that enables intelligence gathering, targeted phishing/social engineering, and follow-on unauthorized access attempts through identifier enumeration.

## How to actually exploit the loop hole

1. Sign in as a user in Workspace A with normal search permissions.
2. Submit broad and high-entropy queries that are likely to match content outside Workspace A.
3. Inspect response payloads for foreign board IDs, workspace IDs, card references, or snippets not belonging to Workspace A.
4. Use pagination, sort options, and filter variations to increase result coverage and extract more foreign metadata.
5. Reuse leaked identifiers in other endpoints to test for additional authorization weaknesses.

## Step by step hypothesis to re-produce the loop whole

1. Create two workspaces with different users and ensure no shared members between them.
2. In Workspace B, create boards/cards/comments containing unique marker keywords unlikely to exist in Workspace A.
3. Authenticate as a Workspace A user and call the search endpoint with those marker keywords.
4. Capture search responses and check whether any hit references Workspace B entities.
5. Repeat with partial keyword fragments, wildcard-like terms, and common tokens to test index broadness.
6. Iterate with pagination (`page`, `limit`, cursor) and ordering changes to detect additional leakage windows.
7. Verify whether each leaked record lacks tenant/workspace-level filtering in the response path.
8. Document leaked fields, counts, and endpoint parameters that consistently reproduce cross-workspace exposure.

## Validation result

- Checked with script: `security/scripts/check-search-index-cross-workspace-data-leak.ts`
- Checked at: `2026-05-06T03:00:12.347Z`
- Base URL: `http://localhost:3000`
- Admin account: `admin-email@email.com`
- Normal account: `replace-test-email@email.com`
- Pristine account: `replace-test-email+test@email.com`
- Forbidden board short ID: `7WlfAtA7`
- Forbidden card short ID: `QqOnIdEz`
- Marker query used: `7WlfAtA7 QqOnIdEz abnplus carousel`

- Admin reference checks:
	- `GET /api/v1/boards/7WlfAtA7` -> `200`
	- `GET /api/v1/cards/QqOnIdEz` -> `200`

- Normal account results:
	- Baseline forbidden direct reads:
		- board -> `403`
		- card -> `403`
	- Workspace search (`GET /api/v1/workspaces/journeyhorizon/search?...`) -> `200`, result count `0`
	- Board search (`GET /api/v1/boards/7WlfAtA7/search?...`) -> `403`
	- Forbidden board/card identifiers leaked in results: `false`

- Pristine account results:
	- Baseline forbidden direct reads:
		- board -> `403`
		- card -> `403`
	- Workspace search (`GET /api/v1/workspaces/journeyhorizon/search?...`) -> `200`, result count `0`
	- Board search (`GET /api/v1/boards/7WlfAtA7/search?...`) -> `403`
	- Forbidden board/card identifiers leaked in results: `false`

- Script verdict: `vulnerable = false`

## Conclusion

For this run, the cross-workspace search data-leak scenario was **not reproduced**. Both the normal and pristine accounts were denied direct access to the forbidden board/card (`403`), and search responses did not return leaked identifiers or content from the forbidden resources.
