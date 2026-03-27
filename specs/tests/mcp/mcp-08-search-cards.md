# MCP 08. search_cards

**Prerequisites:** Flow 08 and 10 completed. Cards with titles and descriptions exist.

---

## Steps

1. Search by title keyword:
   ```json
   { "workspaceId": "$workspaceId", "query": "Test Card" }
   ```
   - **Expected:** `isError` false. Array includes `Test Card 1` and `Test Card 2`.

2. Search by description keyword (from flow 10 — description contains "description"):
   ```json
   { "workspaceId": "$workspaceId", "query": "description" }
   ```
   - **Expected:** `Test Card 1` appears in results.

3. Verify access control — PRIVATE board cards are not returned when searching as a non-member.

4. Board-scoped search:
   ```json
   { "boardId": "$boardId", "query": "Test" }
   ```
   - **Expected:** Only cards from `$boardId` are returned.

5. No-match query:
   ```json
   { "workspaceId": "$workspaceId", "query": "xyznonexistent99999" }
   ```
   - **Expected:** `isError` false, `data: []`.

6. Call without `query`:
   - **Expected:** `isError: true`.

7. Call without both `workspaceId` and `boardId`:
   - **Expected:** `isError: true`.

8. Call with an invalid `workspaceId`:
   - **Expected:** `isError: true`.

9. Archived cards should **not** appear in results.

10. Call without authorization:
    - **Expected:** `401 Unauthorized`.
