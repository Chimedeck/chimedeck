# Sprint 105 — CLI

> **Status:** Planned
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 101 (API Token auth), Sprint 103 (External API surface)

---

## Goal

Deliver a **`horiflow` CLI** that lets developers and power users perform the 6 core Horiflow operations directly from a terminal. The CLI is a pure API client — it contains zero business logic; every action is a thin wrapper around the existing REST endpoints from Sprint 103.

Authentication is via the same API token from Sprint 101, supplied as:
- The `HORIFLOW_TOKEN` environment variable, **or**
- The `--token <value>` global flag.

The `HORIFLOW_API_URL` environment variable (default `https://app.horiflow.com`) overrides the API base URL for local development.

---

## Acceptance Criteria

- [ ] `cli/index.ts` is executable as `bun cli/index.ts <command>` and via `horiflow` if installed globally
- [ ] Shebang line is `#!/usr/bin/env bun`
- [ ] 6 sub-commands: `move-card`, `comment`, `create-card`, `edit-description`, `set-price`, `invite`
- [ ] `--token` global flag and `HORIFLOW_TOKEN` env var both accepted; flag takes precedence
- [ ] Missing token prints a helpful error pointing to User Settings and exits 1
- [ ] Each command prints success output as pretty-printed JSON or a one-line confirmation
- [ ] `--json` global flag forces raw JSON output (useful for scripting)
- [ ] `horiflow --help` and `horiflow <command> --help` print usage
- [ ] `cli/README.md` documents installation and all 6 commands with examples

---

## Scope

### 1. CLI entry point

**`cli/index.ts`**

```ts
#!/usr/bin/env bun
/**
 * horiflow CLI — calls the Horiflow REST API on behalf of the user.
 * Usage: horiflow [--token <token>] [--json] <command> [options]
 */
```

Use a minimal argument-parsing library (`minimist` — already common in Bun projects, or `yargs` for richer help). Choose the one that keeps the CLI dependency footprint smallest.

Global flags:
- `--token <value>` — override `HORIFLOW_TOKEN`
- `--api-url <value>` — override `HORIFLOW_API_URL`
- `--json` — output raw JSON
- `--help` / `-h` — print help
- `--version` / `-v` — print version from `package.json`

---

### 2. Config module

**`cli/config.ts`**

```ts
export function resolveConfig({ tokenFlag, apiUrlFlag }: { tokenFlag?: string; apiUrlFlag?: string }) {
  const token = tokenFlag ?? Bun.env.HORIFLOW_TOKEN ?? '';
  const apiUrl = apiUrlFlag ?? Bun.env.HORIFLOW_API_URL ?? 'https://app.horiflow.com';
  if (!token) {
    console.error('Error: No API token provided.\n  Set HORIFLOW_TOKEN or use --token <value>.\n  Generate a token at: Settings → API Tokens');
    process.exit(1);
  }
  return { token, apiUrl };
}
```

---

### 3. API client

**`cli/apiClient.ts`**

Shared fetch helper used by all commands:
```ts
export async function call<T>({
  config,
  method,
  path,
  body,
}: {
  config: { token: string; apiUrl: string };
  method: string;
  path: string;
  body?: unknown;
}): Promise<T>
```

- Attaches `Authorization: Bearer <token>` header.
- On 4xx/5xx: prints the error name from the response body and exits with code 1.
- On network error: prints a user-friendly message and exits 1.

---

### 4. Command implementations

**`cli/commands/`**

```
commands/
  moveCard.ts         # move-card
  comment.ts          # comment
  createCard.ts       # create-card
  editDescription.ts  # edit-description
  setPrice.ts         # set-price
  invite.ts           # invite
```

#### `move-card`
```
horiflow move-card --card <cardId> --list <listId> [--position <n>]
```
→ `PATCH /api/v1/cards/:cardId/move`

#### `comment`
```
horiflow comment --card <cardId> --text "Great progress!"
```
→ `POST /api/v1/cards/:cardId/comments`

#### `create-card`
```
horiflow create-card --list <listId> --title "New task" [--description "Details..."]
```
→ `POST /api/v1/lists/:listId/cards`

#### `edit-description`
```
horiflow edit-description --card <cardId> --description "Updated description"
```
→ `PATCH /api/v1/cards/:cardId/description`

#### `set-price`
```
horiflow set-price --card <cardId> [--amount 9900] [--currency USD] [--label Price]
horiflow set-price --card <cardId> --clear   # clears the price
```
→ `PATCH /api/v1/cards/:cardId/money`

#### `invite`
```
horiflow invite --board <boardId> --email user@example.com [--role member|observer]
```
→ `POST /api/v1/boards/:boardId/members`

---

### 5. Output formatting

**`cli/output.ts`**

```ts
export function print(data: unknown, jsonMode: boolean): void
```

- `jsonMode = true`: `console.log(JSON.stringify(data, null, 2))`
- `jsonMode = false`: pretty-print key facts (e.g. "✓ Card moved to list {listName}")

---

### 6. README

**`cli/README.md`**

Cover:
1. Install globally: `bun install --global` or add to `$PATH`.
2. Authentication: generate token in UI → `export HORIFLOW_TOKEN=hf_...`.
3. Point at local dev: `export HORIFLOW_API_URL=http://localhost:3000`.
4. Command reference with one example per command.
5. Scripting tip: use `--json` + `jq` for pipelines.

---

### 7. `package.json` — bin entry

Add to `package.json`:
```json
{
  "bin": {
    "horiflow": "cli/index.ts"
  }
}
```

---

## File Checklist

| File | Change |
|------|--------|
| `cli/index.ts` | CLI entry point + command dispatcher |
| `cli/config.ts` | Token + API URL resolution |
| `cli/apiClient.ts` | Fetch wrapper |
| `cli/output.ts` | Pretty-print vs JSON output |
| `cli/commands/moveCard.ts` | `move-card` command |
| `cli/commands/comment.ts` | `comment` command |
| `cli/commands/createCard.ts` | `create-card` command |
| `cli/commands/editDescription.ts` | `edit-description` command |
| `cli/commands/setPrice.ts` | `set-price` command |
| `cli/commands/invite.ts` | `invite` command |
| `cli/README.md` | Setup + command reference |
| `package.json` | Add `bin.horiflow` entry |

---

## Tests

| ID | Scenario | Expected |
|----|----------|---------|
| T1 | `horiflow move-card --card X --list Y` | Prints confirmation; exit 0 |
| T2 | `horiflow comment --card X --text "hi"` | Comment created; prints confirmation |
| T3 | `horiflow create-card --list X --title "Task"` | Card created; prints card id |
| T4 | `horiflow edit-description --card X --description "desc"` | Description updated |
| T5 | `horiflow set-price --card X --amount 5000 --currency USD` | Price updated |
| T6 | `horiflow set-price --card X --clear` | Price cleared |
| T7 | `horiflow invite --board X --email u@example.com` | Member invited or 403 shown clearly |
| T8 | No token set, no --token flag | Helpful error + exit 1 |
| T9 | Any command with `--json` | Raw JSON output |
| T10 | `horiflow --help` | Usage printed; exit 0 |
| T11 | `horiflow move-card --help` | Command-specific usage printed |
