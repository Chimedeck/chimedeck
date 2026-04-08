#!/bin/bash

# E2E Test Runner using GitHub Copilot CLI + MCP
# This script reads a single test scenario (.md) and executes it via Copilot CLI
# with the Playwright MCP server.
#
# CONVENTION: All test scenario files MUST live in specs/tests/.
# For every developed feature a corresponding test case must be created there
# in Markdown format (e.g. specs/tests/login-flow.md).
# Run a specific test : ./run-test.sh specs/tests/<scenario>.md
# Run all tests       : ./run-all-tests-full.sh

set -e

TEST_FILE="${1:-specs/tests/login-flow.md}"
BASE_URL="${BASE_URL:-http://localhost:5173}"

echo "🧪 Running E2E Test: $TEST_FILE"
echo "🌐 Base URL: $BASE_URL"
echo "----------------------------------------"

# Read the test file
if [ ! -f "$TEST_FILE" ]; then
    echo "❌ Test file not found: $TEST_FILE"
    exit 1
fi

TEST_CONTENT=$(cat "$TEST_FILE")

# ─── Ensure ~/.copilot/mcp-config.json exists ───────────────────────────────
COPILOT_MCP_CONFIG="$HOME/.copilot/mcp-config.json"
DEFAULT_MCP_CONFIG='{
  "mcpServers": {
    "playwright": {
      "type": "local",
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "env": {},
      "tools": ["*"]
    }
  }
}'

if [ ! -f "$COPILOT_MCP_CONFIG" ]; then
    echo ""
    echo "⚠️  ~/.copilot/mcp-config.json not found."
    echo ""
    echo "  [1] Create default config (Playwright MCP via npx)"
    echo "  [2] Copy from existing VS Code MCP config"
    echo "  [3] Abort"
    echo ""
    printf "Choose [1/2/3]: "
    read -r CHOICE </dev/tty

    case "$CHOICE" in
        1)
            mkdir -p "$HOME/.copilot"
            echo "$DEFAULT_MCP_CONFIG" > "$COPILOT_MCP_CONFIG"
            echo "✅ Created $COPILOT_MCP_CONFIG with default Playwright config."
            ;;
        2)
            # Find candidate VS Code mcp.json files
            VSCODE_MCP=""
            if [ -f ".vscode/mcp.json" ]; then
                VSCODE_MCP=".vscode/mcp.json"
            elif [ -f "$HOME/Library/Application Support/Code/User/mcp.json" ]; then
                VSCODE_MCP="$HOME/Library/Application Support/Code/User/mcp.json"
            fi

            if [ -z "$VSCODE_MCP" ]; then
                echo "❌ No VS Code mcp.json found. Aborting."
                exit 1
            fi

            echo "📋 Found: $VSCODE_MCP"
            printf "Copy this file to ~/.copilot/mcp-config.json? [y/N]: "
            read -r CONFIRM </dev/tty
            if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
                mkdir -p "$HOME/.copilot"
                cp "$VSCODE_MCP" "$COPILOT_MCP_CONFIG"
                echo "✅ Copied to $COPILOT_MCP_CONFIG"
            else
                echo "❌ Aborted."
                exit 1
            fi
            ;;
        *)
            echo "❌ Aborted."
            exit 1
            ;;
    esac
    echo ""
fi
# ─────────────────────────────────────────────────────────────────────────────

