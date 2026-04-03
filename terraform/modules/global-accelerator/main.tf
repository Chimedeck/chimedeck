terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

# ── Global Accelerator ────────────────────────────────────────────────────────
# A single Global Accelerator fronts all regional ALBs. It provides two static
# anycast IPv4 addresses and routes traffic over the AWS backbone to the nearest
# healthy endpoint group, giving lower latency than plain DNS-based routing.

resource "aws_globalaccelerator_accelerator" "this" {
  name            = var.name_prefix
  ip_address_type = "IPV4"
  enabled         = true

  tags = var.tags
}

# ── Listener ──────────────────────────────────────────────────────────────────
# TCP is required when the endpoints are ALBs (HTTP/HTTPS is handled by the ALB
# itself; Global Accelerator just passes TCP through).

resource "aws_globalaccelerator_listener" "this" {
  accelerator_arn = aws_globalaccelerator_accelerator.this.id
  protocol        = "TCP"

  port_range {
    from_port = 80
    to_port   = 80
  }

  port_range {
    from_port = 443
    to_port   = 443
  }
}

# ── Primary region endpoint group ─────────────────────────────────────────────

resource "aws_globalaccelerator_endpoint_group" "primary" {
  listener_arn          = aws_globalaccelerator_listener.this.id
  endpoint_group_region = var.primary_region

  endpoint_configuration {
    endpoint_id                    = var.primary_alb_arn
    weight                         = 128
    # Preserve real client IP so application logs show actual visitors.
    client_ip_preservation_enabled = true
  }
}

# ── Additional region endpoint groups ─────────────────────────────────────────
# One endpoint group per additional region. If a region is unhealthy Global
# Accelerator automatically drains it and shifts traffic to the remaining groups.

resource "aws_globalaccelerator_endpoint_group" "additional" {
  count = length(var.additional_endpoint_groups)

  listener_arn          = aws_globalaccelerator_listener.this.id
  endpoint_group_region = var.additional_endpoint_groups[count.index].region

  endpoint_configuration {
    endpoint_id                    = var.additional_endpoint_groups[count.index].alb_arn
    weight                         = 128
    client_ip_preservation_enabled = true
  }

  # Prevent parallel creation; each endpoint group must be created sequentially.
  depends_on = [aws_globalaccelerator_endpoint_group.primary]
}
