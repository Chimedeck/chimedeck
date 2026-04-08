# ChimeDeck: How We Built a Full Trello Replacement in Weeks Using an AI Agent Loop

## The Problem: Trello Was Costing Too Much for What It Was

Like most software teams, we had been running on Trello for years. It worked. It was familiar. And then the invoice arrived one month and someone actually looked at it.

Seat costs had compounded quietly as the team grew. We were paying for a tool that stored our data in someone else's cloud, gave us no ability to customise the workflow to fit how we actually ship software, and locked us into a pricing model that scaled with headcount rather than with value. Every time we wanted something slightly different — a custom field, a domain-specific card attribute, an integration with our own infrastructure — we hit a wall.

The conversation that followed went something like this:

> "We should find a cheaper alternative."  
> "There are open-source ones, but they all need maintenance."  
> "We're a software company. We *are* the alternative."

That was the moment ChimeDeck was decided.

---

## What We Set Out to Build

We did not want a minimal Kanban clone. We wanted a production-grade, self-hosted collaborative task management platform that we could extend ourselves. The requirements we set from day one:

- **Workspaces → Boards → Cards** hierarchy, with full role-based access control
- **Real-time collaboration** — every connected user sees changes within one second, with optimistic UI and conflict resolution
- **Event sourcing** — an append-only activity log so nothing is ever truly lost
- **A plugin system** — so any future capability could be shipped as an isolated extension without touching core
- **An automation engine** — trigger/action rules, scheduled commands, and a quota system
- **An MCP server and CLI** — so AI agents and scripts could interact with the board programmatically
- **AWS SES email flows** — verification, password reset, mention notifications, board activity digests

The full feature surface mapped to 123 named sprints in the plan. We were not going to build it by hand.

---

## The Stack Bet

Every technology decision pointed at speed of iteration over flexibility later:

- **Bun** as the runtime — native TypeScript, no build step, built-in WebSocket server, the fastest cold start we could get
- **PostgreSQL 16** for everything that needs to persist — ACID transactions, JSONB event payloads, `pg_notify` for single-node pub/sub, full-text search via `tsvector`/GIN
- **Knex** for migrations — readable SQL-first TypeScript files, no generated client to keep in sync
- **React + Vite + Tailwind + Redux Toolkit** on the client
- **Redis** as an optional layer — pub/sub fan-out at scale, presence TTLs, rate-limit sliding windows
- **MinIO / S3-compatible** for file storage — attachments, board backgrounds, avatars, with LocalStack in development

Docker Compose wired all of it together locally. Terraform managed the production fleet.

---

## How the Agent Loop Built It

This is where the story gets interesting.

We wrote a shell script — `start-agent-loop.sh` — that runs GitHub Copilot in a structured four-phase loop, one feature at a time, indefinitely.

### The Four Phases

**Recap** (`gpt-4.1`) — Before any code is written, the agent reads the sprint plan, the architecture specs, and the most recent changelog entries to understand exactly where the project stands. It produces 5–10 bullets summarising what exists, what is owed, and what blockers remain.

**Planning** (`gpt-4.1`) — The agent reads the requirements file as the authoritative source of truth, then produces a numbered implementation plan: every file to create or modify, the one-sentence purpose of each change, any pattern adapted from the reference repo, and the tests that will verify the work. Scope is capped at two intertwined features per iteration to keep changes reviewable.

**Execute** (`claude-sonnet-4.6`) — The most capable model in the chain implements exactly what the plan described. No scope creep. After finishing, it writes a short summary of what changed and emits `DONE_ALL_TASKS` only when all acceptance criteria across the full task are met.

**Retest** (`gpt-4.1` scout, then `gpt-4.1` evaluator) — A scout model first decides whether full browser testing is warranted: skip it for doc-only changes; run it for any UI, API, or auth change, or when three or more files were touched. When testing is required, a second model uses **Playwright MCP** to open a real browser, navigate to every affected view, execute the happy path step by step, take screenshots, run at least one error scenario, and report PASS or FAIL per flow. If something fails, the bug description feeds the next iteration.

A changelog is then written to `specs/changelog/YYYYMMDD_HHMMSS.md` with four standardised sections — Update, New, Technical Debt, What Should Be Done Next — creating a permanent audit trail of every decision and deferral.

### Guardrails for the First Run

When no architecture document existed yet, the loop detected the empty `specs/architecture/` directory and entered a bootstrap phase. It ran Recap and Planning only, produced the full architecture document — system overview, domain model, folder conventions, data flow, open questions — and then paused for a human to review and approve before a single line of implementation was written.

After that gate, subsequent iterations ran autonomously until the task was complete or a human rejected a plan.

### What Playwright MCP Actually Did

The browser testing was not stubbed. Playwright MCP opened a live Chromium instance against the running dev server on each iteration that touched the UI. It:

