# Sprint 86 - Access-Aware Board Search Results

> **Status:** Future sprint - not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 13 (Search & Presence), Sprint 77 (Granular Search), Sprint 78 (Board Visibility Enforcement)
> **References:** [requirements.md](../architecture/requirements.md)

---

## Goal

Fix search behavior where a board appears in results but fails to open. Search must hide boards the current user cannot access.

This sprint delivers:
- Permission-filtered board search results
- Server-side hard filtering for unauthorized boards
- Client-side guard for stale cached search items

---

## Scope

### 1. Server-Side Permission Filtering

Update board search query so results are filtered by effective board access rights.

Rules:
- Search response must include only boards user can access
- Private boards require explicit membership or granted access
- Unauthorized boards are excluded instead of returned with later failure

### 2. Board Open Guard Consistency

Align board-fetch and search behavior:
- If board is not accessible, board-open API returns `404` or permission error per current policy
- Search endpoint must not leak inaccessible board metadata

### 3. Client Search Result Safety

- If stale cached result is clicked and board becomes inaccessible, show neutral message and redirect to workspace boards list
- Remove inaccessible result from local search state after failed open

### 4. Observability

Add structured logs/metrics for:
- Search results filtered by permission
- Search click leading to permission denial

---

## File Checklist

| File | Change |
|------|--------|
| `server/extensions/search/mods/queryWorkspaceSearch.ts` | Enforce board permission joins/filters |
| `server/extensions/search/api/getSearch.ts` | Ensure filtered response shape |
| `server/extensions/board/api/get.ts` | Keep board-open permission behavior consistent |
| `src/extensions/Search/components/SearchResults.tsx` | Handle stale inaccessible board click gracefully |
| `src/extensions/Search/slices/searchSlice.ts` | Purge inaccessible board items from client cache |
| `specs/tests/search-board-access-rights.md` | Authorization search scenarios |

---

## Acceptance Criteria

- [ ] Search results never show boards user cannot access
- [ ] Clicking board result no longer produces "Fail to load board" for permission issues
- [ ] If a board becomes inaccessible after search response, click path handles gracefully and removes stale result
- [ ] No board metadata leakage for inaccessible boards in search API payload

---

## Tests

```text
specs/tests/search-board-access-rights.md
```
