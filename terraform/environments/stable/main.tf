provider "aws" {
  region = var.fleet_regions[0].region

  default_tags {
    tags = var.tags
  }
}

# ── Additional fleet region providers ─────────────────────────────────────────
# Up to 3 extra regions are supported (4 total including primary). Aliases that
# don't map to a configured region fall back to the primary so that resource
# blocks with count = 0 never receive an empty region string.

provider "aws" {
  alias  = "fleet_r1"
  region = length(var.fleet_regions) > 1 ? var.fleet_regions[1].region : var.fleet_regions[0].region

  default_tags {
    tags = var.tags
  }
}

provider "aws" {
  alias  = "fleet_r2"
  region = length(var.fleet_regions) > 2 ? var.fleet_regions[2].region : var.fleet_regions[0].region

  default_tags {
    tags = var.tags
  }
}

provider "aws" {
  alias  = "fleet_r3"
  region = length(var.fleet_regions) > 3 ? var.fleet_regions[3].region : var.fleet_regions[0].region

  default_tags {
    tags = var.tags
  }
}

locals {
  name_prefix = "${var.app_name}-stable"
  primary     = var.fleet_regions[0]

  # ── Additional region safe locals ─────────────────────────────────────────
  # Flat values prevent out-of-bounds index errors in resource bodies whose
  # count = 0 — Terraform still type-checks the expressions.

  r1_enabled        = length(var.fleet_regions) > 1 && var.deployment_mode == "fleet"
  r1_region         = length(var.fleet_regions) > 1 ? var.fleet_regions[1].region : var.fleet_regions[0].region
  r1_instance_count = length(var.fleet_regions) > 1 ? var.fleet_regions[1].instance_count : 0
  r1_ami_id         = length(var.fleet_regions) > 1 ? var.fleet_regions[1].ami_id : var.fleet_regions[0].ami_id
  r1_vpc_cidr       = length(var.fleet_regions) > 1 ? var.fleet_regions[1].vpc_cidr : "10.254.1.0/24"
  r1_azs            = length(var.fleet_regions) > 1 ? var.fleet_regions[1].azs : var.fleet_regions[0].azs
  r1_acm_cert       = length(var.fleet_regions) > 1 ? var.fleet_regions[1].acm_certificate_arn : ""

  r2_enabled        = length(var.fleet_regions) > 2 && var.deployment_mode == "fleet"
  r2_region         = length(var.fleet_regions) > 2 ? var.fleet_regions[2].region : var.fleet_regions[0].region
  r2_instance_count = length(var.fleet_regions) > 2 ? var.fleet_regions[2].instance_count : 0
  r2_ami_id         = length(var.fleet_regions) > 2 ? var.fleet_regions[2].ami_id : var.fleet_regions[0].ami_id
  r2_vpc_cidr       = length(var.fleet_regions) > 2 ? var.fleet_regions[2].vpc_cidr : "10.254.2.0/24"
  r2_azs            = length(var.fleet_regions) > 2 ? var.fleet_regions[2].azs : var.fleet_regions[0].azs
  r2_acm_cert       = length(var.fleet_regions) > 2 ? var.fleet_regions[2].acm_certificate_arn : ""

  r3_enabled        = length(var.fleet_regions) > 3 && var.deployment_mode == "fleet"
  r3_region         = length(var.fleet_regions) > 3 ? var.fleet_regions[3].region : var.fleet_regions[0].region
  r3_instance_count = length(var.fleet_regions) > 3 ? var.fleet_regions[3].instance_count : 0
  r3_ami_id         = length(var.fleet_regions) > 3 ? var.fleet_regions[3].ami_id : var.fleet_regions[0].ami_id
  r3_vpc_cidr       = length(var.fleet_regions) > 3 ? var.fleet_regions[3].vpc_cidr : "10.254.3.0/24"
  r3_azs            = length(var.fleet_regions) > 3 ? var.fleet_regions[3].azs : var.fleet_regions[0].azs
  r3_acm_cert       = length(var.fleet_regions) > 3 ? var.fleet_regions[3].acm_certificate_arn : ""

  fleet_computed_key_name = coalesce(var.fleet_key_pair_name, "${local.name_prefix}-fleet-key")
}

