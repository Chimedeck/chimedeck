output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer. Point your domain's CNAME here."
  value       = aws_lb.this.dns_name
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer."
  value       = aws_lb.this.arn
}

output "alb_zone_id" {
  description = "Hosted zone ID of the ALB. Used with Route 53 alias records."
  value       = aws_lb.this.zone_id
}

output "blue_target_group_arn" {
  description = "ARN of the blue slot's Target Group."
  value       = module.blue.target_group_arn
}

output "green_target_group_arn" {
  description = "ARN of the green slot's Target Group."
  value       = module.green.target_group_arn
}

output "blue_asg_name" {
  description = "Name of the blue slot's Auto Scaling Group."
  value       = module.blue.asg_name
}

output "green_asg_name" {
  description = "Name of the green slot's Auto Scaling Group."
  value       = module.green.asg_name
}
