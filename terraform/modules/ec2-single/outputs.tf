output "instance_id" {
  description = "ID of the EC2 instance."
  value       = aws_instance.this.id
}

output "public_ip" {
  description = "Public IP address of the Elastic IP associated with the instance."
  value       = aws_eip.this.public_ip
}

output "eip_allocation_id" {
  description = "Allocation ID of the Elastic IP."
  value       = aws_eip.this.id
}

output "private_ip" {
  description = "Private IP address of the instance (useful for inter-VPC connectivity)."
  value       = aws_instance.this.private_ip
}
