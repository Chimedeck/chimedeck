#!/usr/bin/env bash
# Deploy script for HoriFlow — runs on the host machine alongside docker-compose.horiflow.prod.yml
# Required env vars:
#   IMAGE_URL        — full image URI, e.g. 123456789.dkr.ecr.ap-southeast-1.amazonaws.com/horiflow-app:abc1234
#   AWS_REGION       — AWS region for ECR login (default: ap-southeast-1)
# Optional env vars:
#   COMPOSE_PROFILES — comma-separated list of profiles to activate (default: local-db,local-s3,redis)
#                      local-db  → start internal Postgres instead of AWS RDS
#                      local-s3  → start LocalStack instead of AWS S3
#                      redis     → start Redis sidecar
#                      e.g. COMPOSE_PROFILES="" to use all external AWS services

COMPOSE_FILE=docker-compose.horiflow.prod.yml
AWS_REGION=${AWS_REGION:-ap-southeast-1}
export COMPOSE_PROFILES=${COMPOSE_PROFILES:-local-db,local-s3}

# Main deployment config
MAIN_CONTAINER_NAME=horiflow-prod
MAIN_APP_PORT=6402

# Fallback deployment config
FALLBACK_CONTAINER_NAME=horiflow-prod-fallback
FALLBACK_APP_PORT=6412

echo "Begin deploy process"
set -e
SECONDS=0

if [[ -z "${IMAGE_URL}" ]]; then
  echo "ERROR: IMAGE_URL is not set" >&2
  exit 1
fi

echo "Authenticating with ECR"
# Extract registry host (everything before the first /)
ECR_REGISTRY=$(echo "${IMAGE_URL}" | cut -d'/' -f1)
aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${ECR_REGISTRY}"

echo "Pulling new image: ${IMAGE_URL}"
CONTAINER_NAME=${MAIN_CONTAINER_NAME} APP_PORT=${MAIN_APP_PORT} IMAGE_URL="${IMAGE_URL}" \
  docker compose -f "${COMPOSE_FILE}" pull app

echo "Ensuring infra services (postgres, localstack or redis) are running"
# Only starts services whose profile is active in COMPOSE_PROFILES.
# If COMPOSE_PROFILES is unset (using AWS RDS/S3), no infra containers are started.
if [[ -n "${COMPOSE_PROFILES}" ]]; then
  CONTAINER_NAME=${MAIN_CONTAINER_NAME} APP_PORT=${MAIN_APP_PORT} IMAGE_URL="${IMAGE_URL}" \
  POSTGRES_USER=horiflow POSTGRES_PASSWORD=horiflow POSTGRES_DB=horiflow_dev \
    docker compose -f "${COMPOSE_FILE}" up -d --no-recreate --no-deps
else
  echo "No local infra profiles active — using external AWS services"
fi

echo "Raising fallback container"
docker container rm ${FALLBACK_CONTAINER_NAME} -f || echo "No fallback container found"
CONTAINER_NAME=${FALLBACK_CONTAINER_NAME} APP_PORT=${FALLBACK_APP_PORT} SEED_TRELLO=false IMAGE_URL="${IMAGE_URL}" \
  docker compose -f "${COMPOSE_FILE}" up -d --no-deps app

echo "Waiting for fallback container to set up itself"
sleep 5

echo "____________________"
echo "Working on NGINX to use fallback server"
sudo rm -f /etc/nginx/conf.d/main-horiflow.conf
sudo cp ./fallback-horiflow.conf /etc/nginx/conf.d/
sudo systemctl restart nginx
echo "____________________"

echo "Starting main containers with new image"
CONTAINER_NAME=${MAIN_CONTAINER_NAME} APP_PORT=${MAIN_APP_PORT} SEED_TRELLO=true IMAGE_URL="${IMAGE_URL}" \
  docker compose -f "${COMPOSE_FILE}" up -d --no-deps --remove-orphans app

echo "Deployed successfully!"
duration=$SECONDS
echo "$(($duration / 60)) minutes and $(($duration % 60)) seconds deploy time."

echo "Waiting for main container to set up itself"
sleep 5

echo "____________________"
echo "Switch NGINX to use main server"
sudo rm -f /etc/nginx/conf.d/fallback-horiflow.conf
sudo cp ./main-horiflow.conf /etc/nginx/conf.d/
sudo systemctl restart nginx
echo "____________________"

echo "Closing fallback container"
CONTAINER_NAME=${FALLBACK_CONTAINER_NAME} APP_PORT=${FALLBACK_APP_PORT} IMAGE_URL="${IMAGE_URL}" \
  docker compose -f "${COMPOSE_FILE}" stop app
docker container rm ${FALLBACK_CONTAINER_NAME} -f

echo "Pruning dangling images"
docker image prune -f