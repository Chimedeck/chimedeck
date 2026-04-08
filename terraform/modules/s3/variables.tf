variable "bucket_name" {
  description = "Globally unique name for the S3 bucket."
  type        = string
}

variable "versioning_enabled" {
  description = "Enable S3 object versioning. Recommended true for state buckets and assets that require rollback."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags merged onto every resource created by this module."
  type        = map(string)
  default     = {}
}
