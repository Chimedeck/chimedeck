# chimedeck CLI

A command-line interface for [ChimeDeck](https://app.chimedeck.com) that lets developers and power users perform core board operations directly from a terminal. Every command is a thin wrapper around the ChimeDeck REST API.

---

## Installation

### Global install via npm (recommended)

```sh
npm install -g chimedeck
```

After installation, the `chimedeck` binary is available on your `$PATH`. Requires [Node.js](https://nodejs.org/) v18 or later.

### Global install via Bun

```sh
bun install --global
```

> **Requirement:** [Bun](https://bun.sh/) v1.0 or later.

### Run without installing

```sh
bun cli/index.ts <command> [options]
```

---

## Local development install

Use this when working on the CLI source itself or testing changes before publishing.

**1. Clone the repo and install dependencies:**

```sh
git clone https://github.com/your-org/chimedeck.git
cd chimedeck
bun install
```

**2. Build the CLI:**

```sh
bun run build:cli
```

This compiles `cli/index.ts` → `dist/cli/index.js` and adds the correct Node.js shebang.

**3. Link it globally:**

```sh
npm link
```

Run this from the **project root** (where `package.json` lives). The `chimedeck` command will now resolve to your local `dist/cli/index.js`.

**4. Rebuild after changes:**

```sh
bun run build:cli
# No need to re-link — the symlink picks up the new file automatically.
```

**5. Unlink when done:**

```sh
npm unlink -g chimedeck
```

---

## Authentication

All commands require an API token.

### 1. Generate a token

Open ChimeDeck → **Settings → API Tokens** → create a new token. Copy the `hf_...` value.

### 2. Export the token

```sh
export CHIMEDECK_TOKEN=hf_your_token_here
```

Add that line to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) to persist it across sessions.

### 3. Per-command override

Pass `--token` directly when you need a different token for a single command:

```sh
chimedeck --token hf_other_token move-card --card abc123 --list xyz789
```

The `--token` flag takes precedence over the environment variable.

### Error when token is missing

```
Error: No API token provided.
  Set CHIMEDECK_TOKEN or use --token <value>.
  Generate a token at: Settings → API Tokens
```

The process exits with code **1**.

---

## Pointing at a local dev server

```sh
export CHIMEDECK_API_URL=http://localhost:3000
```

The default is `https://app.chimedeck.com`. The `--api-url` flag overrides this per command.

---

## Global flags

| Flag | Description |
|------|-------------|
| `--token <value>` | API token (overrides `CHIMEDECK_TOKEN`) |
| `--api-url <value>` | API base URL (overrides `CHIMEDECK_API_URL`) |
| `--json` | Output raw JSON (useful for scripting with `jq`) |
| `--help`, `-h` | Print help |
| `--version`, `-v` | Print version |

---

## Command reference

### `move-card`

Move a card to a different list.

```sh
chimedeck move-card --card <cardId> --list <listId> [--position <number>]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--card` | ✓ | ID of the card to move |
| `--list` | ✓ | ID of the destination list |
| `--position` | | 0-based position in the list |

**Example:**

```sh
chimedeck move-card --card card_abc123 --list list_xyz789 --position 0
# ✓ Card card_abc123 moved to list list_xyz789
```

---

### `comment`

Add a comment to a card.

```sh
chimedeck comment --card <cardId> --text <text>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--card` | ✓ | ID of the card to comment on |
| `--text` | ✓ | Comment text |

**Example:**

```sh
chimedeck comment --card card_abc123 --text "Great progress!"
# ✓ Comment added to card card_abc123
```

---

### `create-card`

Create a new card in a list.

```sh
chimedeck create-card --list <listId> --title <title> [--description <text>]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--list` | ✓ | ID of the list |
| `--title` | ✓ | Card title |
| `--description` | | Card description |

**Example:**

```sh
chimedeck create-card --list list_xyz789 --title "Add OAuth login" --description "Support Google and GitHub"
# ✓ Card created: card_new456
```

---

### `edit-description`

Update a card's description.

```sh
chimedeck edit-description --card <cardId> --description <text>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--card` | ✓ | ID of the card |
| `--description` | ✓ | New description text |

**Example:**

```sh
chimedeck edit-description --card card_abc123 --description "Updated scope: add GitHub OAuth only"
# ✓ Description updated for card card_abc123
```

---

### `set-price`

Set or clear a card's price.

```sh
chimedeck set-price --card <cardId> --amount <number> --currency <code> [--label <text>]
chimedeck set-price --card <cardId> --clear
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
chimedeck set-price --card card_abc123 --amount 9900 --currency USD --label Price
# ✓ Price set to 9900 USD for card card_abc123

# Clear the price
chimedeck set-price --card card_abc123 --clear
# ✓ Price cleared for card card_abc123
```

---

### `invite`

Invite a user to a board. Requires admin permission on the board.

```sh
chimedeck invite --board <boardId> --email <email> [--role <role>]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--board` | ✓ | ID of the board |
| `--email` | ✓ | Email address of the user to invite |
| `--role` | | `member` (default) or `admin` |

**Example:**

```sh
chimedeck invite --board board_def456 --email alice@example.com --role member
# ✓ Invited alice@example.com to board board_def456 as member
```

If you lack admin permission, the API returns a `403` error and the CLI prints the error name and exits 1.

---

### `get-card`

Retrieve full details of a card (title, description, list, price, labels, members).

```sh
chimedeck get-card --card <cardId>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--card` | ✓ | ID of the card to retrieve |

**Example:**

```sh
chimedeck get-card --card card_abc123
chimedeck get-card --card card_abc123 --json | jq '.data.title'
```

---

### `search-cards`

Full-text search over all cards within a workspace.

```sh
chimedeck search-cards --workspace <workspaceId> --query <text> [--limit <number>]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--workspace` | ✓ | ID of the workspace to search within |
| `--query` | ✓ | Search query |
| `--limit` | | Max results to return (default: 20) |

**Example:**

```sh
chimedeck search-cards --workspace ws_123 --query "payment bug" --limit 10
chimedeck search-cards --workspace ws_123 --query "refund" --json | jq '.data[].title'
```

---

### `search-board`

Full-text search over cards scoped to a single board.

```sh
chimedeck search-board --board <boardId> --query <text> [--limit <number>]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--board` | ✓ | ID of the board to search within |
| `--query` | ✓ | Search query |
| `--limit` | | Max results to return |

**Example:**

```sh
chimedeck search-board --board board_def456 --query "OAuth"
chimedeck search-board --board board_def456 --query "bug" --limit 5 --json | jq '.data'
```

---

Pass `--json` to any command to receive raw JSON output, then pipe it into `jq` for further processing.

```sh
# Get the new card's ID after creation
CARD_ID=$(chimedeck create-card --list list_xyz789 --title "Fix bug" --json | jq -r '.data.id')

# Use the ID in a follow-up command
chimedeck set-price --card "$CARD_ID" --amount 500 --currency EUR
```

```sh
# Move a card and inspect the full response
chimedeck move-card --card card_abc123 --list list_xyz789 --json | jq '.data'
```

---

## Getting help

```sh
chimedeck --help                  # global usage
chimedeck move-card --help        # command-specific usage
chimedeck --version               # print version
```
