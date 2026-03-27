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
You are running an automated end-to-end test using the Playwright MCP server.

Execute the following test scenario step by step against the base URL provided.
Report results for each step and produce a final summary.

Scenario:
EOP
)

# Append dynamic content to the prompt
PROMPT="$PROMPT
Base URL: $BASE_URL

$TEST_CONTENT

After executing all steps, provide a summary:
- Total steps executed
- Steps passed
- Steps failed (if any)
- Any errors or issues encountered
- Final verdict: PASS or FAIL"

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

# Run via GitHub Copilot CLI with MCP connection
# Latest Copilot CLI loads MCP servers from the MCP_CONFIG environment variable.
# We export MCP_CONFIG for this invocation and do not rely on any CLI flags.
MCP_CONFIG="$MCP_CONFIG_PATH" copilot --allow-all-tools --add-dir "$PWD" -p "$PROMPT"

echo "----------------------------------------"
echo "✅ Test execution completed"
