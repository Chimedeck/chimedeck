# Sprint 128 — Deploy Pipeline: build.sh + deploy.sh Refactor + CI Templates

> **Repo:** this app repo
> **Depends on:** Sprint 127 (`terraform/` folder complete and deployable)
> **Status:** ⬜ Future

---

## Goal

Split the current monolithic `deploy.sh` into two scripts (`build.sh` for image build/push and `deploy.sh` for instance update), add `USE_SSH` as the primary dispatch mechanism, and create two new `.umbra/` CI workflow files to cover the fleet and ASG blue/green deployment topologies.

After this sprint all three deployment modes (single, fleet, ASG blue/green) are fully automated from a git push through to running instances.

---

## Scope

### 1. `scripts/build.sh` (new file)

Extracts docker build + ECR push from the current `deploy.sh`. This script is always run first by CI, regardless of deployment mode.

Responsibilities:
1. Source `./scripts/set_environment.sh` (validates required env vars and builds `AWS_ECR_REPO_URL`)
2. Configure temporary AWS profile for env-file access (same as current `deploy.sh`)
3. Download and decode `.env` from Secrets Manager via `json2env.sh`
4. `docker build -t ${AWS_ECR_REPO_URL} . --platform linux/amd64`
5. Log in to ECR: `docker login -u AWS -p $(aws ecr get-login-password --region ${AWS_ECR_REGION}) ...`
6. `docker push ${AWS_ECR_REPO_URL}`
7. Write `.ecr-build-output` to disk:
   ```bash
   cat > .ecr-build-output <<EOF
   export IMAGE_URL="${AWS_ECR_REPO_URL}"
   export ECR_TAG="${AWS_ECR_TAG_NAME}"
   EOF
   ```
8. Clean up temporary AWS profile credentials

`.ecr-build-output` is sourced by `deploy.sh` in the next CI step; it must never be committed.

---

### 2. `scripts/deploy.sh` (refactor)

Primary dispatch is `USE_SSH` (env var, `"TRUE"` or `"FALSE"`). The deployment mode context (`DEPLOYMENT_MODE`) is treated as metadata for logging only.

```
USE_SSH=TRUE   → SSH in-place update (single or fleet)
USE_SSH=FALSE  → Terraform instance replacement (asg-bluegreen only)
```

#### Shared preamble

```bash
source ./scripts/set_environment.sh
source ./.ecr-build-output  # provides IMAGE_URL and ECR_TAG
```

#### `USE_SSH=TRUE` path

No Terraform. Instances are updated in place.

1. Decode PEM: `echo ${ENCODED_PEM} | base64 --decode > ${AWS_PRIVATE_KEY_PATH} && chmod 400 ${AWS_PRIVATE_KEY_PATH}`
2. If `AWS_INSTANCE_URLS` is set (fleet): iterate comma-separated list, SSH into each and run `AWS_INSTANCE_DEPLOY_SCRIPT`
3. Else if `AWS_INSTANCE_URL` is set (single): SSH into the single instance and run `AWS_INSTANCE_DEPLOY_SCRIPT`
4. Remote command: `IMAGE_URL=${IMAGE_URL} REGION=${AWS_ECR_REGION} ${AWS_INSTANCE_DEPLOY_SCRIPT}`
5. Clean up PEM file

#### `USE_SSH=FALSE` path

Terraform-based instance replacement. Only valid for `DEPLOYMENT_MODE=asg-bluegreen`. No PEM key involved.

1. **Install Terraform** if absent:
   ```bash
   if ! command -v terraform &>/dev/null; then
     TERRAFORM_VERSION="1.8.5"
     curl -fsSL "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip" -o terraform.zip
     unzip -o terraform.zip -d /usr/local/bin && rm terraform.zip
   fi
   ```
   The `terraform/` folder is already present in the CI workspace via the repo checkout — no separate clone needed.
2. **Run DB migrations** (if `USE_RDS=TRUE`):
   ```bash
   bun knex migrate:latest --env production
   ```
4. **Snapshot tfvars for rollback**:
   ```bash
   cp terraform/environments/${ENV_NAME}/terraform.tfvars \
      terraform/environments/${ENV_NAME}/terraform.tfvars.rollback
   ```
5. **Determine inactive slot and flip weights**:
   - Read current `blue_weight` and `green_weight` from `terraform.tfvars`
   - If `blue_weight=100`, inactive slot is green → set `green_ecr_tag=${ECR_TAG}`, `green_weight=100`, `blue_weight=0`
   - If `green_weight=100`, inactive slot is blue → set `blue_ecr_tag=${ECR_TAG}`, `blue_weight=100`, `green_weight=0`
   - Write updated values back to `terraform.tfvars` using `sed` line replacements
