############################################
# database module — RDS Postgres 16 + subnet group + SG + password
############################################

resource "aws_db_subnet_group" "this" {
  name       = "christina-crm-${var.environment}-db"
  subnet_ids = var.private_db_subnet_ids

  tags = merge(var.tags, {
    Name = "christina-crm-${var.environment}-db-subnet-group"
  })
}

resource "aws_security_group" "db" {
  name        = "christina-crm-${var.environment}-db"
  description = "RDS Postgres access from private app subnets only"
  vpc_id      = var.vpc_id

  ingress {
    description = "Postgres from private app subnets"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.private_app_subnet_cidrs
  }

  # No egress — RDS instances don't initiate outbound connections.

  tags = merge(var.tags, {
    Name = "christina-crm-${var.environment}-db-sg"
  })
}

resource "aws_db_parameter_group" "this" {
  name   = "christina-crm-${var.environment}-pg16"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_statement"
    value = "ddl"
  }

  tags = var.tags
}

############################################
# Password — generated, never stored in plain TF state
############################################

resource "random_password" "master" {
  length  = 32
  special = true
  # Postgres rejects these inside connection URLs; avoid them.
  override_special = "!#$%^&*()-_=+[]{}<>?"
}

############################################
# RDS instance
############################################

resource "aws_db_instance" "this" {
  identifier = "christina-crm-${var.environment}"

  engine               = "postgres"
  engine_version       = var.engine_version
  instance_class       = var.instance_class
  allocated_storage    = var.storage_gb
  max_allocated_storage = var.max_storage_gb
  storage_type         = "gp3"
  storage_encrypted    = true
  kms_key_id           = var.kms_key_arn

  db_name  = "christina_crm"
  username = "crm_admin"
  password = random_password.master.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.db.id]
  parameter_group_name   = aws_db_parameter_group.this.name
  publicly_accessible    = false

  multi_az                = var.multi_az
  backup_retention_period = var.backup_retention_days
  backup_window           = "07:00-08:00" # UTC, off-peak for us-west
  maintenance_window      = "Sun:09:00-Sun:10:00"
  deletion_protection     = var.deletion_protection
  skip_final_snapshot     = false
  final_snapshot_identifier = "christina-crm-${var.environment}-final-${formatdate("YYYYMMDDhhmm", timestamp())}"

  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  performance_insights_kms_key_id       = var.kms_key_arn

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  iam_database_authentication_enabled = true
  copy_tags_to_snapshot               = true

  tags = merge(var.tags, {
    Name = "christina-crm-${var.environment}-rds"
  })

  lifecycle {
    ignore_changes = [
      password,
      final_snapshot_identifier,
    ]
  }
}
