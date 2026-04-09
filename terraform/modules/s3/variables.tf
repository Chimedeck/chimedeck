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

variable "cors_allowed_origins" {
  description = "Allowed origins for browser access to this bucket. Empty disables bucket CORS configuration."
  type        = list(string)
  default     = []
}

variable "cors_allowed_methods" {
  description = "Allowed methods for bucket CORS rules used by browser uploads and reads."
  type        = list(string)
  default     = ["GET", "HEAD", "PUT"]
}

variable "cors_allowed_headers" {
  description = "Allowed request headers for bucket CORS preflight checks."
  type        = list(string)
  default     = ["*"]
}

variable "cors_expose_headers" {
  description = "Response headers exposed to browser JavaScript. ETag is required for multipart upload completion."
  type        = list(string)
  default     = ["ETag", "x-amz-request-id", "x-amz-id-2"]
}

variable "cors_max_age_seconds" {
  description = "How long browsers cache successful preflight responses."
  type        = number
  default     = 3000
}
