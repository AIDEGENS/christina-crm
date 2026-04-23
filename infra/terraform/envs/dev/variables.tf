variable "environment" {
  description = "Environment name."
  type        = string
  default     = "dev"
}

variable "region" {
  description = "AWS region."
  type        = string
  default     = "us-west-1"
}

variable "vpc_cidr" {
  description = "IPv4 CIDR for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

############################################
# database knobs
############################################

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.medium"
}

variable "db_storage_gb" {
  description = "Initial RDS storage in GB."
  type        = number
  default     = 100
}

variable "db_max_storage_gb" {
  description = "RDS storage autoscaling ceiling in GB."
  type        = number
  default     = 500
}

variable "db_multi_az" {
  description = "Enable Multi-AZ (off for dev, on for prod)."
  type        = bool
  default     = false
}

variable "db_backup_retention_days" {
  description = "Automated backup retention (dev = 7, prod = 30)."
  type        = number
  default     = 7
}

variable "db_deletion_protection" {
  description = "Deletion protection flag. Leave true unless explicitly tearing down."
  type        = bool
  default     = true
}

############################################
# iam knobs
############################################

variable "github_oidc_provider_arn" {
  description = "ARN of the existing GitHub Actions OIDC provider in this AWS account. Must be created out-of-band before ci_deploy role can assume."
  type        = string
}

variable "github_oidc_sub_claim" {
  description = "GitHub Actions sub-claim pattern."
  type        = string
  default     = "repo:AIDEGENS/christina-crm:*"
}

variable "db_admin_principal_arns" {
  description = "IAM principal ARNs allowed to assume the db-admin role (SSO group role ARNs or user ARNs)."
  type        = list(string)
  default     = []
}
