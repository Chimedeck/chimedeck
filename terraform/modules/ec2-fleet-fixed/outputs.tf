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

output "instance_elastic_ips" {
  description = "Elastic IP addresses of all primary-region instances. Use these to whitelist SSH access or cross-region security group rules."
  value       = aws_eip.primary[*].public_ip
}

output "key_pair_name" {
  description = "Name of the EC2 key pair created in the primary region. Use this name when creating aws_key_pair resources in additional fleet regions."
  value       = aws_key_pair.fleet.key_name
}

output "public_key_openssh" {
  description = "OpenSSH-format public key. Pass to aws_key_pair.public_key in each additional fleet region so all regions share the same private key (PEM file)."
  value       = tls_private_key.fleet.public_key_openssh
}

output "private_key_pem_path" {
  description = "Absolute path to the generated .pem file written to the root module directory."
  value       = local_sensitive_file.fleet_pem.filename
}