6. **Terraform apply**:
   ```bash
   cd terraform/environments/${ENV_NAME}
   terraform init -backend-config=backend.tf -input=false
   terraform plan -out=tfplan -input=false
   terraform apply -input=false tfplan
   ```
7. **On failure — rollback**:
   ```bash
   if [ $? -ne 0 ]; then
     echo "Deploy failed — rolling back"
     cp terraform.tfvars.rollback terraform.tfvars
     terraform plan -out=tfplan-rollback -input=false
     terraform apply -input=false tfplan-rollback
     exit 1
   fi
   ```
8. No cleanup needed — Terraform state files and `.tfplan` artifacts are gitignored (see section 6 below)

---

### 3. `scripts/set_environment.sh` (additions only)

Document the new variables added by this sprint. Add to the existing comment block listing all possible env vars:

```bash
# Deployment strategy — added Sprint 128
# USE_SSH              — TRUE = SSH in-place; FALSE = Terraform replacement (asg only)
# DEPLOYMENT_MODE      — single | fleet | asg-bluegreen (informational, used for logging)
# USE_RDS              — TRUE = run migrations against RDS before terraform apply
# ENV_NAME             — environment directory name under terraform/environments/: staging | stable | production
```

No logic changes to `set_environment.sh` itself — just documentation.

---

### 4. `.umbra/production-fleet.yml` (new CI workflow)

Triggers on the `production-fleet` branch.

```yaml
name: Deploy to Production Fleet

on:
  push:
    branches:
      - production-fleet

env:
  ENV: production
  DEPLOYMENT_MODE: fleet
  USE_SSH: "TRUE"
  # AWS credentials (shared with existing production workflow)
  AWS_ACCESS_KEY_ID: ${{ secrets.PRODUCTION_AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.PRODUCTION_AWS_SECRET_ACCESS_KEY }}
  AWS_ACCOUNT_ID: ${{ secrets.PRODUCTION_AWS_ACCOUNT_ID }}
  AWS_ECR_REGION: ${{ secrets.PRODUCTION_AWS_ECR_REGION }}
  AWS_ECR_REPO_NAME: ${{ secrets.PRODUCTION_AWS_ECR_REPO_NAME }}
  AWS_JH_ENV_SECRET_NAME: ${{ secrets.PRODUCTION_AWS_JH_ENV_SECRET_NAME }}
  AWS_ENV_USER_ACCESS_KEY_ID: ${{ secrets.PRODUCTION_AWS_ENV_USER_ACCESS_KEY_ID }}
  AWS_ENV_USER_SECRET_ACCESS_KEY: ${{ secrets.PRODUCTION_AWS_ENV_USER_SECRET_ACCESS_KEY }}
  AWS_ENV_USER_REGION: ${{ secrets.PRODUCTION_AWS_ENV_USER_REGION }}
  AWS_ECR_TAG_NAME: ${{ secrets.PRODUCTION_AWS_ECR_TAG_NAME }}
  # Fleet-specific
  USE_SSH_DEPLOYMENT: "TRUE"
  ENCODED_PEM: ${{ secrets.PRODUCTION_FLEET_ENCODED_PEM }}
  AWS_PRIVATE_KEY_PATH: /tmp/fleet-deploy.pem
  AWS_INSTANCE_URLS: ${{ secrets.PRODUCTION_FLEET_INSTANCE_URLS }}
  AWS_INSTANCE_DEPLOY_SCRIPT: ${{ secrets.PRODUCTION_FLEET_DEPLOY_SCRIPT }}

jobs:
  deploy:
    builder:
      - ubuntu
      - docker
      - aws
    steps:
      - uses: checkout
      - name: Build Docker image and push to ECR
        run: ./scripts/build.sh
      - name: Deploy to fleet instances via SSH
        run: ./scripts/deploy.sh
```

---

### 5. `.umbra/production-asg.yml` (new CI workflow)

Triggers on the `production-asg` branch.

