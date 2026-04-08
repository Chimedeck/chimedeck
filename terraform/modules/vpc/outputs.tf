output "vpc_id" {
  description = "ID of the VPC (created or default)."
  value       = var.create_vpc ? aws_vpc.this[0].id : data.aws_vpc.default[0].id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets."
  value       = var.create_vpc ? aws_subnet.public[*].id : data.aws_subnets.default[0].ids
}

output "private_subnet_ids" {
  description = "IDs of the private subnets. Equals public_subnet_ids when create_vpc = false (default VPC has no private subnets)."
  value       = var.create_vpc ? aws_subnet.private[*].id : data.aws_subnets.default[0].ids
}

output "public_route_table_id" {
  description = "ID of the public route table. Null when create_vpc = false."
  value       = var.create_vpc ? aws_route_table.public[0].id : null
}

output "private_route_table_ids" {
  description = "IDs of the private route tables (one per AZ). Empty when create_vpc = false."
  value       = var.create_vpc ? aws_route_table.private[*].id : []
}

output "internet_gateway_id" {
  description = "ID of the Internet Gateway. Null when create_vpc = false."
  value       = var.create_vpc ? aws_internet_gateway.this[0].id : null
}
