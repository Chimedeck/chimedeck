# Sprint 116 — Health Check Tab UI

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 115 (Health Check Backend), Sprint 18 (Board View), Sprint 19 (Card Detail Modal)
> **Status:** ⬜ Future

---

## Goal

Surface the board's health monitoring as a **fifth tab** in the board header — alongside Overview, Activity (or whichever 4 tabs already exist). The tab is called **"Health Check"** and displays a dead-simple traffic-light dashboard: one row per monitored endpoint, coloured green / amber / red based on the latest probe result. Board members can add services from a preset list or by entering a custom URL, trigger an on-demand probe, and remove entries. No charts, no history — just a clear at-a-glance status page.

---

## Scope

---

### 1. New Board Tab — "Health Check"

The board header tab bar currently has 4 tabs. Add a fifth:

```
[Board]  [Table]  [Calendar]  [Timeline]  [Health Check]
```

The tab is rendered for all board members when `HEALTH_CHECK_ENABLED` is `true`. It is hidden (not just disabled) when the flag is `false`.

**Route:** `/boards/:boardId?tab=health-check` (query-param-based tab switching — consistent with existing board tab pattern).

---

### 2. Health Check Dashboard — Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Health Check                            [↻ Refresh]  [+ Add]  │
│  Last checked: 2 minutes ago                                    │
├─────────────────────────────────────────────────────────────────┤
│  🟢  Stripe API           https://api.stripe.com/     120 ms   │
│  🟡  AWS S3 (us-east-1)   https://s3.amazonaws.com/  1 340 ms  │
│  🔴  My Deploy Server     https://deploy.example.com  Timeout  │
│  ─                                                              │
│  (empty state when no services added)                           │
└─────────────────────────────────────────────────────────────────┘
```

Each row contains:

| Column | Content |
|--------|---------|
| **Status dot** | `🟢` `🟡` `🔴` coloured circle (Tailwind `bg-green-500` / `bg-amber-400` / `bg-red-500`); `bg-gray-300` when never probed |
| **Name** | Service name (truncated to 1 line with `truncate`) |
| **URL** | Subdued URL text (`text-gray-500 text-sm truncate`) |
| **Response time** | `120 ms` when green/amber; `Timeout` / `Error` when red; `—` when never checked |
| **Last checked** | Relative time string: `2 min ago`, `just now` (hidden on mobile to save space) |
| **Remove** | `×` button (`TrashIcon` 16 px), visible on row hover; triggers confirmation before delete |

#### Status dot tooltip

On hover, the status dot shows a tooltip:
- Green: `"200 OK · 120 ms"`
- Amber: `"200 OK · 1 340 ms (slow)"` or `"302 Redirect"`
- Red: `"503 Service Unavailable"` / `"Request timed out"` / `"Network error: <message>"`
- Gray (never probed): `"Not yet checked — click ↻ to probe"`

---

### 3. Add Service Modal

Triggered by the **"+ Add"** button. Two-mode form:

#### Mode A — Choose from presets

Dropdown populated from `GET /api/v1/health-check/presets`. Each option shows the service name and URL. Selecting a preset auto-fills the name field and locks the URL (display only, not editable). The user can optionally override the name.

#### Mode B — Custom URL

Text input for a URL. Text input for a name (auto-filled from the URL's hostname as a convenience default). Both fields are editable.

#### Mode toggle

A segmented control at the top of the modal:

```
  ┌──────────────────┬───────────────────┐
  │  Preset service  │  Custom URL       │
  └──────────────────┴───────────────────┘
```

Switching clears the form state for the previous mode.

#### Submission

Calls `POST /api/v1/boards/:boardId/health-checks`. On success:
1. Close modal.
2. New entry appears at the bottom of the list with status dot gray (never probed).
3. Immediately trigger a single probe (`POST …/probe`) in the background; update the row when the result arrives.

#### Error handling

| Error | UI behaviour |
|-------|-------------|
| `health-check-url-already-monitored` | Inline field error: _"This URL is already being monitored"_ |
| `validation-error` | Inline field errors per field |
| Network error | Toast: _"Failed to add service. Please try again."_ |

---

### 4. Refresh Behaviour

#### Manual refresh

The **↻ Refresh** button calls `POST /api/v1/boards/:boardId/health-checks/probe-all`. While probing:
- Button shows a spinning `ArrowPathIcon` (Heroicons) and is disabled.
- Each row's status dot shows a subtle pulse animation while its result is being awaited (optimistic loading state via a `probing` flag in Redux).
- On completion, all rows update simultaneously.

#### Auto-refresh

When the Health Check tab is active, probe-all is called automatically every **60 seconds**. The timer resets on manual refresh. The timer pauses when the tab is not visible (using the Page Visibility API / `document.hidden`). A countdown `Next check in: 58s` is shown below the header in small subdued text.

---

### 5. Empty State

When no health checks have been added:

```
  ┌─────────────────────────────────────┐
  │                                     │
  │    [HeartIcon 48px outlined]        │
  │    No services monitored yet        │
  │    Add a service URL to start       │
  │    tracking its availability.       │
  │                                     │
  │         [+ Add your first service]  │
  └─────────────────────────────────────┘
