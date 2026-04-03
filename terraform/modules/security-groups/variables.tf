variable "name_prefix" {
  description = "Prefix for all security group names and tags."
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC in which to create the security groups."
  type        = string
}

variable "tags" {
  description = "Additional tags applied to every resource."
  type        = map(string)
  default     = {}
}

variable "ssh_allowed_cidrs" {
  description = "CIDR blocks allowed to SSH (port 22) into the fixed EC2 instance. Restrict to known office/VPN CIDRs in production."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}
