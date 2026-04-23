variable "environment" {
  description = "Environment name (dev, staging, prod)."
  type        = string
}

variable "secret_arns" {
  description = "Secrets Manager ARNs the app-runtime role may read."
  type        = list(string)
}

variable "kms_key_arns" {
  description = "KMS CMK ARNs the app-runtime role may decrypt with."
  type        = list(string)
}

variable "log_group_arns" {
  description = "CloudWatch log group ARNs the app-runtime role may write to."
  type        = list(string)
}

variable "db_instance_resource_id" {
  description = "RDS DbiResourceId — used to scope rds-db:connect."
  type        = string
}

variable "github_oidc_provider_arn" {
  description = "ARN of the GitHub Actions OIDC provider in this account."
  type        = string
}

variable "github_oidc_sub_claim" {
  description = "Sub-claim pattern GitHub Actions must match (e.g. repo:AIDEGENS/christina-crm:*)."
  type        = string
  default     = "repo:AIDEGENS/christina-crm:*"
}

variable "db_admin_principal_arns" {
  description = "IAM principal ARNs (SSO group roles or user ARNs) allowed to assume the db-admin role."
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags applied to all taggable resources."
  type        = map(string)
  default     = {}
}
