output "db_instance_id" {
  description = "RDS instance identifier."
  value       = aws_db_instance.this.id
}

output "db_instance_arn" {
  description = "RDS instance ARN."
  value       = aws_db_instance.this.arn
}

output "db_instance_resource_id" {
  description = "RDS DbiResourceId (needed for rds-db:connect policies)."
  value       = aws_db_instance.this.resource_id
}

output "db_endpoint" {
  description = "RDS writer endpoint host:port."
  value       = aws_db_instance.this.endpoint
  sensitive   = true
}

output "db_address" {
  description = "RDS writer hostname."
  value       = aws_db_instance.this.address
  sensitive   = true
}

output "db_port" {
  description = "RDS port."
  value       = aws_db_instance.this.port
}

output "db_security_group_id" {
  description = "Security group protecting the RDS instance."
  value       = aws_security_group.db.id
}

output "db_username" {
  description = "Master username."
  value       = aws_db_instance.this.username
  sensitive   = true
}
