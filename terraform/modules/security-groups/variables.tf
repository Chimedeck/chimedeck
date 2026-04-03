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

variable "regions" {
  description = "All AWS regions in this deployment. EC2 Instance Connect IP ranges are fetched for every region so operators can SSH into instances regardless of which region they are in."
  type        = list(string)
}

variable "ssh_allowed_cidrs" {
  description = "Additional CIDR blocks allowed to SSH (port 22) into the fixed EC2 instance (e.g. office/VPN). EC2 Instance Connect IPs are always included automatically."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}
