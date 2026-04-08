# modules/ec2-asg-bluegreen

Deploys two permanently-defined ASG slots (blue and green) behind a single Application Load Balancer using weighted forwarding. Traffic is shifted between slots by adjusting `blue_weight` and `green_weight`. A health gate (`null_resource`) blocks `terraform apply` until the newly-active slot reaches the required number of healthy targets — if it times out, the apply fails and CI triggers a rollback.

---

## Architecture

```
Internet
  │
  ▼
ALB (public subnets)
  │  HTTP :80 → HTTPS redirect
  │  HTTPS :443 → weighted forward
  ├─── blue_weight % → [blue ASG] (private subnets)
  └─── green_weight % → [green ASG] (private subnets)
```

Each slot owns its own:
- **Launch Template** — renders user data with the slot's ECR tag and Secrets Manager ARN
- **Auto Scaling Group** — distributed across private subnets; refreshes instances on tag change
- **Target Group** — health check on `GET /health` (port 3000)

---

## Usage

```hcl
module "app_bluegreen" {
  source = "../modules/ec2-asg-bluegreen"

  name_prefix          = "myapp-production"
  vpc_id               = module.vpc.vpc_id
  public_subnet_ids    = module.vpc.public_subnet_ids
  private_subnet_ids   = module.vpc.private_subnet_ids
  alb_sg_id            = module.security_groups.alb_sg_id
  app_sg_id            = module.security_groups.app_sg_id
  ami_id               = var.ami_id
  iam_instance_profile = aws_iam_instance_profile.app.name
  secrets_arn          = var.secrets_arn
  ecr_repo_url         = module.ecr.repository_url
  acm_certificate_arn  = var.acm_certificate_arn
  user_data_template_path = "${path.root}/../../scripts/startup.sh"

  blue_ecr_tag  = "v1.2.3"
  green_ecr_tag = "v1.2.4"   # new version being deployed
  blue_weight   = 0           # shift all traffic to green
  green_weight  = 100
}
```

---

## Slot switching (deployment workflow)

1. **Normal state** — `blue_weight = 100`, `green_weight = 0`; all traffic goes to blue.
2. **Deploy new version** — update `green_ecr_tag` to the new image tag and set `blue_weight = 0`, `green_weight = 100`.
3. **Terraform apply** — green ASG refreshes instances with the new tag; the health gate polls `wait-for-healthy-targets.sh` until `health_check_min_healthy` targets are healthy.
4. **Success** — apply completes; green slot serves 100% of traffic.
5. **Failure** — if the health gate times out, `terraform apply` exits non-zero; CI restores the previous `terraform.tfvars` snapshot (written by `deploy.sh`) and re-applies to roll back to blue.

---

## Weights precondition

`blue_weight + green_weight` must equal exactly `100`. Terraform will fail at the **plan** stage with a descriptive error if this invariant is violated:

```
Error: Resource precondition failed

blue_weight (60) + green_weight (60) must equal 100.
```

---

## Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `name_prefix` | string | — | Prefix for all resource names |
| `vpc_id` | string | — | VPC ID |
| `public_subnet_ids` | list(string) | — | Public subnets for the ALB |
| `private_subnet_ids` | list(string) | — | Private subnets for ASG instances |
| `alb_sg_id` | string | — | ALB security group ID |
| `app_sg_id` | string | — | App security group ID |
| `ami_id` | string | — | AMI ID (Docker + AWS CLI baked in) |
| `instance_type` | string | `"t3.small"` | EC2 instance type |
| `iam_instance_profile` | string | — | IAM instance profile name |
| `secrets_arn` | string | — | Secrets Manager ARN |
| `ecr_repo_url` | string | — | ECR repo URL without tag |
| `blue_ecr_tag` | string | — | ECR tag for blue slot |
| `green_ecr_tag` | string | — | ECR tag for green slot |
| `blue_weight` | number | `100` | ALB weight for blue (0–100) |
| `green_weight` | number | `0` | ALB weight for green (0–100) |
| `desired_capacity` | number | `2` | Desired instances per slot |
| `min_size` | number | `1` | Minimum instances per slot |
| `max_size` | number | `4` | Maximum instances per slot |
| `acm_certificate_arn` | string | — | ACM cert ARN for HTTPS listener |
| `user_data_template_path` | string | — | Path to startup.sh templatefile |
| `health_check_min_healthy` | number | `1` | Min healthy targets for health gate |
| `health_check_timeout_seconds` | number | `300` | Health gate timeout (seconds) |
| `tags` | map(string) | `{}` | Extra tags for all resources |

---

## Outputs

| Output | Description |
|---|---|
| `alb_dns_name` | DNS name of the ALB — point your CNAME here |
| `alb_arn` | ARN of the ALB |
| `alb_zone_id` | Hosted zone ID for Route 53 alias records |
| `blue_target_group_arn` | ARN of the blue slot's Target Group |
| `green_target_group_arn` | ARN of the green slot's Target Group |
| `blue_asg_name` | Name of the blue slot's ASG |
| `green_asg_name` | Name of the green slot's ASG |

---

## Sub-module: `asg-slot`

`ec2-asg-bluegreen` calls `../asg-slot` twice (once for `blue`, once for `green`). The `asg-slot` module is **not intended for direct use** — it is an internal building block that provides the Launch Template + ASG + Target Group for a single slot.
