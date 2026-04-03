#!/usr/bin/env bash
# EC2 user data template — rendered by Terraform templatefile().
#
# Template variables injected at render time:
#   ecr_image_url  — full ECR image URL including tag
#                    e.g. 123456789.dkr.ecr.ap-southeast-1.amazonaws.com/app:abc1234
#   secrets_arn    — AWS Secrets Manager ARN for app env vars (JSON key-value object)
#
# AMI baking requirements (must be pre-installed):
#   - Docker Engine (latest stable), NOT set to auto-start on boot
#   - AWS CLI v2
#   - jq
#   - /app/docker-compose.prod.yml

set -euo pipefail

log() {
  echo "[startup] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"
}

ECR_IMAGE_URL="${ecr_image_url}"
SECRETS_ARN="${secrets_arn}"

# Extract registry host (everything before the first '/') and region
# e.g. 123456789.dkr.ecr.ap-southeast-1.amazonaws.com/app:abc1234
#   → ECR_REGISTRY = 123456789.dkr.ecr.ap-southeast-1.amazonaws.com
#   → AWS_REGION   = ap-southeast-1
ECR_REGISTRY="$${ECR_IMAGE_URL%%/*}"
AWS_REGION="$(echo "$${ECR_REGISTRY}" | awk -F'.' '{print $4}')"

APP_DIR="/app"
COMPOSE_FILE="$${APP_DIR}/docker-compose.prod.yml"
ENV_FILE="$${APP_DIR}/.env"

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

# ── 4. Write .env from Secrets Manager ───────────────────────────────────────
log "Fetching secrets from $${SECRETS_ARN}..."
mkdir -p "$${APP_DIR}"
aws secretsmanager get-secret-value \
  --secret-id "$${SECRETS_ARN}" \
  --query SecretString \
  --output text \
  | jq -r 'to_entries[] | "\(.key)=\(.value)"' > "$${ENV_FILE}"
chmod 600 "$${ENV_FILE}"
log "Secrets written to $${ENV_FILE}."

# ── 5. Start app ──────────────────────────────────────────────────────────────
if [[ ! -f "$${COMPOSE_FILE}" ]]; then
  log "ERROR: $${COMPOSE_FILE} not found. Ensure the AMI bakes this file in at /app/."
  exit 1
fi
log "Starting app with docker compose..."
docker compose -f "$${COMPOSE_FILE}" up -d
log "App started."

# ── 6. Health signal ──────────────────────────────────────────────────────────
touch /tmp/startup-complete
log "Startup complete. Marker written to /tmp/startup-complete."
