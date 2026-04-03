#!/usr/bin/env bash
# EC2 user data template for ASG blue/green instances — rendered by Terraform templatefile().
#
# Template variables injected at render time:
#   ecr_image_url — full ECR image URL including tag
#                   e.g. 123456789.dkr.ecr.ap-southeast-1.amazonaws.com/app:abc1234
#
# The application deploy script (/home/ubuntu/deploy.sh) is baked into the AMI.
# This script's only job is to authenticate to ECR and invoke it with the correct
# IMAGE_URL so the instance pulls the right image on first boot.
#
# AMI baking requirements:
#   - Docker Engine (latest stable), NOT set to auto-start on boot
#   - AWS CLI v2
#   - /home/ubuntu/deploy.sh  (deploy-on-instance-stable-fixed.sh)

set -euo pipefail

log() {
  echo "[startup] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"
}

ECR_IMAGE_URL="${ecr_image_url}"

# Extract registry host and region from the image URL
# e.g. 123456789.dkr.ecr.ap-southeast-1.amazonaws.com/app:abc1234
#   → ECR_REGISTRY = 123456789.dkr.ecr.ap-southeast-1.amazonaws.com
#   → AWS_REGION   = ap-southeast-1
ECR_REGISTRY="$${ECR_IMAGE_URL%%/*}"
AWS_REGION="$(echo "$${ECR_REGISTRY}" | awk -F'.' '{print $4}')"

# ── 1. Enable Docker ──────────────────────────────────────────────────────────
log "Enabling and starting Docker..."
systemctl enable docker
systemctl start docker
log "Docker is running."

# ── 2. ECR authentication via instance IAM role ───────────────────────────────
log "Authenticating to ECR ($${ECR_REGISTRY}) in $${AWS_REGION}..."
aws ecr get-login-password --region "$${AWS_REGION}" \
  | docker login --username AWS --password-stdin "$${ECR_REGISTRY}"
log "ECR authentication successful."

# ── 3. Hand off to the baked-in deploy script ────────────────────────────────
# IMAGE_URL and AWS_REGION are passed as env vars so deploy.sh can pull the
# correct image and authenticate to ECR for subsequent operations.
log "Invoking /home/ubuntu/deploy.sh for $${ECR_IMAGE_URL}..."
IMAGE_URL="$${ECR_IMAGE_URL}" AWS_REGION="$${AWS_REGION}" /home/ubuntu/deploy.sh
log "Deploy complete."

# ── 4. Health signal ──────────────────────────────────────────────────────────
touch /tmp/startup-complete
log "Startup complete. Marker written to /tmp/startup-complete."
