output "alb_sg_id" {
  description = "ID of the ALB security group."
  value       = aws_security_group.alb.id
}

output "app_sg_id" {
  description = "ID of the application security group."
  value       = aws_security_group.app.id
}

output "db_sg_id" {
  description = "ID of the database (RDS) security group."
  value       = aws_security_group.db.id
}

output "redis_sg_id" {
  description = "ID of the Redis security group."
  value       = aws_security_group.redis.id
}
