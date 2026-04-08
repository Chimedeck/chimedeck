variable "requester_vpc_id" {
  description = "VPC ID of the requesting side of the peering connection."
  type        = string
}

variable "requester_region" {
  description = "AWS region of the requesting VPC."
  type        = string
}

variable "accepter_vpc_id" {
  description = "VPC ID of the accepting side of the peering connection."
  type        = string
}

variable "accepter_region" {
  description = "AWS region of the accepting VPC."
  type        = string
}

variable "requester_route_table_ids" {
  description = "Route table IDs on the requester side to update with a route to the accepter CIDR."
  type        = list(string)
}

variable "accepter_route_table_ids" {
  description = "Route table IDs on the accepter side to update with a route to the requester CIDR."
  type        = list(string)
}

variable "accepter_cidr_block" {
  description = "CIDR block of the accepter VPC. Added to requester route tables."
  type        = string
}

variable "requester_cidr_block" {
  description = "CIDR block of the requester VPC. Added to accepter route tables."
  type        = string
}

variable "tags" {
  description = "Additional tags merged onto every resource created by this module."
  type        = map(string)
  default     = {}
}