# Create the prompt for Copilot safely via heredoc (avoids quoting issues)
PROMPT=$(cat <<'EOP'
You are an automated end-to-end test runner. Your ONLY job is to execute the
test scenario below by driving a real browser exclusively through Playwright MCP tools.

════════════════════════════════════════════════════════════
ABSOLUTE PROHIBITIONS — any violation is an immediate failure:
════════════════════════════════════════════════════════════
A. NEVER use any HTTP fetch, web fetch, or URL retrieval tool to inspect the app.
   The following are permanently forbidden for interacting with the app:
     - fetch_webpage / fetch web content / any tool that fetches a URL as HTML
     - curl, wget, or any HTTP client tool
   These tools do NOT execute JavaScript and will only return a blank React shell.
   They will always fail. Use mcp_playwright_browser_navigate instead — it opens
   a real browser that runs the full React app.

B. NEVER run any terminal or shell command related to Playwright. The following
   are permanently forbidden, no exceptions:
     - npx playwright ...
     - playwright codegen ...
     - playwright test ...
     - npx playwright codegen ...
     - Any shell command that installs, launches, or wraps Playwright via CLI
   If you feel the urge to run a terminal command to open a browser or record
   actions, STOP — use the MCP tool instead.

C. NEVER generate, write, or execute a .spec.ts / .spec.js / playwright test file.
   Do not write code. Do not produce test scripts. Execute steps directly.

D. NEVER open a new terminal session to run Playwright. The terminal is only
   permitted for `bun run dev` if the app is not already running (rule 6 below).

E. If mcp_playwright_browser_* tools are not present in your available toolset,
   or a call to one of them returns a connection/transport error:
   → Output exactly: "ERROR: MCP_NOT_CONNECTED — Playwright MCP server unavailable."
   → Then STOP. Do NOT attempt any shell or CLI fallback whatsoever.

════════════════════════════════════════
MANDATORY RULES:
════════════════════════════════════════
1. DO NOT output a plan, summary, or description of what you are about to do.
   Your FIRST action must be a Playwright MCP tool call — no text before it.
   Opening phrases like "I will now...", "Proceeding to...", "Let me..." are forbidden.

2. Use ONLY Playwright MCP browser tools for every UI step.
   Every permitted tool name matches the pattern: mcp_playwright_browser_*
   (i.e. any tool whose name starts with "mcp_playwright_browser_").
   These are the ONLY tools permitted for browser interaction.
   To visit a page: call mcp_playwright_browser_navigate, then immediately call
   mcp_playwright_browser_snapshot to read the rendered DOM. NEVER use a fetch
   or HTTP tool to inspect pages — they cannot execute JavaScript.

3. Execute steps ONE AT A TIME. After each MCP tool call completes, inspect the
   result, then immediately issue the next MCP tool call. Do not batch or defer.

4. All credentials and the base URL come from specs/tests/TEST_CREDENTIALS.md.
   Read that file first. Never hard-code URLs, emails, or passwords.

5. "The test does not exist" is NOT a valid response. The scenario below IS the
   test. Execute it live in the browser right now using MCP tools.

6. Only if the app is unreachable (connection refused on the base URL), run
   `bun run dev` in the terminal, wait for it to be ready, then continue with
   MCP browser tools. Do not run any other terminal commands.

7. After each step record PASS or FAIL inline, then move immediately to the next step.

8. Only after ALL steps have been executed via MCP tool calls, output the final summary.

Scenario:
EOP
)

# Append dynamic content to the prompt
PROMPT="$PROMPT
Base URL: $BASE_URL

$TEST_CONTENT

After executing ALL steps in the browser, provide a summary:
- Total steps executed
- Steps passed
- Steps failed (with exact error / screenshot reference)
- Final verdict: PASS or FAIL

REMINDER: verdict must reflect what you actually observed in the browser,
not a static analysis of the codebase."

# Ensure Copilot CLI is available
if ! command -v copilot >/dev/null 2>&1; then
    echo "❌ GitHub Copilot CLI not found on PATH (command 'copilot')."
    echo "📎 Install or expose the CLI, then re-run."
    exit 1
fi

# Recursively kill a process and all its descendants (macOS-compatible)
_kill_tree() {
    local pid=$1
    for child in $(pgrep -P "$pid" 2>/dev/null); do
        _kill_tree "$child"
    done
    kill -KILL "$pid" 2>/dev/null || true
}

COPILOT_PID=""
_cleanup() {
    echo ""
    echo "⚠️  Interrupted — killing test process."
    [ -n "$COPILOT_PID" ] && _kill_tree "$COPILOT_PID"
    exit 130
}
trap _cleanup INT TERM

COPILOT_MODEL="${COPILOT_MODEL:-gpt-4.1}"

# Run via GitHub Copilot CLI — picks up ~/.copilot/mcp-config.json automatically.
# Run in background so we can trap signals and kill the full process tree.
copilot --allow-all-tools --add-dir "$PWD" --model "$COPILOT_MODEL" -p "$PROMPT" &
COPILOT_PID=$!
wait $COPILOT_PID
COPILOT_STATUS=$?
trap - INT TERM

echo "----------------------------------------"
echo "✅ Test execution completed"
exit $COPILOT_STATUS
