output "peering_connection_id" {
  description = "ID of the VPC peering connection."
  value       = aws_vpc_peering_connection.this.id
}

output "peering_connection_status" {
  description = "Status of the VPC peering connection (e.g. 'active')."
  value       = aws_vpc_peering_connection_accepter.this.accept_status
}
