output "alb_dns_name" {
  description = "Public URL of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "rds_endpoint" {
  description = "PostgreSQL RDS connection endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "s3_bucket_name" {
  description = "AWS S3 bucket name for item images"
  value       = aws_s3_bucket.item_images.bucket
}

output "ecs_cluster_name" {
  description = "ECS Fargate Cluster Name"
  value       = aws_ecs_cluster.main.name
}

output "backend_service_name" {
  description = "Backend ECS Service Name"
  value       = aws_ecs_service.backend.name
}

output "frontend_service_name" {
  description = "Frontend ECS Service Name"
  value       = aws_ecs_service.frontend.name
}