```

---

### 6. Files — Client

```
src/extensions/HealthCheck/
├── config/
│   └── healthCheckConfig.ts            ← HEALTH_CHECK_ENABLED feature flag, API path constants
├── components/
│   ├── HealthCheckRow.tsx               ← single service row: dot, name, URL, timing, remove
│   ├── HealthCheckStatusDot.tsx         ← coloured dot with tooltip (green/amber/red/gray + pulse)
│   ├── HealthCheckEmptyState.tsx        ← empty state illustration + CTA
│   └── HealthCheckCountdown.tsx         ← "Next check in: Xs" display
├── containers/
│   └── HealthCheckTab/
│       ├── HealthCheckTab.tsx           ← tab panel shell: header, list, empty state, modals
│       └── HealthCheckTab.duck.ts       ← RTK slice: entries, probingIds, lastCheckedAt
│                                           thunks: fetchHealthChecks, probeAll, probeSingle,
│                                                   addHealthCheck, removeHealthCheck
├── modals/
│   └── AddServiceModal.tsx              ← two-mode modal: preset picker + custom URL form
├── hooks/
│   ├── useHealthCheckAutoRefresh.ts     ← 60s auto-probe-all, page visibility pause, countdown
│   └── useHealthCheckProbe.ts           ← per-row probe state (probing flag, optimistic update)
├── api.ts                               ← fetch wrappers for all 6 health-check endpoints
├── routes.ts                            ← registers health-check tab in board tab bar
├── reducers.ts                          ← wires HealthCheckTab.duck into root reducer
└── README.md
```

---

### 7. State Shape (Redux)

```ts
interface HealthCheckState {
  entries: HealthCheckEntry[];       // ordered by createdAt asc
  probingIds: string[];              // health check IDs currently being probed
  lastCheckedAt: string | null;      // ISO timestamp of last probe-all
  status: 'idle' | 'loading' | 'error';
  error: string | null;
}

interface HealthCheckEntry {
  id: string;
  boardId: string;
  name: string;
  url: string;
  type: 'custom' | 'preset';
  presetKey: string | null;
  isActive: boolean;
  createdAt: string;
  latestResult: ProbeResult | null;
}

interface ProbeResult {
  status: 'green' | 'amber' | 'red';
  httpStatus: number | null;
  responseTimeMs: number | null;
  errorMessage: string | null;
  checkedAt: string;
}
```

---

### 8. Accessibility

- Status dots include `aria-label="Status: green — 200 OK, 120ms"` (matching tooltip text).
- The tab button has `role="tab"` consistent with other board tabs.
- Remove buttons are `aria-label="Remove [service name]"`.
- The countdown uses `aria-live="polite"` so screen reader users hear updates without interruption.

---

### 9. Acceptance Criteria

| # | Scenario | Expected |
|---|----------|---------|
| AC-1 | Board member opens Health Check tab | Tab renders; empty state shown when no services |
| AC-2 | Board member adds a preset service | Modal shows preset dropdown; on confirm entry appears; auto-probe fires; dot updates |
| AC-3 | Board member adds a custom URL | Entry appears with gray dot; auto-probe fires; dot turns green/amber/red |
| AC-4 | Board member clicks ↻ Refresh | All dots pulse; results update; "Last checked: just now" updates |
| AC-5 | Tab is active for 60 seconds | Auto-refresh fires; rows update; countdown resets |
| AC-6 | Tab is inactive (user switches away) | Auto-refresh timer pauses; no background fetches |
| AC-7 | Board member removes a service | Row disappears; DELETE API called |
| AC-8 | `HEALTH_CHECK_ENABLED=false` | Health Check tab not rendered in board tab bar |
| AC-9 | Probe returns slow result (≥ 1000 ms) | Dot shows amber; tooltip says `"200 OK · Xs (slow)"` |
| AC-10 | Probe returns timeout | Dot shows red; tooltip says `"Request timed out"` |

---

### 10. Feature Flag

Inherits `HEALTH_CHECK_ENABLED` from Sprint 115. The tab is conditionally rendered client-side by checking this flag through the feature flags context already established in Sprint 01.

---

### 11. Tests

- **E2E:** `tests/e2e/health-check-tab.spec.ts`
  - Add preset service → verify row appears with correct status after probe
  - Add custom URL → verify row
  - Manual refresh → spinner visible then resolves
  - Remove service → row gone
  - Tab not visible when flag disabled
