terraform {
  # Bootstrap uses a local backend — it manages its own state separately
  # so it can be applied once without requiring a pre-existing remote backend.
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

# ── S3 state bucket ──────────────────────────────────────────────────────────

resource "aws_s3_bucket" "state" {
  bucket = var.bucket_name

  # Prevent accidental deletion of the bucket that holds all Terraform state.
  lifecycle {
    prevent_destroy = true
  }

  tags = merge(
    { Name = var.bucket_name, ManagedBy = "terraform-bootstrap" },
    var.tags,
  )
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Prevent the bucket from being accidentally deleted when it still holds objects.
resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "expire-old-noncurrent-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      # Keep 90 days of history; older non-current versions are removed automatically.
      noncurrent_days = 90
    }
  }
}

# ── S3 native locking (Terraform >= 1.10) ────────────────────────────────────
# No DynamoDB table required — locking is handled via S3 conditional writes.
