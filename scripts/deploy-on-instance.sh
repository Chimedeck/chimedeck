#!/usr/bin/env bash
# Managed-service EC2 rollout. Run one host at a time behind a load balancer.
set -euo pipefail

COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.prod.yml}
AWS_REGION=${AWS_REGION:-us-east-1}
MAIN_CONTAINER_NAME=${MAIN_CONTAINER_NAME:-chimedeck-prod}
MAIN_APP_PORT=${MAIN_APP_PORT:-3000}
HEALTH_ATTEMPTS=${HEALTH_ATTEMPTS:-60}
HEALTH_CONSECUTIVE_SUCCESSES=${HEALTH_CONSECUTIVE_SUCCESSES:-5}
RUN_MIGRATIONS=${RUN_MIGRATIONS:-false}

if [[ -z "${IMAGE_URL:-}" || "$IMAGE_URL" != */* ]]; then
  echo "ERROR: IMAGE_URL must be a fully qualified image URI" >&2
  exit 1
fi
if [[ "$RUN_MIGRATIONS" != "true" && "$RUN_MIGRATIONS" != "false" ]]; then
  echo "ERROR: RUN_MIGRATIONS must be true or false" >&2
  exit 1
fi
if [[ "${SEED_TRELLO:-false}" != "false" ]]; then
  echo "ERROR: deployment never runs Trello seeding; run the one-off seed separately" >&2
  exit 1
fi

ECR_REGISTRY=${IMAGE_URL%%/*}
PREVIOUS_IMAGE=$(docker inspect --format '{{.Config.Image}}' "$MAIN_CONTAINER_NAME" 2>/dev/null || true)

compose() {
  CONTAINER_NAME="$MAIN_CONTAINER_NAME" APP_PORT="$MAIN_APP_PORT" \
    SEED_TRELLO=false IMAGE_URL="$1" \
    docker compose -f "$COMPOSE_FILE" "${@:2}"
}

wait_for_health() {
  local attempt=0 consecutive=0 status
  while (( attempt < HEALTH_ATTEMPTS )); do
    attempt=$((attempt + 1))
    status=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${MAIN_APP_PORT}/health" 2>/dev/null || true)
    if [[ "$status" == "200" ]]; then
      consecutive=$((consecutive + 1))
      if (( consecutive >= HEALTH_CONSECUTIVE_SUCCESSES )); then
        echo "Health check passed after ${attempt} attempt(s)"
        return 0
      fi
    else
      consecutive=0
    fi
    sleep 2
  done
  echo "ERROR: health check did not stabilise" >&2
  return 1
}

rollback() {
  if [[ -z "$PREVIOUS_IMAGE" || "$PREVIOUS_IMAGE" == "$IMAGE_URL" ]]; then
    echo "No distinct previous image is available for rollback" >&2
    return 0
  fi
  echo "Rolling back to ${PREVIOUS_IMAGE}" >&2
  compose "$PREVIOUS_IMAGE" up -d --no-deps --force-recreate app
  wait_for_health || echo "ERROR: rollback image did not become healthy" >&2
}

printf 'Deploying image: %s\n' "$IMAGE_URL"
printf 'Authenticating with ECR registry: %s\n' "$ECR_REGISTRY"
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

if [[ "$RUN_MIGRATIONS" == "true" ]]; then
  echo "Running explicit migration phase"
  compose "$IMAGE_URL" run --rm app bun run db:migrate:safe
fi

compose "$IMAGE_URL" pull app
compose "$IMAGE_URL" up -d --no-deps --force-recreate app

if ! wait_for_health; then
  rollback
  exit 1
fi

echo "Deployment completed successfully"
