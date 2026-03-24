# Test: Plugin Install

## Overview
Verifies that a workspace admin can install a plugin, that the plugin appears in the workspace plugin list, that non-admin members cannot install plugins, and that duplicate installs are rejected.

## Pre-conditions
- User A is authenticated and is a workspace admin
- User B is authenticated and is a regular member (not admin) of the same workspace
- A workspace exists with known `workspaceId`
- At least one available plugin slug is known (e.g. `"github-sync"`)

## Steps

### 1. List available plugins in the registry
1. `GET /api/v1/plugins` with header `Authorization: Bearer <tokenA>`
2. **Assert** response status is `200`
3. **Assert** response body has shape `{ "data": [ { "slug": "<string>", "name": "<string>", "description": "<string>" }, ... ] }`
4. Capture a valid plugin `slug` (e.g. `"github-sync"`)

### 2. Install plugin as workspace admin
1. `POST /api/v1/workspaces/:workspaceId/plugins` with header `Authorization: Bearer <tokenA>` and body:
   ```json
   { "slug": "github-sync" }
   ```
2. **Assert** response status is `201`
3. **Assert** response body has shape:
   ```json
   { "data": { "id": "<uuid>", "slug": "github-sync", "workspaceId": "<workspaceId>", "installedAt": "<iso8601>", "status": "active" } }
   ```
4. Capture `installedPluginId`

### 3. List installed plugins for workspace
1. `GET /api/v1/workspaces/:workspaceId/plugins` with header `Authorization: Bearer <tokenA>`
2. **Assert** response status is `200`
3. **Assert** response body has shape `{ "data": [ ... ] }` and includes an entry with `slug: "github-sync"` and `status: "active"`

### 4. Get plugin details
1. `GET /api/v1/workspaces/:workspaceId/plugins/:installedPluginId` with header `Authorization: Bearer <tokenA>`
2. **Assert** response status is `200`
3. **Assert** response body has `{ "data": { "id": "<installedPluginId>", "slug": "github-sync", "status": "active" } }`

### 5. Reject duplicate install
1. `POST /api/v1/workspaces/:workspaceId/plugins` with header `Authorization: Bearer <tokenA>` and body:
   ```json
   { "slug": "github-sync" }
   ```
2. **Assert** response status is `409`
3. **Assert** response body has `{ "name": "plugin-already-installed" }`

### 6. Reject install by non-admin member
1. `POST /api/v1/workspaces/:workspaceId/plugins` with header `Authorization: Bearer <tokenB>` and body:
   ```json
   { "slug": "github-sync" }
   ```
2. **Assert** response status is `403`
3. **Assert** response body has `{ "name": "insufficient-permissions" }`

### 7. Uninstall plugin as workspace admin
1. `DELETE /api/v1/workspaces/:workspaceId/plugins/:installedPluginId` with header `Authorization: Bearer <tokenA>`
2. **Assert** response status is `200` or `204`

### 8. Confirm plugin no longer appears in list
1. `GET /api/v1/workspaces/:workspaceId/plugins` with header `Authorization: Bearer <tokenA>`
2. **Assert** response status is `200`
3. **Assert** the `data` array does not contain an entry with `slug: "github-sync"` and `status: "active"`

### 9. Reject install of unknown plugin slug
1. `POST /api/v1/workspaces/:workspaceId/plugins` with header `Authorization: Bearer <tokenA>` and body:
   ```json
   { "slug": "nonexistent-plugin-xyz" }
   ```
2. **Assert** response status is `404`
3. **Assert** response body has `{ "name": "plugin-not-found" }`

### 10. Reject unauthenticated install
1. `POST /api/v1/workspaces/:workspaceId/plugins` with no `Authorization` header
2. **Assert** response status is `401`

## Expected Result
- Workspace admins can install and uninstall plugins; plugins appear in the installed list
- Duplicate installs return `409 plugin-already-installed`
- Non-admin members receive `403 insufficient-permissions`
- Unknown plugin slugs return `404 plugin-not-found`
- Unauthenticated requests return `401`
