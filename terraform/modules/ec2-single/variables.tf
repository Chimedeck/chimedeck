variable "name_prefix" {
  description = "Prefix applied to all resource Name tags (e.g. 'myapp-staging')."
  type        = string
}

variable "ami_id" {
  description = "AMI ID for the region (custom baked AMI with Docker + AWS CLI pre-installed)."
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type."
  type        = string
  default     = "t3.small"
}

variable "subnet_id" {
  description = "ID of the public subnet in which to place the instance."
  type        = string
}

variable "security_group_ids" {
  description = "List of security group IDs to attach to the instance (typically just the app SG)."
  type        = list(string)
}

variable "iam_instance_profile" {
  description = "Name of the IAM instance profile to attach (grants ECR pull)."
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

variable "tags" {
  description = "Additional tags merged onto every resource created by this module."
  type        = map(string)
  default     = {}
}
