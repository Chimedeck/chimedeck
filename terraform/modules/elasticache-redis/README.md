# modules/elasticache-redis

ElastiCache Redis 7 module supporting both **single-node** (standalone cluster) and **cluster mode** (replication group with sharding) deployments.

---

## Usage

### Single-node (dev / staging)

```hcl
module "redis" {
  source = "../../modules/elasticache-redis"

  name              = "myapp-staging-redis"
  node_type         = "cache.t3.micro"
  cluster_mode      = "single"
  num_cache_nodes   = 1
  subnet_ids        = module.vpc.private_subnet_ids
  security_group_id = module.security_groups.redis_sg_id

  tags = { Environment = "staging" }
}
```

### Cluster mode (production)

```hcl
module "redis" {
  source = "../../modules/elasticache-redis"

  name                    = "myapp-prod-redis"
  node_type               = "cache.r7g.large"
  cluster_mode            = "cluster"
  num_node_groups         = 3   # shards
  replicas_per_node_group = 1   # read replica per shard
  subnet_ids              = module.vpc.private_subnet_ids
  security_group_id       = module.security_groups.redis_sg_id
  at_rest_encryption      = true
  transit_encryption      = true

  tags = { Environment = "production" }
}
```

---

## Variables

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `name` | string | — | Name prefix for the cluster / replication group |
| `node_type` | string | `"cache.t3.micro"` | ElastiCache node instance type |
| `cluster_mode` | string | `"single"` | `"single"` or `"cluster"` |
| `num_cache_nodes` | number | `1` | Nodes — only used when `cluster_mode = "single"` |
| `num_node_groups` | number | `1` | Shards — only used when `cluster_mode = "cluster"` |
| `replicas_per_node_group` | number | `1` | Replicas per shard — only used when `cluster_mode = "cluster"` |
| `subnet_ids` | list(string) | — | Private subnet IDs for the cache subnet group |
| `security_group_id` | string | — | Redis SG ID from the `security-groups` module |
| `at_rest_encryption` | bool | `true` | AES-256 encryption at rest (cluster mode only) |
| `transit_encryption` | bool | `true` | TLS encryption in transit (cluster mode only) |
| `tags` | map(string) | `{}` | Resource tags |

---

## Outputs

| Name | Description |
|------|-------------|
| `primary_endpoint` | Write endpoint (`host:port`) |
| `reader_endpoint` | Read-only endpoint (`host:port`); empty string for single-node mode |
| `cluster_id` | Cluster or replication group ID |

---

## Behaviour notes

### `cluster_mode = "single"`

Creates an `aws_elasticache_cluster` resource. This is the simplest deployment
and is suitable for development and staging. The AWS standalone cluster resource
does **not** expose `at_rest_encryption_enabled` or `transit_encryption_enabled`
inputs — encryption options are only available on replication groups. If
encryption at rest / in transit is required on a single-node setup, switch to
`cluster_mode = "cluster"` with `num_node_groups = 1` and
`replicas_per_node_group = 0`.

### `cluster_mode = "cluster"`

Creates an `aws_elasticache_replication_group` with Redis cluster mode enabled
(`num_node_groups > 1` means sharding). Encryption options are enforced.
`automatic_failover_enabled` is set to `true` when
`replicas_per_node_group >= 1`.

### Encryption caveat

Encryption can only be set at creation time — changing `at_rest_encryption` or
`transit_encryption` after the resource exists forces replacement.

### AWS region limitations

Redis cluster mode is available in all commercial AWS regions as of 2024. Verify
availability for GovCloud regions before use.

---

## Connecting

Connect via the application security group. The `security-groups` module
restricts inbound Redis traffic (port 6379) to the `app` SG only:

```bash
redis-cli -h <primary_endpoint_host> -p 6379
```

For cluster mode, use the configuration endpoint and a cluster-aware client:

```bash
redis-cli -c -h <primary_endpoint_host> -p 6379
```
