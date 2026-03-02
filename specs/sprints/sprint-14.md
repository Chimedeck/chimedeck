# Sprint 13 — Observability, Rate Limiting & Security Hardening

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **References:** [requirements §§6, 12](../architecture/requirements.md), [technical-decisions.md §§14-16](../architecture/technical-decisions.md)

---

## Goal

Instrument the full application with OpenTelemetry traces/metrics, enforce rate limiting, complete the security audit, and deliver frontend performance polish (virtualization, skeletons, mobile layout). This is the sprint that turns the system production-ready.

---

## Scope

### 1. OpenTelemetry Instrumentation

Per [requirements §12](../architecture/requirements.md) + [technical-decisions.md §14](../architecture/technical-decisions.md):

```
server/mods/observability/
  tracer.ts        # OTEL SDK init (TracerProvider, BatchSpanProcessor)
  metrics.ts       # OTEL Metrics: counters, histograms
  exporters.ts     # OTLP HTTP exporter (target from Bun.env.OTEL_EXPORTER_URL)
```

**Instrumentation points:**

| Signal | What | Where |
|--------|------|-------|
| Trace | HTTP request span (method, path, status, latency) | Express-compatible middleware |
| Trace | DB query span (table, operation, duration) | Prisma `$extends` middleware |
| Trace | WS event fan-out span (boardId, eventType, recipientCount) | `rooms/broadcast.ts` |
| Metric | `mutation_latency_ms` histogram | Every POST/PATCH/DELETE handler |
| Metric | `sync_delay_ms` histogram | WS event sent - `Event.createdAt` |
| Metric | `http_error_total` counter | By status code + route |
| Metric | `conflict_total` counter | Incremented on position collision resolution |
| Metric | `ws_disconnect_total` counter | WS close handler |

**Request ID:** every HTTP request gets `X-Request-Id` (UUID v4) injected by middleware; propagated to Prisma spans and WS events.

### 2. Rate Limiting Middleware

Per [technical-decisions.md §16](../architecture/technical-decisions.md): Redis sliding-window counter.

```
server/middlewares/rateLimiter.ts
```

Implementation:
1. Lua script: `INCR rl:<key>:<window>` + `EXPIRE` in one atomic operation
2. Key: `<userId>` when authenticated, `<IP>` otherwise
3. Middleware applied per route class:

| Route class | Limit |
|-------------|-------|
| Auth (POST `/auth/*`) | 10 req / min |
| Mutations (POST/PATCH/DELETE) | 120 req / min |
| Reads (GET) | 600 req / min |
| Upload initiation | 20 req / min |

4. Exceeded: `HTTP 429`, headers `Retry-After: <seconds>`, error name `rate-limit-exceeded`

### 3. Security Hardening

Per [requirements §6 Security](../architecture/requirements.md):

#### Input Sanitization
- All string inputs trimmed and validated with Zod schemas in every route handler
- Markdown `description` / comment content sanitized with `dompurify` (server-side via `jsdom`) on read

#### CSRF
- `SameSite=Strict` on refresh token cookie (set in sprint 02; verify across all auth paths)
- `X-Requested-With: XMLHttpRequest` header required on all state-mutating API calls
- Missing header → `HTTP 403`, error name `csrf-check-failed`

#### Security Headers (Helmet)
`server/mods/helmet.ts` (stubbed in sprint 01) — fully configure:

```
Content-Security-Policy
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy
Strict-Transport-Security (HSTS)
```

#### Audit Log
- `Activity` table records every mutation (sprint 10) — already satisfies audit logging requirement
- Add `ipAddress` and `userAgent` fields to `Activity` for security events

#### Dependency Audit
- `bun audit` run in CI (add to GitHub Actions workflow from sprint 01)
- Address all `high` and `critical` severity advisories

### 4. Frontend Performance (Virtualization)

Per [requirements §§6, 10](../architecture/requirements.md):

#### Card List Virtualization
For boards with > 100 cards per list: render only visible cards.

```
src/extensions/Board/
  components/
    VirtualCardList.tsx     # @tanstack/virtual virtualizer for card column
```

Switch from direct render to `VirtualCardList` when `cards.length > 100`.

#### Board Load Skeletons
Per [requirements §10](../architecture/requirements.md):

```
src/extensions/Board/
  components/
    BoardSkeleton.tsx       # shimmer placeholders for lists + cards
    CardSkeleton.tsx
```

Shown while RTK Query `isFetching` on initial board load.

#### Mobile Responsive
Per [requirements §10](../architecture/requirements.md):

- Board: horizontal scroll on mobile (each list column full-width)
- Card modal: full-screen sheet on `< 768 px`
- Touch drag-drop: `@dnd-kit/sortable` supports pointer events natively

### 5. Load Testing

Per [requirements §6 Performance](../architecture/requirements.md):

```
tests/load/
  board-load.js      # k6: 1000-card board GET < 2 s at 50 concurrent users
  drag-latency.js    # k6: card move round-trip < 500 ms at 20 concurrent users
  ws-broadcast.js    # k6: WS event fan-out to 100 subscribers < 500 ms
```

Add `bun run test:load` script. Load tests run in CI only on `main` branch merge.

### 6. Final Acceptance Verification

Run through all acceptance criteria from [requirements §14](../architecture/requirements.md):

- [ ] All board mutations persist reliably — verified by integration test suite
- [ ] Clients converge after conflicts — E2E concurrent-edit test
- [ ] Permission checks never bypassed — RBAC penetration test suite
- [ ] UI remains responsive with 1000+ cards — k6 load test passes
- [ ] No silent corruption possible — `Activity` table completeness audit
- [ ] Activity log is complete and immutable — DB trigger verification
- [ ] Concurrent edits produce deterministic outcome — E2E conflict test

---

## Error Responses (new in this sprint)

| Name | HTTP | Trigger |
|------|------|---------|
| `rate-limit-exceeded` | 429 | Sliding window counter exceeded |
| `csrf-check-failed` | 403 | Missing `X-Requested-With` on mutation |

---

## Tests

- Unit: rate-limiter Lua script correctness, OTEL span attributes
- Integration: security headers present on all responses, 429 returned after limit, CSRF header checked
- Load: k6 scenarios pass at defined thresholds

---

## Acceptance Criteria

- [ ] OTEL traces visible in exporter (test with Jaeger locally via docker-compose)
- [ ] `mutation_latency_ms`, `ws_disconnect_total`, `conflict_total` metrics emitted
- [ ] Rate limit returns 429 with `Retry-After` header
- [ ] `X-Frame-Options: DENY` present on all responses
- [ ] CSP header blocks inline scripts
- [ ] Board with 1000 cards loads in < 2 s (k6 load test)
- [ ] Card move round-trip < 500 ms (k6 load test)
- [ ] `bun audit` reports zero high/critical vulnerabilities
- [ ] Mobile board renders correctly on 375 px viewport
- [ ] All 7 system-level acceptance criteria from [requirements §14](../architecture/requirements.md) verified
