output "instance_id" {
  description = "ID of the EC2 instance."
  value       = aws_instance.this.id
}

output "private_ip" {
  description = "Private IP address of the instance (useful for inter-VPC connectivity)."
  value       = aws_instance.this.private_ip
}
