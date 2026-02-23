#!/bin/bash

# Run all E2E test scenarios found in specs/tests/
#
# CONVENTION: For every developed feature a corresponding test case MUST be
# created as a Markdown file inside specs/tests/. Each .md file describes the
# scenario steps that Playwright MCP will execute via run-test.sh.
# Example: specs/tests/login-flow.md, specs/tests/checkout-voucher.md

set -e

SCENARIOS_DIR="specs/tests"
PASSED=0
FAILED=0

echo "🚀 Running all E2E test scenarios from $SCENARIOS_DIR"
echo "========================================================"

for test_file in "$SCENARIOS_DIR"/*.md; do
    if [ -f "$test_file" ]; then
        echo ""
        echo "📝 Testing: $(basename "$test_file")"

        if ./run-test.sh "$test_file"; then
            ((PASSED++))
            echo "✅ PASSED: $(basename "$test_file")"
        else
            ((FAILED++))
            echo "❌ FAILED: $(basename "$test_file")"
        fi
    fi
done

if [ $((PASSED + FAILED)) -eq 0 ]; then
    echo ""
    echo "⚠️  No test files found in ${SCENARIOS_DIR}/"
    echo "   Create at least one .md test scenario there and re-run."
    exit 1
fi

echo ""
echo "========================================================"
echo "📊 Test Results:"
echo "   ✅ Passed: $PASSED"
echo "   ❌ Failed: $FAILED"
echo "   📈 Total:  $((PASSED + FAILED))"
echo "========================================================"

if [ $FAILED -gt 0 ]; then
    exit 1
fi

