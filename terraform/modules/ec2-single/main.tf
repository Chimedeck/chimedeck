# ── Elastic IP ────────────────────────────────────────────────────────────────

resource "aws_eip" "this" {
  domain = "vpc"

  tags = merge(
    { Name = "${var.name_prefix}-eip" },
    var.tags,
  )
}

# ── EC2 Instance ──────────────────────────────────────────────────────────────

resource "aws_instance" "this" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = var.security_group_ids
  iam_instance_profile   = var.iam_instance_profile

  # User data is rendered from the startup.sh template, injecting the ECR image
  # URL and Secrets Manager ARN so the instance can pull the image and load env
  # vars without storing any credentials in the AMI.
  user_data = templatefile(var.user_data_template_path, {
    ecr_image_url = var.ecr_image_url
    secrets_arn   = var.secrets_arn
  })

  # Replace the instance when user data changes (image tag or secrets ARN update).
  lifecycle {
    create_before_destroy = true
  }

  tags = merge(
    { Name = "${var.name_prefix}-ec2" },
    var.tags,
  )
}

# ── EIP Association ───────────────────────────────────────────────────────────

resource "aws_eip_association" "this" {
  instance_id   = aws_instance.this.id
  allocation_id = aws_eip.this.id
}
