
# ── EC2 Instance ──────────────────────────────────────────────────────────────

resource "aws_instance" "this" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = var.security_group_ids
  iam_instance_profile   = var.iam_instance_profile

  # User data is rendered from the startup.sh template, injecting the ECR image
  # URL. Env vars are baked into the Docker image by the build script.
  user_data = templatefile(var.user_data_template_path, {
    ecr_image_url = var.ecr_image_url
  })

  # Replace the instance when user data changes (image tag update).
  lifecycle {
    create_before_destroy = true
  }

  tags = merge(
    { Name = "${var.name_prefix}-ec2" },
    var.tags,
  )
}

