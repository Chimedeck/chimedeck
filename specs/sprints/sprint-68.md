# Sprint 68 — Automation: Run History, Logs & Quota Tracking

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 67 (Scheduled Commands UI — all automation types live)
> **References:** Trello Automation — https://support.atlassian.com/trello/docs/automation-overview/ (Automation terminology section)

---

## Goal

Surface automation execution history in the panel, show quota usage, and provide a detailed run-log view so users can debug failing automations. Also adds the `automation_run_log` API endpoints and completes the Log tab in the Automation panel.

---

## Scope

### 1. Run Log API Endpoints

#### `GET /api/v1/boards/:boardId/automations/:automationId/runs`

Returns paginated run log for a single automation.

Query params: `page`, `perPage` (max 50), `status` filter (`SUCCESS|PARTIAL|FAILED`).

```json
{
  "data": [
    {
      "id": "...",
      "status": "SUCCESS",
      "cardId": "...",
      "cardName": "Fix login bug",
      "triggeredByUser": { "id": "...", "name": "Alice" },
      "ranAt": "2026-03-10T09:00:00Z",
      "context": { "triggerType": "card.moved_to_list", "listName": "Done" }
    }
  ],
  "metadata": { "totalPage": 4, "perPage": 20 }
}
```

#### `GET /api/v1/boards/:boardId/automation-runs`

Board-wide log — all automations, last 200 runs, sorted by `ran_at` desc.

```json
{
  "data": [...],
  "metadata": { "totalPage": 2, "perPage": 50 }
}
```

---

### 2. Quota Tracking

`server/extensions/automation/api/quota.ts`

#### `GET /api/v1/boards/:boardId/automation-quota`

Returns the current board's automation run usage within the current calendar month:

```json
{
  "data": {
    "usedRuns": 142,
    "maxRuns": 1000,
    "resetAt": "2026-04-01T00:00:00Z",
    "percentUsed": 14
  }
}
```

Quota is configurable via `AUTOMATION_MONTHLY_QUOTA` env var (default: `1000`). Above 80% usage: quota warning event published to WS `board channel`. Above 100%: automations still run but a `quota_exceeded` warning is logged (hard block is a future concern).

---

### 3. Automation Panel: Log Tab (activating Sprint 65 placeholder)

`src/extensions/Automation/components/LogPanel/`

```
LogPanel/
  index.tsx                  # tab content: QuotaBar + RunLogTable
  QuotaBar.tsx               # usage bar: "142 / 1 000 runs this month"
  RunLogTable.tsx            # paginated table of runs across all automations
  RunLogRow.tsx              # single row: status icon, automation name, card link, time
  RunLogDetail.tsx           # expandable row: shows context JSON + error message
  AutomationRunsPanel.tsx    # per-automation run list (opened from edit view)
```

#### `QuotaBar`

- Progress bar component (`bg-emerald-500` → `bg-amber-500` at 80% → `bg-red-500` at 95%)
- Shows "X / Y runs used this month · resets in N days"
- Heroicon: `ChartBarIcon`

#### `RunLogTable` columns

| Column | Contents |
|--------|----------|
| Status | `CheckCircleIcon` (success), `ExclamationCircleIcon` (partial), `XCircleIcon` (failed) |
| Automation | Name + type chip (`BoltIcon` rule, `PlayIcon` button, `ClockIcon` schedule) |
| Card | Clickable card name (opens card modal) or "Board-wide" |
| Triggered by | Avatar + name or "Scheduled" |
| When | Relative time ("2 minutes ago") |
| Details | `ChevronDownIcon` — expand inline to show context + error |

---

### 4. Per-Automation Run Count Badge

Each automation row in the **Rules**, **Buttons**, and **Schedule** tabs now shows a grey/green run-count chip:

- Grey: 0 runs
- Green: > 0 runs, showing count

Uses `automation.run_count` from the existing API response (column already in schema from Sprint 61).

---

### 5. WS Event: `automation_ran`

Published from the executor in Sprint 61/63/64 but consumed in the UI starting this sprint:

```json
{
  "type": "automation_ran",
  "automationId": "...",
  "status": "SUCCESS",
  "cardId": "...",
  "ranAt": "..."
}
```

UI listens on the board WebSocket channel and:
- Increments the run-count badge on the relevant automation row (optimistic)
- Appends a new row at the top of `RunLogTable` if the Log tab is open

---

### 6. Heroicons Used

| Component | Icon |
|-----------|------|
| Log tab label | `ClipboardDocumentListIcon` |
| Quota bar | `ChartBarIcon` |
| Quota warning | `ExclamationTriangleIcon` |
| Run success | `CheckCircleIcon` (green) |
| Run partial | `ExclamationCircleIcon` (amber) |
| Run failed | `XCircleIcon` (red) |
| Expand row | `ChevronDownIcon` |
| Collapse row | `ChevronUpIcon` |
| Scheduled source | `ClockIcon` |

---

### 7. Files

```
src/extensions/Automation/components/LogPanel/
  index.tsx
  QuotaBar.tsx
  RunLogTable.tsx
  RunLogRow.tsx
  RunLogDetail.tsx
  AutomationRunsPanel.tsx

server/extensions/automation/api/
  runs.ts           # GET /:automationId/runs
  boardRuns.ts      # GET /boards/:boardId/automation-runs
  quota.ts          # GET /boards/:boardId/automation-quota
```

RTK Query additions in `api.ts`:
- `getAutomationRuns(boardId, automationId, params)`
- `getBoardRuns(boardId, params)`
- `getAutomationQuota(boardId)`

---

## Acceptance Criteria

- [ ] Log tab shows the last 200 runs across all automations on the board
- [ ] Each row is expandable to show context and any error message
- [ ] Quota bar shows correct usage percentage and resets at month boundary
- [ ] At ≥ 80% quota a warning appearance (`bg-amber-500`) is applied
- [ ] New run entries appear in the Log tab in real time via WebSocket
- [ ] Per-automation run count badges update after each run
- [ ] `AUTOMATION_MONTHLY_QUOTA` env var controls the quota ceiling

---

## Tests

- `tests/integration/automation/runs.test.ts` — pagination, status filter, 1000-row cap enforcement
- `tests/integration/automation/quota.test.ts` — usage calculation across calendar month boundary
- `tests/e2e/automation/logPanel.spec.ts` — log tab renders runs, quota bar, expand/collapse
