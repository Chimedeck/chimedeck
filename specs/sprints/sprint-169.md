# Sprint 169 - Backend Repo Fetch + Specs Markdown Delivery

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 168 (Board Setting: GitHub Project URL)
> **Status:** ⬜ Future

---

## Goal

Create backend repository bridge functions that accept a GitHub project URL, download repository code locally, then read markdown files from the `specs` directory and deliver them to the client for viewing and editing.

---

## Strict Boundary

1. Fetch must use GitHub App installation token authentication.
2. Implement a function that receives project URL and returns downloaded repository path.
3. Commit/push of edits is handled in Sprint 170.

---

## Scope

### 1. Repository Download Function

Implement service contract:

- `downloadRepositoryFromProjectUrl({ projectUrl }): { repoPath, ref, fetchedAt }`

Behaviour:
- Validates incoming URL format.
- Downloads or refreshes local repo mirror/worktree.
- Returns absolute path to downloaded repository.

Fetch/auth implementation requirements:

- Use GitHub App installation token for authenticated clone/fetch.
- Use a server-side Git wrapper (recommended: `simple-git`) to run clone/fetch/checkout operations.
- Do not expose raw shell command execution to clients.
- Rotate or refresh installation token per request window and never log token values.
- Persist only repository metadata/cache keys; do not persist tokens.

### 2. Specs Markdown Reader

After obtaining `repoPath`:

1. Navigate to `repoPath/specs`.
2. Enumerate markdown files recursively (`**/*.md`).
3. Return file tree metadata and file content endpoint support.

API examples:
- `POST /api/v1/boards/:boardId/github/specs/load`
- `GET /api/v1/boards/:boardId/github/specs/file?path=...`

### 3. Access Control + Safety

- Only workspace members on the board can invoke load/read.
- Path traversal protection for file reads.
- Maximum file size guard for safe transport.

### 4. Caching Strategy

- Cache local repo path per board/url.
- Add refresh option to re-download latest default branch.

### 5. Performance Strategy (Load Path)

To avoid slow full-sync flows (fetch all -> send all -> save all), implement incremental transport:

- Return a lightweight manifest first (path, size, sha, updatedAt), not full file contents.
- Load markdown content on-demand per selected file.
- Support HTTP compression (gzip/br) and ETag/If-None-Match for file reads.
- Add pagination/virtualization for very large file trees.
- Keep a warm local repo cache with TTL-based refresh and explicit manual refresh.
- Deduplicate concurrent fetches using an in-flight lock per board/repo/ref.

Recommended endpoints:

- `POST /api/v1/boards/:boardId/github/specs/load` -> manifest only + repo metadata.
- `GET /api/v1/boards/:boardId/github/specs/file?path=...` -> one file content payload.
- Optional: `GET /api/v1/boards/:boardId/github/specs/file-meta?path=...` -> sha/etag check.

---

## Deliverables

1. Repository download function from project URL to local path.
2. Specs markdown listing and file-read APIs.
3. Board-member permission enforcement on repo/spec endpoints.
4. Path sanitization and file size limits.
5. Integration tests for load and read workflow.
6. GitHub App installation-token auth path for clone/fetch.
7. Manifest-first + lazy-file loading flow.

---

## Acceptance Criteria

1. Backend accepts project URL and returns a valid downloaded repo path.
2. Backend can list markdown files under `specs` recursively.
3. Client can request and receive markdown file content for viewing/editing.
4. Unauthorized users (including disallowed guests) cannot load/read specs.
5. Invalid file paths are rejected and cannot escape repo root.
6. Backend fetch operations authenticate using GitHub App installation token.
7. Initial docs load returns manifest quickly without transferring all file contents.
