# horiflow CLI

A command-line interface for [Horiflow](https://app.horiflow.com) that lets developers and power users perform core board operations directly from a terminal. Every command is a thin wrapper around the Horiflow REST API.

---

## Installation

### Global install via Bun

```sh
bun install --global
```

After installation, the `horiflow` binary is available on your `$PATH`.

### Run without installing

```sh
bun cli/index.ts <command> [options]
```

> **Requirement:** [Bun](https://bun.sh/) v1.0 or later.

---

## Authentication

All commands require an API token.

### 1. Generate a token

Open Horiflow → **Settings → API Tokens** → create a new token. Copy the `hf_...` value.

### 2. Export the token

```sh
export HORIFLOW_TOKEN=hf_your_token_here
```

Add that line to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) to persist it across sessions.

### 3. Per-command override

Pass `--token` directly when you need a different token for a single command:

```sh
horiflow --token hf_other_token move-card --card abc123 --list xyz789
```

The `--token` flag takes precedence over the environment variable.

### Error when token is missing

```
Error: No API token provided.
  Set HORIFLOW_TOKEN or use --token <value>.
  Generate a token at: Settings → API Tokens
```

The process exits with code **1**.

---

## Pointing at a local dev server

```sh
export HORIFLOW_API_URL=http://localhost:3000
```

The default is `https://app.horiflow.com`. The `--api-url` flag overrides this per command.

---

## Global flags

| Flag | Description |
|------|-------------|
| `--token <value>` | API token (overrides `HORIFLOW_TOKEN`) |
| `--api-url <value>` | API base URL (overrides `HORIFLOW_API_URL`) |
| `--json` | Output raw JSON (useful for scripting with `jq`) |
| `--help`, `-h` | Print help |
| `--version`, `-v` | Print version |

---

## Command reference

### `move-card`

Move a card to a different list.

```sh
horiflow move-card --card <cardId> --list <listId> [--position <number>]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--card` | ✓ | ID of the card to move |
| `--list` | ✓ | ID of the destination list |
| `--position` | | 0-based position in the list |

**Example:**

```sh
horiflow move-card --card card_abc123 --list list_xyz789 --position 0
# ✓ Card card_abc123 moved to list list_xyz789
```

---

### `comment`

Add a comment to a card.

```sh
horiflow comment --card <cardId> --text <text>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--card` | ✓ | ID of the card to comment on |
| `--text` | ✓ | Comment text |

**Example:**

```sh
horiflow comment --card card_abc123 --text "Great progress!"
# ✓ Comment added to card card_abc123
```

---

### `create-card`

Create a new card in a list.

```sh
horiflow create-card --list <listId> --title <title> [--description <text>]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--list` | ✓ | ID of the list |
| `--title` | ✓ | Card title |
| `--description` | | Card description |

**Example:**

```sh
horiflow create-card --list list_xyz789 --title "Add OAuth login" --description "Support Google and GitHub"
# ✓ Card created: card_new456
```

---

### `edit-description`

Update a card's description.

```sh
horiflow edit-description --card <cardId> --description <text>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--card` | ✓ | ID of the card |
| `--description` | ✓ | New description text |

**Example:**

```sh
horiflow edit-description --card card_abc123 --description "Updated scope: add GitHub OAuth only"
# ✓ Description updated for card card_abc123
```

---

### `set-price`

Set or clear a card's price.

```sh
horiflow set-price --card <cardId> --amount <number> --currency <code> [--label <text>]
horiflow set-price --card <cardId> --clear
```

| Flag | Required | Description |
|------|----------|-------------|
| `--card` | ✓ | ID of the card |
| `--amount` | ✓ (unless `--clear`) | Price amount (integer, e.g. `9900` for $99.00) |
| `--currency` | ✓ (unless `--clear`) | ISO 4217 currency code (e.g. `USD`) |
| `--label` | | Optional display label |
| `--clear` | | Remove the price; takes precedence over `--amount` |

**Examples:**

```sh
# Set a price
horiflow set-price --card card_abc123 --amount 9900 --currency USD --label Price
# ✓ Price set to 9900 USD for card card_abc123

# Clear the price
horiflow set-price --card card_abc123 --clear
# ✓ Price cleared for card card_abc123
```

---

### `invite`

Invite a user to a board. Requires admin permission on the board.

```sh
horiflow invite --board <boardId> --email <email> [--role <role>]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--board` | ✓ | ID of the board |
| `--email` | ✓ | Email address of the user to invite |
| `--role` | | `member` (default) or `admin` |

**Example:**

```sh
horiflow invite --board board_def456 --email alice@example.com --role member
# ✓ Invited alice@example.com to board board_def456 as member
```

If you lack admin permission, the API returns a `403` error and the CLI prints the error name and exits 1.

---

## Scripting with `--json` and `jq`

Pass `--json` to any command to receive raw JSON output, then pipe it into `jq` for further processing.

```sh
# Get the new card's ID after creation
CARD_ID=$(horiflow create-card --list list_xyz789 --title "Fix bug" --json | jq -r '.data.id')

# Use the ID in a follow-up command
horiflow set-price --card "$CARD_ID" --amount 500 --currency EUR
```

```sh
# Move a card and inspect the full response
horiflow move-card --card card_abc123 --list list_xyz789 --json | jq '.data'
```

---

## Getting help

```sh
horiflow --help                  # global usage
horiflow move-card --help        # command-specific usage
horiflow --version               # print version
```
