variable "name_prefix" {
  description = "Name for the Global Accelerator resource (e.g. 'myapp-stable')."
  type        = string
}

variable "primary_region" {
  description = "AWS region of the primary ALB endpoint group."
  type        = string
}

variable "primary_alb_arn" {
  description = "ARN of the primary region ALB registered as the first endpoint group."
  type        = string
}

variable "additional_endpoint_groups" {
  description = <<-EOT
    Additional ALB endpoints in other fleet regions. Each entry:
      region  — AWS region name (e.g. "us-east-1")
      alb_arn — ARN of the ALB in that region
    Leave empty (default) for a single-region deployment.
  EOT
  type = list(object({
    region  = string
    alb_arn = string
  }))
  default = []
}

variable "tags" {
  description = "Tags applied to the Global Accelerator."
  type        = map(string)
  default     = {}
}
