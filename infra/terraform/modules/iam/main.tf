############################################
# iam module — app-runtime, ci-deploy, db-admin roles
############################################

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}
data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  partition  = data.aws_partition.current.partition
  region     = data.aws_region.current.name
  name       = "christina-crm-${var.environment}"
}

############################################
# app-runtime role — assumed by EC2, Lambda, Fargate tasks
############################################

data "aws_iam_policy_document" "app_runtime_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type = "Service"
      identifiers = [
        "ec2.amazonaws.com",
        "lambda.amazonaws.com",
        "ecs-tasks.amazonaws.com",
      ]
    }
  }
}

resource "aws_iam_role" "app_runtime" {
  name               = "${local.name}-app-runtime"
  assume_role_policy = data.aws_iam_policy_document.app_runtime_assume.json

  tags = var.tags
}

data "aws_iam_policy_document" "app_runtime" {
  # Secrets Manager — read the 5 placeholder secrets only
  statement {
    sid       = "SecretsReadScoped"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
    resources = var.secret_arns
  }

  # KMS — decrypt via the 3 app-managed CMKs only
  statement {
    sid       = "KmsDecryptScoped"
    effect    = "Allow"
    actions   = ["kms:Decrypt", "kms:GenerateDataKey"]
    resources = var.kms_key_arns
  }

  # CloudWatch Logs — write only to the two app/api groups
  statement {
    sid    = "CloudWatchLogsWriteScoped"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogStreams",
    ]
    resources = [for arn in var.log_group_arns : "${arn}:*"]
  }

  # RDS IAM auth — connect as app_user only
  statement {
    sid    = "RdsIamConnectScoped"
    effect = "Allow"
    actions = ["rds-db:connect"]
    resources = [
      "arn:${local.partition}:rds-db:${local.region}:${local.account_id}:dbuser:${var.db_instance_resource_id}/app_user",
    ]
  }
}

resource "aws_iam_role_policy" "app_runtime" {
  name   = "${local.name}-app-runtime"
  role   = aws_iam_role.app_runtime.id
  policy = data.aws_iam_policy_document.app_runtime.json
}

############################################
# ci-deploy role — GitHub Actions OIDC federation
############################################

data "aws_iam_policy_document" "ci_deploy_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [var.github_oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [var.github_oidc_sub_claim]
    }
  }
}

resource "aws_iam_role" "ci_deploy" {
  name               = "${local.name}-ci-deploy"
  assume_role_policy = data.aws_iam_policy_document.ci_deploy_assume.json

  tags = var.tags
}

