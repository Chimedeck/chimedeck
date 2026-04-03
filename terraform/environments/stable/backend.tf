# Backend configuration — two usage modes:
#
# 1. CI / blue-green deploy (deploy.stable.sh):
#    Leave bucket and region as empty strings below. They are injected at
#    runtime via -backend-config= flags in the deploy script using
#    $TF_STATE_BUCKET and $AWS_ECR_REGION environment variables.
#
# 2. One-off / manual apply (running terraform locally):
#    Fill in the YOUR_* placeholders with the real values from
#    terraform/bootstrap/ before running `terraform init`.
#    Do NOT commit this file after filling in real values.

terraform {
  required_version = ">= 1.10"

  backend "s3" {
    bucket       = "YOUR_TF_STATE_BUCKET"   # leave empty ("") for CI; fill in for manual runs
    key          = "environments/stable/terraform.tfstate"
    region       = "YOUR_STATE_BUCKET_REGION" # leave empty ("") for CI; fill in for manual runs
    use_lockfile = true
    encrypt      = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