# ─────────────────────────────────────────────
# Networking — primary region
# ─────────────────────────────────────────────

module "vpc" {
  source = "../../modules/vpc"

  create_vpc         = var.create_vpc
  vpc_cidr           = local.primary.vpc_cidr
  availability_zones = local.primary.azs
  name_prefix        = local.name_prefix
  tags               = var.tags
}

# ─────────────────────────────────────────────
# ECR, S3, Security Groups (primary region — always created)
# ─────────────────────────────────────────────

module "ecr" {
  source = "../../modules/ecr"

  name = var.ecr_repo_name
  tags = var.tags
}

module "s3" {
  source = "../../modules/s3"

  bucket_name = var.s3_bucket_name
  tags        = var.tags
}

module "security_groups" {
  source = "../../modules/security-groups"

  name_prefix = local.name_prefix
  vpc_id      = module.vpc.vpc_id
  regions     = [for r in var.fleet_regions : r.region]
  tags        = var.tags
}

# ─────────────────────────────────────────────
# RDS PostgreSQL (primary region only)
# ─────────────────────────────────────────────

module "rds" {
  source = "../../modules/rds-postgres"

  identifier            = "${local.name_prefix}-postgres"
  instance_class        = var.rds_instance_class
  allocated_storage     = var.rds_allocated_storage
  max_allocated_storage = var.rds_max_allocated_storage
  multi_az              = var.rds_multi_az
  db_name               = var.rds_db_name
  db_username           = var.rds_username
  db_password           = var.rds_password
  subnet_ids            = module.vpc.private_subnet_ids
  security_group_id     = module.security_groups.db_sg_id
  deletion_protection   = var.rds_deletion_protection
  backup_retention_days = var.rds_backup_retention_days
  tags                  = var.tags
}

# ─────────────────────────────────────────────
# ElastiCache Redis (primary region only)
# ─────────────────────────────────────────────

module "redis" {
  source = "../../modules/elasticache-redis"

  name              = "${local.name_prefix}-redis"
  node_type         = var.redis_node_type
  cluster_mode      = var.redis_cluster_mode
  subnet_ids        = module.vpc.private_subnet_ids
  security_group_id = module.security_groups.redis_sg_id
  tags              = var.tags
}

# ─────────────────────────────────────────────
# Cross-region DB / Redis access rules
# Additional-region EC2s connect to RDS and Redis in the primary VPC via VPC
# peering. These rules extend the primary SGs to allow connections from each
# additional region's CIDR block.
# ─────────────────────────────────────────────

resource "aws_security_group_rule" "db_from_r1" {
  count             = local.r1_enabled ? 1 : 0
  type              = "ingress"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  cidr_blocks       = [local.r1_vpc_cidr]
  security_group_id = module.security_groups.db_sg_id
  description       = "PostgreSQL from fleet region r1 (${local.r1_region}) via VPC peering"
}

resource "aws_security_group_rule" "redis_from_r1" {
  count             = local.r1_enabled ? 1 : 0
  type              = "ingress"
  from_port         = 6379
  to_port           = 6379
  protocol          = "tcp"
  cidr_blocks       = [local.r1_vpc_cidr]
  security_group_id = module.security_groups.redis_sg_id
  description       = "Redis from fleet region r1 (${local.r1_region}) via VPC peering"
}

resource "aws_security_group_rule" "db_from_r2" {
  count             = local.r2_enabled ? 1 : 0
  type              = "ingress"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  cidr_blocks       = [local.r2_vpc_cidr]
  security_group_id = module.security_groups.db_sg_id
  description       = "PostgreSQL from fleet region r2 (${local.r2_region}) via VPC peering"
}

resource "aws_security_group_rule" "redis_from_r2" {
  count             = local.r2_enabled ? 1 : 0
  type              = "ingress"
  from_port         = 6379
  to_port           = 6379
  protocol          = "tcp"
  cidr_blocks       = [local.r2_vpc_cidr]
  security_group_id = module.security_groups.redis_sg_id
  description       = "Redis from fleet region r2 (${local.r2_region}) via VPC peering"
}