data "aws_iam_policy_document" "ci_deploy" {
  # ECR push — scoped to christina-crm repos only
  statement {
    sid    = "EcrAuthToken"
    effect = "Allow"
    actions = ["ecr:GetAuthorizationToken"]
    # GetAuthorizationToken is account-wide by AWS design; no resource narrowing possible.
    resources = ["*"]
  }

  statement {
    sid    = "EcrPushScoped"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
      "ecr:DescribeRepositories",
      "ecr:DescribeImages",
    ]
    resources = [
      "arn:${local.partition}:ecr:${local.region}:${local.account_id}:repository/christina-crm-${var.environment}-*",
    ]
  }

  # ECS service update — scoped to christina-crm cluster + services
  statement {
    sid    = "EcsDeployScoped"
    effect = "Allow"
    actions = [
      "ecs:UpdateService",
      "ecs:DescribeServices",
      "ecs:DescribeTaskDefinition",
      "ecs:RegisterTaskDefinition",
      "ecs:ListTasks",
      "ecs:DescribeTasks",
    ]
    resources = [
      "arn:${local.partition}:ecs:${local.region}:${local.account_id}:cluster/christina-crm-${var.environment}",
      "arn:${local.partition}:ecs:${local.region}:${local.account_id}:service/christina-crm-${var.environment}/*",
      "arn:${local.partition}:ecs:${local.region}:${local.account_id}:task-definition/christina-crm-${var.environment}-*:*",
    ]
  }

  # PassRole limited to the app-runtime role only
  statement {
    sid    = "PassRoleScoped"
    effect = "Allow"
    actions = ["iam:PassRole"]
    resources = [aws_iam_role.app_runtime.arn]
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }

  # CloudWatch metrics — PutMetricData scoped via namespace condition
  statement {
    sid    = "CloudWatchPutMetricsScoped"
    effect = "Allow"
    actions = ["cloudwatch:PutMetricData"]
    resources = ["*"] # PutMetricData doesn't support resource-level scoping
    condition {
      test     = "StringEquals"
      variable = "cloudwatch:namespace"
      values   = ["ChristinaCRM/${var.environment}"]
    }
  }

  # Explicit denials — guardrails against privilege creep
  statement {
    sid    = "ExplicitDenyIamMutation"
    effect = "Deny"
    actions = [
      "iam:CreateUser",
      "iam:DeleteUser",
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:AttachRolePolicy",
      "iam:PutRolePolicy",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "ExplicitDenyDestructiveDbKms"
    effect = "Deny"
    actions = [
      "rds:DeleteDBInstance",
      "rds:DeleteDBCluster",
      "rds:DeleteDBSnapshot",
      "kms:ScheduleKeyDeletion",
      "kms:DisableKey",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "ci_deploy" {
  name   = "${local.name}-ci-deploy"
  role   = aws_iam_role.ci_deploy.id
  policy = data.aws_iam_policy_document.ci_deploy.json
}

############################################
# db-admin role — humans only via SSO
############################################

data "aws_iam_policy_document" "db_admin_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "AWS"
      identifiers = var.db_admin_principal_arns
    }

    # Require MFA for human role assumption.
    condition {
      test     = "Bool"
      variable = "aws:MultiFactorAuthPresent"
      values   = ["true"]
    }
  }
}

resource "aws_iam_role" "db_admin" {
  name               = "${local.name}-db-admin"
  assume_role_policy = data.aws_iam_policy_document.db_admin_assume.json

  tags = var.tags
}

data "aws_iam_policy_document" "db_admin" {
  statement {
    sid    = "RdsIamConnectAdminScoped"
    effect = "Allow"
    actions = ["rds-db:connect"]
    resources = [
      "arn:${local.partition}:rds-db:${local.region}:${local.account_id}:dbuser:${var.db_instance_resource_id}/db_admin",
    ]
  }

  statement {
    sid    = "RdsDescribeScoped"
    effect = "Allow"
    actions = [
      "rds:DescribeDBInstances",
      "rds:DescribeDBClusters",
      "rds:DescribeDBSnapshots",
      "rds:DescribeDBParameterGroups",
    ]
    resources = [
      "arn:${local.partition}:rds:${local.region}:${local.account_id}:db:christina-crm-${var.environment}",
      "arn:${local.partition}:rds:${local.region}:${local.account_id}:snapshot:*christina-crm-${var.environment}*",
      "arn:${local.partition}:rds:${local.region}:${local.account_id}:pg:christina-crm-${var.environment}-*",
    ]
  }

  statement {
    sid    = "CloudWatchReadScoped"
    effect = "Allow"
    actions = [
      "cloudwatch:GetMetricData",
      "cloudwatch:GetMetricStatistics",
      "cloudwatch:ListMetrics",
      "logs:GetLogEvents",
      "logs:FilterLogEvents",
      "logs:DescribeLogStreams",
    ]
    resources = [
      "arn:${local.partition}:logs:${local.region}:${local.account_id}:log-group:/christina-crm/${var.environment}/*",
      "arn:${local.partition}:logs:${local.region}:${local.account_id}:log-group:/christina-crm/${var.environment}/*:log-stream:*",
    ]
  }
}

resource "aws_iam_role_policy" "db_admin" {
  name   = "${local.name}-db-admin"
  role   = aws_iam_role.db_admin.id
  policy = data.aws_iam_policy_document.db_admin.json
}
