variable "environment" {
  description = "Environment name (dev, staging, prod)."
  type        = string
}

variable "tags" {
  description = "Tags applied to all taggable resources."
  type        = map(string)
  default     = {}
}
