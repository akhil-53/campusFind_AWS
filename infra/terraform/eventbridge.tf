# IAM Role for EventBridge to invoke HTTP endpoints
resource "aws_iam_role" "eventbridge_invocation" {
  name = "${var.project_name}-eventbridge-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
    }]
  })
}

# EventBridge Connection (stores the authorization header securely)
resource "aws_cloudwatch_event_connection" "backend_job_auth" {
  name               = "${var.project_name}-job-connection"
  description        = "Authorization header for CampusFind Cloud Cron trigger"
  authorization_type = "API_KEY"

  auth_parameters {
    api_key {
      key   = "x-cron-secret"
      value = var.cron_secret
    }
  }
}

# EventBridge API Destination (points to backend /api/jobs/run on the ALB)
resource "aws_cloudwatch_event_api_destination" "run_jobs_api" {
  name                             = "${var.project_name}-run-jobs-api"
  description                      = "Invokes /api/jobs/run on CampusFind ALB"
  invocation_endpoint              = "http://${aws_lb.main.dns_name}/api/jobs/run"
  http_method                      = "POST"
  invocation_rate_limit_per_second = 1
  connection_arn                   = aws_cloudwatch_event_connection.backend_job_auth.arn
}

# CloudWatch Event Rule (runs every 5 minutes)
resource "aws_cloudwatch_event_rule" "every_5_minutes" {
  name                = "${var.project_name}-escalation-cron"
  description         = "Triggers sp_run_jobs() escalation and overdue processing every 5 minutes"
  schedule_expression = "rate(5 minutes)"
}

# Event Target linking rule to API destination
resource "aws_cloudwatch_event_target" "trigger_jobs" {
  rule     = aws_cloudwatch_event_rule.every_5_minutes.name
  arn      = aws_cloudwatch_event_api_destination.run_jobs_api.arn
  role_arn = aws_iam_role.eventbridge_invocation.arn
}