resource "aws_security_group_rule" "db_from_r3" {
  count             = local.r3_enabled ? 1 : 0
  type              = "ingress"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  cidr_blocks       = [local.r3_vpc_cidr]
  security_group_id = module.security_groups.db_sg_id
  description       = "PostgreSQL from fleet region r3 (${local.r3_region}) via VPC peering"
}

resource "aws_security_group_rule" "redis_from_r3" {
  count             = local.r3_enabled ? 1 : 0
  type              = "ingress"
  from_port         = 6379
  to_port           = 6379
  protocol          = "tcp"
  cidr_blocks       = [local.r3_vpc_cidr]
  security_group_id = module.security_groups.redis_sg_id
  description       = "Redis from fleet region r3 (${local.r3_region}) via VPC peering"
}

# ─────────────────────────────────────────────
# Fleet — additional region 1
# ─────────────────────────────────────────────
# Own VPC + public-subnet instances + ALB. No NAT Gateway needed: instances
# get auto-assigned public IPs for outbound internet (ECR, Secrets Manager).
# VPC peering to primary is maintained for RDS/Redis connectivity only.

module "vpc_r1" {
  count     = local.r1_enabled ? 1 : 0
  source    = "../../modules/vpc"
  providers = { aws = aws.fleet_r1 }

  create_vpc         = true
  vpc_cidr           = local.r1_vpc_cidr
  availability_zones = local.r1_azs
  name_prefix        = "${local.name_prefix}-r1"
  tags               = var.tags
}

module "security_groups_r1" {
  count     = local.r1_enabled ? 1 : 0
  source    = "../../modules/security-groups"
  providers = { aws = aws.fleet_r1 }

  name_prefix = "${local.name_prefix}-r1"
  vpc_id      = module.vpc_r1[0].vpc_id
  regions     = [for r in var.fleet_regions : r.region]
  tags        = var.tags
}

resource "aws_key_pair" "fleet_r1" {
  count    = local.r1_enabled ? 1 : 0
  provider = aws.fleet_r1

  key_name   = local.fleet_computed_key_name
  public_key = module.ec2_fleet[0].public_key_openssh

  depends_on = [module.ec2_fleet]
}

resource "aws_instance" "fleet_r1" {
  count    = local.r1_enabled ? local.r1_instance_count : 0
  provider = aws.fleet_r1

  ami                         = local.r1_ami_id
  instance_type               = var.instance_type
  subnet_id                   = module.vpc_r1[0].public_subnet_ids[count.index % length(module.vpc_r1[0].public_subnet_ids)]
  vpc_security_group_ids      = [module.security_groups_r1[0].app_sg_id]
  iam_instance_profile        = var.iam_instance_profile
  key_name                    = aws_key_pair.fleet_r1[0].key_name
  associate_public_ip_address = false # Elastic IP allocated separately

  user_data = templatefile("${path.root}/../../scripts/startup.sh", {
    ecr_image_url = "${module.ecr.repository_url}:${var.ecr_image_tag}"
  })

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "${local.name_prefix}-r1-${count.index}" }
}

# ALB for r1 — registers instances by private IP (same VPC, no cross-region trick).
resource "aws_lb" "fleet_r1" {
  count    = local.r1_enabled ? 1 : 0
  provider = aws.fleet_r1

  name               = "${local.name_prefix}-r1-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [module.security_groups_r1[0].alb_sg_id]
  subnets            = module.vpc_r1[0].public_subnet_ids

  tags = { Name = "${local.name_prefix}-r1-alb" }
}

resource "aws_lb_target_group" "fleet_r1" {
  count    = local.r1_enabled ? 1 : 0
  provider = aws.fleet_r1

  name        = "${local.name_prefix}-r1-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = module.vpc_r1[0].vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 5
  }
}

