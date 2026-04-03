variable "slot" {
  description = "Slot identifier: 'blue' or 'green'. Used to namespace resources within the parent module."
  type        = string

  validation {
    condition     = contains(["blue", "green"], var.slot)
    error_message = "slot must be 'blue' or 'green'."
  }
}

variable "name_prefix" {
  description = "Prefix applied to all resource Name tags (e.g. 'myapp-staging')."
  type        = string
}

variable "ami_id" {
  description = "AMI ID for the region. Should be a custom baked AMI with Docker and AWS CLI pre-installed."
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type for all instances in this slot."
  type        = string
  default     = "t3.small"
}

variable "ecr_tag" {
  description = "ECR image tag deployed to this slot (e.g. 'v1.2.3'). Changing this triggers a new Launch Template version and ASG instance refresh."
  type        = string
}

variable "ecr_repo_url" {
  description = "ECR repository URL without tag (e.g. '123456789.dkr.ecr.us-east-1.amazonaws.com/app')."
  type        = string
}

variable "desired_capacity" {
  description = "Desired number of instances in the ASG."
  type        = number
  default     = 2
}

variable "min_size" {
  description = "Minimum number of instances in the ASG."
  type        = number
  default     = 1
}

variable "max_size" {
  description = "Maximum number of instances in the ASG."
  type        = number
  default     = 4
}

variable "vpc_id" {
  description = "VPC ID where the target group is registered. Must match the VPC containing the private subnets."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs where ASG instances are launched. Instances are distributed across these subnets."
  type        = list(string)
}

variable "app_sg_id" {
  description = "Security group ID (app SG) from the security-groups module. Applied to all instances in this slot."
  type        = string
}

variable "iam_instance_profile" {
  description = "Name of the IAM instance profile to attach to instances (grants ECR pull)."
  type        = string
}

variable "user_data_template_path" {
  description = "Path to the startup.sh templatefile rendered as EC2 user data. Receives ecr_image_url."
  type        = string
}

variable "tags" {
  description = "Additional tags merged onto every resource created by this module."
  type        = map(string)
  default     = {}
}
