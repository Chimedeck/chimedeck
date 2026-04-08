# ── Subnet Group ─────────────────────────────────────────────────────────────

resource "aws_elasticache_subnet_group" "this" {
  name        = var.name
  subnet_ids  = var.subnet_ids
  description = "Subnet group for ElastiCache cluster ${var.name}"

  tags = merge(
    { Name = var.name },
    var.tags,
  )
}

# ── Single-node (standalone) cluster ─────────────────────────────────────────
# Used when cluster_mode = "single". Creates a single cache node with no
# replication. Suitable for dev/staging environments.

resource "aws_elasticache_cluster" "single" {
  count = var.cluster_mode == "single" ? 1 : 0

  cluster_id           = var.name
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.node_type
  num_cache_nodes      = var.num_cache_nodes
  subnet_group_name    = aws_elasticache_subnet_group.this.name
  security_group_ids   = [var.security_group_id]

  # Encryption flags are only supported on the replication group resource in
  # single-node mode; the standalone cluster resource does not expose them, so
  # at_rest_encryption and transit_encryption are enforced at the replication
  # group level. Document this limitation in the README.

  tags = merge(
    { Name = var.name },
    var.tags,
  )
}

# ── Cluster mode (replication group with sharding) ────────────────────────────
# Used when cluster_mode = "cluster". Enables Redis cluster mode with
# num_node_groups shards and replicas_per_node_group read replicas per shard.
# Both encryption options are enforced here.

resource "aws_elasticache_replication_group" "cluster" {
  count = var.cluster_mode == "cluster" ? 1 : 0

  replication_group_id = var.name
  description          = "Redis 7 replication group ${var.name}"

  engine_version = "7.1"
  node_type      = var.node_type

  # Cluster mode: multiple shards, each with replicas.
  num_node_groups         = var.num_node_groups
  replicas_per_node_group = var.replicas_per_node_group

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = [var.security_group_id]

  at_rest_encryption_enabled = var.at_rest_encryption
  transit_encryption_enabled = var.transit_encryption

  # Automatic failover requires at least one replica per node group.
  automatic_failover_enabled = var.replicas_per_node_group >= 1

  tags = merge(
    { Name = var.name },
    var.tags,
  )
}
