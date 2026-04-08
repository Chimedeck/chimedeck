# Sprint 124 — Terraform: Scaffolding + Foundation Modules

> **Folder:** `terraform/` (new top-level folder in this repo)
> **Depends on:** none
> **Status:** ⬜ Future

---

## Goal

Create the `terraform/` folder in this repository with the correct directory structure, remote state backend, and the four foundation modules that all higher-level modules depend on: VPC, ECR, S3, and NAT Gateway.

After this sprint the folder is self-contained — an operator can `terraform apply` the bootstrap module once to create the remote state bucket and lock table, then use the foundation modules to provision core AWS primitives for any environment.

---

## Scope

### 1. Repository structure

Create the root directory layout inside this repository:

```
terraform/
├── bootstrap/            # one-time state-backend provisioning
│   ├── main.tf
│   └── variables.tf
├── modules/
│   ├── vpc/
│   ├── ecr/
│   ├── s3/
│   └── nat-gateway/
├── environments/         # populated in Sprint 127
├── scripts/              # populated in Sprint 127
├── .terraform-version    # pin terraform version (≥ 1.7)
└── README.md
```

### 2. Bootstrap module (`bootstrap/`)

One-time manual apply. Creates the shared state infrastructure:

- S3 bucket: versioning enabled, SSE-S3 encryption, block all public access
- DynamoDB table: `LockID` string hash key (for terraform state locking)
- Output both resource identifiers so they can be pasted into environment `backend.tf` files

Variables:
- `bucket_name` — S3 state bucket name
- `lock_table_name` — DynamoDB table name
- `region` — AWS region for state infrastructure

> This module uses a **local** backend (no remote state for the bootstrapper itself). Apply once manually.

### 3. Root Terraform config (`terraform.tf`)

Provider and backend declaration used by all environment configs:

```hcl
terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    null = {
      source  = "hashicorp/null"
      version = ">= 3.0"
    }
  }

  backend "s3" {
    # populated per-environment via backend.tf partial config
    # terraform init -backend-config=backend.tf
  }
}
```

### 4. `modules/vpc/`

Optional VPC creation. If `create_vpc = false`, uses the default VPC.

Variables:
- `create_vpc` (bool, default `false`) — when true, creates a dedicated VPC
- `vpc_cidr` (string, default `"10.0.0.0/16"`) — only used when `create_vpc = true`
- `availability_zones` (list of strings) — AZs to place subnets in
- `name_prefix` (string) — resource name prefix

Outputs:
- `vpc_id`
- `public_subnet_ids` (list)
- `private_subnet_ids` (list)

Behaviour when `create_vpc = true`:
- One public subnet per AZ (auto-assign public IP enabled)
- One private subnet per AZ
- Internet Gateway attached to public subnets
- Route table: public subnets route `0.0.0.0/0` → IGW
- Private subnet route `0.0.0.0/0` → NAT Gateway (wired in by the caller via `nat-gateway` module)

Behaviour when `create_vpc = false`:
- Uses `data.aws_vpc.default` and `data.aws_subnets` data sources
- All subnets treated as public (default VPC behaviour)
- `private_subnet_ids` output equals `public_subnet_ids`

### 5. `modules/ecr/`

ECR repository with image lifecycle management.

Variables:
- `name` (string) — repository name
- `image_tag_mutability` (string, default `"MUTABLE"`)
- `keep_last_n_images` (number, default `10`) — lifecycle policy: expire untagged images over N
- `tags` (map of strings)

Outputs:
- `repository_url`
- `repository_arn`

### 6. `modules/s3/`

General-purpose S3 bucket with security defaults.

Variables:
- `bucket_name` (string)
- `versioning_enabled` (bool, default `true`)
- `tags` (map of strings)

Behaviour:
- Block all public access
- SSE-S3 encryption (AES256) on all objects by default
- Versioning per variable

Outputs:
- `bucket_name`
- `bucket_arn`

### 7. `modules/nat-gateway/`

Managed NAT Gateway for private subnet egress.

Variables:
- `name_prefix` (string)
- `public_subnet_id` (string) — the public subnet to place the NAT GW in
- `private_route_table_ids` (list of strings) — route tables to update with the NAT GW route

Behaviour:
- Allocates an EIP
- Creates NAT Gateway in the given public subnet
- Adds `0.0.0.0/0 → nat-gateway` route to each supplied private route table

Outputs:
- `nat_gateway_id`
- `eip_public_ip`

---

## Files

```
bootstrap/
  main.tf
  variables.tf
  outputs.tf

modules/vpc/
  main.tf
  variables.tf
  outputs.tf

modules/ecr/
  main.tf
  variables.tf
  outputs.tf

modules/s3/
  main.tf
  variables.tf
  outputs.tf

modules/nat-gateway/
  main.tf
  variables.tf
  outputs.tf

.terraform-version
.gitignore
README.md
```

---

## Acceptance criteria

- [ ] `terraform validate` passes on every module individually
- [ ] Bootstrap module applies cleanly from scratch and creates S3 bucket + DynamoDB table
- [ ] VPC module with `create_vpc = true` produces a VPC with correct subnet count matching `availability_zones`
- [ ] VPC module with `create_vpc = false` successfully reads and outputs the default VPC ID
- [ ] ECR module creates repo; pulling a test image after pushing confirms `repository_url` is correct
- [ ] S3 module creates bucket with public access fully blocked; attempt to make an object public is rejected
- [ ] NAT Gateway module adds correct routes to supplied private route table IDs
- [ ] All modules: `terraform destroy` removes all created resources without errors