resource "aws_lb_listener" "http_fleet_r1" {
  count    = local.r1_enabled ? 1 : 0
  provider = aws.fleet_r1

  load_balancer_arn = aws_lb.fleet_r1[0].arn
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

resource "aws_lb_listener" "https_fleet_r1" {
  count    = local.r1_enabled ? 1 : 0
  provider = aws.fleet_r1

  load_balancer_arn = aws_lb.fleet_r1[0].arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = local.r1_acm_cert

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.fleet_r1[0].arn
  }
}

resource "aws_eip" "fleet_r1" {
  count    = local.r1_enabled ? local.r1_instance_count : 0
  provider = aws.fleet_r1
  domain   = "vpc"

  tags = { Name = "${local.name_prefix}-r1-eip-${count.index}" }
}

resource "aws_eip_association" "fleet_r1" {
  count    = local.r1_enabled ? local.r1_instance_count : 0
  provider = aws.fleet_r1

  instance_id   = aws_instance.fleet_r1[count.index].id
  allocation_id = aws_eip.fleet_r1[count.index].id
}

resource "aws_lb_target_group_attachment" "fleet_r1" {
  count    = local.r1_enabled ? local.r1_instance_count : 0
  provider = aws.fleet_r1

  target_group_arn = aws_lb_target_group.fleet_r1[0].arn
  target_id        = aws_instance.fleet_r1[count.index].private_ip
  port             = 3000
}

# VPC peering r1 — data plane only (RDS/Redis in primary VPC private subnets).
# Instances in r1 are in PUBLIC subnets, so we add VPC peering routes to the
# PUBLIC route table of vpc_r1. Primary VPC private route tables get routes
# back to r1 so RDS/Redis responses are routed correctly.
module "vpc_peering_r1" {
  count  = local.r1_enabled ? 1 : 0
  source = "../../modules/vpc-peering"
  providers = {
    aws.requester = aws
    aws.accepter  = aws.fleet_r1
  }

  requester_region          = local.primary.region
  requester_vpc_id          = module.vpc.vpc_id
  requester_route_table_ids = module.vpc.private_route_table_ids
  requester_cidr_block      = local.primary.vpc_cidr
  accepter_region           = local.r1_region
  accepter_vpc_id           = module.vpc_r1[0].vpc_id
  accepter_route_table_ids  = [module.vpc_r1[0].public_route_table_id]
  accepter_cidr_block       = local.r1_vpc_cidr
  tags                      = var.tags
}

# ─────────────────────────────────────────────
# Fleet — additional region 2
# ─────────────────────────────────────────────

module "vpc_r2" {
  count     = local.r2_enabled ? 1 : 0
  source    = "../../modules/vpc"
  providers = { aws = aws.fleet_r2 }

  create_vpc         = true
  vpc_cidr           = local.r2_vpc_cidr
  availability_zones = local.r2_azs
  name_prefix        = "${local.name_prefix}-r2"
  tags               = var.tags
}

module "security_groups_r2" {
  count     = local.r2_enabled ? 1 : 0
  source    = "../../modules/security-groups"
  providers = { aws = aws.fleet_r2 }

  name_prefix = "${local.name_prefix}-r2"
  vpc_id      = module.vpc_r2[0].vpc_id
  regions     = [for r in var.fleet_regions : r.region]
  tags        = var.tags
}

resource "aws_key_pair" "fleet_r2" {
  count    = local.r2_enabled ? 1 : 0
  provider = aws.fleet_r2

  key_name   = local.fleet_computed_key_name
  public_key = module.ec2_fleet[0].public_key_openssh

  depends_on = [module.ec2_fleet]
}

resource "aws_instance" "fleet_r2" {
  count    = local.r2_enabled ? local.r2_instance_count : 0
  provider = aws.fleet_r2

  ami                         = local.r2_ami_id
  instance_type               = var.instance_type
  subnet_id                   = module.vpc_r2[0].public_subnet_ids[count.index % length(module.vpc_r2[0].public_subnet_ids)]
  vpc_security_group_ids      = [module.security_groups_r2[0].app_sg_id]
  iam_instance_profile        = var.iam_instance_profile
  key_name                    = aws_key_pair.fleet_r2[0].key_name
  associate_public_ip_address = false # Elastic IP allocated separately

  user_data = templatefile("${path.root}/../../scripts/startup.sh", {
    ecr_image_url = "${module.ecr.repository_url}:${var.ecr_image_tag}"
  })

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "${local.name_prefix}-r2-${count.index}" }
}

