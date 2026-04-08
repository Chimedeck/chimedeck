# Sprint 115 — Health Check Tab: Backend, Config & Probe Engine

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 05 (Board), Sprint 03 (Auth), Sprint 04 (Workspace/RBAC)
> **Status:** ⬜ Future

---

## Goal

Give every board a built-in **Health Check** tab where members can monitor the live status of external services. This sprint builds the server-side foundation: database schema, the pre-configured services JSON file, the REST API for managing health check entries per board, and the HTTP probe engine that checks endpoints and classifies them as **green / amber / red**.

The UI is delivered in Sprint 116. This sprint is intentionally back-end only so the probe logic can be tested in isolation.

---

## Background & Classification Rules

Each monitored endpoint is probed via an unauthenticated HTTP GET with a 10-second timeout. The result is classified as:

| Status | Condition |
|--------|-----------|
| 🟢 **Green** | HTTP 2xx, response time < 1 000 ms |
| 🟡 **Amber** | HTTP 2xx but response time ≥ 1 000 ms **OR** HTTP 3xx (redirect but reachable) |
| 🔴 **Red** | HTTP 4xx / 5xx, timeout (> 10 s), or network/DNS error |

Amber is intentionally conservative: a slow-but-alive service is still a warning worth surfacing without alarming the team.

---

## Scope

---

### 1. Configuration File — Pre-configured Services

Create a JSON file that ships with the server and lists services that can be added to a board's Health Check list with one click.

**Path:** `server/config/health-check-services.json`

**Shape:**

```json
[
  {
    "key": "stripe-api",
    "name": "Stripe API",
    "description": "Stripe payment processing API status",
    "url": "https://api.stripe.com/",
    "category": "payments"
  },
  {
    "key": "sendgrid-api",
    "name": "SendGrid API",
    "description": "Email delivery via SendGrid",
    "url": "https://api.sendgrid.com/",
    "category": "email"
  },
  {
    "key": "aws-s3-us-east-1",
    "name": "AWS S3 (us-east-1)",
    "description": "Amazon S3 object storage — US East 1 region",
    "url": "https://s3.amazonaws.com/",
    "category": "infrastructure"
  },
  {
    "key": "aws-ses",
    "name": "AWS SES",
    "description": "Amazon Simple Email Service",
    "url": "https://email.us-east-1.amazonaws.com/",
    "category": "email"
  },
  {
    "key": "github-api",
    "name": "GitHub API",
    "description": "GitHub REST API availability",
    "url": "https://api.github.com/",
    "category": "developer-tools"
  },
  {
    "key": "cloudflare",
    "name": "Cloudflare",
    "description": "Cloudflare CDN and DNS",
    "url": "https://www.cloudflarestatus.com/api/v2/status.json",
    "category": "infrastructure"
  }
]
```

Keys must be unique and URL-safe. Additional services can be added by operators without redeploying — the server reads this file at startup and hot-reload is not required.

**Access endpoint:** `GET /api/v1/health-check/presets` — returns this list as `{ data: Preset[] }`. No auth required (public endpoint — the URLs are already public). Board-level read permission check is enforced at the `POST health-checks` level.

---

### 2. Database Migrations

#### Migration: `board_health_checks`

```sql
CREATE TABLE board_health_checks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id      UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  url           TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'custom',  -- 'custom' | 'preset'
  preset_key    TEXT,                            -- populated when type = 'preset'
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_board_health_checks_board_id ON board_health_checks(board_id);
```

#### Migration: `board_health_check_results`

```sql
CREATE TABLE board_health_check_results (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  health_check_id  UUID NOT NULL REFERENCES board_health_checks(id) ON DELETE CASCADE,
  checked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status           TEXT NOT NULL,           -- 'green' | 'amber' | 'red'
  http_status      INTEGER,                 -- null on timeout/network error
  response_time_ms INTEGER,                 -- null on network error
  error_message    TEXT                     -- null on success
);

CREATE INDEX idx_bhcr_health_check_id ON board_health_check_results(health_check_id);
CREATE INDEX idx_bhcr_checked_at ON board_health_check_results(checked_at DESC);
```

Only the **latest result per health check** is needed for the dashboard tile. The full history is retained for potential future charting — no cleanup job is in scope for this sprint, but a simple trim-on-insert (keep last 100 rows per health_check_id) is acceptable if DB size is a concern.

---

### 3. API Endpoints

All endpoints are under `/api/v1/boards/:boardId/health-checks`. Auth: board member for reads; board admin/member for writes (any board member can add/remove monitors — adjust to board-admin only if operator preference differs).

#### `GET /api/v1/health-check/presets`

Returns the parsed `health-check-services.json`.

- **Auth:** Authenticated user only.
- **Success:** `200` `{ data: Preset[] }`

#### `GET /api/v1/boards/:boardId/health-checks`

Returns all active health checks for the board, each with its latest result embedded.

- **Auth:** Board member.
- **Success:** `200`

```ts
{
  data: Array<{
    id: string;
    boardId: string;
    name: string;
    url: string;
    type: 'custom' | 'preset';
    presetKey: string | null;
    isActive: boolean;
    createdAt: string;
    latestResult: {
      status: 'green' | 'amber' | 'red' | null; // null = never checked
      httpStatus: number | null;
      responseTimeMs: number | null;
      errorMessage: string | null;
      checkedAt: string | null;
    } | null;
  }>;
}
```

#### `POST /api/v1/boards/:boardId/health-checks`

Adds a new health check to the board.

- **Auth:** Board member.
- **Body:**

```ts
{
  name: string;        // required
  url: string;         // required, must be a valid absolute URL (http or https)
  type?: 'custom' | 'preset';  // default: 'custom'
  presetKey?: string;  // required when type === 'preset'
}
```

