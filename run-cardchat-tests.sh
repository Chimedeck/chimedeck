#!/usr/bin/env bash
set -euo pipefail

FAILED=0
TOTAL_PASS=0
TOTAL_FAIL=0

run_test() {
  local file="$1"
  local result pass_count fail_count
  result=$(bun test "$file" 2>&1)
  pass_count=$(echo "$result" | grep -oE '^[[:space:]]+[0-9]+ pass' | grep -oE '[0-9]+' || echo "0")
  fail_count=$(echo "$result" | grep -oE '^[[:space:]]+[0-9]+ fail' | grep -oE '[0-9]+' || echo "0")
  TOTAL_PASS=$((TOTAL_PASS + pass_count))
  TOTAL_FAIL=$((TOTAL_FAIL + fail_count))
  local fname
  fname=$(basename "$(dirname "$(dirname "$file")")")/$(basename "$file")
  printf "%-55s %3s pass, %3s fail\n" "$fname" "$pass_count" "$fail_count"
  if [ "$fail_count" != "0" ]; then
    FAILED=1
  fi
}

echo "=== Agentic Extensions Test Results ==="
echo ""

# cardChat (Sprint 171) — all tests that use mock.module for common/db
TESTS=(
  "server/extensions/cardChat/api/__tests__/messages.test.ts"
  "server/extensions/cardChat/api/__tests__/session.test.ts"
  "server/extensions/cardChat/api/__tests__/refine.test.ts"
  "server/extensions/cardChat/mods/activities/__tests__/index.test.ts"
  "server/extensions/cardChat/mods/messages/__tests__/write.test.ts"
  "server/extensions/cardChat/mods/session/__tests__/lifecycle.test.ts"
  "server/extensions/cardChat/mods/messages/__tests__/query.test.ts"
  "server/extensions/cardChat/mods/baPersona/__tests__/goalLoop.test.ts"
  "server/extensions/cardChat/mods/baPersona/__tests__/structuredExtraction.test.ts"
  "server/extensions/cardChat/mods/provider/__tests__/index.test.ts"
  "server/extensions/cardChat/mods/qualityScore/__tests__/index.test.ts"
  # Sprint 172-175 — tests affected by Bun mock.module cross-file caching
  "server/extensions/aiEditOrchestrator/mods/pathGuard/__tests__/index.test.ts"
  "server/extensions/sprintGeneration/mods/tierPolicy/__tests__/index.test.ts"
  "server/extensions/sprintGeneration/mods/tierPolicy/__tests__/quotaEnforcer.test.ts"
  # Sprint 168-170 — stateTransitions tests affected by Bun mock.module cross-file caching
  "server/extensions/stateTransitions/enforcement/__tests__/index.test.ts"
  "server/extensions/stateTransitions/enforcement/__tests__/rules.test.ts"
  "server/extensions/stateTransitions/__tests__/getRules.test.ts"
  "server/extensions/stateTransitions/__tests__/put.test.ts"
  "server/extensions/stateTransitions/__tests__/sync.test.ts"
  "server/extensions/stateTransitions/mods/phaseResolver/__tests__/index.test.ts"
  "server/extensions/stateTransitions/api/__tests__/put_sync_hooks.test.ts"
  "server/extensions/stateTransitions/api/__tests__/sync.test.ts"
  "server/extensions/stateTransitions/api/__tests__/index.test.ts"
  "server/extensions/stateTransitions/api/__tests__/put.test.ts"
  "server/extensions/stateTransitions/api/__tests__/put_ws.test.ts"
  "server/extensions/stateTransitions/api/__tests__/put_list_sync.test.ts"
  "server/extensions/stateTransitions/api/__tests__/get.test.ts"
  "server/extensions/stateTransitions/api/__tests__/getRules.test.ts"
  "server/extensions/stateTransitions/api/__tests__/wsBroadcast.test.ts"
  "server/extensions/stateTransitions/api/__tests__/copy.test.ts"
  "server/extensions/stateTransitions/common/__tests__/integration_list_sync.test.ts"
  "server/extensions/stateTransitions/common/__tests__/sync-list-delete.test.ts"
  "server/extensions/stateTransitions/common/__tests__/validator.test.ts"
  "server/extensions/stateTransitions/common/__tests__/sync-list-rename.test.ts"
  "server/extensions/stateTransitions/common/__tests__/workflowPhases.test.ts"
  "server/extensions/stateTransitions/common/__tests__/sync.test.ts"
  "server/extensions/stateTransitions/common/__tests__/types.test.ts"
  "server/extensions/stateTransitions/common/__tests__/sync-edge-cases.test.ts"
  "server/extensions/stateTransitions/common/__tests__/serializer.test.ts"
  "server/extensions/stateTransitions/common/__tests__/errors.test.ts"
)

for test in "${TESTS[@]}"; do
  run_test "$test"
done

echo ""
echo "Total: $((TOTAL_PASS + TOTAL_FAIL)) tests across ${#TESTS[@]} files ($TOTAL_PASS pass, $TOTAL_FAIL fail)"

if [ "$FAILED" -eq 1 ]; then
  echo "❌ Some tests FAILED"
  exit 1
else
  echo "✅ All tests passed"
  exit 0
fi
