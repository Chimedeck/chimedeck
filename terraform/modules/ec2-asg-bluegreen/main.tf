terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    null = {
      source  = "hashicorp/null"
      version = ">= 3.0"
    }
  }
}

# ── Locals ────────────────────────────────────────────────────────────────────

locals {
  # Determine which slot is receiving traffic (weight > 0). Used to target the
  # health gate at the newly-active slot's target group so we confirm readiness
  # before considering the apply complete.
  # When both weights are > 0 (gradual canary), we check the slot that was most
  # recently changed from 0 by choosing the one with the lower weight — the
  # "incoming" slot. If both are equal, default to green (which is typically
  # the deployment target).
  new_slot_tg_arn = (
    var.green_weight == 0 ? module.blue.target_group_arn :
    var.blue_weight == 0 ? module.green.target_group_arn :
    var.green_weight <= var.blue_weight ? module.green.target_group_arn :
    module.blue.target_group_arn
  )
}

# ── Blue slot ─────────────────────────────────────────────────────────────────

module "blue" {
  source = "../asg-slot"

  slot                    = "blue"
  name_prefix             = var.name_prefix
  ami_id                  = var.ami_id
  instance_type           = var.instance_type
  ecr_tag                 = var.blue_ecr_tag
  ecr_repo_url            = var.ecr_repo_url
  desired_capacity        = var.desired_capacity
  min_size                = var.min_size
  max_size                = var.max_size
  vpc_id                  = var.vpc_id
  private_subnet_ids      = var.private_subnet_ids
  app_sg_id               = var.app_sg_id
  iam_instance_profile    = var.iam_instance_profile
  user_data_template_path = var.user_data_template_path
  tags                    = var.tags
}

# ── Green slot ────────────────────────────────────────────────────────────────

module "green" {
  source = "../asg-slot"

  slot                    = "green"
  name_prefix             = var.name_prefix
  ami_id                  = var.ami_id
  instance_type           = var.instance_type
  ecr_tag                 = var.green_ecr_tag
  ecr_repo_url            = var.ecr_repo_url
  desired_capacity        = var.desired_capacity
  min_size                = var.min_size
  max_size                = var.max_size
  vpc_id                  = var.vpc_id
  private_subnet_ids      = var.private_subnet_ids
  app_sg_id               = var.app_sg_id
  iam_instance_profile    = var.iam_instance_profile
  user_data_template_path = var.user_data_template_path
  tags                    = var.tags
}

# ── Application Load Balancer ─────────────────────────────────────────────────

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

# ── HTTPS listener: weighted forward to blue and green target groups ───────────
# Weights control the traffic split between slots. The precondition below
# enforces that blue_weight + green_weight == 100 at plan time.

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type = "forward"

    forward {
      target_group {
        arn    = module.blue.target_group_arn
        weight = var.blue_weight
      }

      target_group {
        arn    = module.green.target_group_arn
        weight = var.green_weight
      }

      # Disable stickiness during a deployment so new requests are distributed
      # according to weights immediately; re-enable post-cutover if required.
      stickiness {
        enabled  = false
        duration = 1
      }
    }
  }

  lifecycle {
    precondition {
      condition     = var.blue_weight + var.green_weight == 100
      error_message = "blue_weight (${var.blue_weight}) + green_weight (${var.green_weight}) must equal 100. Adjust the weights so traffic is fully accounted for."
    }
  }
}

# ── Health gate ───────────────────────────────────────────────────────────────
# Runs wait-for-healthy-targets.sh against the newly-active slot's target group
# after every slot change (blue_ecr_tag or green_ecr_tag update). If the script
# exits non-zero (timeout or insufficient healthy targets), terraform apply
# fails and CI's rollback step in deploy.sh restores the previous weights.

resource "null_resource" "wait_for_new_slot_healthy" {
  triggers = {
    blue_tag   = var.blue_ecr_tag
    green_tag  = var.green_ecr_tag
    blue_weight  = var.blue_weight
    green_weight = var.green_weight
  }

  provisioner "local-exec" {
    command = "${path.module}/../../scripts/wait-for-healthy-targets.sh ${local.new_slot_tg_arn} ${var.health_check_min_healthy} ${var.health_check_timeout_seconds}"
  }

  depends_on = [module.blue, module.green, aws_lb_listener.https]
}
