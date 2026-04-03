# Sprint 127 — Terraform Infra: Environment Directories + EC2 Startup Scripts

> **Folder:** `terraform/` in this repo
> **Depends on:** Sprint 124, Sprint 125, Sprint 126 (all modules must exist)
> **Status:** ⬜ Future

---

## Goal

Wire all the modules from previous sprints into concrete, deployable environment directories (`staging`, `stable`, `production`) and write the two runtime scripts that run on every EC2 instance: the user-data startup script that fetches the ECR image and starts the app, and the health-gate polling script used by the `null_resource` in `ec2-asg-bluegreen`.

After this sprint, an operator can `terraform init` + `terraform apply` a specific environment with a specific deployment mode and get a fully running stack.

---

## Scope

### 1. `scripts/startup.sh`

EC2 user data template. Rendered at Launch Template creation time via `templatefile()`. Two template variables injected by the calling module:

- `ecr_image_url` — full image URL including tag, e.g. `123.dkr.ecr.ap-southeast-1.amazonaws.com/app:abc1234`
- `secrets_arn` — AWS Secrets Manager ARN for the app's environment variables (JSON key-value object)

Script responsibilities (in order):

1. **Enable docker on boot** — `systemctl enable docker && systemctl start docker` (no-op if already running on baked AMI)
2. **ECR authentication** — use instance's IAM role (no credentials stored on disk):
   ```bash
   aws ecr get-login-password --region "${AWS_REGION}" \
     | docker login --username AWS --password-stdin "${ECR_REGISTRY}"
   ```
   Extract registry host from `ecr_image_url` (everything before the first `/`).
3. **Pull image** — `docker pull "${ecr_image_url}"`
4. **Write `.env` from Secrets Manager** — fetch the secret JSON and convert each key to `KEY=value` lines:
   ```bash
   aws secretsmanager get-secret-value \
     --secret-id "${secrets_arn}" \
     --query SecretString \
     --output text \
   | jq -r 'to_entries[] | "\(.key)=\(.value)"' > /app/.env
   ```
5. **Start the app** — `docker compose -f /app/docker-compose.prod.yml up -d`
6. **Emit health signal** — write a marker file `/tmp/startup-complete` so external tooling can confirm the script ran

> **Note:** the `docker-compose.prod.yml` must be present on the instance. The baked AMI should include it at `/app/docker-compose.prod.yml`. Document this as an AMI baking requirement.

### 2. `scripts/wait-for-healthy-targets.sh`

Health gate script. Called by the `null_resource` in `ec2-asg-bluegreen` during `terraform apply`.

```
Usage: wait-for-healthy-targets.sh <target-group-arn> <min-healthy> <timeout-seconds>
```

Algorithm:
1. Record start time
2. Every 15 seconds, call:
   ```bash
   aws elbv2 describe-target-health \
     --target-group-arn "$1" \
     --query 'TargetHealthDescriptions[?TargetHealth.State==`healthy`] | length(@)'
   ```
3. If returned count ≥ `min-healthy`, print success message and exit 0
4. If elapsed time ≥ `timeout-seconds`, print failure message listing current unhealthy targets and exit 1

Requires: `aws` CLI, `jq` on the CI runner (not the EC2 instance).

---

### 2. Environment directory structure

Each environment (`staging`, `stable`, `production`) has the same file layout:

```
environments/<env>/
  backend.tf          # partial backend config; passed to `terraform init -backend-config=backend.tf`
  main.tf             # module calls
  variables.tf        # variable declarations
  terraform.tfvars.example  # example with all required vars documented
  outputs.tf          # surfaces key outputs for CI use
```

### 3. `environments/*/backend.tf`

Partial backend config (no sensitive values hardcoded):

```hcl
bucket         = "YOUR_TF_STATE_BUCKET"
key            = "environments/<env>/terraform.tfstate"
region         = "YOUR_STATE_BUCKET_REGION"
dynamodb_table = "YOUR_LOCK_TABLE_NAME"
encrypt        = true
```

Operators fill in the bucket and table names (created by bootstrap module) and pass using:
```bash
terraform init -backend-config=backend.tf
```

### 4. `environments/*/main.tf`

Calls modules conditionally based on `deployment_mode` variable:

