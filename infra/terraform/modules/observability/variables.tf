variable "environment" {
  description = "Environment name (dev, staging, prod)."
  type        = string
}

variable "kms_key_arn" {
  description = "KMS key ARN for log-group + SNS encryption."
  type        = string
}

variable "tags" {
  description = "Tags applied to all taggable resources."
  type        = map(string)
  default     = {}
}
