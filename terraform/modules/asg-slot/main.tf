terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

# ── Target Group ──────────────────────────────────────────────────────────────
# Instance-based target group on port 3000. Health check polls /health so the
# parent module's health gate can confirm readiness before shifting traffic.

resource "aws_lb_target_group" "this" {
  name     = "${var.name_prefix}-${var.slot}-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 5
  }

  tags = merge(
    { Name = "${var.name_prefix}-${var.slot}-tg" },
    var.tags,
  )
}

# ── Launch Template ───────────────────────────────────────────────────────────
# A new template version is created whenever ecr_tag changes, triggering an
# ASG instance refresh in the parent module.

resource "aws_launch_template" "this" {
  name_prefix   = "${var.name_prefix}-${var.slot}-lt-"
  image_id      = var.ami_id
  instance_type = var.instance_type

  iam_instance_profile {
    name = var.iam_instance_profile
  }

  vpc_security_group_ids = [var.app_sg_id]

  # Startup script pulls the tagged image from ECR and sources env vars from
  # Secrets Manager; no credentials are stored in the AMI or Launch Template.
  user_data = base64encode(templatefile(var.user_data_template_path, {
    ecr_image_url = "${var.ecr_repo_url}:${var.ecr_tag}"
    secrets_arn   = var.secrets_arn
  }))

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(
    { Name = "${var.name_prefix}-${var.slot}-lt" },
    var.tags,
  )
}

# ── Auto Scaling Group ────────────────────────────────────────────────────────
# Instances are placed in private subnets and receive traffic only from the
# ALB via the target group. Instance refresh is enabled so new Launch Template
# versions propagate to running instances without manual intervention.

resource "aws_autoscaling_group" "this" {
  name                = "${var.name_prefix}-${var.slot}-asg"
  desired_capacity    = var.desired_capacity
  min_size            = var.min_size
  max_size            = var.max_size
  vpc_zone_identifier = var.private_subnet_ids

  target_group_arns = [aws_lb_target_group.this.arn]

  launch_template {
    id      = aws_launch_template.this.id
    version = "$Latest"
  }

  # Automatically replace instances when the Launch Template changes (e.g.
  # when ecr_tag is updated for a new deployment to this slot).
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
    }
  }

  health_check_type         = "ELB"
  health_check_grace_period = 60

  lifecycle {
    create_before_destroy = true
  }

  dynamic "tag" {
    for_each = merge(
      { Name = "${var.name_prefix}-${var.slot}" },
      var.tags,
    )
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }
}
