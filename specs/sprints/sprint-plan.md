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
| **— UI Layer —** | | | |
| [15](./sprint-15.md) | UI Foundation | Vite + React + Tailwind, routing shell, Redux store, API client | 🔵 Needs 03 |
| [16](./sprint-16.md) | Authentication UI | Login/Signup pages, OAuth buttons, token refresh on boot | 🔵 Needs 15 |
| [17](./sprint-17.md) | Workspace Dashboard | App shell, sidebar, workspace switcher, boards grid | 🔵 Needs 16 |
| [18](./sprint-18.md) | Board View (Kanban) | DnD columns + cards, inline edit, optimistic mutations | 🔵 Needs 17 |
| [19](./sprint-19.md) | Card Detail Modal | Rich modal: Markdown, labels, members, due date, checklist | 🔵 Needs 18 |
| [20](./sprint-20.md) | Real-Time UI | WebSocket wiring, live updates, reconnection indicator, conflict toasts | 🔵 Needs 19 + 10 |
| [21](./sprint-21.md) | Comments, Activity & Attachments UI | Threaded comments, activity feed, file upload panel | 🔵 Needs 20 + 12 |
| [22](./sprint-22.md) | Search, Presence & Polish | ⌘K palette, presence avatars, theme toggle, skeletons, a11y | 🔵 Needs 21 + 13 |
| **— Extensions —** | | | |
| [23](./sprint-23.md) | Email Verification (SES) | `EMAIL_VERIFICATION_ENABLED` flag, AWS SES module, verify-email flow | 🔵 Needs 03 |
| [24](./sprint-24.md) | Profile Settings | Avatar upload (S3), nickname field, `/settings/profile` page | 🔵 Needs 12 + 17 |
| [25](./sprint-25.md) | @Mentions | Autocomplete dropdown, mention parsing, chips in card + comments | 🔵 Needs 11 + 19 + 24 |
| [26](./sprint-26.md) | Mention Notifications | In-app bell, notification panel, real-time WS delivery | 🔵 Needs 25 + 20 |
| [27](./sprint-27.md) | Collapsible Label Chips | Label pills on card tiles, collapsed/expanded toggle, localStorage persist | 🔵 Needs 18 + 06 |
| [28](./sprint-28.md) | Member Avatar Popover | Profile popover on card tile avatars, context-aware remove/edit actions | 🔵 Needs 07 + 15 |
| **— Monetization & Events —** | | | |
| [29](./sprint-29.md) | Configurable Events in Activity Feed | System events (member, due date, move) shown inline with comments; configurable filter file | 🔵 Needs 11 + 21 |
| [30](./sprint-30.md) | Card Money & Currency (DB + API) | `amount` + `currency` columns on cards, PATCH validation, activity event | 🔵 Needs 07 |
| [31](./sprint-31.md) | Card Money Badge UI | `CardMoneyBadge` on tile, editable Value section in card modal, Heroicons for calendar | 🔵 Needs 30 + 18 + 19 |
| [32](./sprint-32.md) | Board Monetization Type | `monetization_type` DB column, board settings radio UI, `payToPaidConfig` predicate | 🔵 Needs 30 |
| [33](./sprint-33.md) | Stripe Embedded Payments | `stripePaymentButtonsConfig`, Stripe PaymentIntent endpoint, embedded checkout modal | 🔵 Needs 32 |
| **— Plugin System —** | | | |
| [34](./sprint-34.md) | Plugin System: Server, SDK & DB | DB migrations (plugins, board_plugins, plugin_data), board-plugin API, plugin registry API, `jhInstance` SDK bundle served at `/sdk/jh-instance.js` | � Done |
| [35](./sprint-35.md) | Plugin Dashboard UI & Board Integration | Plugin admin dashboard, hidden iframe injection, postMessage bridge, card-badges/card-buttons/section UI injections, plugin popups & modals | 🟢 Done |
| [36](./sprint-36.md) | Plugin Registry: Registration UI & Search | `POST/PATCH/DELETE /api/v1/plugins` (platform admin), search + category filter on `GET /api/v1/plugins`, Register Plugin modal, one-time api_key reveal, `PluginSearchBar` | 🟢 Done |
| [37](./sprint-37.md) | Plugin SDK: Context Queries, Data Fix & Button Callbacks | Fix `CTX_CARD/LIST/BOARD/MEMBER` handlers in bridge, fix `t.get()`/`t.set()` `resourceId`, button callback registry in SDK so `card-badges`/`card-buttons` actually work | 🟢 Ready after 36 |
| [38](./sprint-38.md) | Plugin Data: Board Isolation & Cross-Board Validation | Add `board_id` to `plugin_data`, use it in GET/SET queries, validate card/list resource belongs to board, isolate member-scoped data per board | 🔵 Needs 37 |

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
| `EMAIL_VERIFICATION_ENABLED` | Sprint 23 | Skip email verification on register/login |
| `SES_ENABLED` | Sprint 23 | Log emails to console instead of sending via AWS SES |
| `PLUGINS_ENABLED` | Sprint 34 | Disable plugin routes and SDK endpoint entirely (off by default in dev until Sprint 34) |

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
──── UI Layer (Tailwind CSS + React) ────────────────────────────────
Sprint 15 ──────────── Vite + React + Tailwind scaffold, routing, Redux, API client
Sprint 16 ──────────── Login / Signup pages, OAuth buttons, token refresh
Sprint 17 ──────────── App shell, sidebar, workspace switcher, boards dashboard
Sprint 18 ──────────── Kanban board view, DnD cards + lists, inline editing
Sprint 19 ──────────── Card detail modal (Markdown, labels, checklist, due date)
Sprint 20 ──────────── Real-time UI (WebSocket, optimistic mutations, conflict toasts)
Sprint 21 ──────────── Comments, activity feed, attachments panel
Sprint 22 ──────────── ⌘K search palette, presence avatars, theme toggle, a11y polish
──── Extensions ─────────────────────────────────────────────────────────────────────
Sprint 23 ──────────── Email verification flow (AWS SES), feature flags
Sprint 24 ──────────── User profile: avatar upload (S3), nickname
Sprint 25 ──────────── @Mentions in cards & comments (autocomplete + chips)
Sprint 26 ──────────── In-app notification bell + panel (mention alerts, real-time WS)
Sprint 27 ──────────── Collapsible label chips on card tiles (board view)
Sprint 28 ──────────── Member avatar popover on card tiles (profile + remove)
──── Monetization & Events ──────────────────────────────────────────────────────────
Sprint 29 ──────────── Configurable activity events in comment feed (member, due date, move)
Sprint 30 ──────────── Card money & currency fields (DB migration, API validation)
Sprint 31 ──────────── Card money badge UI (tile badge, modal editor, Heroicons)
Sprint 32 ──────────── Board monetization type (pre-paid / pay-to-paid, column predicate config)
Sprint 33 ──────────── Stripe embedded payment flows (PaymentIntent API, configurable buttons)
──── Plugin System ──────────────────────────────────────────────────────────────────
Sprint 34 ──────────── Plugin, BoardPlugin, PluginData, PluginAuthToken (schema + API + SDK)
Sprint 35 ──────────── Plugin UI: dashboard, iframe injection, postMessage bridge, capability injections
Sprint 36 ──────────── Plugin registry CRUD API (platform admin), Register Plugin modal, search + category filter
Sprint 37 ──────────── Plugin SDK fixes: CTX_* handlers, t.get()/t.set() resourceId, button callback registry
Sprint 38 ──────────── Plugin data board isolation: board_id column, resource ownership validation
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

### UI Layer Additional Criteria (Sprints 15–22)

- [ ] Full journey works end-to-end: sign-up → workspace → board → drag cards → real-time sync
- [ ] All pages are mobile-responsive at 375 px viewport
- [ ] Dark/light theme toggle persists across sessions
- [ ] Command palette (`⌘K`) searches cards and boards in real time
- [ ] Lighthouse Performance ≥ 80 and Accessibility ≥ 90 on board page
- [ ] All modals are keyboard-accessible and closeable with `Escape`
- [ ] No `console.error` during normal usage flows
