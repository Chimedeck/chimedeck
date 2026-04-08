output "target_group_arn" {
  description = "ARN of the Target Group created for this slot. Referenced by the weighted ALB listener in the parent module."
  value       = aws_lb_target_group.this.arn
}

output "asg_name" {
  description = "Name of the Auto Scaling Group for this slot."
  value       = aws_autoscaling_group.this.name
}

output "launch_template_id" {
  description = "ID of the Launch Template used by the ASG in this slot."
  value       = aws_launch_template.this.id
}
