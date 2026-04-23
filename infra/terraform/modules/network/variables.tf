variable "environment" {
  description = "Environment name (dev, staging, prod)."
  type        = string
}

variable "region" {
  description = "AWS region."
  type        = string
}

variable "vpc_cidr" {
  description = "IPv4 CIDR for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "flow_logs_kms_key_arn" {
  description = "KMS key ARN used to encrypt the VPC flow-logs CloudWatch log group."
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags applied to all taggable resources."
  type        = map(string)
  default     = {}
}
