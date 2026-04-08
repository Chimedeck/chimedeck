# TEST_CREDENTIALS

Single source of truth for all credentials, base URLs, and runtime IDs used across every test flow.

**Rule:** No test flow file may hard-code a URL, email, or password. All values must be referenced from this file using the notation below.

---

## Credential Object

```json
{
  "baseUrl": "http://localhost:5173",
  "admin": {
    "email": "tam.vu@journeyh.io",
    "password": "12345678"
  },
  "user": {
    "email": "tam.vu@journeyh.io",
    "password": "12345678"
  },
  "guest": {
    "email": "tam.vu@journeyh.io",
    "password": "12345678"
  }
}
```

Set `TEST_BASE_URL` environment variable to override `baseUrl` when running against staging or production.

---

## Reference Notation

| Token | Value |
|---|---|
| `TEST_CREDENTIALS.baseUrl` | Application root URL |
| `TEST_CREDENTIALS.admin.email` | Admin user email |
| `TEST_CREDENTIALS.admin.password` | Admin user password |
| `TEST_CREDENTIALS.user.email` | Regular user email |
| `TEST_CREDENTIALS.user.password` | Regular user password |
| `TEST_CREDENTIALS.guest.email` | Guest / limited-access user email |
| `TEST_CREDENTIALS.guest.password` | Guest / limited-access user password |

---

## Obtaining a Bearer Token (API flows)

```http
POST {TEST_CREDENTIALS.baseUrl}/api/v1/auth/login
Content-Type: application/json

{
  "email": "{TEST_CREDENTIALS.admin.email}",
  "password": "{TEST_CREDENTIALS.admin.password}"
}
```

`response.data.token` → use as `Authorization: Bearer <token>` in subsequent requests.

---

## Runtime Placeholders

These are resolved during the flow execution (not pre-seeded).

| Placeholder | How to resolve |
|---|---|
| `$workspaceId` | `GET {TEST_CREDENTIALS.baseUrl}/api/v1/workspaces` → first item `id` |
| `$boardId` | From board create response or `GET /api/v1/boards` |
| `$listId` | From board lists panel or `GET /api/v1/boards/$boardId/lists` |
| `$cardId` | From card create response or board view click |
| `$token` | From login response `data.token` |
