variable "name_prefix" {
  description = "Prefix applied to all resource Name tags (e.g. 'myapp-staging')."
  type        = string
}

variable "primary_region" {
  description = "AWS region where the ALB and primary instances live."
  type        = string
}

variable "instance_count_primary" {
  description = "Number of EC2 instances to create in the primary region."
  type        = number
  default     = 2
}

# ami_ids is a map so the module can derive the correct AMI for the primary
# region without requiring a separate variable per region.
variable "ami_ids" {
  description = "Map of AWS region name → AMI ID. Must contain an entry for primary_region."
  type        = map(string)
}

variable "instance_type" {
  description = "EC2 instance type used for all primary region instances."
  type        = string
  default     = "t3.small"
}

variable "vpc_id" {
  description = "VPC ID in the primary region."
  type        = string
}

variable "vpc_cidr_block" {
  description = "CIDR block of the primary VPC. Documented here for callers setting up vpc-peering alongside this module."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs in the primary region. Instances are distributed across these subnets."
  type        = list(string)
}

variable "public_subnet_ids" {
  description = "Public subnet IDs in the primary region. The ALB is placed across these subnets."
  type        = list(string)
}

variable "private_route_table_ids" {
  description = "Private route table IDs in the primary region. Passed to modules/vpc-peering when setting up cross-region routing in the environment."
  type        = list(string)
}

variable "app_sg_id" {
  description = "Security group ID (app SG) from the security-groups module, primary region."
  type        = string
}

variable "alb_sg_id" {
  description = "Security group ID (ALB SG) from the security-groups module, primary region."
  type        = string
}

variable "iam_instance_profile" {
  description = "Name of the IAM instance profile to attach to all instances (grants ECR pull + Secrets Manager read)."
  type        = string
}

variable "secrets_arn" {
  description = "Secrets Manager ARN for app environment variables. Injected into user data on every instance."
  type        = string
}

variable "ecr_image_url" {
  description = "Full ECR image URL including tag (e.g. 123456789.dkr.ecr.us-east-1.amazonaws.com/app:v1.2.3)."
  type        = string
}

variable "user_data_template_path" {
  description = "Path to the startup.sh templatefile rendered as EC2 user data."
  type        = string
}

variable "acm_certificate_arn" {
  description = "ARN of the ACM certificate used by the HTTPS listener. Must be in the same region as the ALB (primary_region)."
  type        = string
}

# Cross-region instances are created outside this module (using provider aliases
# and modules/vpc-peering + modules/nat-gateway in the environment directory).
# Their private IPs are registered in the shared target group here.
variable "additional_target_ips" {
  description = <<-EOT
    Private IP addresses of instances in additional regions to register in the
    ALB target group alongside the primary-region instances. Use this after
    creating cross-region instances externally with modules/vpc-peering and
    modules/nat-gateway. See README for the recommended environment-level pattern.
  EOT
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Additional tags merged onto every resource created by this module."
  type        = map(string)
  default     = {}
}
