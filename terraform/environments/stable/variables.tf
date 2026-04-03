# ─────────────────────────────────────────────
# Core / provider
# ─────────────────────────────────────────────

variable "aws_region" {
  description = "Primary AWS region for all resources."
  type        = string
}

variable "app_name" {
  description = "Short application name used as a prefix for resource names (e.g. 'myapp')."
  type        = string
}

variable "tags" {
  description = "Common tags merged onto every resource in this environment."
  type        = map(string)
  default     = {}
}

# ─────────────────────────────────────────────
# Deployment mode
# ─────────────────────────────────────────────

variable "deployment_mode" {
  description = <<-EOT
    Controls which compute modules are instantiated.
    Valid values:
      "single"         — one EC2 instance with an Elastic IP (no ALB, no NAT Gateway)
      "fleet"          — fixed-count instances behind an ALB with NAT Gateway
      "asg-bluegreen"  — two Auto Scaling Groups with weighted ALB blue/green routing
  EOT
  type        = string

  validation {
    condition     = contains(["single", "fleet", "asg-bluegreen"], var.deployment_mode)
    error_message = "deployment_mode must be one of: \"single\", \"fleet\", \"asg-bluegreen\"."
  }
}

# ─────────────────────────────────────────────
# VPC
# ─────────────────────────────────────────────

variable "create_vpc" {
  description = "When true, creates a dedicated VPC. When false, uses the AWS default VPC."
  type        = bool
  default     = false
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC. Only used when create_vpc = true."
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of Availability Zones to spread subnets across (e.g. [\"ap-southeast-1a\", \"ap-southeast-1b\"])."
  type        = list(string)
}

# ─────────────────────────────────────────────
# EC2 / compute
# ─────────────────────────────────────────────

variable "ami_ids" {
  description = <<-EOT
    Map of AWS region → AMI ID for the custom baked AMI.
    Must include an entry for aws_region, plus any additional regions used by
    the fleet module. Example: { "ap-southeast-1" = "ami-0abc123" }
  EOT
  type        = map(string)
}

variable "instance_type" {
  description = "EC2 instance type for all compute modules."
  type        = string
  default     = "t3.small"
}

variable "iam_instance_profile" {
  description = "Name of the IAM instance profile attached to EC2 instances (must grant ECR pull + Secrets Manager read)."
  type        = string
}

variable "instance_count" {
  description = "Number of instances per region when deployment_mode = \"fleet\"."
  type        = number
  default     = 2
}

# ─────────────────────────────────────────────
# ECR / image
# ─────────────────────────────────────────────

variable "ecr_repo_name" {
  description = "Name of the ECR repository."
  type        = string
}

variable "ecr_image_tag" {
  description = "Image tag to deploy when deployment_mode is \"single\" or \"fleet\"."
  type        = string
  default     = "latest"
}

# ─────────────────────────────────────────────
# S3
# ─────────────────────────────────────────────

variable "s3_bucket_name" {
  description = "Globally unique name for the application S3 bucket."
  type        = string
}

# ─────────────────────────────────────────────
# Secrets Manager
# ─────────────────────────────────────────────

variable "secrets_arn" {
  description = "ARN of the Secrets Manager secret containing the application's .env key-value pairs (JSON object)."
  type        = string
}

# ─────────────────────────────────────────────
# ACM / TLS (fleet and asg-bluegreen modes only)
# ─────────────────────────────────────────────

variable "acm_certificate_arn" {
  description = "ARN of the ACM certificate used by the HTTPS listener. Required when deployment_mode is \"fleet\" or \"asg-bluegreen\"."
  type        = string
  default     = ""
}

# ─────────────────────────────────────────────
# RDS PostgreSQL
# ─────────────────────────────────────────────

variable "rds_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t3.micro"
}

variable "rds_allocated_storage" {
  description = "Initial RDS storage in GiB."
  type        = number
  default     = 20
}

variable "rds_max_allocated_storage" {
  description = "Storage auto-scaling ceiling in GiB. Set to 0 to disable auto-scaling."
  type        = number
  default     = 100
}

variable "rds_multi_az" {
  description = "Enable Multi-AZ standby for RDS."
  type        = bool
  default     = false
}

variable "rds_db_name" {
  description = "Name of the initial database created on the RDS instance."
  type        = string
}

variable "rds_username" {
  description = "Master username for the RDS instance."
  type        = string
}

variable "rds_password" {
  description = "Master password for the RDS instance. Mark sensitive in tfvars."
  type        = string
  sensitive   = true
}

variable "rds_deletion_protection" {
  description = "Prevent accidental destroy of the RDS instance."
  type        = bool
  default     = false
}

variable "rds_backup_retention_days" {
  description = "Number of days to retain automated backups."
  type        = number
  default     = 7
}

# ─────────────────────────────────────────────
# ElastiCache Redis
# ─────────────────────────────────────────────

variable "redis_node_type" {
  description = "ElastiCache node instance type."
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_cluster_mode" {
  description = "Redis deployment mode: \"single\" (standalone) or \"cluster\" (sharded replication group)."
  type        = string
  default     = "single"
}

# ─────────────────────────────────────────────
# ASG blue/green (asg-bluegreen mode only)
# ─────────────────────────────────────────────

variable "blue_ecr_tag" {
  description = "ECR image tag for the blue (currently live) slot. Only used when deployment_mode = \"asg-bluegreen\"."
  type        = string
  default     = "latest"
}

variable "green_ecr_tag" {
  description = "ECR image tag for the green (inactive) slot. Only used when deployment_mode = \"asg-bluegreen\"."
  type        = string
  default     = "latest"
}

variable "blue_weight" {
  description = "ALB listener weight for the blue slot (0–100). Must sum to 100 with green_weight."
  type        = number
  default     = 100
}

variable "green_weight" {
  description = "ALB listener weight for the green slot (0–100). Must sum to 100 with blue_weight."
  type        = number
  default     = 0
}

variable "health_check_min_healthy" {
  description = "Minimum healthy targets required by the health gate before a blue/green deploy is considered successful."
  type        = number
  default     = 1
}

variable "health_check_timeout_seconds" {
  description = "Maximum seconds the health gate waits for min_healthy targets before failing the apply."
  type        = number
  default     = 300
}
