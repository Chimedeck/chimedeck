# Terraform Infrastructure

This directory contains all Terraform code for the project. It is structured to support multiple environments (staging, stable, production) with shared reusable modules.

---

## Directory Structure

```
terraform/
├── .terraform-version          # Pinned Terraform version (used by tfenv / tofuenv)
├── README.md                   # This file
├── bootstrap/                  # One-time state-backend provisioning (local backend)
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
├── modules/                    # Reusable modules (no provider config inside)
│   ├── vpc/
│   ├── nat-gateway/
│   ├── ecr/
│   ├── s3/
│   ├── security-groups/
│   ├── rds-postgres/
│   ├── elasticache-redis/
│   ├── ec2-single/
│   ├── ec2-fleet-fixed/
│   ├── ec2-asg-bluegreen/
│   ├── asg-slot/
│   └── vpc-peering/
├── environments/               # Per-environment entry points
│   ├── staging/
│   ├── stable/
│   └── production/
└── scripts/                    # Helper scripts (startup.sh, health-gate, etc.)
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| [Terraform](https://developer.hashicorp.com/terraform/install) | ≥ 1.10 (see `.terraform-version`) |
| [tfenv](https://github.com/tfutils/tfenv) | any — automatically picks version from `.terraform-version` |
| AWS CLI | ≥ 2.x |
| Appropriate AWS credentials | IAM user or role with the permissions described below |

---

## AWS Profile

All Terraform commands use whichever AWS profile is active in your shell. If your company has multiple profiles, set the correct one before running any `terraform` command:

```bash
export AWS_PROFILE=your-company-profile
```

Verify the active identity before proceeding:

```bash
aws sts get-caller-identity
```

---

## Quick Start

### 1. Bootstrap (first time only)

The `bootstrap/` module creates the S3 bucket and DynamoDB table used by all other Terraform configurations as a remote backend. It uses a **local** backend itself and must be applied once before any environment is initialised.

```bash
cd terraform/bootstrap

terraform init
terraform apply \
  -var="bucket_name=chime-deck-bootstrap-tf-states" \
  -var="region=ap-southeast-1"
```

Note the outputs — you will paste them into each environment's `backend.tf`.

### 2. Initialise an environment

```bash
cd terraform/environments/stable
terraform init -backend-config=backend.tf
```

### 3. Plan & apply

```bash
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

---

## Modules Overview

| Module | Purpose |
|--------|---------|
| `vpc` | Optional VPC with public/private subnets and IGW. Falls back to default VPC when `create_vpc = false`. |
| `nat-gateway` | EIP + managed NAT Gateway; wires private route tables to enable outbound internet from private subnets. |
| `ecr` | ECR repository with configurable lifecycle policy. |
| `s3` | General-purpose S3 bucket with versioning, SSE-S3, and public-access blocking. |
| `security-groups` | Four security groups: ALB, App, DB, Redis — with least-privilege ingress rules. |
| `rds-postgres` | RDS PostgreSQL 16 with pg_cron parameter group and storage auto-scaling. |
| `elasticache-redis` | ElastiCache Redis 7; supports single-node and cluster mode. |
| `ec2-single` | Single EC2 instance with optional EIP and user-data templatefile. |
| `ec2-fleet-fixed` | Fixed-count private-instance fleet behind an ALB with ACM TLS and HTTP→HTTPS redirect. |
| `asg-slot` | Sub-module: Launch Template + ASG + Target Group for one blue/green slot. |
| `ec2-asg-bluegreen` | Two asg-slot instances, weighted ALB listener, and a health-gate null_resource. |
| `vpc-peering` | Cross-region VPC peering connection with route table entries on both sides. |

---

## Remote State Backend

All environment configs use the S3 backend created by the bootstrap module:

```hcl
# environments/<env>/backend.tf
bucket       = "<output: state_bucket_name>"
key          = "environments/<env>/terraform.tfstate"
region       = "<output: region>"
use_lockfile = true  # S3 native locking — requires Terraform >= 1.10
encrypt      = true
```

---

## Conventions

- **No secrets in code.** All sensitive values are passed via environment variables or Secrets Manager.
- **`prevent_destroy = true`** on the state bucket and lock table to prevent accidental deletion.
- **Tagging:** every resource accepts a `tags` variable and merges it with module-level defaults.
- **Idempotency:** every `apply` is safe to re-run; resources are only updated when configuration changes.
