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

# decode the encoded permission file
echo -e "${COLOR}::::Decoding permission file::::${NC}"

if [ "$USE_SSH_DEPLOYMENT" == "TRUE" ]; then
  echo ${ENCODED_PEM} | base64 --decode >${AWS_PRIVATE_KEY_PATH}
  chmod 400 ${AWS_PRIVATE_KEY_PATH}
fi

echo -e "${COLOR}::::will deploy with tag >>${AWS_ECR_TAG_NAME}<<::::${NC}"
docker build -t ${AWS_ECR_REPO_URL} . --platform linux/amd64

echo -e "${COLOR}::::login aws::::${NC}"

docker login -u AWS -p $(aws ecr get-login-password --region ${AWS_ECR_REGION} ${AWS_PROFILE_PARAM}) ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_ECR_REGION}.amazonaws.com

echo -e "${COLOR}::::pushing to aws repo::::${NC}"
docker push ${AWS_ECR_REPO_URL}

if [ "$USE_SSH_DEPLOYMENT" == "TRUE" ]; then
  if [ -n "${AWS_INSTANCE_URLS}" ]; then
    echo -e "${COLOR}::::ssh and deploy for multiple instances::::${NC}"
    echo $AWS_INSTANCE_URLS | tr ',' '\n' | while read CURRENT_AWS_INSTANCE_URL
    do
      echo "Processing $CURRENT_AWS_INSTANCE_URL"
      ssh -o StrictHostKeyChecking=no -i "${AWS_PRIVATE_KEY_PATH}" ${CURRENT_AWS_INSTANCE_URL} "IMAGE_URL=${AWS_ECR_REPO_URL} REGION=${AWS_ECR_REGION} ${AWS_INSTANCE_DEPLOY_SCRIPT}"
    done
  elif [ -n "${AWS_INSTANCE_URL}" ]; then
    echo -e "${COLOR}::::ssh and deploy for single instance::::${NC}"
    ssh -o StrictHostKeyChecking=no -i "${AWS_PRIVATE_KEY_PATH}" ${AWS_INSTANCE_URL} "IMAGE_URL=${AWS_ECR_REPO_URL} REGION=${AWS_ECR_REGION} ${AWS_INSTANCE_DEPLOY_SCRIPT}"
  else
    echo -e "${COLOR}:::::::::::::Deploy by other alternatives::::::::::::::${NC}"
  fi
else
  echo -e "${COLOR}:::::::::::::Deploy by other alternatives::::::::::::::${NC}"
fi

aws configure set aws_access_key_id "" --profile $TEMPORARY_SESSION_NAME && aws configure set aws_secret_access_key "" --profile $TEMPORARY_SESSION_NAME
rm -f $AWS_PRIVATE_KEY_PATH

duration=$SECONDS
echo -e "${COLOR}::::::::$(($duration / 60)) minutes and $(($duration % 60)) seconds deployment time.${NC}"
