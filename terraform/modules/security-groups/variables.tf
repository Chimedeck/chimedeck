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
