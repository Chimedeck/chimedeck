#!/usr/bin/env bash
# Runs inside LocalStack once S3 is ready.
# Creates all required buckets if they don't already exist.
set -euo pipefail

BUCKET="${S3_BUCKET:-kanban}"
REGION="${DEFAULT_REGION:-us-east-1}"

echo "[init] Ensuring S3 bucket '$BUCKET' exists…"
awslocal s3api head-bucket --bucket "$BUCKET" 2>/dev/null \
  || awslocal s3 mb "s3://${BUCKET}" --region "$REGION"

echo "[init] Applying CORS policy to '$BUCKET'…"
awslocal s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration '{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}'

echo "[init] Bucket '$BUCKET' is ready."
