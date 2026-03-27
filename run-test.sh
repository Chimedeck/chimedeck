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

# Resolve MCP config path — workspace-local first, then VS Code global fallback
# Override precedence:
#   MCP_CONFIG_PATH          — explicit path to use (skips all auto-detection)
#   MCP_CONFIG_GLOBAL_PATH   — overrides the global VS Code fallback location
MCP_CONFIG_GLOBAL_PATH="${MCP_CONFIG_GLOBAL_PATH:-$HOME/Library/Application Support/Code/User/mcp.json}"
if [ -z "${MCP_CONFIG_PATH:-}" ]; then
    if [ -f ".vscode/mcp.json" ]; then
        MCP_CONFIG_PATH=".vscode/mcp.json"
    else
        MCP_CONFIG_PATH="$MCP_CONFIG_GLOBAL_PATH"
    fi
fi
if [ ! -f "$MCP_CONFIG_PATH" ]; then
    echo "❌ MCP config not found: $MCP_CONFIG_PATH"
    echo "ℹ️  Set MCP_CONFIG_PATH (explicit) or MCP_CONFIG_GLOBAL_PATH (global fallback)"
    exit 1
fi

# Try to extract MCP server URL (for a quick reachability check)
if command -v jq >/dev/null 2>&1; then
    # Strip trailing commas and // comments so jq can parse JSONC
    MCP_URL=$(sed 's|//.*||g; s|,\s*}|}|g; s|,\s*]|]|g' "$MCP_CONFIG_PATH" | jq -r '.servers.playwright.url // empty' 2>/dev/null || true)
else
    MCP_URL=""
fi

if [ -n "$MCP_URL" ]; then
    echo "🔌 Checking MCP server reachability: $MCP_URL"
    if ! curl -sI --max-time 3 "$MCP_URL" >/dev/null; then
        echo "⚠️  Unable to reach MCP server at $MCP_URL (non-fatal). Ensure it is running and accessible."
    fi
fi

# Create the prompt for Copilot safely via heredoc (avoids quoting issues)
PROMPT=$(cat <<'EOP'
You are an automated end-to-end test runner. Your ONLY job is to execute the
test scenario below by operating a real browser through the Playwright MCP tools.

MANDATORY RULES — violating any of these is an error:
1. DO NOT output a plan, summary, or description of what you are about to do.
   Your FIRST action must be a Playwright MCP tool call — no text before it.
   "I will now execute..." or "Proceeding to..." are forbidden as opening text.
2. You MUST use Playwright MCP browser tools for every step that involves the UI:
   mcp_playwright_browser_navigate, mcp_playwright_browser_snapshot,
   mcp_playwright_browser_click, mcp_playwright_browser_fill_form,
   mcp_playwright_browser_type, mcp_playwright_browser_take_screenshot, etc.
3. Execute steps ONE AT A TIME. After each tool call completes, inspect the
   result, then immediately make the next tool call. Do not batch or defer.
4. Read specs/tests/TEST_CREDENTIALS.md for all login credentials.
   Placeholders like <adminToken>, <email>, <password> are resolved there.
5. "Tests do not exist" is NOT a valid response. The scenario IS the test.
   Execute it live in the browser right now.
6. If the app is not running, run `bun run dev` in the terminal first, then navigate.
7. After each step, note PASS or FAIL inline, then continue to the next step.
8. Only after ALL steps have been executed via tool calls, output the final summary.

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

echo "🧰 Using MCP config via env: $MCP_CONFIG_PATH"

# If a remote MCP URL is present, prefer it by generating a minimal temp config
if [ -n "$MCP_URL" ]; then
    echo "🔧 Preferring remote MCP server: $MCP_URL"
    TMP_MCP_CONFIG=$(mktemp)
    cat > "$TMP_MCP_CONFIG" <<JSON
{
    "servers": {
        "playwright": {
            "transport": "http",
            "url": "$MCP_URL"
        }
    },
    "inputs": []
}
JSON
    MCP_CONFIG_PATH="$TMP_MCP_CONFIG"
    echo "📄 Generated minimal MCP config: $MCP_CONFIG_PATH"
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

# Run via GitHub Copilot CLI with MCP connection.
# Run in background so we can trap signals and kill the full process tree.
MCP_CONFIG="$MCP_CONFIG_PATH" copilot --allow-all-tools --add-dir "$PWD" --model "$COPILOT_MODEL" -p "$PROMPT" &
COPILOT_PID=$!
wait $COPILOT_PID
COPILOT_STATUS=$?
trap - INT TERM

echo "----------------------------------------"
echo "✅ Test execution completed"
exit $COPILOT_STATUS
