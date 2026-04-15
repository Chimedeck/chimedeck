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
| [39](./sprint-39.md) | Plugin Domain Whitelisting & Edit Plugin UI | `whitelisted_domains` on plugins table, board-level `allowedDomains` subset in `board_plugins.config`, bridge origin enforcement, Edit Plugin modal (platform admin), Board Domain Allowlist panel | 🔵 Needs 36 + 38 |
| [113](./sprint-113.md) | Plugin Registration Global Panel | Platform-admin `/plugins` page in sidebar; registry table with edit/deactivate; `Register Plugin` two-step modal (form → one-time API key reveal); search + category + status filters; `GET /api/v1/plugins/:pluginId` | 🔵 Needs 36 + 17 |
| [114](./sprint-114.md) | Board Plugin Discovery & Enable Flow | `GET /api/v1/boards/:boardId/plugins/available`; Board Plugins panel split into Enabled + Discover sections; one-click Enable/Disable; real-time row transitions; replaces board-by-board creation | 🔵 Needs 113 + 35 |
| **— Account Management —** | | | |
| [40](./sprint-40.md) | Change Email | Authenticated email-change request, confirmation link to new address, token invalidation on commit | 🔵 Needs 23 + 24 |
| [41](./sprint-41.md) | Forgot Password / Password Reset | `POST /auth/forgot-password`, reset email via SES, `/reset-password?token=` page, session invalidation | 🔵 Needs 23 + 16 |
| [42](./sprint-42.md) | Split AWS Credentials (LocalStack vs SES) | `S3_AWS_ACCESS_KEY_ID`/`S3_AWS_SECRET_ACCESS_KEY` for S3/LocalStack; global `AWS_*` for SES; fallback chain | 🔵 Needs 12 + 23 |
| **— Admin & Access Control —** | | | |
| [43](./sprint-43.md) | Email Domain Restriction | Configurable `ALLOWED_EMAIL_DOMAINS` list; guard registration + change-email; `EMAIL_DOMAIN_RESTRICTION_ENABLED` flag | 🔵 Needs 03 + 40 |
| [44](./sprint-44.md) | Admin: Create External User API | `POST /api/v1/admin/users`; `ADMIN_EMAIL_DOMAINS` (separate from `ALLOWED_EMAIL_DOMAINS`); auto/manual password; invitation email via SES; `ADMIN_INVITE_EMAIL_ENABLED` flag; `credentials` in response | 🔵 Needs 23 + 43 |
| [45](./sprint-45.md) | Admin: Invite External Users UI | Sidebar entry (admin-domain only); invite modal with password-mode radio + send-email toggle; copyable credential sheet | 🔵 Needs 17 + 44 |
| **— Requirements Gap Fixes —** | | | |
| [46](./sprint-46.md) | DB Schema: Board & Card Extensions | `boards`: `visibility`, `description`, `background` columns; `cards`: `start_date` column; expose in API | ⬜ Future |
| [47](./sprint-47.md) | UUID v7 Migration | Replace `uuidv4()` with `uuidv7()` across all entity primary keys; centralise in `server/common/uuid.ts` | ⬜ Future |
| [48](./sprint-48.md) | Board Stars, Followers & Board-Level Views | `board_stars` + `board_followers` tables; star/favourite API + UI; board activity log, comments, archived cards panels | ⬜ Future |
| [49](./sprint-49.md) | Guest Role + Board Visibility Access Control | `GUEST` membership role; `board_guest_access` table; Private/Workspace/Public visibility enforcement middleware | ⬜ Needs 46 |
| [50](./sprint-50.md) | API & Event Envelope Fixes | Standardise error envelope to `{ error: { code, message } }`; emit `member_joined` event; add `version` field to all real-time events | ⬜ Future |
| [51](./sprint-51.md) | Auth Hardening & WS Polling Fallback | Access token TTL → 24h; WS close on token revocation; client-side forced logout on 401; HTTP polling fallback | ⬜ Future |
| [52](./sprint-52.md) | View Persistence + Table View | `user_board_view_prefs` table; GET/PUT view-preference API; Board view switcher UI; Table view component | ⬜ Future |
| [53](./sprint-53.md) | Calendar View | Monthly + weekly calendar grid; cards by due date; drag-to-reschedule (U-CAL-01/02/03) | ⬜ Needs 52 |
| [54](./sprint-54.md) | Timeline / Gantt View | Swimlanes by list; bars from `start_date` to `due_date`; zoom levels; drag to resize/move (U-GNT-01/02/03) | ⬜ Needs 46 + 52 |
| [55](./sprint-55.md) | Custom Fields | `custom_fields` + `card_custom_field_values` tables; field definition API; card value API; card modal + tile badge UI | ⬜ Future |
| [56](./sprint-56.md) | Business Logic Invariants | Archived board read-only guard; workspace ≥1 Owner invariant; delete-with-nested-content confirmation flag | ⬜ Future |
| [57](./sprint-57.md) | Security Hardening | CSRF `Origin` header guard on all mutations; server-side input sanitization (`sanitize-html`) on all text fields | ⬜ Future |
| [58](./sprint-58.md) | Observability & Reliability | Install `@opentelemetry/*` packages; IndexedDB offline mutation queue; conflict counter + propagation delay histogram | ⬜ Future |
| **— Attachments & Automation —** | | | |
| [59](./sprint-59.md) | Card Attachment Upload (Enhanced Backend) | Multipart S3 upload for large files, MIME-type allowlist, image thumbnail generation (sharp), orphan-cleanup worker | ⬜ Needs 12 |
| [60](./sprint-60.md) | Card Attachment Upload UI | Drag-and-drop drop zone, clipboard paste (Cmd+V), multi-file progress bars, thumbnail previews, Heroicons for file types | ⬜ Needs 59 + 21 |
| [61](./sprint-61.md) | Automation: DB Schema & Core Engine | `automations`, `automation_triggers`, `automation_actions`, `automation_run_log` tables; rule evaluator + executor; `AUTOMATION_ENABLED` flag | ⬜ Needs 07 + 09 |
| [62](./sprint-62.md) | Automation: Triggers | 15 trigger types (card moved, label added, member assigned, checklist completed, …); trigger registry; `GET /automation/trigger-types` | ⬜ Needs 61 |
| [63](./sprint-63.md) | Automation: Actions | 18 action types (move card, add label, assign member, post comment, archive, sort list, …); variable substitution; `GET /automation/action-types` | ⬜ Needs 62 |
| [64](./sprint-64.md) | Automation: Scheduled & Due Date Commands | `pg_cron` + `pg_notify`/`LISTEN` scheduler (no `setInterval`); `automation_scheduler_tick()` stored proc; Bun Worker fallback for local dev (`AUTOMATION_USE_PGCRON=false`); **pre-deploy ops task required on self-hosted prod**: install `postgresql-16-cron` package, add to `shared_preload_libraries`, restart PostgreSQL, then `CREATE EXTENSION pg_cron` + `cron.schedule(...)` as superuser | ⬜ Needs 63 |
| [65](./sprint-65.md) | Automation: Rules Builder UI | Board header **BoltIcon button** (left of `...`); slide-in Automation panel; guided trigger + action builder; Heroicons throughout | ⬜ Needs 64 + 18 |
| [66](./sprint-66.md) | Automation: Card & Board Buttons UI | Card back "Automation" section with custom Heroicon buttons; board header action buttons; icon picker (24 Heroicons); Buttons tab live | ⬜ Needs 65 + 19 |
| [67](./sprint-67.md) | Automation: Scheduled Commands UI | Schedule tab live: calendar-command builder, due-date-command builder, schedule summary formatter, 3 quick-start templates | ⬜ Needs 66 + 64 |
| [68](./sprint-68.md) | Automation: Run History, Logs & Quota | Log tab: paginated run log, expandable rows, real-time WS updates; quota bar (`ChartBarIcon`); monthly quota via env var | ⬜ Needs 67 |
| [69](./sprint-future-1.md) | In-House Virus Scanning (ClamAV) | ClamAV sidecar, INSTREAM TCP protocol, EICAR integration test, `REJECTED` UI state with tooltip | ⬜ Needs 59 |
| **— Notifications —** | | | |
| [70](./sprint-70.md) | Notification Preferences: DB + API | `notification_preferences` table; GET/PATCH preference API; `preferenceGuard` helper; gate in-app + email dispatch; `NOTIFICATION_PREFERENCES_ENABLED` flag | ⬜ Needs 26 + 23 |
| [71](./sprint-71.md) | Notification Preferences UI | Toggle matrix in Profile Settings (4 types × 2 channels); optimistic PATCH; email column disabled when SES off | ⬜ Needs 70 + 24 |
| [72](./sprint-72.md) | Email Notifications (Mentions + Board Activity) | SES email templates for mention/card_created/card_moved/card_commented; `boardActivityDispatch`; `EMAIL_NOTIFICATIONS_ENABLED` flag; fire-and-forget | ⬜ Needs 70 + 23 + 26 |
| [73](./sprint-73.md) | In-App Notifications for Board Activity | Extend in-app notifications to card_created/card_moved/card_commented; WS push to board members; new icons + copy in notification panel; `type` filter on list API | ⬜ Needs 70 + 26 + 72 |
| [95](./sprint-95.md) | Board-scoped Notification Preferences (Global) | `board_notification_preferences` table; per-board global on/off toggle in board settings "User settings"; `user_notification_settings` master toggle; guard in `boardActivityDispatch` | ⬜ Needs 70 + 73 |
| [96](./sprint-96.md) | Profile Settings: Notifications Tab | Refactor `EditProfilePage` into tab layout (Profile / Notifications); URL-driven tab state (`?tab=notifications`); master toggle + preference matrix on Notifications tab | ⬜ Needs 71 + 95 |
| [97](./sprint-97.md) | New Notification Types: card_updated, card_deleted, card_archived | DB constraint extended; server dispatch wired on card PATCH/DELETE/archive; client types + labels + icons for 3 new types; preference panel shows all 9 types | ⬜ Needs 73 + 88 + 96 |
| [98](./sprint-98.md) | card_commented Notification Dispatch | Wire comment creation to `boardActivityDispatch`; in-app + WS push; email via SES for `card_commented`; self-exclusion guard | ⬜ Needs 72 + 73 |
| [99](./sprint-99.md) | Email Templates for New Notification Types | SES templates for card_updated / card_deleted / card_archived; fix `shared.ts` deep-link to `?tab=notifications`; verify card_commented end-to-end | ⬜ Needs 72 + 97 + 98 |
| [100](./sprint-100.md) | Board-Level Per-Type Notification Preferences | `board_notification_type_preferences` table; GET/PATCH/DELETE API; override cascade (board-type → user-type → default); `BoardNotificationTypePreferences` toggle matrix in board settings | ⬜ Needs 95 + 96 + 97 |
| **— External API, MCP & CLI —** | | | |
| [101](./sprint-101.md) | API Token Infrastructure | `api_tokens` DB table; `POST/GET/DELETE /api/v1/tokens`; SHA-256 hashed storage; token prefix for display; extend `authenticate` middleware to accept `hf_...` tokens alongside JWT | ⬜ Needs 03 + 15 |
| [102](./sprint-102.md) | API Token UI (User Settings) | "API Tokens" settings page; generate modal (name + expiry); one-time copy modal; token list with revoke; RTK Query slice | ⬜ Needs 101 + 96 |
| [103](./sprint-103.md) | External API Surface Audit & Card Money Endpoint | Audit all 6 external operations; add `PATCH /api/v1/cards/:id/money`; add `POST /api/v1/cards/:id/comments` if missing; verify permission guard on board invite; `docs/api-reference.md` | ⬜ Needs 101 |
| [104](./sprint-104.md) | MCP Server | `server/extensions/mcp/` — MCP stdio server with 6 tools (move_card, write_comment, create_card, edit_card_description, set_card_price, invite_to_board); token auth; Claude Desktop + Cursor setup README | ⬜ Needs 101 + 103 |
| [105](./sprint-105.md) | CLI | `cli/` — `chimedeck` Bun CLI with 6 sub-commands; `--token` flag + `CHIMEDECK_TOKEN` env; `--json` mode; `cli/README.md` | ⬜ Needs 101 + 103 |
| **— Admin Enhancements —** | | | |
| [74](./sprint-74.md) | Admin: Auto-Verify External User Email | `autoVerifyEmail` param on `POST /api/v1/admin/users`; sets `email_verified_at` at creation; checkbox in invite modal (default: checked); verification status in credential sheet | ⬜ Needs 44 + 45 |
| **— UI / UX Polish —** | | | |
| [75](./sprint-75.md) | Light / Dark Theme (Full Implementation) | Audit all components for hardcoded dark classes; dual-mode Tailwind `dark:` variants throughout; theme persisted in `localStorage`; no flash on load; `ThemeToggle` Sun/Moon icons | ⬜ Needs 22 |
| [76](./sprint-76.md) | Board Background Image Upload | S3 upload for board backgrounds (`board-backgrounds/{boardId}/`); `POST/DELETE /api/v1/boards/:id/background`; background renders behind columns only — columns stay opaque; thumbnail in workspace grid + search results; real-time WS sync | ⬜ Needs 46 + 12 + 75 |
| [77](./sprint-77.md) | Granular Search (Scoped by Type) | Scope tabs (`All` / `Boards` / `Cards`) in command palette; passes `type=board|card` to search API; scoped empty states; placeholder text matches scope; `sessionStorage` persistence | ⬜ Needs 22 + 13 + 76 |
| **— Board Access Control —** | | | |
| [78](./sprint-78.md) | Board Members Table + Visibility Enforcement (Server) | `board_members` table + migration; auto-insert creator as board ADMIN; visibility middleware; PRIVATE/WORKSPACE/PUBLIC access matrix; board member CRUD API; guest/PRIVATE board filtering on workspace boards list | ⬜ Needs 46 + 49 |
| [79](./sprint-79.md) | Board Member Management UI | Visibility selector in board settings; Board Members Panel (add/change role/remove); workspace boards grid visibility badge; board header avatar stack | ⬜ Needs 78 + 17 + 18 |
| [80](./sprint-80.md) | Guest Experience UI | Guest invite flow (by email, stub account creation); scoped workspace view for GUEST role (granted boards only, member list hidden); client-side permission guards; guest sidebar labels | ⬜ Needs 79 + 49 + 44 |
| **— Offline Experience —** | | | |
| [82](./sprint-82.md) | Rich Text Toolbar One-Line Overflow + Inline Attachments | Keep description/comment rich toolbar to one line, move secondary commands into searchable `+` menu, and show inline upload previews (image thumbnail or file name) while uploading attachments from editor | ⬜ Needs 11 + 21 + 81 |
| [83](./sprint-83.md) | Offline Drafts for Card Description + Comments | User-private draft store (description/comment), local IndexedDB draft persistence, cross-device draft sync for same user, offline Save/Comment replay with idempotency and retry states | ⬜ Needs 11 + 20 + 58 + 81 |
| **— Board UX & Access Improvements —** | | | |
| [84](./sprint-84.md) | Board-Scoped Search Bar | Board-header search bar scoped to active board only; board-local cards/lists results; board route integration for card open | ⬜ Needs 13 + 18 + 77 |
| [85](./sprint-85.md) | Collapsible Sidebar Drawer (Tailwind) | Desktop collapse rail + mobile drawer behavior; persisted sidebar state; keyboard and accessibility support | ⬜ Needs 15 + 17 + 18 |
| [86](./sprint-86.md) | Access-Aware Board Search Results | Hide inaccessible boards from search results; server-side permission filtering; stale-result click guard in client | ⬜ Needs 13 + 77 + 78 |
| [87](./sprint-87.md) | Board Deletion Auto-Refresh | Remove deleted boards from UI without reload; redirect when current board deleted; workspace-wide real-time deletion sync | ⬜ Needs 05 + 17 + 20 |
| [88](./sprint-88.md) | Expanded Card Activity Tracking | Track `card_created`, `card_moved`, `card_member_assigned` and unassign events in activity feed with real-time updates | ⬜ Needs 07 + 11 + 29 + 73 |
| [89](./sprint-89.md) | Guest Role Split: VIEWER vs MEMBER | Split board GUEST into read-only VIEWER and write-capable MEMBER (board-scoped only); `guest_type` column on `board_guest_access`; API + UI updates | ⬜ Needs 49 + 80 |
| **— Internationalisation (i18n) —** | | | |
| [90](./sprint-90.md) | i18n Phase 1: Comment, Activity & Attachment | Extract all hardcoded strings in Comment, Activity, Attachment/Attachments extensions into `translations/en.json`; bracket-notation access; no library | ⬜ Needs 11 + 21 |
| [91](./sprint-91.md) | i18n Phase 2: Automation | Extract ~20-component Automation extension (rules, buttons, schedules, run log) into `Automation/translations/en.json` | ⬜ Needs 90 + 61–68 |
| [92](./sprint-92.md) | i18n Phase 3: Plugins | Extract ~15-component Plugins extension (search bar, register/edit modals, board panel, domain allowlist) into `Plugins/translations/en.json` | ⬜ Needs 90 + 34–39 |
| [93](./sprint-93.md) | i18n Phase 4: CustomFields, CalendarView, TimelineView & TableView | Create `translations/en.json` for four view/data extensions; extract all labels, aria-labels, and empty-state strings | ⬜ Needs 90 + 52–55 |
| [94](./sprint-94.md) | i18n Phase 5: Remaining Extensions & Common/Layout | Finish i18n coverage: Mention, Notifications, UserProfile, AdminInvite, Realtime, OfflineDrafts, BoardViews, `src/common/`, `src/layout/`; zero hardcoded strings across all of `src/` | ⬜ Needs 91–93 |
| **— Health Check —** | | | |
| [115](./sprint-115.md) | Health Check Tab: Backend & Config | `board_health_checks` + `board_health_check_results` tables; `server/config/health-check-services.json` presets; `GET /health-check/presets`; board CRUD endpoints (`GET/POST/DELETE`); on-demand `probe` + `probe-all`; probe engine with green/amber/red classification; SSRF prevention; `HEALTH_CHECK_ENABLED` flag | ⬜ Needs 05 + 03 |
| [116](./sprint-116.md) | Health Check Tab UI | 5th board tab "Health Check"; traffic-light status dots (green/amber/red/gray); one row per endpoint with name, URL, response time; Add Service modal (preset picker + custom URL); manual ↻ Refresh + 60-second auto-refresh with Page Visibility pause; empty state | ⬜ Needs 115 + 18 |
| [117](./sprint-117.md) | Secure Attachment Proxy + Alias & Comment/Edit Actions | Authenticated proxy endpoints replace raw S3 presigned URLs; `alias` DB column + `PATCH` endpoint for rename; Edit (inline rename) and Comment (insert markdown link) action buttons on attachment rows | ⬜ Needs 12 + 59 + 60 |
| [121](./sprint-121.md) | Email Template Centralisation & Handlebars Migration | Extract all email HTML into `templates/html/*.html` files; `renderTemplate` Handlebars helper with `Bun.file` + compile cache; replace `${var}` interpolation with `{{var}}`; update call sites to `await` async builders | ⬜ Needs 23 |
| [123](./sprint-123.md) | Sentry Monitoring: Client + Server | Add Sentry SDK wiring for React client and Bun server, unified release/environment tagging, source map upload, and error-boundary capture with trace propagation | ⬜ Needs 15 + 03 + 58 |
| **— Comments Enhancements —** | | | |
| [129](./sprint-129.md) | Comment Emoji Reactions: DB + API | `comment_reactions` table; `POST/DELETE /api/v1/comments/:id/reactions`; reactions joined onto comment list response; WS events | ⬜ Needs 11 |
| [130](./sprint-130.md) | Comment Emoji Reactions: UI | `CommentReactions` pill row; `EmojiPickerPopover` (`@emoji-mart/react`); optimistic toggle; real-time WS sync | ⬜ Needs 129 + 21 |
| [131](./sprint-131.md) | Comment Threaded Replies: DB + API | `parent_id` on `comments`; one-level-deep guard; `GET /api/v1/comments/:id/replies`; `reply_count` in list; WS event | ⬜ Needs 11 |
| [132](./sprint-132.md) | Comment Threaded Replies: UI | Reply button on top-level comments; inline `CommentEditor` composer; load-on-demand `CommentReplyThread`; real-time sync | ⬜ Needs 131 + 130 |
| **— Design System —** | | | |
| [133](./sprint-133.md) | Design System: Replace Raw Buttons | `link` variant + `IconButton` component; audit + replace all ad-hoc `<button>` elements across Attachment, Workspace, List, Sidebar, Timeline, Table, Auth, Plugins, Comment, Card | ⬜ Needs 15 |
| [134](./sprint-134.md) | Design Stylesheet Page | `/design-system` route (dev-only, `DESIGN_SYSTEM_ENABLED` flag); colour tokens, typography, all Button variants, comments demo, reactions demo, stubbed components — no API calls | ⬜ Needs 133 |
| **— Webhooks —** | | | |
| [135](./sprint-135.md) | Webhooks: DB + API Infrastructure | `webhooks` + `webhook_deliveries` tables; `POST/GET/PATCH/DELETE /api/v1/webhooks`; HMAC-SHA256 `v0` signing; fire-and-forget dispatch; SSRF guard; `WEBHOOKS_ENABLED` flag | ⬜ Needs 101 |
| [136](./sprint-136.md) | Webhooks: Register UI (`WebhooksRegisterPage`) | `/settings/webhooks` page (mirrors `ApiTokenPage`); register-endpoint modal with event-type checklist; one-time signing-secret reveal modal; edit + delete dialogs; `SignatureVerificationSnippet` JS code guide | ⬜ Needs 135 + 102 |

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
| `EMAIL_DOMAIN_RESTRICTION_ENABLED` | Sprint 43 | Reject registration / email-change for domains not in `ALLOWED_EMAIL_DOMAINS` (default: `true`) |
| `ADMIN_INVITE_EMAIL_ENABLED` | Sprint 44 | Send invitation email to externally created users via SES (requires `SES_ENABLED` also `true`) |
| `WEBHOOKS_ENABLED` | Sprint 135 | Return `501 Not Implemented` on all `/api/v1/webhooks*` routes (off by default in local dev) |
| `NOTIFICATION_PREFERENCES_ENABLED` | Sprint 70 | When `false`, all notification channels are treated as enabled for all users (backward-compatible with Sprint 26) |
| `EMAIL_NOTIFICATIONS_ENABLED` | Sprint 72 | Enable SES email dispatch for notification events — requires `SES_ENABLED` also `true` |
| `AUTOMATION_ENABLED` | Sprint 61 | Disable all automation routes and the event-pipeline evaluation hook |
| `AUTOMATION_SCHEDULER_ENABLED` | Sprint 64 | Prevent calendar + due-date scheduler workers from starting (useful in read-only replicas) |
| `AUTOMATION_MONTHLY_QUOTA` | Sprint 68 | Maximum automation runs per board per calendar month (default: `1000`) |
| `HEALTH_CHECK_ENABLED` | Sprint 115 | Disable all health-check routes and hide the Health Check board tab (default: `false`) |
| `SENTRY_CLIENT_ENABLED` | Sprint 123 | Skip browser-side Sentry SDK initialisation (no client error/performance events sent) |
| `SENTRY_SERVER_ENABLED` | Sprint 123 | Skip Bun server Sentry SDK initialisation and server-side capture wrappers |
| `DESIGN_SYSTEM_ENABLED` | Sprint 134 | Expose `/design-system` route in the client (default: `true` in dev, `false` in production) |

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
──── Account Management ─────────────────────────────────────────────────────────────
Sprint 40 ──────────── Change email: pending_email + token, confirmation flow, session invalidation
Sprint 41 ──────────── Forgot password: reset token + email, /forgot-password + /reset-password UI
Sprint 42 ──────────── Split AWS credentials: S3_AWS_* for LocalStack, AWS_* for SES; fallback chain
──── Admin & Access Control ─────────────────────────────────────────────────────────
Sprint 43 ──────────── Email domain restriction: ALLOWED_EMAIL_DOMAINS config, registration + change-email guards
Sprint 44 ──────────── Admin create external user API: auto/manual password, optional SES invite email
Sprint 45 ──────────── Admin invite UI: sidebar entry, invite modal, credential sheet with copy-to-clipboard
──── Requirements Gap Fixes ─────────────────────────────────────────────────────────
Sprint 46 ──────────── Board extensions (visibility, description, background); Card start_date column
Sprint 47 ──────────── UUID v7 migration: replace uuidv4() across all entity primary keys
Sprint 48 ──────────── Board stars + followers tables; board activity/comments/archived-cards panels
Sprint 49 ──────────── Guest role; board_guest_access table; Private/Workspace/Public visibility enforcement
Sprint 50 ──────────── Error envelope standardisation; member_joined event; event version field
Sprint 51 ──────────── Access token TTL → 24h; WS close on revocation; client forced logout; HTTP polling fallback
Sprint 52 ──────────── User view preference (DB + API); Board view switcher; Table view
Sprint 53 ──────────── Calendar view: month/week grid, drag-to-reschedule (U-CAL-01/02/03)
Sprint 54 ──────────── Timeline/Gantt view: swimlanes, start+due bars, zoom, resize/move (U-GNT-01/02/03)
Sprint 55 ──────────── Custom fields: definitions per board, values per card, modal + tile badge UI
Sprint 56 ──────────── Business logic invariants: archived read-only, ≥1 owner, delete confirmation
Sprint 57 ──────────── Security hardening: CSRF Origin guard, server-side input sanitization
Sprint 58 ──────────── Observability: install OTel packages, IndexedDB offline queue, conflict + lag metrics
──── Attachments & Automation ───────────────────────────────────────────────────────────────────
Sprint 59 ──────────── Enhanced attachments: multipart S3 upload, MIME allowlist, thumbnail generation, orphan cleanup
Sprint 60 ──────────── Attachment Upload UI: drag-and-drop, clipboard paste, progress bars, thumbnails, Heroicons
Sprint 61 ──────────── Automation core: DB schema (automations, triggers, actions, run_log), engine + executor
Sprint 62 ──────────── Automation triggers: 15 trigger types registered (card moved, labeled, member, checklist, …)
Sprint 63 ──────────── Automation actions: 18 action types (move, label, assign, comment, archive, sort list, …)
Sprint 64 ──────────── Automation scheduler: pg_cron + pg_notify/LISTEN; automation_scheduler_tick() stored proc; Bun Worker fallback
Sprint 65 ──────────── Automation Rules UI: BoltIcon board-header button (left of ...), slide-in panel, rule builder
Sprint 66 ──────────── Automation Buttons UI: card-back buttons, board-header buttons, Heroicon icon picker
Sprint 67 ──────────── Automation Schedule UI: calendar command builder, due-date command builder, quick-start templates
Sprint 68 ──────────── Automation Log & Quota: run history log, quota bar, real-time WS updates, monthly quota config
Sprint 69 ──────────── In-house virus scanning: ClamAV sidecar, INSTREAM protocol, EICAR test, REJECTED UI state
──── Notifications ──────────────────────────────────────────────────────────────────────────────
Sprint 70 ──────────── NotificationPreference (per user, per type, per channel)
Sprint 71 ──────────── Notification preferences settings UI
Sprint 72 ──────────── Email notification dispatch (mention, card_created, card_moved, card_commented)
Sprint 73 ──────────── In-app board activity notifications; extend notification panel
Sprint 95 ──────────── Board-scoped global notification toggle; user global master toggle
Sprint 96 ──────────── Profile settings tab layout: Profile tab + Notifications tab
Sprint 97 ──────────── New notification types: card_updated, card_deleted, card_archived; dispatch + client
Sprint 98 ──────────── card_commented dispatch: comment creation triggers in-app + email notification
Sprint 99 ──────────── Email templates for card_updated / card_deleted / card_archived
Sprint 100 ─────────── Board-level per-type notification overrides; `board_notification_type_preferences`
──── External API, MCP & CLI ────────────────────────────────────────────────────────────────────
Sprint 101 ─────────── API Token infrastructure: DB table, CRUD endpoints, extend authenticate middleware
Sprint 102 ─────────── API Token UI: generate/list/revoke tokens in User Settings
Sprint 103 ─────────── External API surface audit: card money endpoint, comments endpoint, API reference doc
Sprint 104 ─────────── MCP server: 6 tools over stdio transport; Claude Desktop + Cursor setup
Sprint 105 ─────────── CLI: chimedeck CLI with 6 commands, token auth, --json mode
──── Admin Enhancements ─────────────────────────────────────────────────────────────────────────
Sprint 74 ──────────── Admin auto-verify external user email on invite
──── UI / UX Polish ─────────────────────────────────────────────────────────────────────────────
Sprint 75 ──────────── Full light/dark theme: audit + dual-mode Tailwind classes, no-flash init
Sprint 76 ──────────── Board background image upload; S3 storage; board card + search thumbnails
Sprint 77 ──────────── Granular search: scope selector (All / Boards / Cards) in command palette
──── Board Access Control ─────────────────────────────────────────────────────────
Sprint 78 ──────────── Board members table + visibility enforcement middleware
Sprint 79 ──────────── Board member management UI (visibility selector, members panel)
Sprint 80 ──────────── Guest scoped workspace UI and permission guards
──── Offline Experience ───────────────────────────────────────────────────────────
Sprint 82 ──────────── Rich text one-line toolbar overflow + inline attachment previews
Sprint 83 ──────────── Offline drafts for card description + comments with replay
──── Board UX & Access Improvements ───────────────────────────────────────────────
Sprint 84 ──────────── Board-scoped search bar inside board pages only
Sprint 85 ──────────── Collapsible sidebar drawer using Tailwind CSS
Sprint 86 ──────────── Search permission filtering to hide inaccessible boards
Sprint 87 ──────────── Auto-refresh board lists after board deletion
Sprint 88 ──────────── Card activity tracking: create, move, assign/unassign
Sprint 89 ──────────── Guest role split: VIEWER (read-only) vs MEMBER (board-scoped write)
──── Internationalisation (i18n) ──────────────────────────────────────────────────
Sprint 90 ──────────── i18n Phase 1: Comment, Activity, Attachment/Attachments extensions
Sprint 91 ──────────── i18n Phase 2: Automation extension (rules, buttons, schedules, run log)
Sprint 92 ──────────── i18n Phase 3: Plugins extension (modals, search bar, board panel)
Sprint 93 ──────────── i18n Phase 4: CustomFields, CalendarView, TimelineView, TableView
Sprint 94 ──────────── i18n Phase 5: Mention, Notifications, UserProfile, AdminInvite, Realtime, OfflineDrafts, BoardViews, common/layout — zero hardcoded strings
──── Email Infrastructure ───────────────────────────────────────────────────────────────────────
Sprint 121 ─────────── Email template centralisation: extract HTML to *.html files, Handlebars {{var}} binding, renderTemplate helper
──── Monitoring & Error Tracking ────────────────────────────────────────────────────────────────
Sprint 123 ─────────── Sentry end-to-end monitoring: React runtime errors + route tracing, Bun API error capture, shared release/environment tags, source map upload for deobfuscated stack traces
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
