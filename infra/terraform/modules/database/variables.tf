variable "environment" {
  description = "Environment name (dev, staging, prod)."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID."
  type        = string
}

variable "private_db_subnet_ids" {
  description = "Private DB subnet IDs (>= 2 AZs)."
  type        = list(string)
}

variable "private_app_subnet_cidrs" {
  description = "CIDR blocks of private app subnets allowed to reach Postgres:5432."
  type        = list(string)
}

variable "kms_key_arn" {
  description = "Customer KMS CMK ARN for storage + performance-insights encryption."
  type        = string
}

variable "engine_version" {
  description = "Postgres engine version."
  type        = string
  default     = "16.3"
}

variable "instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.medium"
}

variable "storage_gb" {
  description = "Initial allocated storage in GB."
  type        = number
  default     = 100
}

variable "max_storage_gb" {
  description = "Storage autoscaling ceiling in GB."
  type        = number
  default     = 500
}

variable "multi_az" {
  description = "Enable Multi-AZ. Off for dev."
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Automated backup retention (1-35)."
  type        = number
  default     = 7
}

variable "deletion_protection" {
  description = "Deletion protection flag."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags applied to all taggable resources."
  type        = map(string)
  default     = {}
}
