output "bucket_name" {
  description = "Name of the S3 bucket."
  value       = aws_s3_bucket.this.id
}

output "bucket_arn" {
  description = "ARN of the S3 bucket."
  value       = aws_s3_bucket.this.arn
}

output "bucket_region" {
  description = "AWS region the bucket was created in."
  value       = aws_s3_bucket.this.region
}
