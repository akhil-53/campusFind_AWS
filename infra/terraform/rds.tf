resource "aws_db_subnet_group" "rds" {
  name        = "${var.project_name}-db-subnet-group"
  subnet_ids  = aws_subnet.private[*].id
  description = "Private DB subnet group for RDS PostgreSQL"

  tags = {
    Name = "${var.project_name}-db-subnet-group"
  }
}

resource "aws_db_parameter_group" "postgres16" {
  name        = "${var.project_name}-pg16-params"
  family      = "postgres16"
  description = "Custom parameter group for CampusFind PostgreSQL 16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  tags = {
    Name = "${var.project_name}-pg16-params"
  }
}

resource "aws_db_instance" "postgres" {
  identifier             = "${var.project_name}-postgres-${var.environment}"
  engine                 = "postgres"
  engine_version         = "16.3"
  instance_class         = var.db_instance_class
  allocated_storage      = 20
  max_allocated_storage  = 100
  storage_type           = "gp3"
  storage_encrypted      = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.rds.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.postgres16.name

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Sun:04:30-Sun:05:30"

  auto_minor_version_upgrade = true
  publicly_accessible        = false
  skip_final_snapshot        = var.environment == "prod" ? false : true
  final_snapshot_identifier  = "${var.project_name}-postgres-final-snapshot"

  deletion_protection = var.environment == "prod" ? true : false

  tags = {
    Name = "${var.project_name}-postgres"
  }
}

