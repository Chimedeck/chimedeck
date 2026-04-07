#!/usr/bin/env bash

set -e

SECONDS=0

source ./scripts/set_environment.stable.sh

# set up aws credentials for getting the env file
aws configure set aws_access_key_id ${AWS_ENV_USER_ACCESS_KEY_ID} --profile $TEMPORARY_SESSION_NAME \
  && aws configure set aws_secret_access_key ${AWS_ENV_USER_SECRET_ACCESS_KEY} --profile $TEMPORARY_SESSION_NAME \
  && aws configure set region "$AWS_ENV_USER_REGION" \
  && aws configure set output "text" --profile $TEMPORARY_SESSION_NAME

echo -e "${COLOR}::::Decoding env file::::${NC}"
aws secretsmanager get-secret-value \
  --secret-id ${AWS_JH_ENV_SECRET_NAME} \
  --region=${AWS_ENV_USER_REGION} \
  --query SecretString \
  --output text \
  --profile $TEMPORARY_SESSION_NAME > .env.json
./scripts/json2env.sh .env.json .env

echo -e "${COLOR}::::will build with tag >>${AWS_ECR_TAG_NAME}<<::::${NC}"
docker build -t ${AWS_ECR_REPO_URL} . --platform linux/amd64

echo -e "${COLOR}::::login aws::::${NC}"
ECR_PASSWORD=$(aws ecr get-login-password --region "${AWS_ECR_REGION}")
docker login -u AWS -p "${ECR_PASSWORD}" \
  "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_ECR_REGION}.amazonaws.com"

echo -e "${COLOR}::::pushing to aws repo::::${NC}"
docker push ${AWS_ECR_REPO_URL}

cat > .ecr-build-output <<EOF
export IMAGE_URL="${AWS_ECR_REPO_URL}"
export ECR_TAG="${AWS_ECR_TAG_NAME}"
EOF

echo -e "${COLOR}::::build output written to .ecr-build-output::::${NC}"

# clean up temporary AWS profile credentials
aws configure set aws_access_key_id "" --profile $TEMPORARY_SESSION_NAME \
  && aws configure set aws_secret_access_key "" --profile $TEMPORARY_SESSION_NAME

duration=$SECONDS
echo -e "${COLOR}::::::::$(($duration / 60)) minutes and $(($duration % 60)) seconds build time.${NC}"
