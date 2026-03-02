# Sprint Plan — Collaborative Kanban System

> **Source of truth:** [`specs/architecture/requirements.md`](../architecture/requirements.md)  
> **Architecture decisions:** [`specs/architecture/technical-decisions.md`](../architecture/technical-decisions.md)  
> **Event sourcing:** [`specs/architecture/event_sourcing.md`](../architecture/event_sourcing.md)  
> **Real-time protocol:** [`specs/architecture/real_time_sync_protocol.md`](../architecture/real_time_sync_protocol.md)

---

## Guiding Principles

- Each sprint delivers **1–2 tightly coupled features** that can be tested end-to-end
- No sprint begins without the previous sprint's acceptance criteria being met
- Architecture follows `copilot-instructions.md`: group by feature, Bun runtime, REST conventions
- Every sprint includes: server routes, client UI, Knex migration, unit + integration tests

---

## Sprint Overview

> **Status key:** 🟢 Ready to start — 🔵 Blocked on previous sprint — ⬜ Future

| Sprint | Feature(s) | Key Deliverables | Status |
|--------|-----------|-----------------|--------|
| [01](./sprint-01.md) | Project Setup | Docker (Redis optional), Knex baseline, **feature flags infra**, CI skeleton | 🟢 Ready |
| [02](./sprint-02.md) | Build Tooling & Docker | `package.json` scripts, multi-stage Dockerfile, docker-compose dev/prod | 🟢 Ready after 01 |
| [03](./sprint-03.md) | Authentication | Email/password login, JWT, refresh token, OAuth | 🔵 Needs 02 |
| [04](./sprint-04.md) | Workspace Lifecycle | Create workspace, invite, accept, RBAC | 🔵 Needs 03 |
| [05](./sprint-05.md) | Board Lifecycle | Create, archive, delete, duplicate board | 🔵 Needs 04 |
| [06](./sprint-06.md) | List Management | CRUD lists, fractional index reorder | 🔵 Needs 05 |
| [07](./sprint-07.md) | Card Core | CRUD cards, move between lists | 🔵 Needs 06 |
| [08](./sprint-08.md) | Card Extended Fields | Labels, assignees, due dates, checklists | 🔵 Needs 07 |
| [09](./sprint-09.md) | Real-Time Infrastructure | WebSocket, pub/sub abstraction (Redis or in-memory), event store | 🔵 Needs 08 |
| [10](./sprint-10.md) | Real-Time Collaboration | Sync protocol, optimistic UI, conflict resolution | 🔵 Needs 09 |
| [11](./sprint-11.md) | Comments & Activity Log | Comments CRUD, versioning, immutable activity | 🔵 Needs 10 |
| [12](./sprint-12.md) | Attachments | File upload (S3), external URL, virus scan | 🔵 Needs 11 |
| [13](./sprint-13.md) | Search & Presence | Full-text search, presence indicators | 🔵 Needs 12 |
| [14](./sprint-14.md) | Observability & Hardening | OTEL, rate limiting, security audit | ⬜ Future |

---

## Feature Flag Coverage

Feature flags infrastructure (`server/mods/flags/`) is delivered in **sprint 01** and is available to every subsequent sprint. Key flags unlocking sprint behaviour:

| Flag | First used | Effect when `false` |
|------|-----------|--------------------|
| `USE_REDIS` | Sprint 09 | In-memory pub/sub + node-cache (local dev) |
| `VIRUS_SCAN_ENABLED` | Sprint 12 | Attachments skip scan, go directly to `READY` |
| `OAUTH_GOOGLE_ENABLED` / `OAUTH_GITHUB_ENABLED` | Sprint 03 | Disable respective OAuth buttons |
| `RATE_LIMIT_ENABLED` | Sprint 14 | Bypass rate limiting (dev only) |
| `OTEL_ENABLED` | Sprint 14 | Skip telemetry initialisation |
| `SEARCH_ENABLED` | Sprint 13 | Return 501 on search endpoint |

---

## Domain Model Covered Per Sprint

```
Sprint 01 ──────────── Infrastructure baseline + feature flags module
Sprint 02 ──────────── Build tooling, Docker multi-stage, dev scripts
Sprint 03 ──────────── User, RefreshToken
Sprint 04 ──────────── Workspace, Membership, Invite
Sprint 05 ──────────── Board
Sprint 06 ──────────── List
Sprint 07 ──────────── Card (core)
Sprint 08 ──────────── Card (labels, members, due_date, ChecklistItem)
Sprint 09 ──────────── Event, BoardSnapshot (event store + WS)
Sprint 10 ──────────── WS client sync, optimistic UI, rollback
Sprint 11 ──────────── Comment, Activity
Sprint 12 ──────────── Attachment
Sprint 13 ──────────── Search index, Presence (Redis TTL)
Sprint 14 ──────────── OTEL traces, rate-limit middleware, hardening
```

---

## Total Acceptance (Definition of Done for the System)

Taken directly from [requirements §14](../architecture/requirements.md):

- [ ] All board mutations persist reliably
- [ ] Clients converge after conflicts
- [ ] Permission checks never bypassed
- [ ] UI remains responsive with 1000+ cards
- [ ] No silent corruption possible
- [ ] Activity log is complete and immutable
- [ ] Concurrent edits produce deterministic outcome
