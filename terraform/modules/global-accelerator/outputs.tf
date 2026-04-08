output "dns_name" {
  description = "DNS name of the Global Accelerator. Use as the CNAME target for your domain (replaces per-region ALB DNS)."
  value       = aws_globalaccelerator_accelerator.this.dns_name
}

output "static_ips" {
  description = "Two static anycast IPv4 addresses (can be used as A records instead of CNAME)."
  value       = flatten(aws_globalaccelerator_accelerator.this.ip_sets[*].ip_addresses)
}
