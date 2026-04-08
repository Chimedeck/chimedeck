# ── S3 Bucket ─────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "this" {
  bucket = var.bucket_name

  tags = var.tags
}

# ── Block all public access (deny-first by default) ──────────────────────────

resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── Server-side encryption — SSE-S3 (AES256) ─────────────────────────────────
# Using AWS-managed keys (SSE-S3) avoids KMS cost for non-sensitive buckets
# while still encrypting data at rest. Switch to aws:kms for higher compliance.

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# ── Versioning ────────────────────────────────────────────────────────────────

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id

  versioning_configuration {
    status = var.versioning_enabled ? "Enabled" : "Suspended"
  }
}
