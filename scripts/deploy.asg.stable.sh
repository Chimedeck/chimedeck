#!/usr/bin/env bash

set -e

SECONDS=0

source ./scripts/set_environment.sh
# IMAGE_URL and ECR_TAG are written by build.sh in the preceding CI step.
# IMAGE_URL = full image URI  e.g. 123456789.dkr.ecr.ap-southeast-1.amazonaws.com/app:abc1234
# ECR_TAG   = image tag only  e.g. abc1234
source ./.ecr-build-output

if [[ -z "${IMAGE_URL:-}" ]]; then
  echo -e "${ERR}::::IMAGE_URL is not set — ensure build.sh ran successfully and .ecr-build-output exists::::${NC}"
  exit 1
fi

if [[ -z "${ECR_TAG:-}" ]]; then
  echo -e "${ERR}::::ECR_TAG is not set — ensure build.sh ran successfully and .ecr-build-output exists::::${NC}"
  exit 1
fi

echo -e "${COLOR}:::::::::Deploying $GITHUB_BASE_REF — mode: ${DEPLOYMENT_MODE:-unset}, USE_SSH: ${USE_SSH}:::::::::${NC}"

if [ "${USE_SSH}" == "TRUE" ]; then
  # ── SSH in-place update (single instance or fleet) ──────────────────────────

  echo -e "${COLOR}::::Decoding permission file::::${NC}"
  echo ${ENCODED_PEM} | base64 --decode > ${AWS_PRIVATE_KEY_PATH}
  chmod 400 ${AWS_PRIVATE_KEY_PATH}

  # Ensure PEM is removed even on failure
  trap 'rm -f ${AWS_PRIVATE_KEY_PATH}' EXIT

  if [ -n "${AWS_INSTANCE_URLS}" ]; then
    echo -e "${COLOR}::::ssh and deploy for multiple instances::::${NC}"
    # Collect exit codes — a subshell pipe loses them, so use a temp file
    FAILED=0
    while IFS= read -r CURRENT_AWS_INSTANCE_URL; do
      echo "Processing $CURRENT_AWS_INSTANCE_URL"
      ssh -o StrictHostKeyChecking=no -i "${AWS_PRIVATE_KEY_PATH}" \
        "${CURRENT_AWS_INSTANCE_URL}" \
        "IMAGE_URL=${IMAGE_URL} REGION=${AWS_ECR_REGION} ${AWS_INSTANCE_DEPLOY_SCRIPT}" \
        || { echo -e "${ERR}::::Failed on ${CURRENT_AWS_INSTANCE_URL}::::${NC}"; FAILED=1; }
    done < <(echo "${AWS_INSTANCE_URLS}" | tr ',' '\n')

    if [ "${FAILED}" -ne 0 ]; then
      echo -e "${ERR}::::One or more fleet instances failed — aborting::::${NC}"
      exit 1
    fi

  elif [ -n "${AWS_INSTANCE_URL}" ]; then
    echo -e "${COLOR}::::ssh and deploy for single instance::::${NC}"
    ssh -o StrictHostKeyChecking=no -i "${AWS_PRIVATE_KEY_PATH}" \
      "${AWS_INSTANCE_URL}" \
      "IMAGE_URL=${IMAGE_URL} REGION=${AWS_ECR_REGION} ${AWS_INSTANCE_DEPLOY_SCRIPT}"
  else
    echo -e "${ERR}::::No instance URL provided for SSH deploy::::${NC}"
    exit 1
  fi

else
  # ── Terraform blue/green replacement (asg-bluegreen only) ───────────────────
  # IMAGE_URL flow:
  #   1. build.sh pushes the image and writes ECR_TAG to .ecr-build-output
  #   2. This script writes ECR_TAG into terraform.tfvars (blue_ecr_tag or green_ecr_tag)
  #   3. Terraform renders startup-asg.sh with ecr_image_url = ecr_repo_url:ecr_tag
  #   4. ASG instance refresh boots new instances; startup-asg.sh calls
  #      /home/ubuntu/deploy.sh with IMAGE_URL=<full ECR image URL> so the
  #      instance pulls and runs the exact image that was built in step 1.

  if ! command -v terraform &>/dev/null; then
    echo -e "${COLOR}::::Installing Terraform::::${NC}"
    TERRAFORM_VERSION="1.10.5"
    curl -fsSL \
      "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip" \
      -o terraform.zip
    unzip -o terraform.zip -d /usr/local/bin
    rm terraform.zip
  fi

  if [ "${USE_RDS}" == "TRUE" ]; then
    echo -e "${COLOR}::::Running DB migrations::::${NC}"
    bun knex migrate:latest --env production
  fi

  TFVARS="terraform/environments/${ENV_NAME}/terraform.tfvars"

  echo -e "${COLOR}::::Snapshotting tfvars for rollback::::${NC}"
  cp "${TFVARS}" "${TFVARS}.rollback"

  # Determine which slot is currently inactive and flip weights
  BLUE_WEIGHT=$(grep -E '^blue_weight\s*=' "${TFVARS}" | sed 's/.*=\s*//' | tr -d ' "')
  GREEN_WEIGHT=$(grep -E '^green_weight\s*=' "${TFVARS}" | sed 's/.*=\s*//' | tr -d ' "')

  echo -e "${COLOR}::::Current weights — blue: ${BLUE_WEIGHT}, green: ${GREEN_WEIGHT}::::${NC}"

  if [ "${BLUE_WEIGHT}" == "100" ]; then
    # blue is live → deploy to green slot
    echo -e "${COLOR}::::Deploying to green slot::::${NC}"
    sed -i "s/^green_ecr_tag\s*=.*/green_ecr_tag = \"${ECR_TAG}\"/" "${TFVARS}"
    sed -i "s/^green_weight\s*=.*/green_weight = 100/"               "${TFVARS}"
    sed -i "s/^blue_weight\s*=.*/blue_weight  = 0/"                  "${TFVARS}"
  elif [ "${GREEN_WEIGHT}" == "100" ]; then
    # green is live → deploy to blue slot
    echo -e "${COLOR}::::Deploying to blue slot::::${NC}"
    sed -i "s/^blue_ecr_tag\s*=.*/blue_ecr_tag = \"${ECR_TAG}\"/"   "${TFVARS}"
    sed -i "s/^blue_weight\s*=.*/blue_weight  = 100/"                "${TFVARS}"
    sed -i "s/^green_weight\s*=.*/green_weight = 0/"                 "${TFVARS}"
  else
    echo -e "${ERR}::::Cannot determine active slot (blue=${BLUE_WEIGHT}, green=${GREEN_WEIGHT}) — aborting::::${NC}"
    exit 1
  fi

  TF_DIR="terraform/environments/${ENV_NAME}"

  echo -e "${COLOR}::::Running terraform apply::::${NC}"
  (
    cd "${TF_DIR}"
    terraform init \
      -backend-config="bucket=${TF_STATE_BUCKET}" \
      -backend-config="region=${AWS_ECR_REGION}" \
      -input=false
    terraform plan -out=tfplan -input=false
    terraform apply -input=false tfplan
  ) || {
    echo -e "${ERR}::::Deploy failed — rolling back tfvars and re-applying::::${NC}"
    cp "${TFVARS}.rollback" "${TFVARS}"
    (
      cd "${TF_DIR}"
      terraform plan -out=tfplan-rollback -input=false
      terraform apply -input=false tfplan-rollback
    )
    exit 1
  }
fi

duration=$SECONDS
echo -e "${COLOR}::::::::$(($duration / 60)) minutes and $(($duration % 60)) seconds deployment time.${NC}"
