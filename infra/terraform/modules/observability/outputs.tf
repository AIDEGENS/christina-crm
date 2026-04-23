output "app_log_group_name" {
  description = "Application log group name."
  value       = aws_cloudwatch_log_group.this["app"].name
}

output "app_log_group_arn" {
  description = "Application log group ARN."
  value       = aws_cloudwatch_log_group.this["app"].arn
}

output "api_log_group_name" {
  description = "API log group name."
  value       = aws_cloudwatch_log_group.this["api"].name
}

output "api_log_group_arn" {
  description = "API log group ARN."
  value       = aws_cloudwatch_log_group.this["api"].arn
}

output "log_group_arns" {
  description = "All managed log group ARNs."
  value       = [for lg in aws_cloudwatch_log_group.this : lg.arn]
}

output "phi_alarm_topic_arn" {
  description = "SNS topic that receives PHI-leak alarms (no subscribers by default)."
  value       = aws_sns_topic.phi_alarm.arn
}