- **Validation:**
  - `url` must parse as a valid absolute URL. Reject relative URLs and non-http(s) schemes (no `file://`, `javascript:`, `data:`, etc.) — this is a security boundary.
  - `name` max 120 characters.
  - No duplicate `url` per board (case-insensitive). Error: `health-check-url-already-monitored` 409.
- **Success:** `201` `{ data: HealthCheck }` (latestResult: null)

#### `DELETE /api/v1/boards/:boardId/health-checks/:healthCheckId`

Removes a health check and its result history via cascade.

- **Auth:** Board member.
- **Success:** `200` `{ data: {} }`
- **Error:** `404` `{ error: { name: 'health-check-not-found' } }`

#### `POST /api/v1/boards/:boardId/health-checks/:healthCheckId/probe`

Triggers an immediate on-demand probe of a single health check and persists the result.

- **Auth:** Board member.
- **Success:** `200` `{ data: ProbeResult }` — same shape as `latestResult` above.
- **Behaviour:** Fires the HTTP probe synchronously (within the request lifetime — max 12 s, slightly above 10 s timeout). Updates `board_health_check_results` and returns the new row.
- **Rate limit:** Max 1 probe per health check per 5 seconds per user (in-memory sliding window — no Redis dependency). Error: `probe-rate-limited` 429.

#### `POST /api/v1/boards/:boardId/health-checks/probe-all`

Probes every active health check on the board in parallel (capped at 10 concurrent fetches).

- **Auth:** Board member.
- **Success:** `200` `{ data: { results: ProbeResult[], checkedAt: string } }`
- Same rate limiting as single probe (1 call per board per 5 seconds).

---

### 4. Probe Engine Module

**Path:** `server/extensions/healthCheck/mods/probe/`

```
server/extensions/healthCheck/
├── api/
│   ├── index.ts                    ← route registrations
│   ├── presets.ts                  ← GET /health-check/presets handler
│   ├── list.ts                     ← GET /boards/:boardId/health-checks
│   ├── create.ts                   ← POST /boards/:boardId/health-checks
│   ├── remove.ts                   ← DELETE /boards/:boardId/health-checks/:id
│   ├── probe.ts                    ← POST …/:id/probe
│   └── probeAll.ts                 ← POST …/probe-all
├── common/
│   └── config/
│       └── healthCheck.ts          ← reads HEALTH_CHECK_ENABLED, HEALTH_CHECK_TIMEOUT_MS (default 10000), HEALTH_CHECK_AMBER_THRESHOLD_MS (default 1000)
├── mods/
│   └── probe/
│       ├── index.ts                ← compose: runProbe → persistResult
│       ├── runProbe.ts             ← fetch with timeout, classify green/amber/red, return ProbeResult
│       ├── classify.ts             ← pure: (httpStatus, responseTimeMs, error) → 'green' | 'amber' | 'red'
│       └── persistResult.ts       ← INSERT into board_health_check_results, return row
└── index.ts                        ← registers routes when HEALTH_CHECK_ENABLED
```

**Environment variables (added to config):**

| Variable | Default | Description |
|----------|---------|-------------|
| `HEALTH_CHECK_ENABLED` | `false` | Feature flag |
| `HEALTH_CHECK_TIMEOUT_MS` | `10000` | HTTP probe timeout in ms |
| `HEALTH_CHECK_AMBER_THRESHOLD_MS` | `1000` | Response time threshold for amber vs green |

---

### 5. Security Notes

- **SSRF prevention:** The probe URL must be validated as a public HTTP(S) URL. Reject private IP ranges (`10.x`, `172.16–31.x`, `192.168.x`, `127.x`, `::1`, `fc00::/7`) before making the request. Use a DNS pre-check to resolve the hostname and block reserved ranges. Reject `localhost` and `.local` hostnames. Log rejected probe attempts.
- **URL scheme allow-list:** Only `http:` and `https:` are allowed. Reject all other schemes at the POST validation layer.
- **No credentials in URL:** Warn if the URL contains `@` (basic auth in URL) — reject with `health-check-url-credentials-not-allowed` 422.

---

### 6. Acceptance Criteria

| # | Scenario | Expected |
|---|----------|---------|
| AC-1 | `GET /api/v1/health-check/presets` | Returns JSON list from config file |
| AC-2 | Board member adds a custom URL health check | `201` returned; row in DB; `latestResult: null` |
| AC-3 | Board member adds a preset health check | `201` returned; `type: 'preset'`, `presetKey` populated |
| AC-4 | Duplicate URL for same board | `409 health-check-url-already-monitored` |
| AC-5 | On-demand probe of a green endpoint | `status: 'green'`, httpStatus 200, responseTimeMs < 1000 |
| AC-6 | On-demand probe of a slow endpoint (mocked 1.5 s) | `status: 'amber'` |
| AC-7 | On-demand probe of an unreachable endpoint | `status: 'red'`, errorMessage populated |
| AC-8 | Probe URL with private IP | `422` with SSRF rejection error |
| AC-9 | `GET health-checks` after probe | `latestResult` embedded in each entry |
| AC-10 | `HEALTH_CHECK_ENABLED=false` | All health-check routes return `404` |

---

### 7. Tests

- **Unit:** `tests/integration/healthCheck/probe.test.ts`
  - `classify()` pure function: all 8 edge cases (green fast, green slow→amber, 3xx→amber, 4xx→red, 5xx→red, timeout→red)
  - SSRF rejection for private IPs

- **Integration:** `tests/integration/healthCheck/healthCheckApi.test.ts`
  - Full CRUD lifecycle
  - Probe on-demand with mocked `fetch` (Bun test mock)
  - `probe-all` parallel execution

- **MCP scenario:** `specs/tests/health-check-board.md`