```yaml
name: Deploy to Production ASG (Blue/Green)

on:
  push:
    branches:
      - production-asg

env:
  ENV: production
  DEPLOYMENT_MODE: asg-bluegreen
  USE_SSH: "FALSE"
  ENV_NAME: production
  # AWS credentials
  AWS_ACCESS_KEY_ID: ${{ secrets.PRODUCTION_AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.PRODUCTION_AWS_SECRET_ACCESS_KEY }}
  AWS_ACCOUNT_ID: ${{ secrets.PRODUCTION_AWS_ACCOUNT_ID }}
  AWS_ECR_REGION: ${{ secrets.PRODUCTION_AWS_ECR_REGION }}
  AWS_ECR_REPO_NAME: ${{ secrets.PRODUCTION_AWS_ECR_REPO_NAME }}
  AWS_JH_ENV_SECRET_NAME: ${{ secrets.PRODUCTION_AWS_JH_ENV_SECRET_NAME }}
  AWS_ENV_USER_ACCESS_KEY_ID: ${{ secrets.PRODUCTION_AWS_ENV_USER_ACCESS_KEY_ID }}
  AWS_ENV_USER_SECRET_ACCESS_KEY: ${{ secrets.PRODUCTION_AWS_ENV_USER_SECRET_ACCESS_KEY }}
  AWS_ENV_USER_REGION: ${{ secrets.PRODUCTION_AWS_ENV_USER_REGION }}
  AWS_ECR_TAG_NAME: ${{ secrets.PRODUCTION_AWS_ECR_TAG_NAME }}
  # Terraform state
  TF_STATE_BUCKET: ${{ secrets.PRODUCTION_TF_STATE_BUCKET }}
  TF_LOCK_TABLE: ${{ secrets.PRODUCTION_TF_LOCK_TABLE }}
  # Migrations
  USE_RDS: "TRUE"

jobs:
  deploy:
    builder:
      - ubuntu
      - docker
      - aws
    steps:
      - uses: checkout
      - name: Build Docker image and push to ECR
        run: ./scripts/build.sh
      - name: Blue/Green deploy via Terraform
        run: ./scripts/deploy.sh
```

---

### 6. `.gitignore` additions

Add to the root `.gitignore` so build artifacts are never committed:

```
.ecr-build-output
terraform/environments/**/terraform.tfvars.rollback
terraform/environments/**/.terraform/
terraform/environments/**/tfplan
terraform/environments/**/tfplan-rollback
/tmp/*.pem
```

---

## New secrets required in TurtleCI

Document these new secrets needed for the new CI workflows (note: existing secrets are unchanged):

| Secret key | Used by | Description |
|---|---|---|
| `PRODUCTION_FLEET_ENCODED_PEM` | `production-fleet.yml` | Base64-encoded EC2 PEM for fleet SSH access |
| `PRODUCTION_FLEET_INSTANCE_URLS` | `production-fleet.yml` | Comma-separated `user@host` strings for all fleet instances |
| `PRODUCTION_FLEET_DEPLOY_SCRIPT` | `production-fleet.yml` | Remote command string to run on each fleet instance |
| `PRODUCTION_TF_STATE_BUCKET` | `production-asg.yml` | S3 bucket name for Terraform state |
| `PRODUCTION_TF_LOCK_TABLE` | `production-asg.yml` | DynamoDB table name for state locking |

---

## Files changed

```
scripts/build.sh             (new)
scripts/deploy.sh            (refactored)
scripts/set_environment.sh   (comment additions only)
.umbra/production-fleet.yml  (new)
.umbra/production-asg.yml    (new)
.gitignore                   (additions)
```

Existing files **not changed**:
- `.umbra/production.yml`
- `.umbra/production copy.yml`
- `scripts/deploy.production.sh`
- `scripts/deploy-horiflow.sh`
- `scripts/deploy-horiflow-staging.sh`

---

## Acceptance criteria

- [ ] `build.sh` runs standalone: exits 0, image is visible in ECR, `.ecr-build-output` is written with correct `IMAGE_URL` and `ECR_TAG`
- [ ] `deploy.sh` with `USE_SSH=TRUE` and a single instance: SSH connection established, deploy script runs, new image is running (`docker inspect` confirms correct image digest)
- [ ] `deploy.sh` with `USE_SSH=TRUE` and `AWS_INSTANCE_URLS` (multiple): deploy script runs on every listed instance; partial failure (one host unreachable) causes the overall script to exit non-zero
- [ ] `deploy.sh` with `USE_SSH=FALSE`: infra repo cloned, `terraform.tfvars` updated with correct tag and slot weights, `terraform apply` executes; final `terraform.tfvars` diff shows only `ecr_tag` and weight changes
- [ ] `deploy.sh` `USE_SSH=FALSE` rollback path: force `terraform apply` to fail (e.g. temporarily revoke IAM permission); confirm `terraform.tfvars.rollback` is applied and previous weights are restored
- [ ] `.umbra/production-fleet.yml` CI run completes end-to-end on a push to `production-fleet` branch
- [ ] `.umbra/production-asg.yml` CI run completes end-to-end on a push to `production-asg` branch
- [ ] `.ecr-build-output` and `.infra-repo/` are absent from `git status` after a local test run (confirmed by `.gitignore` entries)
