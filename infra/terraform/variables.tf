variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Environment name (e.g. prod, staging, dev)"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Project name prefix"
  type        = string
  default     = "campusfind"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "db_name" {
  description = "RDS PostgreSQL database name"
  type        = string
  default     = "campusfind"
}

variable "db_username" {
  description = "Master username for RDS PostgreSQL"
  type        = string
  default     = "campusfind_admin"
}

variable "db_password" {
  description = "Master password for RDS PostgreSQL"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "backend_image" {
  description = "ECR image URI for the backend service"
  type        = string
  default     = "public.ecr.aws/dummy/campusfind-backend:latest"
}

variable "frontend_image" {
  description = "ECR image URI for the frontend service"
  type        = string
  default     = "public.ecr.aws/dummy/campusfind-frontend:latest"
}

variable "backend_port" {
  description = "Port exposed by the backend container"
  type        = number
  default     = 4000
}

variable "frontend_port" {
  description = "Port exposed by the frontend container"
  type        = number
  default     = 80
}

variable "jwt_secret" {
  description = "JWT Secret for backend authentication"
  type        = string
  sensitive   = true
}

variable "cron_secret" {
  description = "Secret token for EventBridge scheduled job trigger"
  type        = string
  sensitive   = true
  default     = "campusfind-cloud-cron-secret-key"
}

