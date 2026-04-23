output "app_runtime_role_arn" {
  description = "ARN of the application runtime role."
  value       = aws_iam_role.app_runtime.arn
}

output "app_runtime_role_name" {
  description = "Name of the application runtime role."
  value       = aws_iam_role.app_runtime.name
}

output "ci_deploy_role_arn" {
  description = "ARN of the CI deploy role (GitHub Actions OIDC)."
  value       = aws_iam_role.ci_deploy.arn
}

output "db_admin_role_arn" {
  description = "ARN of the human db-admin role."
  value       = aws_iam_role.db_admin.arn
}
