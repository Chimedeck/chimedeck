variable "name" {
  description = "Name of the ECR repository."
  type        = string
}

variable "image_tag_mutability" {
  description = "Image tag mutability setting for the repository. Valid values: MUTABLE, IMMUTABLE."
  type        = string
  default     = "MUTABLE"
}

variable "keep_last_n_images" {
  description = "Number of tagged images to retain. Untagged images beyond this count are expired by the lifecycle policy."
  type        = number
  default     = 10
}

variable "tags" {
  description = "Tags merged onto every resource created by this module."
  type        = map(string)
  default     = {}
}
