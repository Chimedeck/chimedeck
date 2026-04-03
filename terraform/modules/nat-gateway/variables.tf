variable "name_prefix" {
  description = "Prefix applied to all resource Name tags (e.g. 'myapp-staging')."
  type        = string
}

variable "public_subnet_id" {
  description = "ID of the public subnet in which to place the NAT Gateway."
  type        = string
}

variable "private_route_table_ids" {
  description = "List of private route table IDs that should route 0.0.0.0/0 through the NAT Gateway."
  type        = list(string)
}

variable "tags" {
  description = "Additional tags merged onto every resource created by this module."
  type        = map(string)
  default     = {}
}
