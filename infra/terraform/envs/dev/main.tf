############################################
# envs/dev — composes all 5 modules for the dev environment.
############################################

provider "aws" {
  region = var.region

  default_tags {
    tags = local.tags
  }
}

locals {
  tags = {
    project     = "christina-crm"
    environment = var.environment
    managed_by  = "terraform"
    phase       = "0.2"
  }
}

############################################
# secrets — must exist before network flow-log CMK reference
############################################

module "secrets" {
  source = "../../modules/secrets"

  environment = var.environment
  tags        = local.tags
}

############################################
# network
############################################

module "network" {
  source = "../../modules/network"

  environment           = var.environment
  region                = var.region
  vpc_cidr              = var.vpc_cidr
  flow_logs_kms_key_arn = module.secrets.kms_key_app_arn
  tags                  = local.tags
}

############################################
# database
############################################

data "aws_subnet" "private_app" {
  for_each = toset(module.network.private_app_subnet_ids)
  id       = each.value
}

module "database" {
  source = "../../modules/database"

  environment              = var.environment
  vpc_id                   = module.network.vpc_id
  private_db_subnet_ids    = module.network.private_db_subnet_ids
  private_app_subnet_cidrs = [for s in data.aws_subnet.private_app : s.cidr_block]
  kms_key_arn              = module.secrets.kms_key_rds_arn
  instance_class           = var.db_instance_class
  storage_gb               = var.db_storage_gb
  max_storage_gb           = var.db_max_storage_gb
  multi_az                 = var.db_multi_az
  backup_retention_days    = var.db_backup_retention_days
  deletion_protection      = var.db_deletion_protection
  tags                     = local.tags
}

############################################
# observability
############################################

module "observability" {
  source = "../../modules/observability"

  environment = var.environment
  kms_key_arn = module.secrets.kms_key_app_arn
  tags        = local.tags
}

############################################
# iam — depends on every other module's outputs
############################################

module "iam" {
  source = "../../modules/iam"

  environment              = var.environment
  secret_arns              = module.secrets.secret_arns
  kms_key_arns             = module.secrets.kms_key_arns
  log_group_arns           = module.observability.log_group_arns
  db_instance_resource_id  = module.database.db_instance_resource_id
  github_oidc_provider_arn = var.github_oidc_provider_arn
  github_oidc_sub_claim    = var.github_oidc_sub_claim
  db_admin_principal_arns  = var.db_admin_principal_arns
  tags                     = local.tags
}
