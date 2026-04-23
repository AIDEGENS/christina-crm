############################################
# network module — VPC + subnets + NAT + flow logs
############################################

locals {
  azs = ["${var.region}a", "${var.region}c"] # us-west-1 has only 1a + 1c

  public_subnets = {
    "a" = { az = local.azs[0], cidr = cidrsubnet(var.vpc_cidr, 8, 0) }
    "c" = { az = local.azs[1], cidr = cidrsubnet(var.vpc_cidr, 8, 1) }
  }

  private_app_subnets = {
    "a" = { az = local.azs[0], cidr = cidrsubnet(var.vpc_cidr, 8, 10) }
    "c" = { az = local.azs[1], cidr = cidrsubnet(var.vpc_cidr, 8, 11) }
  }

  private_db_subnets = {
    "a" = { az = local.azs[0], cidr = cidrsubnet(var.vpc_cidr, 8, 20) }
    "c" = { az = local.azs[1], cidr = cidrsubnet(var.vpc_cidr, 8, 21) }
  }
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(var.tags, {
    Name = "christina-crm-${var.environment}-vpc"
  })
}

# Harden the default SG — deny all ingress and egress
resource "aws_default_security_group" "this" {
  vpc_id = aws_vpc.this.id

  # No ingress / egress rules — effectively deny-all.
  tags = merge(var.tags, {
    Name = "christina-crm-${var.environment}-default-sg-hardened"
  })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, {
    Name = "christina-crm-${var.environment}-igw"
  })
}

resource "aws_subnet" "public" {
  for_each = local.public_subnets

  vpc_id                  = aws_vpc.this.id
  cidr_block              = each.value.cidr
  availability_zone       = each.value.az
  map_public_ip_on_launch = false

  tags = merge(var.tags, {
    Name = "christina-crm-${var.environment}-public-${each.key}"
    Tier = "public"
  })
}

resource "aws_subnet" "private_app" {
  for_each = local.private_app_subnets

  vpc_id            = aws_vpc.this.id
  cidr_block        = each.value.cidr
  availability_zone = each.value.az

  tags = merge(var.tags, {
    Name = "christina-crm-${var.environment}-private-app-${each.key}"
    Tier = "private-app"
  })
}

resource "aws_subnet" "private_db" {
  for_each = local.private_db_subnets

  vpc_id            = aws_vpc.this.id
  cidr_block        = each.value.cidr
  availability_zone = each.value.az

  tags = merge(var.tags, {
    Name = "christina-crm-${var.environment}-private-db-${each.key}"
    Tier = "private-db"
  })
}

############################################
# NAT (single, dev posture) — in first public subnet
############################################

resource "aws_eip" "nat" {
  domain = "vpc"

  tags = merge(var.tags, {
    Name = "christina-crm-${var.environment}-nat-eip"
  })
}

resource "aws_nat_gateway" "this" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public["a"].id

  tags = merge(var.tags, {
    Name = "christina-crm-${var.environment}-nat"
  })

  depends_on = [aws_internet_gateway.this]
}

############################################
# Route tables
############################################

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = merge(var.tags, {
    Name = "christina-crm-${var.environment}-rt-public"
  })
}

resource "aws_route_table" "private_app" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this.id
  }

  tags = merge(var.tags, {
    Name = "christina-crm-${var.environment}-rt-private-app"
  })
}

resource "aws_route_table" "private_db" {
  vpc_id = aws_vpc.this.id

  # No default route — DB subnets have no outbound internet.
  tags = merge(var.tags, {
    Name = "christina-crm-${var.environment}-rt-private-db"
  })
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private_app" {
  for_each = aws_subnet.private_app

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private_app.id
}

resource "aws_route_table_association" "private_db" {
  for_each = aws_subnet.private_db

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private_db.id
}

############################################
# VPC Flow Logs → CloudWatch (90d retention)
############################################

resource "aws_cloudwatch_log_group" "flow_logs" {
  name              = "/christina-crm/${var.environment}/vpc-flow-logs"
  retention_in_days = 90
  kms_key_id        = var.flow_logs_kms_key_arn

  tags = var.tags
}

data "aws_iam_policy_document" "flow_logs_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["vpc-flow-logs.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "flow_logs" {
  name               = "christina-crm-${var.environment}-vpc-flow-logs"
  assume_role_policy = data.aws_iam_policy_document.flow_logs_assume.json

  tags = var.tags
}

data "aws_iam_policy_document" "flow_logs" {
  statement {
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams",
    ]
    resources = [
      aws_cloudwatch_log_group.flow_logs.arn,
      "${aws_cloudwatch_log_group.flow_logs.arn}:*",
    ]
  }
}

resource "aws_iam_role_policy" "flow_logs" {
  name   = "christina-crm-${var.environment}-vpc-flow-logs"
  role   = aws_iam_role.flow_logs.id
  policy = data.aws_iam_policy_document.flow_logs.json
}

resource "aws_flow_log" "this" {
  vpc_id          = aws_vpc.this.id
  traffic_type    = "ALL"
  log_destination = aws_cloudwatch_log_group.flow_logs.arn
  iam_role_arn    = aws_iam_role.flow_logs.arn

  tags = var.tags
}
