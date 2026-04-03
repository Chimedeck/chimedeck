# ─────────────────────────────────────────────
# Core / provider
# ─────────────────────────────────────────────

# aws_region is derived from fleet_regions[0].region and is no longer a
# top-level variable. The primary region is the first entry in fleet_regions.

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
      "single"         — one EC2 instance with an Elastic IP (no ALB)
      "fleet"          — fixed-count instances in public subnets behind regional ALBs;
                         multiple regions stitched together by AWS Global Accelerator.
                         No NAT Gateways. VPC peering is created for RDS/Redis access only.
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
  description = "When true, creates a dedicated VPC for the primary region. When false, uses the AWS default VPC. Additional fleet regions always create their own VPCs."
  type        = bool
  default     = false
}

# vpc_cidr and availability_zones are now per-region inside fleet_regions.

# ─────────────────────────────────────────────
# EC2 / compute
# ─────────────────────────────────────────────

variable "fleet_regions" {
  description = <<-EOT
    Ordered list of regions for fleet deployment. The first entry is the
    PRIMARY region — it hosts S3, RDS, Redis, ECR, and the primary ALB.
    Additional entries each create their own VPC, security groups, instances,
    and ALB. AWS Global Accelerator routes users to the nearest healthy region.
    All regions share the same PEM key pair for SSH access.

    Each entry:
      region               — AWS region name (e.g. "ap-southeast-1")
      instance_count       — fixed number of EC2 instances in that region
      ami_id               — baked AMI ID (must have Docker, AWS CLI v2, jq)
      vpc_cidr             — CIDR block for the VPC (must not overlap across regions)
      azs                  — availability zones to spread subnets across
      acm_certificate_arn  — ARN of ACM cert in THAT region for the HTTPS listener
    Instance counts are fixed at apply time (not autoscaled).
  EOT
  type = list(object({
    region               = string
    instance_count       = number
    ami_id               = string
    vpc_cidr             = string
    azs                  = list(string)
    acm_certificate_arn  = string
  }))
  validation {
    condition     = length(var.fleet_regions) >= 1
    error_message = "fleet_regions must have at least one entry (the primary region)."
  }
}

variable "fleet_key_pair_name" {
  description = <<-EOT
    Name of the EC2 key pair used across ALL fleet regions for SSH access.
    The same private key (PEM file) must be imported into every configured
    region under this name before applying. Leave null to launch without SSH
    access (recommended when using SSM Session Manager).
  EOT
  type    = string
  default = null
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
