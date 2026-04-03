# modules/security-groups

Creates the four security groups required for the standard application tier:

| SG | Purpose |
|----|---------|
| `alb` | Internet-facing ALB — accepts 80/443 from `0.0.0.0/0` |
| `app` | Application instances — accepts all TCP from `alb` SG |
| `db` | RDS PostgreSQL — accepts 5432 from `app` SG only |
| `redis` | ElastiCache Redis — accepts 6379 from `app` SG only |

The `db` and `redis` SGs have **no egress rules**, enforcing a deny-all
outbound posture for stateful services that never need to initiate connections.

## Usage

```hcl
module "security_groups" {
  source = "../../modules/security-groups"

  name_prefix = "my-env"
  vpc_id      = module.vpc.vpc_id

  tags = {
    Environment = "staging"
  }
}
```

## Outputs

| Output | Description |
|--------|-------------|
| `alb_sg_id` | Security group ID for the ALB |
| `app_sg_id` | Security group ID for the app tier |
| `db_sg_id` | Security group ID for RDS |
| `redis_sg_id` | Security group ID for ElastiCache |
