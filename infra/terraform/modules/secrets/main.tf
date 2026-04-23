############################################
# secrets module — KMS CMKs + Secrets Manager placeholders
############################################

data "aws_caller_identity" "current" {}

############################################
# KMS CMKs (RDS, app, S3) — annual auto-rotate
############################################

data "aws_iam_policy_document" "cmk_default" {
  statement {
    sid       = "EnableRootIAMPermissions"
    effect    = "Allow"
    actions   = ["kms:*"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }
}

resource "aws_kms_key" "rds" {
  description             = "christina-crm-${var.environment} — RDS encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.cmk_default.json

  tags = merge(var.tags, { Name = "christina-crm-${var.environment}-rds" })
}

resource "aws_kms_alias" "rds" {
  name          = "alias/christina-crm-${var.environment}-rds"
  target_key_id = aws_kms_key.rds.key_id
}

resource "aws_kms_key" "app" {
  description             = "christina-crm-${var.environment} — app + Secrets Manager encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.cmk_default.json

  tags = merge(var.tags, { Name = "christina-crm-${var.environment}-app" })
}

resource "aws_kms_alias" "app" {
  name          = "alias/christina-crm-${var.environment}-app"
  target_key_id = aws_kms_key.app.key_id
}

resource "aws_kms_key" "s3" {
  description             = "christina-crm-${var.environment} — S3 encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.cmk_default.json

  tags = merge(var.tags, { Name = "christina-crm-${var.environment}-s3" })
}

resource "aws_kms_alias" "s3" {
  name          = "alias/christina-crm-${var.environment}-s3"
  target_key_id = aws_kms_key.s3.key_id
}

############################################
# Secrets Manager placeholders
############################################

locals {
  placeholder = "PLACEHOLDER_REPLACE_ME"

  secret_names = {
    database_url         = "christina-crm/${var.environment}/DATABASE_URL"
    workos_api_key       = "christina-crm/${var.environment}/WORKOS_API_KEY"
    workos_client_id     = "christina-crm/${var.environment}/WORKOS_CLIENT_ID"
    workos_webhook_secret = "christina-crm/${var.environment}/WORKOS_WEBHOOK_SECRET"
    doppler_token        = "christina-crm/${var.environment}/DOPPLER_TOKEN"
  }
}

resource "aws_secretsmanager_secret" "this" {
  for_each = local.secret_names

  name        = each.value
  description = "christina-crm ${var.environment} — ${each.key}"
  kms_key_id  = aws_kms_key.app.arn

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "this" {
  for_each = aws_secretsmanager_secret.this

  secret_id     = each.value.id
  secret_string = local.placeholder

  lifecycle {
    ignore_changes = [secret_string] # real values rotate out-of-band
  }
}
