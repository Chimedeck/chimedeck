# ─────────────────────────────────────────────
# ECR
# ─────────────────────────────────────────────

output "ecr_repository_url" {
  description = "Full URL of the ECR repository. Use as the image registry prefix in docker build/push commands."
  value       = module.ecr.repository_url
}

# ─────────────────────────────────────────────
# RDS
# ─────────────────────────────────────────────

output "rds_endpoint" {
  description = "Connection endpoint (host:port) for the RDS PostgreSQL instance."
  value       = module.rds.endpoint
}

# ─────────────────────────────────────────────
# Redis
# ─────────────────────────────────────────────

output "redis_endpoint" {
  description = "Primary connection endpoint for the ElastiCache Redis cluster."
  value       = module.redis.primary_endpoint
}

# ─────────────────────────────────────────────
# Compute outputs — single mode
# ─────────────────────────────────────────────

output "public_ip" {
  description = "Elastic IP of the single EC2 instance. Only populated when deployment_mode = \"single\"."
  value       = var.deployment_mode == "single" ? module.ec2_single[0].public_ip : null
}

# ─────────────────────────────────────────────
# Compute outputs — fleet and asg-bluegreen modes
# ─────────────────────────────────────────────

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer. Only populated when deployment_mode is \"fleet\" or \"asg-bluegreen\"."
  value = (
    var.deployment_mode == "fleet" ? module.ec2_fleet[0].alb_dns_name :
    var.deployment_mode == "asg-bluegreen" ? module.ec2_asg_bluegreen[0].alb_dns_name :
    null
  )
}

# ─────────────────────────────────────────────
# Compute outputs — asg-bluegreen mode
# ─────────────────────────────────────────────

output "blue_target_group_arn" {
  description = "ARN of the blue slot's Target Group. Only populated when deployment_mode = \"asg-bluegreen\"."
  value       = var.deployment_mode == "asg-bluegreen" ? module.ec2_asg_bluegreen[0].blue_target_group_arn : null
}

output "green_target_group_arn" {
  description = "ARN of the green slot's Target Group. Only populated when deployment_mode = \"asg-bluegreen\"."
  value       = var.deployment_mode == "asg-bluegreen" ? module.ec2_asg_bluegreen[0].green_target_group_arn : null
}

output "blue_asg_name" {
  description = "Name of the blue ASG. Only populated when deployment_mode = \"asg-bluegreen\"."
  value       = var.deployment_mode == "asg-bluegreen" ? module.ec2_asg_bluegreen[0].blue_asg_name : null
}

output "green_asg_name" {
  description = "Name of the green ASG. Only populated when deployment_mode = \"asg-bluegreen\"."
  value       = var.deployment_mode == "asg-bluegreen" ? module.ec2_asg_bluegreen[0].green_asg_name : null
}

# ─────────────────────────────────────────────
# S3
# ─────────────────────────────────────────────

output "s3_bucket_name" {
  description = "Name of the application S3 bucket."
  value       = module.s3.bucket_name
}
