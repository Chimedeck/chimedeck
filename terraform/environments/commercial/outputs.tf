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
# Compute outputs — fleet mode
# ─────────────────────────────────────────────

output "global_accelerator_dns_name" {
  description = "DNS name of the Global Accelerator. Use this as the CNAME for your domain — it routes users to the nearest healthy regional ALB. Only populated when deployment_mode = \"fleet\"."
  value       = var.deployment_mode == "fleet" ? module.global_accelerator[0].dns_name : null
}

output "global_accelerator_static_ips" {
  description = "Two static anycast IPv4 addresses provided by the Global Accelerator. Only populated when deployment_mode = \"fleet\"."
  value       = var.deployment_mode == "fleet" ? module.global_accelerator[0].static_ips : null
}

output "alb_dns_name_primary" {
  description = "DNS name of the primary region ALB (for debugging). Entry point for users is the Global Accelerator. Only populated when deployment_mode = \"fleet\"."
  value       = var.deployment_mode == "fleet" ? module.ec2_fleet[0].alb_dns_name : null
}

output "fleet_elastic_ips_primary" {
  description = "Elastic IP addresses of the primary-region fleet instances. Only populated when deployment_mode = \"fleet\"."
  value       = var.deployment_mode == "fleet" ? module.ec2_fleet[0].instance_elastic_ips : null
}

output "fleet_elastic_ips_r1" {
  description = "Elastic IP addresses of additional region 1 fleet instances."
  value       = [for eip in aws_eip.fleet_r1 : eip.public_ip]
}

output "fleet_elastic_ips_r2" {
  description = "Elastic IP addresses of additional region 2 fleet instances."
  value       = [for eip in aws_eip.fleet_r2 : eip.public_ip]
}

output "fleet_elastic_ips_r3" {
  description = "Elastic IP addresses of additional region 3 fleet instances."
  value       = [for eip in aws_eip.fleet_r3 : eip.public_ip]
}

output "alb_dns_name_r1" {
  description = "DNS name of the additional region 1 ALB (for debugging). Only populated when fleet_regions has a 2nd entry."
  value       = length(aws_lb.fleet_r1) > 0 ? aws_lb.fleet_r1[0].dns_name : null
}

output "alb_dns_name_r2" {
  description = "DNS name of the additional region 2 ALB (for debugging). Only populated when fleet_regions has a 3rd entry."
  value       = length(aws_lb.fleet_r2) > 0 ? aws_lb.fleet_r2[0].dns_name : null
}

output "alb_dns_name_r3" {
  description = "DNS name of the additional region 3 ALB (for debugging). Only populated when fleet_regions has a 4th entry."
  value       = length(aws_lb.fleet_r3) > 0 ? aws_lb.fleet_r3[0].dns_name : null
}

# ─────────────────────────────────────────────
# Compute outputs — asg-bluegreen mode
# ─────────────────────────────────────────────

output "alb_dns_name" {
  description = "DNS name of the ALB. Only populated when deployment_mode = \"asg-bluegreen\"."
  value       = var.deployment_mode == "asg-bluegreen" ? module.ec2_asg_bluegreen[0].alb_dns_name : null
}

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
