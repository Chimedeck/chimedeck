# Sprint 125 — Terraform Infra: Security Groups + RDS + Redis

> **Folder:** `terraform/` in this repo
> **Depends on:** Sprint 124 (foundation modules — vpc outputs required)
> **Status:** ⬜ Future

---

## Goal

Add the three managed-service modules that sit directly on top of the VPC: a security group set that expresses the full network access graph, an RDS PostgreSQL 16 module with `pg_cron` support and optional auto-scaling storage, and an ElastiCache Redis 7 module.

After this sprint all stateful AWS infrastructure can be provisioned for any environment. Compute modules (Sprint 126) consume the security group and RDS outputs.

---

## Scope

### 1. `modules/security-groups/`

Four security groups. Every rule is additive; ingress not listed means denied.

| SG | Inbound | Outbound |
|----|---------|----------|
| `alb` | 80 and 443 from `0.0.0.0/0` | all |
| `app` | all ports from `alb` SG only | all (needed for ECR pull, Secrets Manager, RDS, Redis) |
| `db` | 5432 from `app` SG only | none |
| `redis` | 6379 from `app` SG only | none |

Variables:
- `name_prefix` (string)
- `vpc_id` (string)
- `tags` (map of strings)

Outputs:
- `alb_sg_id`
- `app_sg_id`
- `db_sg_id`
- `redis_sg_id`

### 2. `modules/rds-postgres/`

RDS PostgreSQL 16 with `pg_cron` extension enabled via parameter group.

#### Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `identifier` | string | — | RDS instance identifier |
| `instance_class` | string | `"db.t3.micro"` | RDS instance type |
| `allocated_storage` | number | `20` | Initial storage in GiB |
| `max_allocated_storage` | number | `100` | Auto-scaling ceiling; `0` disables auto-scaling |
| `multi_az` | bool | `false` | Enable Multi-AZ standby |
| `db_name` | string | — | Initial database name |
| `db_username` | string | — | Master username |
| `db_password` | string | — | Master password (sensitive; use Secrets Manager ARN in prod) |
| `subnet_ids` | list(string) | — | Private subnets for the DB subnet group |
| `security_group_id` | string | — | The `db` SG id from security-groups module |
| `deletion_protection` | bool | `true` | Prevent accidental destroy |
| `backup_retention_days` | number | `7` | Automated backup retention |
| `tags` | map(string) | `{}` | |

#### pg_cron parameter group

Create a custom `aws_db_parameter_group` for `postgres16` family:

```hcl
parameter {
  name         = "shared_preload_libraries"
  value        = "pg_cron"
  apply_method = "pending-reboot"
}
parameter {
  name  = "cron.database_name"
  value = var.db_name
}
```

Apply the parameter group to the `aws_db_instance`.

#### Outputs

- `endpoint` — full connection string host:port
- `db_name`
- `db_username`
- `instance_id`

> **No sharding at the Terraform layer.** Sharding (multiple independent RDS instances) is expressed in the caller by instantiating this module multiple times with different `identifier` values and collecting the `endpoint` outputs into a list. Document this pattern in the module README.

### 3. `modules/elasticache-redis/`

ElastiCache Redis 7 with configurable single-node vs replication group.

#### Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | string | — | Cluster / replication group name |
| `node_type` | string | `"cache.t3.micro"` | Node instance type |
| `cluster_mode` | string | `"single"` | `"single"` or `"cluster"` |
| `num_cache_nodes` | number | `1` | Nodes (only used when `cluster_mode = "single"`) |
| `num_node_groups` | number | `1` | Shards (only used when `cluster_mode = "cluster"`) |
| `replicas_per_node_group` | number | `1` | Replicas per shard (only when `cluster_mode = "cluster"`) |
| `subnet_ids` | list(string) | — | Private subnets for the cache subnet group |
| `security_group_id` | string | — | The `redis` SG id |
| `at_rest_encryption` | bool | `true` | Enable AES-256 encryption at rest |
| `transit_encryption` | bool | `true` | Enable TLS in transit |
| `tags` | map(string) | `{}` | |

#### Behaviour

- `cluster_mode = "single"` → creates `aws_elasticache_cluster`
- `cluster_mode = "cluster"` → creates `aws_elasticache_replication_group` with cluster mode enabled

#### Outputs

- `primary_endpoint` — connection endpoint (host:port)
- `reader_endpoint` — read endpoint (only populated for cluster mode)
- `cluster_id`

---

## Files

```
modules/security-groups/
  main.tf
  variables.tf
  outputs.tf
  README.md

modules/rds-postgres/
  main.tf
  variables.tf
  outputs.tf
  README.md

modules/elasticache-redis/
  main.tf
  variables.tf
  outputs.tf
  README.md
```

---

## Acceptance criteria

- [ ] `terraform validate` passes on all three modules
- [ ] Security groups module: deploying `alb` + `app` + `db` results in the DB SG having zero inbound rules from `0.0.0.0/0`; a connection attempt from outside the `app` SG is refused
- [ ] RDS module: instance comes up, `psql` connects using output `endpoint`; running `CREATE EXTENSION IF NOT EXISTS pg_cron;` succeeds without error
- [ ] RDS storage auto-scaling: set `max_allocated_storage = 50`; confirm the `aws_db_instance` has `max_allocated_storage` set correctly in AWS console
- [ ] Redis module (`cluster_mode = "single"`): `redis-cli PING` via an instance inside the `app` SG returns `PONG`
- [ ] Redis module (`cluster_mode = "cluster"`): `primary_endpoint` output is populated and different from `reader_endpoint`
- [ ] `terraform destroy` on all three modules returns exit code 0 and leaves no orphaned resources
