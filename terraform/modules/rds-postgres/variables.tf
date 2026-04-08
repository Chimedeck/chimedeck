variable "identifier" {
  description = "Unique identifier for the RDS instance."
  type        = string
}

variable "instance_class" {
  description = "RDS instance type."
  type        = string
  default     = "db.t3.micro"
}

variable "allocated_storage" {
  description = "Initial storage allocation in GiB."
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "Storage auto-scaling ceiling in GiB. Set to 0 to disable auto-scaling."
  type        = number
  default     = 100
}

variable "multi_az" {
  description = "Enable Multi-AZ standby for high availability."
  type        = bool
  default     = false
}

variable "db_name" {
  description = "Name of the initial database created on the instance."
  type        = string
}

variable "db_username" {
  description = "Master username for the RDS instance."
  type        = string
}

variable "db_password" {
  description = "Master password for the RDS instance. Use a Secrets Manager reference in production."
  type        = string
  sensitive   = true
}

variable "subnet_ids" {
  description = "List of private subnet IDs for the DB subnet group."
  type        = list(string)
}

variable "security_group_id" {
  description = "ID of the 'db' security group from the security-groups module."
  type        = string
}

variable "deletion_protection" {
  description = "Prevent accidental destroy of the RDS instance."
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Number of days to retain automated backups."
  type        = number
  default     = 7
}

variable "tags" {
  description = "Additional tags applied to every resource."
  type        = map(string)
  default     = {}
}
