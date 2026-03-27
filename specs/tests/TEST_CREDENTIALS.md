# Test Credentials

Reference for all accounts and tokens used across the MCP test suite.
The agent should use these when a test scenario refers to placeholder values
like `<adminToken>`, `<regularToken>`, `<guestToken>`, etc.

---

## Users

| Role    | Email                    | Password      | Notes                          |
|---------|--------------------------|---------------|--------------------------------|
| Admin   | `tam.vu@journeyh.io`      | `12345678` | Has `admin` role               |
| Regular | `tam.vu@journeyh.io`       | `12345678` | Standard authenticated user    |
| Guest   | `tam.vu@journeyh.io`      | `12345678` | Guest / limited-access user    |

---

## Obtaining Tokens

Tokens are obtained by logging in via the API:

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "<email>", "password": "<password>" }
```

The response `data.token` is the Bearer token to use in subsequent requests.

- `adminToken`   → login with `tam.vu@journeyh.io`
- `regularToken` → login with `tam.vu@journeyh.io`
- `guestToken`   → login with `tam.vu@journeyh.io`

---

## Known IDs

These IDs are seeded in the development/test database and can be used as
stable references in test scenarios.

| Resource    | Placeholder      | Value                                  |
|-------------|------------------|----------------------------------------|
| Admin user  | `<adminUserId>`  | resolved at runtime via admin login    |
| Regular user| `<userId>`       | resolved at runtime via user login     |
| Workspace   | `<workspaceId>`  | resolved at runtime via GET /api/v1/workspaces |
| Board       | `<boardId>`      | resolved at runtime via GET /api/v1/boards     |

---

## Base URL

```
http://localhost:5173
```

Override with the `BASE_URL` environment variable when running against staging.
