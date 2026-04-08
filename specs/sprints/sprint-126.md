# Sprint 126 — Terraform Infra: EC2 Compute Modules (Single, Fleet, ASG Blue/Green)

> **Folder:** `terraform/` in this repo
> **Depends on:** Sprint 124 (VPC, NAT Gateway), Sprint 125 (security groups outputs)
> **Status:** ⬜ Future

---

## Goal

Implement the three EC2 compute modules that cover every deployment topology:

- **`ec2-single`** — one instance with an Elastic IP; simplest path
- **`ec2-fleet-fixed`** — a fixed number of instances behind an ALB; instances live in private subnets and are unreachable except from the ALB; supports optional cross-region instances via VPC peering
- **`ec2-asg-bluegreen`** — two permanently-defined ASG slots (blue/green) behind a weighted ALB listener; health-gated cutover with automatic rollback signal on failure

After this sprint every supported topology has a working Terraform module and can be wired into an environment directory (Sprint 127).

---

## Scope

### 1. `modules/ec2-single/`

One EC2 instance with a static public IP.

#### Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `name_prefix` | string | — | Resource name prefix |
| `ami_id` | string | — | AMI ID for the region (custom baked AMI with Docker + AWS CLI) |
| `instance_type` | string | `"t3.small"` | EC2 instance type |
| `subnet_id` | string | — | Public subnet to place the instance in |
| `security_group_ids` | list(string) | — | SGs to attach (typically just `app` SG) |
| `iam_instance_profile` | string | — | Name of IAM instance profile to attach |
| `secrets_arn` | string | — | Secrets Manager ARN for app env vars |
| `ecr_image_url` | string | — | Full ECR image URL including tag |
| `user_data_template_path` | string | — | Path to `startup.sh` templatefile |
| `tags` | map(string) | `{}` | |

#### Behaviour

- Allocates an EIP and associates it with the instance
- User data rendered via `templatefile(var.user_data_template_path, { ecr_image_url = var.ecr_image_url, secrets_arn = var.secrets_arn })`
- IAM instance profile attached directly (grants ECR pull + Secrets Manager read; no credentials stored in AMI)

#### Outputs

- `public_ip`
- `instance_id`

---

### 2. `modules/vpc-peering/`

Cross-region VPC peering for the fleet module.

#### Variables

| Variable | Type | Description |
|----------|------|-------------|
| `requester_vpc_id` | string | VPC ID of the requesting side |
| `requester_region` | string | AWS region of requester |
| `accepter_vpc_id` | string | VPC ID of the accepting side |
| `accepter_region` | string | AWS region of accepter |
| `requester_route_table_ids` | list(string) | Route tables to update on requester side |
| `accepter_route_table_ids` | list(string) | Route tables to update on accepter side |
| `accepter_cidr_block` | string | CIDR block of accepter VPC (added to requester routes) |
| `requester_cidr_block` | string | CIDR block of requester VPC (added to accepter routes) |

#### Behaviour

- Creates `aws_vpc_peering_connection` + `aws_vpc_peering_connection_accepter`
- Adds routes on both sides so each VPC can reach the other's private CIDR via the peering connection
- Uses two provider aliases (`aws.requester`, `aws.accepter`) — callers must pass the correct providers

#### Outputs

- `peering_connection_id`

---

### 3. `modules/ec2-fleet-fixed/`

Fixed-count private instances behind an Application Load Balancer.

#### Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `name_prefix` | string | — | Resource name prefix |
| `primary_region` | string | — | Region where ALB lives |
| `instance_count_primary` | number | `2` | Instances in primary region |
| `additional_regions` | map(object) | `{}` | Map of region name → `{ instance_count, vpc_id, private_subnet_ids, ami_id }` |
| `ami_ids` | map(string) | — | Map of region → AMI ID |
| `instance_type` | string | `"t3.small"` | |
| `private_subnet_ids` | list(string) | — | Primary region private subnets |
| `public_subnet_ids` | list(string) | — | Primary region public subnets (for ALB) |
| `vpc_id` | string | — | Primary region VPC |
| `app_sg_id` | string | — | App SG from security-groups module |
| `alb_sg_id` | string | — | ALB SG from security-groups module |
| `iam_instance_profile` | string | — | |
| `secrets_arn` | string | — | |
| `ecr_image_url` | string | — | |
| `user_data_template_path` | string | — | |
| `acm_certificate_arn` | string | — | ACM cert ARN for HTTPS listener |
| `tags` | map(string) | `{}` | |

#### Behaviour

- Primary region instances: placed in **private** subnets; reachable only from `alb_sg_id`
- ALB in primary region:
  - HTTP listener (port 80) → redirect to HTTPS (301)
  - HTTPS listener (port 443) → forward to target group; uses `acm_certificate_arn`
- Cross-region instances (via `additional_regions`):
  - Use provider aliases per region; placed in private subnets of the remote VPC
  - Uses `modules/vpc-peering` to peer remote VPC with primary VPC
  - NAT Gateway created per additional region via `modules/nat-gateway`
  - Registered as targets in the same ALB target group (cross-zone load balancing enabled)
- All instances: outbound-only from the internet; no inbound except from ALB SG

#### Outputs

- `alb_dns_name`
- `alb_arn`
- `target_group_arn`
- `instance_ids` (list)

---

### 4. `modules/asg-slot/`

Sub-module used internally by `ec2-asg-bluegreen`. Not intended for direct use.

#### Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `slot` | string | — | `"blue"` or `"green"` |
| `name_prefix` | string | — | |
| `ami_id` | string | — | Per-region custom AMI |
| `instance_type` | string | `"t3.small"` | |
| `ecr_tag` | string | — | ECR image tag for this slot |
| `ecr_repo_url` | string | — | ECR repository URL (without tag) |
| `secrets_arn` | string | — | |
| `desired_capacity` | number | `2` | |
| `min_size` | number | `1` | |
| `max_size` | number | `4` | |
| `private_subnet_ids` | list(string) | — | |
| `app_sg_id` | string | — | |
| `iam_instance_profile` | string | — | |
| `user_data_template_path` | string | — | |
| `tags` | map(string) | `{}` | |

#### Behaviour

- Creates a Launch Template with rendered user data (`ecr_tag` and `secrets_arn` injected)
- Creates an ASG using the Launch Template; attached to the Target Group created in this module
- Target Group: HTTP on port 3000; health check path `/health`, healthy threshold 2, unhealthy threshold 3

#### Outputs

- `target_group_arn`
- `asg_name`
- `launch_template_id`

---

### 5. `modules/ec2-asg-bluegreen/`

Two-ASG blue/green module with weighted ALB listener and health gate.

#### Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `name_prefix` | string | — | |
| `vpc_id` | string | — | |
| `public_subnet_ids` | list(string) | — | For ALB |
| `private_subnet_ids` | list(string) | — | For ASG instances |
| `alb_sg_id` | string | — | |
| `app_sg_id` | string | — | |
| `ami_id` | string | — | Per-region custom AMI |
| `instance_type` | string | `"t3.small"` | |
| `iam_instance_profile` | string | — | |
| `secrets_arn` | string | — | |
| `ecr_repo_url` | string | — | ECR repo URL without tag |
| `blue_ecr_tag` | string | — | ECR tag for blue slot |
| `green_ecr_tag` | string | — | ECR tag for green slot |
| `blue_weight` | number | `100` | ALB listener rule weight for blue (0–100) |
| `green_weight` | number | `0` | ALB listener rule weight for green (0–100) |
| `desired_capacity` | number | `2` | Per slot |
| `min_size` | number | `1` | Per slot |
| `max_size` | number | `4` | Per slot |
| `acm_certificate_arn` | string | — | |
| `user_data_template_path` | string | — | |
| `health_check_min_healthy` | number | `1` | Min healthy targets before cutover is declared successful |
| `health_check_timeout_seconds` | number | `300` | Timeout for health gate script |
| `tags` | map(string) | `{}` | |

#### Behaviour

- Instantiates `asg-slot` twice: `module.blue` and `module.green`
- ALB:
  - HTTP → HTTPS redirect on port 80
  - HTTPS listener with two weighted forwarding actions: blue target group at `blue_weight`, green target group at `green_weight`
  - Weights must sum to 100; enforced via `precondition` lifecycle block
- Health gate via `null_resource`:
  ```hcl
  resource "null_resource" "wait_for_new_slot_healthy" {
    triggers = {
      blue_tag  = var.blue_ecr_tag
      green_tag = var.green_ecr_tag
    }
    provisioner "local-exec" {
      command = "${path.module}/../../scripts/wait-for-healthy-targets.sh ${new_tg_arn} ${var.health_check_min_healthy} ${var.health_check_timeout_seconds}"
    }
    depends_on = [module.blue, module.green]
  }
  ```
  - `new_tg_arn` is determined by which slot was just activated (weight changed from 0 to >0)
  - If the script exits non-zero, `terraform apply` fails — CI interprets this as a failed deploy and triggers the rollback in `deploy.sh`

#### Outputs

- `alb_dns_name`
- `alb_arn`
- `blue_target_group_arn`
- `green_target_group_arn`
- `blue_asg_name`
- `green_asg_name`

---

## Files

```
modules/vpc-peering/
  main.tf
  variables.tf
  outputs.tf
  README.md

modules/ec2-single/
  main.tf
  variables.tf
  outputs.tf
  README.md

modules/ec2-fleet-fixed/
  main.tf
  variables.tf
  outputs.tf
  README.md

modules/asg-slot/
  main.tf
  variables.tf
  outputs.tf

modules/ec2-asg-bluegreen/
  main.tf
  variables.tf
  outputs.tf
  README.md
```

---

## Acceptance criteria

- [ ] `terraform validate` passes on all five modules
- [ ] `ec2-single`: instance boots, health endpoint `GET /health` returns 200 from the EIP
- [ ] `ec2-fleet-fixed` (same-region only): ALB DNS resolves; HTTPS request returns 200; direct curl to an instance private IP from outside the VPC times out
- [ ] `ec2-fleet-fixed` (cross-region): instance in additional region registers as healthy in the ALB target group; VPC peering routes are reachable via private IPs
- [ ] `ec2-asg-bluegreen`: apply with `blue_weight=100, green_weight=0`; confirm only blue receives traffic (check access logs)
- [ ] `ec2-asg-bluegreen`: swap to `blue_weight=0, green_weight=100`; health gate script runs; after timeout elapses with healthy targets the apply completes successfully
- [ ] `ec2-asg-bluegreen` rollback: force green targets to fail health checks; confirm the `null_resource` provisioner exits non-zero and the overall `terraform apply` fails; confirm CI rollback step restores `blue_weight=100`
- [ ] `precondition` on weights: set `blue_weight=60, green_weight=60`; `terraform plan` must fail with a descriptive error
