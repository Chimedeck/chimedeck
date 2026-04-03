#!/usr/bin/env bash
# EC2 user data template — rendered by Terraform templatefile().
#
# Template variables injected at render time:
#   ecr_image_url  — full ECR image URL including tag
#                    e.g. 123456789.dkr.ecr.ap-southeast-1.amazonaws.com/app:abc1234
#
# Env vars are baked into the Docker image by the build script — no Secrets
# Manager fetch is needed at boot time.
#
# AMI baking requirements (must be pre-installed):
#   - Docker Engine (latest stable), NOT set to auto-start on boot
#   - AWS CLI v2
#   - /app/docker-compose.prod.yml

set -euo pipefail

log() {
  echo "[startup] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"
}

ECR_IMAGE_URL="${ecr_image_url}"

# Extract registry host (everything before the first '/') and region
# e.g. 123456789.dkr.ecr.ap-southeast-1.amazonaws.com/app:abc1234
#   → ECR_REGISTRY = 123456789.dkr.ecr.ap-southeast-1.amazonaws.com
#   → AWS_REGION   = ap-southeast-1
ECR_REGISTRY="$${ECR_IMAGE_URL%%/*}"
AWS_REGION="$(echo "$${ECR_REGISTRY}" | awk -F'.' '{print $4}')"

APP_DIR="/app"
COMPOSE_FILE="$${APP_DIR}/docker-compose.prod.yml"

# ── 1. Enable Docker ─────────────────────────────────────────────────────────
log "Enabling and starting Docker..."
systemctl enable docker
systemctl start docker
log "Docker is running."

# ── 2. ECR authentication via instance IAM role ───────────────────────────────
log "Authenticating to ECR registry $${ECR_REGISTRY} in $${AWS_REGION}..."
aws ecr get-login-password --region "$${AWS_REGION}" \
  | docker login --username AWS --password-stdin "$${ECR_REGISTRY}"
log "ECR authentication successful."

# ── 3. Pull image ─────────────────────────────────────────────────────────────
log "Pulling image $${ECR_IMAGE_URL}..."
docker pull "$${ECR_IMAGE_URL}"
log "Image pulled."

# ── 4. Start app ──────────────────────────────────────────────────────────────
if [[ ! -f "$${COMPOSE_FILE}" ]]; then
  log "ERROR: $${COMPOSE_FILE} not found. Ensure the AMI bakes this file in at /app/."
  exit 1
fi
log "Starting app with docker compose..."
docker compose -f "$${COMPOSE_FILE}" up -d
log "App started."

# ── 5. Health signal ──────────────────────────────────────────────────────────
touch /tmp/startup-complete
log "Startup complete. Marker written to /tmp/startup-complete."