resource "aws_lb" "fleet_r2" {
  count    = local.r2_enabled ? 1 : 0
  provider = aws.fleet_r2

  name               = "${local.name_prefix}-r2-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [module.security_groups_r2[0].alb_sg_id]
  subnets            = module.vpc_r2[0].public_subnet_ids

  tags = { Name = "${local.name_prefix}-r2-alb" }
}

resource "aws_lb_target_group" "fleet_r2" {
  count    = local.r2_enabled ? 1 : 0
  provider = aws.fleet_r2

  name        = "${local.name_prefix}-r2-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = module.vpc_r2[0].vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 5
  }
}

resource "aws_lb_listener" "http_fleet_r2" {
  count    = local.r2_enabled ? 1 : 0
  provider = aws.fleet_r2

  load_balancer_arn = aws_lb.fleet_r2[0].arn
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

resource "aws_lb_listener" "https_fleet_r2" {
  count    = local.r2_enabled ? 1 : 0
  provider = aws.fleet_r2

  load_balancer_arn = aws_lb.fleet_r2[0].arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = local.r2_acm_cert

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.fleet_r2[0].arn
  }
}

resource "aws_eip" "fleet_r2" {
  count    = local.r2_enabled ? local.r2_instance_count : 0
  provider = aws.fleet_r2
  domain   = "vpc"

  tags = { Name = "${local.name_prefix}-r2-eip-${count.index}" }
}

resource "aws_eip_association" "fleet_r2" {
  count    = local.r2_enabled ? local.r2_instance_count : 0
  provider = aws.fleet_r2

  instance_id   = aws_instance.fleet_r2[count.index].id
  allocation_id = aws_eip.fleet_r2[count.index].id
}

resource "aws_lb_target_group_attachment" "fleet_r2" {
  count    = local.r2_enabled ? local.r2_instance_count : 0
  provider = aws.fleet_r2

  target_group_arn = aws_lb_target_group.fleet_r2[0].arn
  target_id        = aws_instance.fleet_r2[count.index].private_ip
  port             = 3000
}

module "vpc_peering_r2" {
  count  = local.r2_enabled ? 1 : 0
  source = "../../modules/vpc-peering"
  providers = {
    aws.requester = aws
    aws.accepter  = aws.fleet_r2
  }

  requester_region          = local.primary.region
  requester_vpc_id          = module.vpc.vpc_id
  requester_route_table_ids = module.vpc.private_route_table_ids
  requester_cidr_block      = local.primary.vpc_cidr
  accepter_region           = local.r2_region
  accepter_vpc_id           = module.vpc_r2[0].vpc_id
  accepter_route_table_ids  = [module.vpc_r2[0].public_route_table_id]
  accepter_cidr_block       = local.r2_vpc_cidr
  tags                      = var.tags
}

# ─────────────────────────────────────────────
# Fleet — additional region 3
# ─────────────────────────────────────────────

module "vpc_r3" {
  count     = local.r3_enabled ? 1 : 0
  source    = "../../modules/vpc"
  providers = { aws = aws.fleet_r3 }

  create_vpc         = true
  vpc_cidr           = local.r3_vpc_cidr
  availability_zones = local.r3_azs
  name_prefix        = "${local.name_prefix}-r3"
  tags               = var.tags
}

module "security_groups_r3" {
  count     = local.r3_enabled ? 1 : 0
  source    = "../../modules/security-groups"
  providers = { aws = aws.fleet_r3 }

  name_prefix = "${local.name_prefix}-r3"
  vpc_id      = module.vpc_r3[0].vpc_id
  regions     = [for r in var.fleet_regions : r.region]
  tags        = var.tags
}

resource "aws_key_pair" "fleet_r3" {
  count    = local.r3_enabled ? 1 : 0
  provider = aws.fleet_r3

  key_name   = local.fleet_computed_key_name
  public_key = module.ec2_fleet[0].public_key_openssh

  depends_on = [module.ec2_fleet]
}

