# Test: MCP HTTP Session Lifecycle

## Overview
Verifies the full HTTP-based MCP session lifecycle: initialise a session, execute a tool call within the session, and terminate the session. Also validates that stale session IDs are rejected.

## Pre-conditions
- Server is running and reachable
- A valid user JWT or `hf_` API token is available

## Steps

### 1. Initialise a new MCP session
1. `POST /mcp` with header `Authorization: Bearer <token>` and JSON-RPC body:
   ```json
   { "jsonrpc": "2.0", "id": 1, "method": "initialize", "params": { "protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": { "name": "test-client", "version": "1.0.0" } } }
   ```
2. **Assert** response status is `200`
3. **Assert** response body has shape `{ "jsonrpc": "2.0", "id": 1, "result": { "protocolVersion": "2024-11-05", "capabilities": { "tools": {} }, "serverInfo": { "name": "<string>", "version": "<string>" } } }`
4. **Assert** response includes a `Mcp-Session-Id` header
5. Capture `sessionId` from the `Mcp-Session-Id` header

### 2. Send initialized notification
1. `POST /mcp` with headers `Authorization: Bearer <token>` and `Mcp-Session-Id: <sessionId>` and JSON-RPC body:
   ```json
   { "jsonrpc": "2.0", "method": "notifications/initialized" }
   ```
2. **Assert** response status is `204` or `200`

### 3. List tools within the session
1. `POST /mcp` with headers `Authorization: Bearer <token>` and `Mcp-Session-Id: <sessionId>` and body:
   ```json
   { "jsonrpc": "2.0", "id": 2, "method": "tools/list" }
   ```
2. **Assert** response status is `200`
3. **Assert** response body has `{ "result": { "tools": [ ... ] } }` with at least one tool entry
4. **Assert** each tool entry has `name` and `description` fields

### 4. Call a tool within the session
1. `POST /mcp` with headers `Authorization: Bearer <token>` and `Mcp-Session-Id: <sessionId>` and body:
   ```json
   { "jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": { "name": "get_boards", "arguments": {} } }
   ```
2. **Assert** response status is `200`
3. **Assert** response body has `{ "result": { "content": [ { "type": "text", "text": "<json string>" } ] } }`

### 5. Terminate the session
1. `DELETE /mcp` with headers `Authorization: Bearer <token>` and `Mcp-Session-Id: <sessionId>`
2. **Assert** response status is `200` or `204`

### 6. Reject requests with terminated session ID
1. `POST /mcp` with headers `Authorization: Bearer <token>` and `Mcp-Session-Id: <sessionId>` and body:
   ```json
   { "jsonrpc": "2.0", "id": 4, "method": "tools/list" }
   ```
2. **Assert** response status is `404` or `400`
3. **Assert** response body has `{ "error": { "code": <number>, "message": "<string>" } }` or `{ "name": "session-not-found" }`

### 7. Reject request with missing session ID after init
1. `POST /mcp` with header `Authorization: Bearer <token>` but no `Mcp-Session-Id` header and body:
   ```json
   { "jsonrpc": "2.0", "id": 5, "method": "tools/list" }
   ```
2. **Assert** response status is `400`

### 8. Reject unauthenticated session initialisation
1. `POST /mcp` with no `Authorization` header and a valid `initialize` JSON-RPC body
2. **Assert** response status is `401`

## Expected Result
- A valid session is created with a unique `Mcp-Session-Id`
- Tool calls succeed within an active session
- Terminated sessions are rejected with `404` or `400`
- Missing session IDs return `400`
- Unauthenticated requests return `401`
