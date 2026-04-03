# ── ECR Repository ───────────────────────────────────────────────────────────

resource "aws_ecr_repository" "this" {
  name                 = var.name
  image_tag_mutability = var.image_tag_mutability

  # Scan images on push so vulnerabilities are caught before deployment.
  image_scanning_configuration {
    scan_on_push = true
  }

  tags = var.tags
}

# ── Lifecycle Policy ──────────────────────────────────────────────────────────
# Retain only the last N tagged images to cap storage costs.
# Untagged images (e.g. intermediate CI layers) are expired after 1 day.

resource "aws_ecr_lifecycle_policy" "this" {
  repository = aws_ecr_repository.this.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep only the last ${var.keep_last_n_images} tagged images"
        selection = {
          tagStatus   = "tagged"
          tagPrefixList = [""]
          countType   = "imageCountMoreThan"
          countNumber = var.keep_last_n_images
        }
        action = { type = "expire" }
      },
    ]
  })
}