resource "aws_instance" "fleet_r3" {
  count    = local.r3_enabled ? local.r3_instance_count : 0
  provider = aws.fleet_r3

  ami                         = local.r3_ami_id
  instance_type               = var.instance_type
  subnet_id                   = module.vpc_r3[0].public_subnet_ids[count.index % length(module.vpc_r3[0].public_subnet_ids)]
  vpc_security_group_ids      = [module.security_groups_r3[0].app_sg_id]
  iam_instance_profile        = var.iam_instance_profile
  key_name                    = aws_key_pair.fleet_r3[0].key_name
  associate_public_ip_address = false # Elastic IP allocated separately

  user_data = templatefile("${path.root}/../../scripts/startup.sh", {
    ecr_image_url = "${module.ecr.repository_url}:${var.ecr_image_tag}"
  })

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "${local.name_prefix}-r3-${count.index}" }
}

resource "aws_lb" "fleet_r3" {
  count    = local.r3_enabled ? 1 : 0
  provider = aws.fleet_r3

  name               = "${local.name_prefix}-r3-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [module.security_groups_r3[0].alb_sg_id]
  subnets            = module.vpc_r3[0].public_subnet_ids

  tags = { Name = "${local.name_prefix}-r3-alb" }
}

resource "aws_lb_target_group" "fleet_r3" {
  count    = local.r3_enabled ? 1 : 0
  provider = aws.fleet_r3

  name        = "${local.name_prefix}-r3-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = module.vpc_r3[0].vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 5
  }
}

resource "aws_lb_listener" "http_fleet_r3" {
  count    = local.r3_enabled ? 1 : 0
  provider = aws.fleet_r3

  load_balancer_arn = aws_lb.fleet_r3[0].arn
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

resource "aws_lb_listener" "https_fleet_r3" {
  count    = local.r3_enabled ? 1 : 0
  provider = aws.fleet_r3

  load_balancer_arn = aws_lb.fleet_r3[0].arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = local.r3_acm_cert

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.fleet_r3[0].arn
  }
}

resource "aws_eip" "fleet_r3" {
  count    = local.r3_enabled ? local.r3_instance_count : 0
  provider = aws.fleet_r3
  domain   = "vpc"

  tags = { Name = "${local.name_prefix}-r3-eip-${count.index}" }
}

resource "aws_eip_association" "fleet_r3" {
  count    = local.r3_enabled ? local.r3_instance_count : 0
  provider = aws.fleet_r3

  instance_id   = aws_instance.fleet_r3[count.index].id
  allocation_id = aws_eip.fleet_r3[count.index].id
}

resource "aws_lb_target_group_attachment" "fleet_r3" {
  count    = local.r3_enabled ? local.r3_instance_count : 0
  provider = aws.fleet_r3

  target_group_arn = aws_lb_target_group.fleet_r3[0].arn
  target_id        = aws_instance.fleet_r3[count.index].private_ip
  port             = 3000
}

module "vpc_peering_r3" {
  count  = local.r3_enabled ? 1 : 0
  source = "../../modules/vpc-peering"
  providers = {
    aws.requester = aws
    aws.accepter  = aws.fleet_r3
  }

  requester_region          = local.primary.region
  requester_vpc_id          = module.vpc.vpc_id
  requester_route_table_ids = module.vpc.private_route_table_ids
  requester_cidr_block      = local.primary.vpc_cidr
  accepter_region           = local.r3_region
  accepter_vpc_id           = module.vpc_r3[0].vpc_id
  accepter_route_table_ids  = [module.vpc_r3[0].public_route_table_id]
  accepter_cidr_block       = local.r3_vpc_cidr
  tags                      = var.tags
}

# ─────────────────────────────────────────────
# Compute — single EC2 instance (deployment_mode = "single")
# ─────────────────────────────────────────────

module "ec2_single" {
  count  = var.deployment_mode == "single" ? 1 : 0
  source = "../../modules/ec2-single"

