# ── Provider declaration ──────────────────────────────────────────────────────
# This module manages the primary region: ALB, key pair, and EC2 instances.
# Instances are placed in PUBLIC subnets with auto-assigned public IPs so they
# can reach ECR and Secrets Manager without a NAT Gateway. Inbound traffic is
# restricted by the app security group to port 3000 from the ALB SG only.
# Additional fleet regions are fully self-contained (own ALB + instances) and
# routed via AWS Global Accelerator — see the environment-level main.tf.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = ">= 4.0"
    }
    local = {
      source  = "hashicorp/local"
      version = ">= 2.0"
    }
  }
}

# ── Locals ────────────────────────────────────────────────────────────────────

locals {
  primary_ami = var.ami_ids[var.primary_region]
  key_name    = coalesce(var.key_pair_name, "${var.name_prefix}-fleet-key")
}

# ── Key pair generation ───────────────────────────────────────────────────────
# An RSA 4096 key pair is generated once (stored in Terraform state). The
# private key is written to a local .pem file and the public key is uploaded
# to AWS. Import the same public key into every additional fleet region using
# the public_key_openssh output.

resource "tls_private_key" "fleet" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

# Upload to the primary region.
resource "aws_key_pair" "fleet" {
  key_name   = local.key_name
  public_key = tls_private_key.fleet.public_key_openssh

  tags = merge(
    { Name = local.key_name },
    var.tags,
  )
}

# Write the private key to disk beside the root module. The file is created
# with 0600 permissions so only the current user can read it.
resource "local_sensitive_file" "fleet_pem" {
  content         = tls_private_key.fleet.private_key_pem
  filename        = "${path.root}/${local.key_name}.pem"
  file_permission = "0600"
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
# Placed in PUBLIC subnets with Elastic IPs for stable outbound internet access
# (ECR image pull, Secrets Manager). Inbound is blocked from the internet —
# only the ALB SG can reach port 3000 (enforced by the app_sg_id rules).
# Elastic IPs are separate resources so they survive instance replacement.

resource "aws_instance" "primary" {
  count = var.instance_count_primary

  ami                         = local.primary_ami
  instance_type               = var.instance_type
  subnet_id                   = var.public_subnet_ids[count.index % length(var.public_subnet_ids)]
  vpc_security_group_ids      = [var.app_sg_id]
  iam_instance_profile        = var.iam_instance_profile
  key_name                    = aws_key_pair.fleet.key_name
  associate_public_ip_address = false # Elastic IP allocated separately below

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

# ── Primary region Elastic IPs ───────────────────────────────────────────────
# Static public IPs allow SSH access and consistent outbound identity without
# relying on the instance's ephemeral auto-assigned IP.

resource "aws_eip" "primary" {
  count  = var.instance_count_primary
  domain = "vpc"

  tags = merge(
    { Name = "${var.name_prefix}-primary-eip-${count.index}" },
    var.tags,
  )
}

resource "aws_eip_association" "primary" {
  count = var.instance_count_primary

  instance_id   = aws_instance.primary[count.index].id
  allocation_id = aws_eip.primary[count.index].id
}

# ── Primary region target group attachments ───────────────────────────────────
# Register instances by private IP — ALB communicates within the VPC.

resource "aws_lb_target_group_attachment" "primary" {
  count = var.instance_count_primary

  target_group_arn = aws_lb_target_group.this.arn
  target_id        = aws_instance.primary[count.index].private_ip
  port             = 3000
}


