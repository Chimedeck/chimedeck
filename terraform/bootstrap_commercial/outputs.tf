output "state_bucket_name" {
  description = "Name of the S3 bucket that stores Terraform remote state. Paste into environment backend.tf."
  value       = aws_s3_bucket.state.bucket
}

output "state_bucket_arn" {
  description = "ARN of the state S3 bucket."
  value       = aws_s3_bucket.state.arn
}