```hcl
# Always present:
module "vpc"             { ... }
module "ecr"             { ... }
module "s3"              { ... }
module "security_groups" { ... }
module "rds"             { ... }
module "redis"           { ... }

# Conditional on deployment_mode:
module "ec2_single"       { count = var.deployment_mode == "single"   ? 1 : 0 ... }
module "nat_gateway"      { count = var.deployment_mode != "single"   ? 1 : 0 ... }
module "ec2_fleet"        { count = var.deployment_mode == "fleet"    ? 1 : 0 ... }
module "ec2_asg_bluegreen"{ count = var.deployment_mode == "asg-bluegreen" ? 1 : 0 ... }
```

### 5. `environments/*/variables.tf`

Key variables that differ per environment:

| Variable | Type | Description |
|----------|------|-------------|
| `deployment_mode` | string | `"single"` / `"fleet"` / `"asg-bluegreen"` |
| `aws_region` | string | Primary AWS region |
| `ami_ids` | map(string) | Per-region AMI IDs, e.g. `{ "ap-southeast-1" = "ami-xxx" }` |
| `instance_type` | string | EC2 instance type |
| `create_vpc` | bool | Whether to create isolated VPC or use default |
| `ecr_repo_name` | string | ECR repository name |
| `secrets_arn` | string | Secrets Manager ARN for app env vars |
| `acm_certificate_arn` | string | ACM cert ARN (fleet/ASG modes) |
| `rds_instance_class` | string | |
| `rds_allocated_storage` | number | |
| `rds_max_allocated_storage` | number | `0` = disabled |
| `rds_multi_az` | bool | |
| `blue_ecr_tag` | string | Current live slot tag (ASG mode only) |
| `green_ecr_tag` | string | Inactive slot tag (ASG mode only) |
| `blue_weight` | number | 100 = all-blue (ASG mode only) |
| `green_weight` | number | 0 = inactive (ASG mode only) |
| `redis_cluster_mode` | string | `"single"` or `"cluster"` |
| `tags` | map(string) | Common resource tags |

### 6. `environments/*/terraform.tfvars.example`

Fully documented example file for each environment with realistic placeholder values and inline comments. This is the file operators copy to `terraform.tfvars` and fill in. Contains all variables from `variables.tf` with descriptive comments for non-obvious ones.

### 7. `environments/*/outputs.tf`

Surface outputs needed by CI and operators:

- `ecr_repository_url`
- `alb_dns_name` (when applicable)
- `public_ip` (single mode)
- `rds_endpoint`
- `redis_endpoint`

---

## AMI baking requirements (documentation only, no Terraform)

Document in `README.md` what the custom AMI must have pre-installed:

- Docker Engine (latest stable)
- AWS CLI v2
- `/app/docker-compose.prod.yml` copied from this repo
- `jq` (needed by startup script for Secrets Manager parsing)
- Docker set to **not** auto-start on boot (startup script handles this with correct ordering)

Each AWS region used in any environment requires its own copy of the AMI (AMI IDs are region-scoped). The `ami_ids` map in `terraform.tfvars` must include an entry for every region where instances are deployed.

---

## Files

```
terraform/scripts/
  startup.sh
  wait-for-healthy-targets.sh

terraform/environments/
  staging/
    backend.tf
    main.tf
    variables.tf
    terraform.tfvars.example
    outputs.tf
  stable/
    backend.tf
    main.tf
    variables.tf
    terraform.tfvars.example
    outputs.tf
  production/
    backend.tf
    main.tf
    variables.tf
    terraform.tfvars.example
    outputs.tf

terraform/README.md  (AMI baking requirements and operator runbook)
```

---

## Acceptance criteria

- [ ] `startup.sh` runs on a fresh EC2 instance (with the baked AMI); app container comes up and `/health` returns 200 within the startup timeout
- [ ] `startup.sh` correctly writes `.env` from Secrets Manager; no credentials appear in process list or docker inspect env output beyond what Secrets Manager returned
- [ ] `wait-for-healthy-targets.sh <tg-arn> 1 60`: with one healthy target registered, script exits 0
- [ ] `wait-for-healthy-targets.sh <tg-arn> 1 10`: with no healthy targets, script exits 1 after ≤10s + one polling interval
- [ ] `terraform init -backend-config=backend.tf` succeeds for each environment (state bucket must exist via bootstrap module)
- [ ] `terraform plan` for `deployment_mode=single` shows no fleet or ASG resources
- [ ] `terraform plan` for `deployment_mode=fleet` shows ALB + instances but no ASG resources
- [ ] `terraform plan` for `deployment_mode=asg-bluegreen` shows two ASGs + two target groups + ALB weighted listener
- [ ] `terraform.tfvars.example` for each environment has every declared variable covered with a comment
