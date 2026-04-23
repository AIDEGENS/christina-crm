############################################
# observability module — CloudWatch log groups + PHI-leak alarm
############################################

locals {
  log_group_names = {
    app = "/christina-crm/${var.environment}/app"
    api = "/christina-crm/${var.environment}/api"
  }
}

resource "aws_cloudwatch_log_group" "this" {
  for_each = local.log_group_names

  name              = each.value
  retention_in_days = 90
  kms_key_id        = var.kms_key_arn

  tags = merge(var.tags, {
    Name = "christina-crm-${var.environment}-${each.key}-logs"
  })
}

############################################
# PHI-leak canary: SSN regex metric filter + alarm
############################################

resource "aws_cloudwatch_log_metric_filter" "phi_leak" {
  name           = "christina-crm-${var.environment}-phi-leak-ssn"
  log_group_name = aws_cloudwatch_log_group.this["app"].name

  # CloudWatch Logs pattern — matches 3-2-4 digit groups (SSN shape)
  pattern = "%[0-9]{3}-[0-9]{2}-[0-9]{4}%"

  metric_transformation {
    name          = "PHI_LEAK_COUNT"
    namespace     = "ChristinaCRM/${var.environment}/PHI"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_sns_topic" "phi_alarm" {
  name              = "christina-crm-${var.environment}-phi-alarm"
  kms_master_key_id = var.kms_key_arn

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "phi_leak" {
  alarm_name          = "christina-crm-${var.environment}-phi-leak"
  alarm_description   = "Fires when SSN-shaped data is detected in app logs. Investigate immediately."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "PHI_LEAK_COUNT"
  namespace           = "ChristinaCRM/${var.environment}/PHI"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.phi_alarm.arn]

  tags = var.tags
}
