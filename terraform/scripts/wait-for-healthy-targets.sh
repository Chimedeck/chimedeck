#!/usr/bin/env bash
# Polls an ELBv2 Target Group until min-healthy targets are healthy or timeout.
#
# Usage: wait-for-healthy-targets.sh <target-group-arn> <min-healthy> <timeout-seconds>
#
# Exits 0 when healthy count >= min-healthy.
# Exits 1 on timeout or unrecoverable AWS CLI error.
#
# Requires: aws CLI, jq (on the CI runner — not on EC2 instances).

set -euo pipefail

# ── Argument validation ───────────────────────────────────────────────────────
if [[ $# -ne 3 ]]; then
  echo "Usage: $(basename "$0") <target-group-arn> <min-healthy> <timeout-seconds>" >&2
  exit 1
fi

TARGET_GROUP_ARN="$1"
MIN_HEALTHY="$2"
TIMEOUT_SECONDS="$3"

if ! [[ "$MIN_HEALTHY" =~ ^[0-9]+$ ]] || [[ "$MIN_HEALTHY" -lt 1 ]]; then
  echo "ERROR: min-healthy must be a positive integer (got: $MIN_HEALTHY)" >&2
  exit 1
fi

if ! [[ "$TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] || [[ "$TIMEOUT_SECONDS" -lt 1 ]]; then
  echo "ERROR: timeout-seconds must be a positive integer (got: $TIMEOUT_SECONDS)" >&2
  exit 1
fi

POLL_INTERVAL=15

log() {
  echo "[wait-healthy] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"
}

start_time=$(date +%s)

log "Waiting for >= $MIN_HEALTHY healthy target(s) in TG: $TARGET_GROUP_ARN"
log "Timeout: ${TIMEOUT_SECONDS}s  Poll interval: ${POLL_INTERVAL}s"

while true; do
  now=$(date +%s)
  elapsed=$(( now - start_time ))

  # ── Query target health ───────────────────────────────────────────────────
  if ! health_output=$(aws elbv2 describe-target-health \
      --target-group-arn "$TARGET_GROUP_ARN" 2>&1); then
    log "ERROR: AWS CLI returned an error:"
    echo "$health_output" >&2
    exit 1
  fi

  healthy_count=$(echo "$health_output" \
    | jq '[.TargetHealthDescriptions[]
           | select(.TargetHealth.State == "healthy")] | length')

  log "Healthy targets: $healthy_count / $MIN_HEALTHY  (elapsed: ${elapsed}s)"

  if [[ "$healthy_count" -ge "$MIN_HEALTHY" ]]; then
    log "SUCCESS: $healthy_count healthy target(s) — minimum of $MIN_HEALTHY met."
    exit 0
  fi

  if [[ "$elapsed" -ge "$TIMEOUT_SECONDS" ]]; then
    log "TIMEOUT after ${elapsed}s. Required $MIN_HEALTHY healthy target(s); found $healthy_count."
    log "Current target states:"
    echo "$health_output" \
      | jq -r '.TargetHealthDescriptions[]
               | "  \(.Target.Id):\(.Target.Port) → \(.TargetHealth.State) (\(.TargetHealth.Description // ""))"' >&2
    exit 1
  fi

  sleep "$POLL_INTERVAL"
done
