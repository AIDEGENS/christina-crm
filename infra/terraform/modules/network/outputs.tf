output "vpc_id" {
  description = "VPC ID."
  value       = aws_vpc.this.id
}

output "vpc_cidr" {
  description = "VPC CIDR block."
  value       = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  description = "Public subnet IDs."
  value       = [for s in aws_subnet.public : s.id]
}

output "private_app_subnet_ids" {
  description = "Private application subnet IDs."
  value       = [for s in aws_subnet.private_app : s.id]
}

output "private_db_subnet_ids" {
  description = "Private database subnet IDs."
  value       = [for s in aws_subnet.private_db : s.id]
}

output "nat_gateway_id" {
  description = "NAT gateway ID."
  value       = aws_nat_gateway.this.id
}

output "flow_logs_log_group_name" {
  description = "CloudWatch log group for VPC flow logs."
  value       = aws_cloudwatch_log_group.flow_logs.name
}
