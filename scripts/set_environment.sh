#!/usr/bin/env bash

set -e

export COLOR='\033[0;32m'
export NC='\033[0m'
export ERR='\033[0;31m'

# A list of possible environment variables:
# AWS_ECR_TAG_NAME
# AWS_PROFILE_PARAM
# ENV_FILE_PATH
# ENV_NAME
# AWS_ACCOUNT_ID
# AWS_ECR_REGION
# AWS_ECR_REPO_NAME
# AWS_ECR_REPO_URL
# AWS_JH_ENV_SECRET_NAME
# AWS_INSTANCE_URL - single instance
# AWS_INSTANCE_URLS - multiple instances

# AWS_ACCESS_KEY_ID
# AWS_SECRET_ACCESS_KEY
# AWS_ENV_USER_ACCESS_KEY_ID
# AWS_ENV_USER_SECRET_ACCESS_KEY
# AWS_ENV_USER_REGION
# ENCODED_PEM

source ./scripts/utils.sh

echo -e "${COLOR}:::::::::::::Start Environment Setting for $ENV::::::::::::::${NC}"

#Optional variables for shared hosting
# AWS_INSTANCE_DEPLOY_SCRIPT
required_envs=(
  "AWS_ACCESS_KEY_ID"
  "AWS_SECRET_ACCESS_KEY"
  "AWS_ACCOUNT_ID"
  "AWS_ECR_REGION"
  "AWS_ECR_REPO_NAME"
  "AWS_JH_ENV_SECRET_NAME"
  "AWS_ENV_USER_ACCESS_KEY_ID"
  "AWS_ENV_USER_SECRET_ACCESS_KEY"
  "AWS_ENV_USER_REGION"
)

for required_env in "${required_envs[@]}"; do
  if [ -z "${!required_env}" ]; then
    echo "Error: $required_env is not set"
    exit 1
  fi
done

set_env_var "AWS_ECR_TAG_NAME" "${TAG:-"latest-$(git rev-parse HEAD)"}"
set_env_var "AWS_PROFILE_PARAM" ""
set_env_var "ENV_FILE_PATH" ".env"

export ENV_NAME=$ENV
export AWS_ENV_USER_REGION=ap-southeast-1
export AWS_ECR_REPO_URL="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_ECR_REGION}.amazonaws.com/${AWS_ECR_REPO_NAME}:${AWS_ECR_TAG_NAME}"

set_env_var "AWS_INSTANCE_DEPLOY_SCRIPT" "./deploy.sh"
set_env_var "USE_SSH_DEPLOYMENT" "TRUE"

if [ "$USE_SSH_DEPLOYMENT" == "TRUE" ]; then
  set_env_var "ENCODED_PEM" "TRUE"

  if [ -z "$AWS_INSTANCE_URL" ] && [ -z "$AWS_INSTANCE_URLS" ]; then
    echo "Neither single instance URL nor multiple instance URL found"
    exit 1
  fi
fi

echo -e "${COLOR}:::::::::::::Current Environment Setting is correct, CI is starting::::::::::::::${NC}"
export TEMPORARY_SESSION_NAME=$(uuidgen)
export AWS_PRIVATE_KEY_PATH="./${TEMPORARY_SESSION_NAME}.pem"
