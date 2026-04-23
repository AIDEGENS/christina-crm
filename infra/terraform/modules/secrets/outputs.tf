output "kms_key_rds_arn" {
  description = "KMS CMK ARN for RDS encryption."
  value       = aws_kms_key.rds.arn
}

output "kms_key_app_arn" {
  description = "KMS CMK ARN for app / Secrets Manager encryption."
  value       = aws_kms_key.app.arn
}

output "kms_key_s3_arn" {
  description = "KMS CMK ARN for S3 encryption."
  value       = aws_kms_key.s3.arn
}

output "kms_key_arns" {
  description = "All KMS CMK ARNs."
  value = [
    aws_kms_key.rds.arn,
    aws_kms_key.app.arn,
    aws_kms_key.s3.arn,
  ]
}

output "secret_arns" {
  description = "All Secrets Manager secret ARNs."
  value       = [for s in aws_secretsmanager_secret.this : s.arn]
}

output "secret_arn_map" {
  description = "Secrets Manager ARNs keyed by logical name."
  value       = { for k, s in aws_secretsmanager_secret.this : k => s.arn }
}
