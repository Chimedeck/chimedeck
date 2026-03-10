# Sprint 58 — Observability & Reliability

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 14 (Observability & Hardening), Sprint 20 (Real-Time UI)  
> **References:** [requirements §6 — NFR, §12 — Observability](../architecture/requirements.md)

---

## Goal

Three observability and reliability gaps are resolved:

1. **OTel packages** — `@opentelemetry/*` packages referenced in the codebase are not installed; add them to `package.json` so telemetry is actually active
2. **Offline mutation queue persistence** — the in-memory mutation queue is lost on page reload; persist it to `IndexedDB` so optimistic mutations survive browser refresh
3. **Conflict + sync-delay metrics** — the requirements specify that conflict rate and real-time propagation delay are instrumented; wire these as OTel metrics

---

## Scope

### 1. Install OTel Packages

```bash
bun add @opentelemetry/sdk-node \
        @opentelemetry/api \
        @opentelemetry/sdk-trace-node \
        @opentelemetry/exporter-trace-otlp-http \
        @opentelemetry/instrumentation-http \
        @opentelemetry/sdk-metrics \
        @opentelemetry/exporter-prometheus
```

Verify the existing `server/mods/telemetry/` (or equivalent) initialisation code activates correctly after installation.

Add the following to `server/config/env.ts` if not already present:

```ts
OTEL_EXPORTER_OTLP_ENDPOINT: Bun.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318',
OTEL_SERVICE_NAME: Bun.env['OTEL_SERVICE_NAME'] ?? 'kanban-server',
```

---

### 2. Offline Mutation Queue — IndexedDB Persistence

The client-side mutation queue (`src/mods/messageQueue.ts` or equivalent) currently stores pending mutations in memory. On page reload these are lost, leaving the UI in a stale optimistic state.

#### `src/mods/offlineQueue.ts` (replace or wrap existing)

Use the browser's `IndexedDB` API (via a thin wrapper, e.g. `idb` package) to persist pending mutations:

```bash
bun add idb
```

```ts
import { openDB } from 'idb';

const DB_NAME = 'kanban-offline-queue';
const STORE = 'mutations';

// On app boot: load pending mutations from IndexedDB and replay them
export const loadPersistedMutations = async (): Promise<PendingMutation[]> => { ... };

// On mutation enqueue: write to IndexedDB
export const enqueueMutation = async (mutation: PendingMutation): Promise<void> => { ... };

// On mutation acknowledged: remove from IndexedDB
export const acknowledgeMutation = async (id: string): Promise<void> => { ... };
```

On app boot (`src/store/` or `src/App.tsx`), call `loadPersistedMutations()` and replay any pending mutations against the API before rendering the main UI.

---

### 3. Conflict Rate & Sync-Delay Metrics

Add two OTel metrics instruments to the server:

#### 3a. Conflict rate counter — `server/mods/telemetry/metrics.ts`

```ts
const conflictCounter = meter.createCounter('realtime.conflicts', {
  description: 'Number of optimistic update conflicts detected during event processing',
});

// Increment in the conflict resolution handler
conflictCounter.add(1, { boardId, entityType });
```

#### 3b. Real-time propagation delay histogram

```ts
const propagationDelay = meter.createHistogram('realtime.propagation_delay_ms', {
  description: 'Milliseconds between server event emission and client acknowledgement',
  unit: 'ms',
});
```

Client-side: in the WebSocket message handler, calculate `Date.now() - event.emittedAt` and send it back to the server via a lightweight `POST /api/v1/metrics/propagation` endpoint:

```ts
// Client pings after receiving a WS event:
fetch('/api/v1/metrics/propagation', {
  method: 'POST',
  body: JSON.stringify({ delayMs: Date.now() - event.emittedAt }),
});
```

Server records the value in the histogram.

---

## Feature Flag

| Flag | Default | Effect when `false` |
|---|---|---|
| `OTEL_ENABLED` | `false` (already in Sprint 14) | Skip all telemetry initialisation |

The propagation delay endpoint should only record metrics when `OTEL_ENABLED` is `true`.

---

## Acceptance Criteria

- [ ] `bun install` succeeds with all `@opentelemetry/*` packages in `package.json`
- [ ] App starts without OTel-related import errors when `OTEL_ENABLED=true`
- [ ] Pending mutations survive a page reload and are replayed on boot
- [ ] Acknowledged mutations are removed from IndexedDB
- [ ] `realtime.conflicts` counter increments when a conflict is resolved
- [ ] `realtime.propagation_delay_ms` histogram records a value when a WS event is acknowledged by the client
- [ ] Both metrics are exported via the configured OTel exporter
- [ ] `OTEL_ENABLED=false` skips all metric recording without error
