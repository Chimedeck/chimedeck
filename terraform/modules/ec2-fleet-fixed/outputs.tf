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

output "target_group_arn" {
  description = "ARN of the ALB target group. Use this to register additional IP targets externally (e.g. cross-region instances)."
  value       = aws_lb_target_group.this.arn
}

output "instance_ids" {
  description = "IDs of all primary-region EC2 instances created by this module."
  value       = aws_instance.primary[*].id
}
