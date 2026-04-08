# ── DB Subnet Group ───────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "this" {
  name        = var.identifier
  subnet_ids  = var.subnet_ids
  description = "Subnet group for RDS instance ${var.identifier}"

  tags = merge(
    { Name = var.identifier },
    var.tags,
  )
}

# ── Parameter Group — PostgreSQL 16 with pg_cron ─────────────────────────────
# pg_cron must be listed in shared_preload_libraries and requires a reboot.
# cron.database_name tells pg_cron which database to use for its metadata.

resource "aws_db_parameter_group" "this" {
  name        = "${var.identifier}-pg16"
  family      = "postgres16"
  description = "PostgreSQL 16 with pg_cron enabled"

  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_cron"
    apply_method = "pending-reboot"
  }

  parameter {
    name         = "cron.database_name"
    value        = var.db_name
    apply_method = "pending-reboot"
  }

  tags = merge(
    { Name = "${var.identifier}-pg16" },
    var.tags,
  )
}

# ── RDS PostgreSQL 16 Instance ────────────────────────────────────────────────

resource "aws_db_instance" "this" {
  identifier        = var.identifier
  engine            = "postgres"
  engine_version    = "16"
  instance_class    = var.instance_class
  allocated_storage = var.allocated_storage

  # max_allocated_storage = 0 disables storage auto-scaling; any positive value
  # enables it with the given GiB ceiling.
  max_allocated_storage = var.max_allocated_storage > 0 ? var.max_allocated_storage : null

  multi_az = var.multi_az

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [var.security_group_id]
  parameter_group_name   = aws_db_parameter_group.this.name

  deletion_protection     = var.deletion_protection
  backup_retention_period = var.backup_retention_days

  # Skip final snapshot when deletion_protection is off (dev/test teardowns).
  skip_final_snapshot = !var.deletion_protection

  storage_encrypted = true
  storage_type      = "gp3"

  tags = merge(
    { Name = var.identifier },
    var.tags,
  )
}
