variable "bucket_name" {
  description = "Name of the S3 bucket used to store Terraform remote state."
  type        = string
}

variable "region" {
  description = "AWS region in which the state infrastructure is created."
  type        = string
}

variable "tags" {
  description = "Additional tags to apply to all resources."
  type        = map(string)
  default     = {}
}
