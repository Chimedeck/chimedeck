output "endpoint" {
  description = "Full host:port connection string for the RDS instance."
  value       = aws_db_instance.this.endpoint
}

output "db_name" {
  description = "Name of the initial database."
  value       = aws_db_instance.this.db_name
}

output "db_username" {
  description = "Master username."
  value       = aws_db_instance.this.username
}

output "instance_id" {
  description = "RDS instance identifier."
  value       = aws_db_instance.this.identifier
}
