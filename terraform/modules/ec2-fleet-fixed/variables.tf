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
  default     = null
}

variable "public_subnet_ids" {
  description = "Public subnet IDs in the primary region. Instances and the ALB are placed across these subnets."
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
  description = "Name of the IAM instance profile to attach to all instances (grants ECR pull)."
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

variable "key_pair_name" {
  description = "Name for the generated EC2 key pair. Defaults to <name_prefix>-fleet-key when null. The module always generates the key material — this only controls the Key Pair name shown in the AWS console."
  type        = string
  default     = null
}

variable "tags" {
  description = "Additional tags merged onto every resource created by this module."
  type        = map(string)
  default     = {}
}