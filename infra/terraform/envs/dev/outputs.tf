############################################
# Root outputs — re-exported from modules.
# Sensitive values (DB endpoint, username) remain marked sensitive.
############################################

output "vpc_id" {
  value = module.network.vpc_id
}

output "private_app_subnet_ids" {
  value = module.network.private_app_subnet_ids
}

output "private_db_subnet_ids" {
  value = module.network.private_db_subnet_ids
}

output "db_endpoint" {
  value     = module.database.db_endpoint
  sensitive = true
}

output "db_instance_id" {
  value = module.database.db_instance_id
}

output "app_log_group_name" {
  value = module.observability.app_log_group_name
}

output "api_log_group_name" {
  value = module.observability.api_log_group_name
}

output "phi_alarm_topic_arn" {
  value = module.observability.phi_alarm_topic_arn
}

output "kms_key_rds_arn" {
  value = module.secrets.kms_key_rds_arn
}

output "kms_key_app_arn" {
  value = module.secrets.kms_key_app_arn
}

output "kms_key_s3_arn" {
  value = module.secrets.kms_key_s3_arn
}

output "app_runtime_role_arn" {
  value = module.iam.app_runtime_role_arn
}

output "ci_deploy_role_arn" {
  value = module.iam.ci_deploy_role_arn
}

output "db_admin_role_arn" {
  value = module.iam.db_admin_role_arn
}
