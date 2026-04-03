#!/usr/bin/env bash

set -e

SECONDS=0

source ./scripts/set_environment.sh

# set up aws credentials for getting the env file
aws configure set aws_access_key_id ${AWS_ENV_USER_ACCESS_KEY_ID} --profile $TEMPORARY_SESSION_NAME && aws configure set aws_secret_access_key ${AWS_ENV_USER_SECRET_ACCESS_KEY} --profile $TEMPORARY_SESSION_NAME && aws configure set region "$AWS_ENV_USER_REGION" && aws configure set output "text" --profile $TEMPORARY_SESSION_NAME

echo -e "${COLOR}:::::::::Deploying $GITHUB_BASE_REF by the CI:::::::::${NC}"
# download and convert env from json to .env
echo -e "${COLOR}::::Decoding env file::::${NC}"
aws secretsmanager get-secret-value --secret-id ${AWS_JH_ENV_SECRET_NAME} --region=${AWS_ENV_USER_REGION} --query SecretString --output text --profile $TEMPORARY_SESSION_NAME >.env.json
./scripts/json2env.sh .env.json .env

echo -e "${COLOR}::::will deploy with tag >>${AWS_ECR_TAG_NAME}<<::::${NC}"
docker build -t ${AWS_ECR_REPO_URL} . --platform linux/amd64

echo -e "${COLOR}::::login aws::::${NC}"

docker login -u AWS -p $(aws ecr get-login-password --region ${AWS_ECR_REGION}) ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_ECR_REGION}.amazonaws.com

echo -e "${COLOR}::::pushing to aws repo::::${NC}"
docker push ${AWS_ECR_REPO_URL}

if [ "$USE_SSM_DEPLOYMENT" == "TRUE" ]; then
  if [ -n "${AWS_INSTANCE_IDS}" ]; then
    # AWS_INSTANCE_IDS format: "i-0abc123:us-east-1,i-0def456:eu-west-1"
    echo -e "${COLOR}::::SSM deploy for instances: ${AWS_INSTANCE_IDS}::::${NC}"
    echo $AWS_INSTANCE_IDS | tr ',' '\n' | while read ENTRY
    do
      ENTRY=$(echo $ENTRY | tr -d '[:space:]')
      INSTANCE_ID=$(echo $ENTRY | cut -d':' -f1)
      INSTANCE_REGION=$(echo $ENTRY | cut -d':' -f2)
      echo "Deploying to $INSTANCE_ID in $INSTANCE_REGION"

      COMMAND_ID=$(aws ssm send-command \
        --instance-ids "$INSTANCE_ID" \
        --document-name "AWS-RunShellScript" \
        --parameters "commands=[\"IMAGE_URL=${AWS_ECR_REPO_URL} REGION=${INSTANCE_REGION} ${AWS_INSTANCE_DEPLOY_SCRIPT}\"]" \
        --region ${INSTANCE_REGION} \
        --query "Command.CommandId" \
        --output text)

      echo "Waiting for command $COMMAND_ID on $INSTANCE_ID..."
      aws ssm wait command-executed \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --region ${INSTANCE_REGION}

      aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --region ${INSTANCE_REGION} \
        --query "StandardOutputContent" \
        --output text
    done
  else
    echo -e "${COLOR}:::::::::::::No instance IDs provided, skipping SSM deploy::::::::::::::${NC}"
  fi
else
  echo -e "${COLOR}:::::::::::::Deploy by other alternatives::::::::::::::${NC}"
fi

aws configure set aws_access_key_id "" --profile $TEMPORARY_SESSION_NAME && aws configure set aws_secret_access_key "" --profile $TEMPORARY_SESSION_NAME

duration=$SECONDS
echo -e "${COLOR}::::::::$(($duration / 60)) minutes and $(($duration % 60)) seconds deployment time.${NC}"