  name_prefix             = local.name_prefix
  ami_id                  = local.primary.ami_id
  instance_type           = var.instance_type
  subnet_id               = module.vpc.public_subnet_ids[0]
  security_group_ids      = [module.security_groups.app_sg_id]
  iam_instance_profile    = var.iam_instance_profile
  ecr_image_url           = "${module.ecr.repository_url}:${var.ecr_image_tag}"
  user_data_template_path = "${path.root}/../../scripts/startup.sh"
  tags                    = var.tags
}

# ─────────────────────────────────────────────
# Compute — fixed fleet behind ALB (deployment_mode = "fleet")
# Primary region: instances in public subnets, no NAT Gateway.
# ─────────────────────────────────────────────

module "ec2_fleet" {
  count  = var.deployment_mode == "fleet" ? 1 : 0
  source = "../../modules/ec2-fleet-fixed"

  name_prefix             = local.name_prefix
  primary_region          = local.primary.region
  instance_count_primary  = local.primary.instance_count
  ami_ids                 = { (local.primary.region) = local.primary.ami_id }
  instance_type           = var.instance_type
  vpc_id                  = module.vpc.vpc_id
  vpc_cidr_block          = local.primary.vpc_cidr
  public_subnet_ids       = module.vpc.public_subnet_ids
  app_sg_id               = module.security_groups.app_sg_id
  alb_sg_id               = module.security_groups.alb_sg_id
  iam_instance_profile    = var.iam_instance_profile
  ecr_image_url           = "${module.ecr.repository_url}:${var.ecr_image_tag}"
  user_data_template_path = "${path.root}/../../scripts/startup.sh"
  acm_certificate_arn     = local.primary.acm_certificate_arn
  key_pair_name           = var.fleet_key_pair_name
  tags                    = var.tags
}

# ─────────────────────────────────────────────
# Compute — ASG blue/green (deployment_mode = "asg-bluegreen")
# ─────────────────────────────────────────────

module "ec2_asg_bluegreen" {
  count  = var.deployment_mode == "asg-bluegreen" ? 1 : 0
  source = "../../modules/ec2-asg-bluegreen"

  name_prefix                  = local.name_prefix
  vpc_id                       = module.vpc.vpc_id
  public_subnet_ids            = module.vpc.public_subnet_ids
  private_subnet_ids           = module.vpc.private_subnet_ids
  alb_sg_id                    = module.security_groups.alb_sg_id
  app_sg_id                    = module.security_groups.app_sg_id
  ami_id                       = local.primary.ami_id
  instance_type                = var.instance_type
  iam_instance_profile         = var.iam_instance_profile
  ecr_repo_url                 = module.ecr.repository_url
  blue_ecr_tag                 = var.blue_ecr_tag
  green_ecr_tag                = var.green_ecr_tag
  blue_weight                  = var.blue_weight
  green_weight                 = var.green_weight
  acm_certificate_arn          = local.primary.acm_certificate_arn
  user_data_template_path      = "${path.root}/../../scripts/startup-asg.sh"
  health_check_min_healthy     = var.health_check_min_healthy
  health_check_timeout_seconds = var.health_check_timeout_seconds
  tags                         = var.tags
}

# ─────────────────────────────────────────────
# Global Accelerator (fleet mode only)
# One GA fronts all regional ALBs. Users are routed to the nearest healthy
# region over the AWS backbone; no per-region DNS changes required.
# ─────────────────────────────────────────────

module "global_accelerator" {
  count  = var.deployment_mode == "fleet" ? 1 : 0
  source = "../../modules/global-accelerator"

  name_prefix     = local.name_prefix
  primary_region  = local.primary.region
  primary_alb_arn = module.ec2_fleet[0].alb_arn

  # Build the additional-regions list from whichever ALBs actually exist.
  # for-expression naturally returns an empty list when count = 0.
  additional_endpoint_groups = concat(
    [for lb in aws_lb.fleet_r1 : { region = local.r1_region, alb_arn = lb.arn }],
    [for lb in aws_lb.fleet_r2 : { region = local.r2_region, alb_arn = lb.arn }],
    [for lb in aws_lb.fleet_r3 : { region = local.r3_region, alb_arn = lb.arn }],
  )

  tags = var.tags
}
