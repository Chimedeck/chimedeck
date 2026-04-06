terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }
}

# ── EC2 Instance Connect IP ranges ───────────────────────────────────────────
# Fetched at plan time from https://ip-ranges.amazonaws.com/ip-ranges.json.
# Filtered to EC2_INSTANCE_CONNECT for the deployment region so only the AWS
# managed SSH relay IPs are permitted — not the full AMAZON prefix list.

data "aws_ip_ranges" "ec2_instance_connect" {
  regions  = var.regions
  services = ["EC2_INSTANCE_CONNECT"]
}

# ── ALB Security Group ────────────────────────────────────────────────────────
# Accepts inbound HTTP and HTTPS from anywhere. Outbound is unrestricted so
# the load balancer can forward requests to app instances on any port.

resource "aws_security_group" "alb" {
  name        = "${var.name_prefix}-alb"
  description = "ALB: allow HTTP/HTTPS from internet"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    { Name = "${var.name_prefix}-alb" },
    var.tags,
  )
}

# ── App Security Group ────────────────────────────────────────────────────────
# Only accepts traffic forwarded by the ALB security group. Outbound is open
# so instances can reach ECR (image pull), Secrets Manager, RDS, and Redis.
# EC2 Instance Connect IPs are allowed on port 22 so operators can open
# browser-based SSH sessions from the AWS console without long-lived keys.

resource "aws_security_group" "app" {
  name        = "${var.name_prefix}-app"
  description = "App: allow all traffic from ALB SG + EC2 Instance Connect SSH"
  vpc_id      = var.vpc_id

  ingress {
    description     = "All traffic from ALB SG"
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description = "SSH via EC2 Instance Connect (AWS managed relay IPs)"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = data.aws_ip_ranges.ec2_instance_connect.cidr_blocks
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    { Name = "${var.name_prefix}-app" },
    var.tags,
  )
}

# ── DB Security Group ─────────────────────────────────────────────────────────
# Accepts PostgreSQL connections from the app SG only. No outbound rules
# (default deny) because RDS does not need to initiate connections.

resource "aws_security_group" "db" {
  name        = "${var.name_prefix}-db"
  description = "DB: allow PostgreSQL from app SG only"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from app SG"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = merge(
    { Name = "${var.name_prefix}-db" },
    var.tags,
  )
}

# ── Fixed-Instance Security Group ────────────────────────────────────────────
# Used by the single EC2 instance (ec2-single module). Mirrors the app SG but
# also opens port 22 for SSH. EC2 Instance Connect IPs are always included;
# ssh_allowed_cidrs lets operators append office/VPN CIDRs as a fallback.

resource "aws_security_group" "fixed_instance" {
  name        = "${var.name_prefix}-fixed-instance"
  description = "Fixed EC2: ALB traffic + SSH via EC2 Instance Connect and allowed CIDRs"
  vpc_id      = var.vpc_id

  ingress {
    description     = "All traffic from ALB SG"
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description = "SSH via EC2 Instance Connect and optional VPN/office CIDRs"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = concat(data.aws_ip_ranges.ec2_instance_connect.cidr_blocks, var.ssh_allowed_cidrs)
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    { Name = "${var.name_prefix}-fixed-instance" },
    var.tags,
  )
}

# ── Redis Security Group ──────────────────────────────────────────────────────
# Accepts Redis connections from the app SG only. No outbound rules
# (default deny) because ElastiCache does not need to initiate connections.

resource "aws_security_group" "redis" {
  name        = "${var.name_prefix}-redis"
  description = "Redis: allow Redis from app SG only"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from app SG"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = merge(
    { Name = "${var.name_prefix}-redis" },
    var.tags,
  )
}
