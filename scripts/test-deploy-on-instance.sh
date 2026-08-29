#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
SCRIPT="$ROOT/scripts/deploy-on-instance.sh"

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
assert_contains() { grep -Fqx "$2" "$1" || fail "missing log line: $2"; }
assert_not_contains() { ! grep -Fq "$2" "$1" || fail "unexpected log line: $2"; }

run_case() {
  local name=$1
  shift
  local tmp
  tmp=$(mktemp -d)
  mkdir -p "$tmp/bin"
  : >"$tmp/calls"

  cat >"$tmp/bin/aws" <<'EOF'
#!/usr/bin/env bash
printf 'aws %s\n' "$*" >>"$CALLS"
printf 'token'
EOF
  cat >"$tmp/bin/docker" <<'EOF'
#!/usr/bin/env bash
printf 'docker %s\n' "$*" >>"$CALLS"
if [[ "$1" == login ]]; then cat >/dev/null; fi
if [[ "$1" == inspect ]]; then printf '%s\n' "$PREVIOUS_IMAGE"; fi
EOF
  cat >"$tmp/bin/curl" <<'EOF'
#!/usr/bin/env bash
printf 'curl %s\n' "$*" >>"$CALLS"
printf '%s' "$MOCK_HTTP_STATUS"
EOF
  cat >"$tmp/bin/sleep" <<'EOF'
#!/usr/bin/env bash
:
EOF
  cat >"$tmp/bin/sudo" <<'EOF'
#!/usr/bin/env bash
printf 'sudo %s\n' "$*" >>"$CALLS"
exit 0
EOF
  chmod +x "$tmp/bin"/*

  local status=0
  env PATH="$tmp/bin:$PATH" CALLS="$tmp/calls" PREVIOUS_IMAGE="registry.example/old:stable" \
    IMAGE_URL="123456789012.dkr.ecr.us-east-1.amazonaws.com/chimedeck:test" \
    AWS_REGION=us-east-1 COMPOSE_FILE=compose.yml MAIN_APP_PORT=3000 \
    HEALTH_ATTEMPTS=1 HEALTH_CONSECUTIVE_SUCCESSES=1 "$@" \
    bash "$SCRIPT" >"$tmp/output" 2>&1 || status=$?
  CASE_TMP="$tmp"
  return "$status"
}

run_case success MOCK_HTTP_STATUS=200 RUN_MIGRATIONS=true
assert_contains "$CASE_TMP/calls" 'docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com'
assert_contains "$CASE_TMP/calls" 'docker compose -f compose.yml run --rm app bun run db:migrate:safe'
assert_contains "$CASE_TMP/calls" 'docker compose -f compose.yml up -d --no-deps --force-recreate app'
assert_not_contains "$CASE_TMP/calls" 'SEED_TRELLO=true'

if run_case failed-health MOCK_HTTP_STATUS=500 RUN_MIGRATIONS=false; then
  fail 'health failure unexpectedly succeeded'
fi
assert_contains "$CASE_TMP/calls" 'docker compose -f compose.yml up -d --no-deps --force-recreate app'
assert_contains "$CASE_TMP/calls" 'docker compose -f compose.yml up -d --no-deps --force-recreate app'

echo 'PASS: deploy-on-instance contract'
