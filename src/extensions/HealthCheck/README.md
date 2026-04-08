# Health Check Extension

Board-level HTTP endpoint monitoring — Sprint 115 (backend) + Sprint 116 (UI).

## Overview

The Health Check extension lets board members monitor external HTTP services from a dedicated board tab. Each monitored service is probed on demand or automatically every 60 seconds; results are classified green / amber / red based on HTTP status and response time.

## Feature Flag

The entire extension (UI and API) is gated by `HEALTH_CHECK_ENABLED`.

**Server:** set `HEALTH_CHECK_ENABLED=true` in the environment.  
**Client:** expose the flag via `window.__HEALTH_CHECK_ENABLED__ = true` (injected by the server during SSR/bootstrap) or `VITE_HEALTH_CHECK_ENABLED=true` in `.env`.

When the flag is `false`:
- The **Health Check** tab is hidden from the board tab bar.
- All `/api/v1/health-check/*` and `/api/v1/boards/:boardId/health-checks/*` routes return **404**.

## Board Tab Integration

The Health Check tab is the **fifth tab** in the board tab bar:

```
[Board]  [Activity]  [Comments]  [Archived Cards]  [Health Check]
```

**Route:** `/boards/:boardId?tab=health-check`

Tab switching is query-param-based (consistent with existing board navigation). The `HEALTH_CHECK_TAB_ID` and `BOARD_TAB_PARAM` constants are exported from `routes.ts` to avoid magic strings.

## Folder Structure

```
src/extensions/HealthCheck/
├── api.ts                         # Fetch wrappers for all backend endpoints
├── reducers.ts                    # Re-exports the RTK slice reducer
├── routes.ts                      # Tab ID constants + isHealthCheckTabActive() helper
├── config/
│   └── healthCheckConfig.ts       # Feature flag + tunable constants
├── components/
│   ├── HealthCheckCountdown.tsx   # Auto-refresh countdown bar
│   ├── HealthCheckEmptyState.tsx  # Empty-state prompt
│   ├── HealthCheckRow.tsx         # Single service row (dot, name, URL, timing, remove)
│   └── HealthCheckStatusDot.tsx   # Traffic-light dot with tooltip
├── containers/
│   └── HealthCheckTab/
│       ├── HealthCheckTab.tsx     # Tab panel (container — connects Redux)
│       └── HealthCheckTab.duck.ts # RTK slice + thunks + selectors
├── hooks/
│   ├── useHealthCheckAutoRefresh.ts  # 60s countdown + Page Visibility pause
│   └── useHealthCheckProbe.ts        # Per-row on-demand probe dispatch
└── modals/
    └── AddServiceModal.tsx        # Preset/custom mode add-service dialog
```

## Status Classification

| Status | Condition |
|--------|-----------|
| **green** | HTTP 2xx and response time ≤ 2 000 ms |
| **amber** | HTTP 2xx but response time > 2 000 ms, or any 3xx |
| **red** | HTTP 4xx / 5xx, timeout (> 10 s), or network error |
| **unknown** | Not yet probed |

The amber threshold is configurable via `HEALTH_CHECK_AMBER_THRESHOLD_MS` on the server and `HEALTH_CHECK_AMBER_THRESHOLD_MS` in `healthCheckConfig.ts` on the client.

## Auto-Refresh

The tab auto-probes all services every **60 seconds** when the browser tab is visible. The countdown is displayed in the tab header via `HealthCheckCountdown`. When the tab is hidden (Page Visibility API), the countdown pauses and resumes when the tab becomes visible again.

## Adding Services

Click **+ Add** to open `AddServiceModal`. Two modes:

- **Preset** — pick from `GET /api/v1/health-check/presets` (pre-configured well-known endpoints).
- **Custom** — enter a name and URL manually. URL must use `http://` or `https://` and must not target private/loopback IP ranges (SSRF guard enforced server-side).
