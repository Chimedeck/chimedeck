#!/bin/bash

# Orchestration script: runs all three test modes in sequence.
#
# Modes:
#   1. Unit / integration tests  (bun test)
#   2. Playwright e2e tests       (playwright --project=e2e)
#   3. MCP scenario tests         (run-all-tests.sh)
#
# Skip individual modes with env vars:
#   SKIP_UNIT=1  SKIP_E2E=1  SKIP_MCP=1
#
# Forward the app base URL to Playwright:
#   BASE_URL=http://localhost:3000 bash run-all-tests-full.sh

set -euo pipefail

UNIT_STATUS=0
E2E_STATUS=0
MCP_STATUS=0

UNIT_LABEL="bun unit/integration"
E2E_LABEL="playwright e2e"
MCP_LABEL="mcp scenarios"

# ─── helpers ────────────────────────────────────────────────────────────────

pass() { echo "  ✅ PASSED: $1"; }
fail() { echo "  ❌ FAILED: $1 (exit $2)"; }
skip() { echo "  ⏭  SKIPPED: $1"; }

# ─── 1. Unit / integration (bun test) ────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Mode 1: $UNIT_LABEL"
echo "════════════════════════════════════════════════════════"

if [ "${SKIP_UNIT:-}" = "1" ]; then
  skip "$UNIT_LABEL"
elif ! command -v bun >/dev/null 2>&1; then
  echo "  ⚠️  bun not found — skipping $UNIT_LABEL"
elif [ ! -d "tests/integration" ]; then
  echo "  ⚠️  tests/integration not found — skipping $UNIT_LABEL"
else
  if bun test tests/integration; then
    pass "$UNIT_LABEL"
  else
    UNIT_STATUS=$?
    fail "$UNIT_LABEL" "$UNIT_STATUS"
  fi
fi

# ─── 2. Playwright e2e ───────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Mode 2: $E2E_LABEL"
echo "════════════════════════════════════════════════════════"

if [ "${SKIP_E2E:-}" = "1" ]; then
  skip "$E2E_LABEL"
elif ! command -v npx >/dev/null 2>&1; then
  echo "  ⚠️  npx not found — skipping $E2E_LABEL"
else
  # Forward BASE_URL as TEST_BASE_URL (playwright.config.ts reads TEST_BASE_URL)
  E2E_CMD="npx playwright test --project=e2e"
  if [ -n "${BASE_URL:-}" ]; then
    export TEST_BASE_URL="$BASE_URL"
    echo "  BASE_URL → TEST_BASE_URL=$TEST_BASE_URL"
  fi
  if $E2E_CMD; then
    pass "$E2E_LABEL"
  else
    E2E_STATUS=$?
    fail "$E2E_LABEL" "$E2E_STATUS"
  fi
fi

# ─── 3. MCP scenario tests ───────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Mode 3: $MCP_LABEL"
echo "════════════════════════════════════════════════════════"

if [ "${SKIP_MCP:-}" = "1" ]; then
  skip "$MCP_LABEL"
elif [ ! -f "run-all-tests.sh" ]; then
  echo "  ⚠️  run-all-tests.sh not found — skipping $MCP_LABEL"
else
  if bash run-all-tests.sh; then
    pass "$MCP_LABEL"
  else
    MCP_STATUS=$?
    fail "$MCP_LABEL" "$MCP_STATUS"
  fi
fi

# ─── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Summary"
echo "════════════════════════════════════════════════════════"

overall=0

_summary_row() {
  local label="$1" status="$2"
  if [ "$status" = "0" ]; then
    echo "  ✅ $label"
  else
    echo "  ❌ $label"
    overall=1
  fi
}

_summary_row "$UNIT_LABEL" "$UNIT_STATUS"
_summary_row "$E2E_LABEL"  "$E2E_STATUS"
_summary_row "$MCP_LABEL"  "$MCP_STATUS"

echo "════════════════════════════════════════════════════════"

exit $overall
