# primary_endpoint is the write endpoint for both modes.
# For single-node: the standalone cluster endpoint.
# For cluster mode: the replication group configuration endpoint.
output "primary_endpoint" {
  description = "Primary connection endpoint (host:port)."
  value = var.cluster_mode == "single" ? (
    "${aws_elasticache_cluster.single[0].cache_nodes[0].address}:${aws_elasticache_cluster.single[0].cache_nodes[0].port}"
  ) : (
    "${aws_elasticache_replication_group.cluster[0].configuration_endpoint_address}:6379"
  )
}

# reader_endpoint is only meaningful in cluster mode (separate read endpoint).
# Returns an empty string for single-node mode.
output "reader_endpoint" {
  description = "Read-only endpoint. Only populated for cluster_mode = \"cluster\"; empty string otherwise."
  value = var.cluster_mode == "cluster" ? (
    "${aws_elasticache_replication_group.cluster[0].reader_endpoint_address}:6379"
  ) : ""
}

output "cluster_id" {
  description = "ElastiCache cluster or replication group ID."
  value = var.cluster_mode == "single" ? (
    aws_elasticache_cluster.single[0].cluster_id
  ) : (
    aws_elasticache_replication_group.cluster[0].id
  )
}
