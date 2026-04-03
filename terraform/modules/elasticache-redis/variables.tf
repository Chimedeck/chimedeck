variable "name" {
  description = "Name prefix for the ElastiCache cluster or replication group."
  type        = string
}

variable "node_type" {
  description = "ElastiCache node instance type."
  type        = string
  default     = "cache.t3.micro"
}

# "single" creates an aws_elasticache_cluster (no replication).
# "cluster" creates an aws_elasticache_replication_group with cluster mode enabled.
variable "cluster_mode" {
  description = "Deployment mode: \"single\" (standalone cache) or \"cluster\" (replication group with sharding)."
  type        = string
  default     = "single"

  validation {
    condition     = contains(["single", "cluster"], var.cluster_mode)
    error_message = "cluster_mode must be either \"single\" or \"cluster\"."
  }
}

# Only relevant when cluster_mode = "single".
variable "num_cache_nodes" {
  description = "Number of cache nodes. Only used when cluster_mode = \"single\"."
  type        = number
  default     = 1
}

# Only relevant when cluster_mode = "cluster".
variable "num_node_groups" {
  description = "Number of shards (node groups). Only used when cluster_mode = \"cluster\"."
  type        = number
  default     = 1
}

# Only relevant when cluster_mode = "cluster".
variable "replicas_per_node_group" {
  description = "Number of read replicas per shard. Only used when cluster_mode = \"cluster\"."
  type        = number
  default     = 1
}

variable "subnet_ids" {
  description = "List of private subnet IDs for the ElastiCache subnet group."
  type        = list(string)
}

variable "security_group_id" {
  description = "ID of the redis security group (from the security-groups module)."
  type        = string
}

variable "at_rest_encryption" {
  description = "Enable AES-256 encryption at rest."
  type        = bool
  default     = true
}

variable "transit_encryption" {
  description = "Enable TLS encryption in transit."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Map of tags to apply to all resources."
  type        = map(string)
  default     = {}
}
