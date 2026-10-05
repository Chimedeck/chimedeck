# Sprint 170 - Specs Markdown Editor + Commit Sync

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 169 (Backend Repo Fetch + Specs Markdown Delivery)
> **Status:** ⬜ Future

---

## Goal

Deliver a client markdown editing workflow for loaded `specs` files and sync edited/new files back to the server so changes are committed (and pushed when configured) to the linked repository.

---

## Strict Boundary

1. This sprint builds view/edit/save/commit workflow for markdown specs files.
2. Repo download and file loading come from Sprint 169.
3. Branch/PR automation is optional and can be deferred.

---

## Scope

### 0. Board Navigation Entry Point

Add a board-level tab/button named `Documentation` in the board tab strip.

- Placement: directly next to `Health Check`.
- Behavior: clicking `Documentation` opens the specs markdown editor workspace.
- Route: `/boards/:boardId?tab=documentation`.
- Visibility: shown only when the board has a valid `GitHub Project URL` configured; otherwise hidden.
- Permission: visible to users who can view board docs; edit controls inside editor remain role-gated.

Tab order requirement (when all tabs are enabled):

`Board | Table | Calendar | Timeline | Health Check | Documentation`

### 1. Markdown Editor UI

In board-integrated specs workspace:

- Editor stack: TipTap in Markdown mode (single source content stored as markdown text).
- Left file tree for `specs/**/*.md`.
- Main markdown editor pane (view + edit).
- Unsaved changes indicator and dirty-file tracking.
- Optional preview split mode.
- Workspace opens from the board `Documentation` tab and is not a separate app route.

TipTap requirements:

- Markdown-first serialization/deserialization for open/save flows.
- Toolbar profile tuned for specs authoring (headings, bold/italic, lists, code block, links, blockquote, horizontal rule).
- Keyboard shortcuts aligned with common markdown editors.
- Preserve markdown source fidelity (no HTML-only storage).

### 2. Save API

Send edits/new files to backend:

- `PUT /api/v1/boards/:boardId/github/specs/file`

Request supports:
- file path
- markdown content
- create new file when path does not exist

Performance requirements:

- Send only changed files (delta payload), not entire docs tree.
- Debounce autosave requests and coalesce bursts into a single request window.
- Support optimistic local state + background save confirmation.
- Use ETag/sha precondition to prevent stale overwrite (`If-Match` style guard).

### 3. Commit Workflow

Add backend operation:

- `POST /api/v1/boards/:boardId/github/specs/commit`

Payload:
- commit message
- changed file list

Server behaviour:
1. Write file updates to local repo worktree.
2. Stage changed/new markdown files.
3. Create git commit.
4. Push when remote credentials are configured; otherwise return commit hash and push-pending state.

Implementation contract:

- Use a server-side Git service wrapper (recommended: `simple-git`) for add/commit/push operations.
- Commit metadata must include actor id and board id in commit body footer.
- Commit scope is restricted to `specs/**/*.md` paths only.
- Branch target defaults to repository default branch unless board-level override is configured later.
- Push authentication uses GitHub App installation token.
- Commit author/committer identity uses the app alias bot (for example `app-alias[bot]`).
- Commit message footer must include bot identity + initiating actor reference for audit traceability.

### 4. Permissions + Validation

- Only workspace members with edit rights can save/commit.
- Guests can edit only if board policy explicitly allows it.
- Non-markdown file writes are rejected.

---

## Deliverables

1. Board tab/button `Documentation` next to `Health Check`, wired to open docs editor panel.
1. Client markdown editor using TipTap Markdown mode with file tree and dirty-state handling.
2. Save endpoint wiring for edited/new markdown files.
3. Backend git commit operation for specs changes via Git service wrapper.
4. Permission checks for save/commit actions.
5. Integration and E2E tests for end-to-end edit to commit flow.
6. Delta-save + debounce flow to avoid full document round-trips.
7. Bot-alias commit identity and installation-token push flow.

---

## Acceptance Criteria

1. `Documentation` appears in board tabs directly next to `Health Check` when docs integration is available.
1. User can open and edit markdown files loaded from `specs`.
2. User can create new markdown file and save it through API.
3. Server writes edits/new files to repo and creates git commit.
4. Commit response includes commit hash and push status.
5. Unauthorized users cannot save or commit.
6. Non-markdown writes are blocked with `422` error.
7. TipTap editor round-trips markdown files without destructive formatting drift for supported syntax.
8. Commits are authored by app bot alias and include initiating actor reference in metadata/footer.
9. Save path transmits changed file payload only and avoids full-tree resubmission.
