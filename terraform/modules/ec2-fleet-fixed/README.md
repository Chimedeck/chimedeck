# modules/ec2-fleet-fixed

Fixed-count EC2 fleet behind an Application Load Balancer with HTTP→HTTPS
redirect and ACM certificate termination. Supports optional cross-region
instances registered as IP-based targets via `additional_target_ips`.

---

## Architecture

```
Internet
   │  :80
   ▼
[ALB] ──redirect 301──► https://...
   │  :443  (ACM cert)
   ▼
[Target Group — IP-based, target_type = "ip"]
   ├── primary instance 0  (private subnet, primary region)
   ├── primary instance 1  (private subnet, primary region)
   └── additional IPs      (cross-region, registered via additional_target_ips)
```

- Primary instances are placed in **private** subnets; no inbound from the internet.
- The ALB's security group (`alb_sg_id`) is the only ingress source for port 3000.
- The target group uses `target_type = "ip"` so cross-region private IPs can be registered alongside primary-region instances.
- Cross-zone load balancing is always enabled for Application Load Balancers.

---

## Cross-region support

Terraform does not support dynamic provider aliases, so cross-region instances
are managed **outside** this module in the environment directory. The recommended
pattern is:

1. In your environment `main.tf`, configure additional provider aliases and call
   `modules/vpc-peering` and `modules/nat-gateway` to set up the network path.
2. Create EC2 instances in the additional region using those provider aliases.
3. Pass the private IPs of those instances to this module via `additional_target_ips`.

```hcl
# environment/main.tf

provider "aws" {
  alias  = "eu_west_1"
  region = "eu-west-1"
}

module "fleet" {
  source = "../../modules/ec2-fleet-fixed"
  # ...
  additional_target_ips = module.fleet_eu.instance_private_ips
}

# Cross-region peering (primary ↔ eu-west-1)
module "peering_eu" {
  source = "../../modules/vpc-peering"
  providers = {
    aws.requester = aws
    aws.accepter  = aws.eu_west_1
  }
  requester_vpc_id          = module.vpc_primary.vpc_id
  requester_region          = "us-east-1"
  requester_cidr_block      = "10.0.0.0/16"
  requester_route_table_ids = module.vpc_primary.private_route_table_ids
  accepter_vpc_id           = module.vpc_eu.vpc_id
  accepter_region           = "eu-west-1"
  accepter_cidr_block       = "10.1.0.0/16"
  accepter_route_table_ids  = module.vpc_eu.private_route_table_ids
}

# NAT Gateway in eu-west-1 for outbound ECR access
module "nat_eu" {
  source = "../../modules/nat-gateway"
  providers = { aws = aws.eu_west_1 }
  name_prefix             = "myapp-eu"
  public_subnet_id        = module.vpc_eu.public_subnet_ids[0]
  private_route_table_ids = module.vpc_eu.private_route_table_ids
}
```

---

## Usage (same-region only)

```hcl
module "fleet" {
  source = "../../modules/ec2-fleet-fixed"

  name_prefix            = "myapp-prod"
  primary_region         = "us-east-1"
  instance_count_primary = 2
  ami_ids                = { "us-east-1" = "ami-0abcdef1234567890" }
  instance_type          = "t3.small"

  vpc_id                  = module.vpc.vpc_id
  vpc_cidr_block          = "10.0.0.0/16"
  public_subnet_ids       = module.vpc.public_subnet_ids
  private_subnet_ids      = module.vpc.private_subnet_ids
  private_route_table_ids = module.vpc.private_route_table_ids

  alb_sg_id            = module.security_groups.alb_sg_id
  app_sg_id            = module.security_groups.app_sg_id
  iam_instance_profile = aws_iam_instance_profile.app.name
  secrets_arn          = aws_secretsmanager_secret.app.arn
  ecr_image_url        = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
  user_data_template_path = "${path.module}/../../scripts/startup.sh"

  acm_certificate_arn = var.acm_certificate_arn

  tags = { Environment = "production" }
}
```

---

## Variables

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `name_prefix` | string | — | Resource name prefix |
| `primary_region` | string | — | Region where ALB lives |
| `instance_count_primary` | number | `2` | Instances in primary region |
| `ami_ids` | map(string) | — | Region → AMI ID map |
| `instance_type` | string | `"t3.small"` | EC2 instance type |
| `vpc_id` | string | — | Primary region VPC ID |
| `vpc_cidr_block` | string | — | Primary VPC CIDR (used when setting up peering externally) |
| `public_subnet_ids` | list(string) | — | Public subnets for ALB |
| `private_subnet_ids` | list(string) | — | Private subnets for primary instances |
| `private_route_table_ids` | list(string) | — | Primary private route tables (for external peering setup) |
| `app_sg_id` | string | — | App security group (primary region) |
| `alb_sg_id` | string | — | ALB security group (primary region) |
| `iam_instance_profile` | string | — | IAM instance profile name |
| `secrets_arn` | string | — | Secrets Manager ARN for app env vars |
| `ecr_image_url` | string | — | Full ECR image URL with tag |
| `user_data_template_path` | string | — | Path to `startup.sh` templatefile |
| `acm_certificate_arn` | string | — | ACM cert ARN for HTTPS listener |
| `additional_target_ips` | list(string) | `[]` | Private IPs of cross-region instances |
| `tags` | map(string) | `{}` | Tags merged onto all resources |

---

## Outputs

| Name | Description |
|------|-------------|
| `alb_dns_name` | ALB DNS name — point your CNAME here |
| `alb_arn` | ALB ARN |
| `alb_zone_id` | ALB hosted zone ID (for Route 53 alias records) |
| `target_group_arn` | Target group ARN (attach additional IP targets externally) |
| `instance_ids` | Primary region instance IDs |

---

## Caveats and constraints

### ACM certificate region
The ACM certificate (`acm_certificate_arn`) **must be in the same region as the
ALB** (`primary_region`). ACM certificates are region-scoped.

### IP-based target type
The target group uses `target_type = "ip"`. Instances are registered by private
IP. Ensure the ALB's security group allows egress to port 3000 across all
registered CIDR ranges (primary and cross-region CIDRs).

### Cross-region IP targets require VPC peering
Before `additional_target_ips` can pass ALB health checks, VPC peering must be
active and both sides' route tables must include routes for each other's CIDR.
Use `modules/vpc-peering` and `modules/nat-gateway` in the environment directory
before passing the IPs to this module. See the cross-region usage example above.

### Security groups are region-scoped
AWS security groups cannot span regions. Cross-region instances require their own
security groups in their respective regions, configured by the caller.
