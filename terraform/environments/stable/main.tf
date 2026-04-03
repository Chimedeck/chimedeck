provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.tags
  }
}

locals {
  name_prefix = "${var.app_name}-stable"
  # Resolve the correct AMI for the primary region.
  ami_id = var.ami_ids[var.aws_region]
}

# ─────────────────────────────────────────────
# Networking
# ─────────────────────────────────────────────

module "vpc" {
  source = "../../modules/vpc"

  create_vpc         = var.create_vpc
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  name_prefix        = local.name_prefix
  tags               = var.tags
}

# NAT Gateway is only needed for fleet and asg-bluegreen modes where instances
# run in private subnets but must reach the internet (ECR, Secrets Manager).
module "nat_gateway" {
  count  = var.deployment_mode != "single" ? 1 : 0
  source = "../../modules/nat-gateway"

  name_prefix             = local.name_prefix
  public_subnet_id        = module.vpc.public_subnet_ids[0]
  private_route_table_ids = module.vpc.private_route_table_ids
  tags                    = var.tags
}

# ─────────────────────────────────────────────
# ECR, S3, Security Groups (always created)
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
  tags        = var.tags
}

# ─────────────────────────────────────────────
# RDS PostgreSQL (always created)
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
# ElastiCache Redis (always created)
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
# Compute — single EC2 instance (deployment_mode = "single")
# ─────────────────────────────────────────────

module "ec2_single" {
  count  = var.deployment_mode == "single" ? 1 : 0
  source = "../../modules/ec2-single"

  name_prefix             = local.name_prefix
  ami_id                  = local.ami_id
  instance_type           = var.instance_type
  subnet_id               = module.vpc.public_subnet_ids[0]
  security_group_ids      = [module.security_groups.app_sg_id]
  iam_instance_profile    = var.iam_instance_profile
  secrets_arn             = var.secrets_arn
  ecr_image_url           = "${module.ecr.repository_url}:${var.ecr_image_tag}"
  user_data_template_path = "${path.root}/../../scripts/startup.sh"
  tags                    = var.tags
}

# ─────────────────────────────────────────────
# Compute — fixed fleet behind ALB (deployment_mode = "fleet")
# ─────────────────────────────────────────────

module "ec2_fleet" {
  count  = var.deployment_mode == "fleet" ? 1 : 0
  source = "../../modules/ec2-fleet-fixed"

  name_prefix             = local.name_prefix
  primary_region          = var.aws_region
  instance_count_primary  = var.instance_count
  ami_ids                 = var.ami_ids
  instance_type           = var.instance_type
  vpc_id                  = module.vpc.vpc_id
  vpc_cidr_block          = var.vpc_cidr
  private_subnet_ids      = module.vpc.private_subnet_ids
  public_subnet_ids       = module.vpc.public_subnet_ids
  private_route_table_ids = module.vpc.private_route_table_ids
  app_sg_id               = module.security_groups.app_sg_id
  alb_sg_id               = module.security_groups.alb_sg_id
  iam_instance_profile    = var.iam_instance_profile
  secrets_arn             = var.secrets_arn
  ecr_image_url           = "${module.ecr.repository_url}:${var.ecr_image_tag}"
  user_data_template_path = "${path.root}/../../scripts/startup.sh"
  acm_certificate_arn     = var.acm_certificate_arn
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
  ami_id                       = local.ami_id
  instance_type                = var.instance_type
  iam_instance_profile         = var.iam_instance_profile
  secrets_arn                  = var.secrets_arn
  ecr_repo_url                 = module.ecr.repository_url
  blue_ecr_tag                 = var.blue_ecr_tag
  green_ecr_tag                = var.green_ecr_tag
  blue_weight                  = var.blue_weight
  green_weight                 = var.green_weight
  acm_certificate_arn          = var.acm_certificate_arn
  user_data_template_path      = "${path.root}/../../scripts/startup.sh"
  health_check_min_healthy     = var.health_check_min_healthy
  health_check_timeout_seconds = var.health_check_timeout_seconds
  tags                         = var.tags
}
