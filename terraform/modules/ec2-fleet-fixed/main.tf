# ── Provider declaration ──────────────────────────────────────────────────────
# This module uses only the default aws provider (primary region). Cross-region
# instances are registered by private IP via aws_lb_target_group_attachment; the
# caller manages those instances externally with appropriate provider aliases and
# passes their private IPs via var.additional_target_ips. See README for the
# recommended environment-level pattern using modules/vpc-peering and
# modules/nat-gateway alongside this module.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

# ── Locals ────────────────────────────────────────────────────────────────────

locals {
  primary_ami = var.ami_ids[var.primary_region]
}

# ── Application Load Balancer ─────────────────────────────────────────────────
# The ALB lives in the primary region's public subnets. All instances (primary
# and additional regions) register as IP-based targets so cross-region IPs can
# be included in the same target group.

resource "aws_lb" "this" {
  name               = "${var.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_sg_id]
  subnets            = var.public_subnet_ids

  tags = merge(
    { Name = "${var.name_prefix}-alb" },
    var.tags,
  )
}

# ── Target Group ──────────────────────────────────────────────────────────────
# IP-based target type is required to register cross-region instances by their
# private IP addresses (cross-region instance IDs are not accepted by an ALB).

resource "aws_lb_target_group" "this" {
  name        = "${var.name_prefix}-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 5
  }

  tags = merge(
    { Name = "${var.name_prefix}-tg" },
    var.tags,
  )
}

# ── HTTP listener: port 80 → HTTPS redirect ───────────────────────────────────

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ── HTTPS listener: port 443 → target group ───────────────────────────────────
# The ACM certificate must be in the same region as the ALB (primary_region).

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }
}

# ── Primary region EC2 instances ──────────────────────────────────────────────
# Placed in private subnets; inbound is blocked from the internet — only the
# ALB SG can reach port 3000 (enforced by the app_sg_id security group rules).

resource "aws_instance" "primary" {
  count = var.instance_count_primary

  ami                    = local.primary_ami
  instance_type          = var.instance_type
  subnet_id              = var.private_subnet_ids[count.index % length(var.private_subnet_ids)]
  vpc_security_group_ids = [var.app_sg_id]
  iam_instance_profile   = var.iam_instance_profile

  # Startup script pulls the Docker image from ECR and sources env vars from
  # Secrets Manager; no credentials are baked into the AMI.
  user_data = templatefile(var.user_data_template_path, {
    ecr_image_url = var.ecr_image_url
    secrets_arn   = var.secrets_arn
  })

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(
    { Name = "${var.name_prefix}-primary-${count.index}" },
    var.tags,
  )
}

# ── Primary region target group attachments ───────────────────────────────────

resource "aws_lb_target_group_attachment" "primary" {
  count = var.instance_count_primary

  target_group_arn  = aws_lb_target_group.this.arn
  target_id         = aws_instance.primary[count.index].private_ip
  port              = 3000
  availability_zone = "all" # required for IP-based targets
}

# ── Cross-region target registrations ─────────────────────────────────────────
# Instances in additional regions are managed externally (caller uses
# modules/vpc-peering and modules/nat-gateway alongside provider aliases).
# Their private IPs are passed in via var.additional_target_ips and registered
# in the same target group here. VPC peering must be established before these
# targets can pass health checks.

resource "aws_lb_target_group_attachment" "additional" {
  count = length(var.additional_target_ips)

  target_group_arn  = aws_lb_target_group.this.arn
  target_id         = var.additional_target_ips[count.index]
  port              = 3000
  availability_zone = "all" # cross-region IP target; must be "all"
}
