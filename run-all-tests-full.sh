#!/bin/bash

# Run all MCP scenario tests from specs/tests/.
#
# Each .md file in specs/tests/ is executed via run-test.sh using the
# Playwright MCP server. Ctrl+C cancels the current test and exits cleanly.
#
# Skip all:  SKIP_MCP=1
# Single:    ./run-all-tests-full.sh specs/tests/login-flow.md

set -euo pipefail

SCENARIOS_DIR="specs/tests"
PASSED=0
FAILED=0
SKIPPED=0

# ─── Ctrl+C / SIGTERM handler ────────────────────────────────────────────────
# run-test.sh handles killing copilot's process tree when it receives INT/TERM.
# This handler stops the scenario loop and exits cleanly.
_cleanup() {
  echo ""
  echo "⚠️  Interrupted — stopping all tests."
  exit 130
}
trap _cleanup INT TERM

# ─── helpers ─────────────────────────────────────────────────────────────────
pass() { echo "  ✅ PASSED: $1"; }
fail() { echo "  ❌ FAILED: $1"; }
skip() { echo "  ⏭  SKIPPED: $1"; }

# ─── scenario runner ─────────────────────────────────────────────────────────
run_scenarios() {
  local dir="$1"

  if [ ! -d "$dir" ]; then
    echo "❌ Scenarios directory not found: $dir"
    exit 1
  fi

  echo ""
  echo "════════════════════════════════════════════════════════"
  echo "  MCP scenarios — $dir"
  echo "════════════════════════════════════════════════════════"

  for test_file in "$dir"/*.md; do
    [ -f "$test_file" ] || continue
    echo ""
    echo "📝 $(basename "$test_file")"
    if bash run-test.sh "$test_file"; then
      ((PASSED++))
      pass "$(basename "$test_file")"
    else
      ((FAILED++))
      fail "$(basename "$test_file")"
    fi
  done

  if [ $((PASSED + FAILED)) -eq 0 ]; then
    echo ""
    echo "⚠️  No .md test files found in $dir"
    exit 1
  fi
}

# ─── main ────────────────────────────────────────────────────────────────────
if [ "${SKIP_MCP:-}" = "1" ]; then
  skip "mcp scenarios"
  SKIPPED=1
else
  # Allow running a single file: ./run-all-tests-full.sh specs/tests/foo.md
  if [ "${1:-}" != "" ] && [ -f "${1}" ]; then
    echo "📝 Running single scenario: $1"
    bash run-test.sh "$1"
    exit $?
  fi
  run_scenarios "$SCENARIOS_DIR"
fi

# ─── summary ─────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
echo "  Summary"
echo "════════════════════════════════════════════════════════"
echo "  ✅ Passed:  $PASSED"
echo "  ❌ Failed:  $FAILED"
[ "$SKIPPED" -gt 0 ] && echo "  ⏭  Skipped: $SKIPPED"
echo "  📈 Total:   $((PASSED + FAILED))"
echo "════════════════════════════════════════════════════════"

[ "$FAILED" -eq 0 ]
trap - EXIT
