# Test: Admin User List

## Overview
Verifies that server admins can list all users across the platform, filter by status, search by email or name, paginate results, and that non-admin users cannot access the admin user list endpoint.

## Pre-conditions
- User A is authenticated and has the `admin` role
- User B is authenticated as a regular (non-admin) user
- At least three user accounts exist in the system
- Known admin token and regular user token

## Steps

### 1. Admin fetches full user list
1. `GET /api/v1/admin/users` with header `Authorization: Bearer <adminToken>`
2. **Assert** response status is `200`
3. **Assert** response body has shape:
   ```json
   { "data": [ { "id": "<uuid>", "email": "<string>", "name": "<string>", "role": "<string>", "status": "<string>", "createdAt": "<iso8601>" } ], "metadata": { "totalPage": <number>, "perPage": <number> } }
   ```
4. **Assert** `data` array has at least three entries

### 2. Paginate user list
1. `GET /api/v1/admin/users?page=1&perPage=2` with header `Authorization: Bearer <adminToken>`
2. **Assert** response status is `200`
3. **Assert** `data` array has at most 2 entries
4. **Assert** `metadata.perPage` is `2`
5. `GET /api/v1/admin/users?page=2&perPage=2` with header `Authorization: Bearer <adminToken>`
6. **Assert** response status is `200`
7. **Assert** `data` array entries do not overlap with page 1 results

### 3. Filter users by status (active)
1. `GET /api/v1/admin/users?status=active` with header `Authorization: Bearer <adminToken>`
2. **Assert** response status is `200`
3. **Assert** every entry in `data` has `status: "active"`

### 4. Filter users by role (admin)
1. `GET /api/v1/admin/users?role=admin` with header `Authorization: Bearer <adminToken>`
2. **Assert** response status is `200`
3. **Assert** every entry in `data` has `role: "admin"`

### 5. Search users by email
1. `GET /api/v1/admin/users?search=<partialEmail>` where `<partialEmail>` matches at least one known user
2. **Assert** response status is `200`
3. **Assert** all returned entries have `email` containing the search term (case-insensitive)

### 6. Get a specific user by ID
1. `GET /api/v1/admin/users/:userId` with header `Authorization: Bearer <adminToken>`
2. **Assert** response status is `200`
3. **Assert** response body has shape `{ "data": { "id": "<userId>", "email": "<string>", "role": "<string>", "status": "<string>" } }`

### 7. Reject non-admin access to user list
1. `GET /api/v1/admin/users` with header `Authorization: Bearer <regularToken>`
2. **Assert** response status is `403`
3. **Assert** response body has `{ "name": "insufficient-permissions" }` or `{ "name": "admin-access-required" }`

### 8. Reject non-admin access to single user
1. `GET /api/v1/admin/users/:userId` with header `Authorization: Bearer <regularToken>`
2. **Assert** response status is `403`

### 9. Reject unauthenticated access
1. `GET /api/v1/admin/users` with no `Authorization` header
2. **Assert** response status is `401`

### 10. Handle request for non-existent user
1. `GET /api/v1/admin/users/00000000-0000-0000-0000-000000000000` with header `Authorization: Bearer <adminToken>`
2. **Assert** response status is `404`
3. **Assert** response body has `{ "name": "user-not-found" }`

## Expected Result
- Admins receive a paginated user list with full profile fields
- Filters by `status` and `role`, and search by email all work correctly
- Non-admin users receive `403`
- Unauthenticated requests return `401`
- Unknown user IDs return `404 user-not-found`
