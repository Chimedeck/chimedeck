variable "name_prefix" {
  description = "Prefix applied to all resource Name tags (e.g. 'myapp-staging')."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where all resources are created."
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs in the primary region. The ALB is placed across these subnets."
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "Private subnet IDs where ASG instances are launched. Instances in both slots use these subnets."
  type        = list(string)
}

variable "alb_sg_id" {
  description = "Security group ID (ALB SG) from the security-groups module."
  type        = string
}

variable "app_sg_id" {
  description = "Security group ID (app SG) from the security-groups module. Applied to instances in both slots."
  type        = string
}

variable "ami_id" {
  description = "AMI ID for the region. Should be a custom baked AMI with Docker and AWS CLI pre-installed."
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type for all instances in both slots."
  type        = string
  default     = "t3.small"
}

variable "iam_instance_profile" {
  description = "Name of the IAM instance profile to attach to instances (grants ECR pull + Secrets Manager read)."
  type        = string
}

variable "secrets_arn" {
  description = "Secrets Manager ARN for app environment variables. Injected into user data for both slots."
  type        = string
}

variable "ecr_repo_url" {
  description = "ECR repository URL without tag (e.g. '123456789.dkr.ecr.us-east-1.amazonaws.com/app')."
  type        = string
}

variable "blue_ecr_tag" {
  description = "ECR image tag deployed to the blue slot."
  type        = string
}

variable "green_ecr_tag" {
  description = "ECR image tag deployed to the green slot."
  type        = string
}

variable "blue_weight" {
  description = "ALB listener rule weight for the blue slot (0–100). Must sum to 100 with green_weight."
  type        = number
  default     = 100
}

variable "green_weight" {
  description = "ALB listener rule weight for the green slot (0–100). Must sum to 100 with blue_weight."
  type        = number
  default     = 0
}

variable "desired_capacity" {
  description = "Desired number of instances per slot."
  type        = number
  default     = 2
}

variable "min_size" {
  description = "Minimum number of instances per slot."
  type        = number
  default     = 1
}

variable "max_size" {
  description = "Maximum number of instances per slot."
  type        = number
  default     = 4
}

variable "acm_certificate_arn" {
  description = "ARN of the ACM certificate used by the HTTPS listener. Must be in the same region as the ALB."
  type        = string
}

variable "user_data_template_path" {
  description = "Path to the startup.sh templatefile rendered as EC2 user data."
  type        = string
}

variable "health_check_min_healthy" {
  description = "Minimum number of healthy targets required before the health gate declares success."
  type        = number
  default     = 1
}

variable "health_check_timeout_seconds" {
  description = "Timeout in seconds for the health gate script before it exits non-zero."
  type        = number
  default     = 300
}

variable "tags" {
  description = "Additional tags merged onto every resource created by this module."
  type        = map(string)
  default     = {}
}
