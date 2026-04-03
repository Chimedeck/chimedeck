variable "create_vpc" {
  description = "When true, creates a dedicated VPC with public/private subnets and an IGW. When false, the module reads the AWS default VPC."
  type        = bool
  default     = false
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC. Only used when create_vpc = true."
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of Availability Zones to place subnets in. Must contain at least one entry when create_vpc = true."
  type        = list(string)
}

variable "name_prefix" {
  description = "Prefix applied to all resource Name tags (e.g. 'myapp-staging')."
  type        = string
}

variable "tags" {
  description = "Additional tags merged onto every resource created by this module."
  type        = map(string)
  default     = {}
}