- Signed up a new user and verified the email flow
- Created workspaces, boards, lists, and cards end-to-end
- Dragged cards between columns and confirmed the `PATCH /move` response and the DOM update
- Opened the card detail modal and verified Markdown rendering, label chips, assignees, due dates, and checklists
- Submitted comments and confirmed they appeared for a second connected browser without a page refresh
- Uploaded attachments and confirmed S3 pre-signed URL generation
- Tested the plugin iframe injection and the postMessage bridge
- Verified that automation rules fired and appeared in the run log

When it found bugs Copilot can read the or see the problem directly and attempt to solve it.

---

## What Got Built

Over the course of weeks, the loop delivered:

**Core collaboration** — Full workspace/board/list/card CRUD with RBAC, drag-and-drop reordering via fractional lexicographic indexing, real-time WebSocket sync with optimistic mutations, conflict resolution toasts, and a complete event-sourced activity log.

**Rich card detail** — Markdown descriptions with a rich text toolbar, labels, member assignments, due dates, checklists, attachments (S3 upload + external URL), and inline comment threads with edit history.

**Authentication and accounts** — Email/password login, OAuth (Google + GitHub), JWT with refresh token rotation, email verification via AWS SES, password reset, profile settings with avatar upload, and a full change-email flow with confirmation to the new address.

**Admin and access control** — Workspace role hierarchy (Owner/Admin/Member/Viewer/Guest), board visibility settings (Private/Workspace/Public), a platform-admin invite flow that creates external users with optional auto-verification and sends credentials via SES, and configurable email domain restrictions.

**Plugin system** — A board-plugin architecture with iframe injection, a postMessage bridge exposing the full Trello Power-Up-style context API (`t.card()`, `t.board()`, `t.list()`, `t.member()`, `t.get()`, `t.set()`), card-badges and card-buttons injection points, a plugin registry with API key generation, domain whitelisting, and a plugin discovery/enable UI per board.

**Automation engine** — Trigger/action rules covering 15 trigger types and 18 action types, a `pg_cron`-backed scheduler for due-date and calendar commands, a run log with real-time updates, a quota system capped per board per month, and a full Rules Builder UI in a slide-in panel.

**Notifications** — In-app notification bell with a panel, @mention detection and autocomplete, board-activity notifications (card created/moved/commented), per-type notification preferences with email channel support via SES, per-board global toggles, and a master on/off setting in profile.

**External API surface** — SHA-256-hashed API tokens with prefix display, a token management UI in settings, an MCP stdio server with six tools (move card, write comment, create card, edit description, set card price, invite to board), and a `chimedeck` Bun CLI covering the same six operations.

**Monetization fields** — `amount` and `currency` columns on cards, a `CardMoneyBadge` on tiles, an editable Value section in the card modal, board-level `monetization_type` settings, and a Stripe embedded checkout flow via PaymentIntents.

**Multiple board views** — Kanban (DnD), Table, Calendar (monthly/weekly), and Timeline/Gantt with swimlanes. A `user_board_view_prefs` table persists the last-used view per user per board.

**Search and presence** — Full-text search via PostgreSQL `tsvector` with a ⌘K command palette, scoped search (All/Boards/Cards), board-local search bar, and presence avatars with Redis TTL.

**Observability and deployment** — OpenTelemetry traces and metrics, Redis sliding-window rate limiting, Sentry for client and server error capture, multi-stage Dockerfiles, Terraform modules for ASG blue/green and fixed-fleet SSH deployments, and CI pipeline templates for both strategies.

---

## The Numbers

The changelog directory contains over **400 timestamped entries** spanning from 2 March 2026 to 31 March 2026 — roughly four weeks of agent-loop iterations running across multiple daily sessions. Each entry documents what changed, what was deferred, and what comes next.

The sprint plan covers **123 named sprint specifications**. The majority of the core platform and its extensions are implemented. The remaining future items — calendar views, guest role splits, ClamAV virus scanning, advanced i18n phases — are fully specced and ready for the next loop run.

---

## What We Learned

**The loop compounds.** Each changelog became the context for the next recap. The agent never forgot what it had deferred, because the deferred items were always written down. This meant technical debt accrued intentionally and visibly rather than silently.

**Playwright MCP is not optional.** The browser-in-the-loop is what separated "the code looks right" from "the feature works." Several bugs — most memorably the drag-and-drop `useCallback` closure that caused an infinite React re-render — were invisible in static analysis and only surfaced when a real browser dragged a card.

**Small scope per iteration is load-bearing.** The two-feature cap per iteration sounds conservative. In practice, it meant every iteration's diff was reviewable in minutes, every test was targeted rather than broad, and rollback was never catastrophic.

**You still need an architect.** The agent followed the architecture document faithfully. Someone had to write that document, approve the plans, and decide which technical debts were acceptable. The loop handled the implementation. The humans handled the decisions.

---

## Where It Is Now

ChimeDeck runs in production. The data was migrated via a custom import script from the exported Trello JSON. The team uses it daily, and when something is missing, we add it — without filing a feature request, without waiting for a roadmap, without paying per seat.

That was the point.
