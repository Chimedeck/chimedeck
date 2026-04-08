# modules/rds-postgres

Provisions a PostgreSQL 16 RDS instance with:

- Custom parameter group enabling the `pg_cron` extension
- Optional storage auto-scaling (`max_allocated_storage`)
- Optional Multi-AZ standby (`multi_az`)
- `gp3` storage with encryption at rest enabled by default

## Usage

```hcl
module "rds" {
  source = "../../modules/rds-postgres"

  identifier            = "my-env-db"
  db_name               = "app"
  db_username           = "appuser"
  db_password           = var.db_password   # supply via Secrets Manager in production
  subnet_ids            = module.vpc.private_subnet_ids
  security_group_id     = module.security_groups.db_sg_id
  max_allocated_storage = 100               # set to 0 to disable auto-scaling

  tags = {
    Environment = "staging"
  }
}
```

## Sharding pattern

This module provisions a **single** RDS instance. To shard across multiple
independent databases, instantiate this module multiple times with different
`identifier` values and collect the `endpoint` outputs into a list:

```hcl
module "rds_shard_0" {
  source    = "../../modules/rds-postgres"
  identifier = "myapp-shard-0"
  # ...
}

module "rds_shard_1" {
  source    = "../../modules/rds-postgres"
  identifier = "myapp-shard-1"
  # ...
}

locals {
  shard_endpoints = [
    module.rds_shard_0.endpoint,
    module.rds_shard_1.endpoint,
  ]
}
```

## Outputs

| Output | Description |
|--------|-------------|
| `endpoint` | Full `host:port` connection string |
| `db_name` | Initial database name |
| `db_username` | Master username |
| `instance_id` | RDS instance identifier |
