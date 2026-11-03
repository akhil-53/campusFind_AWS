# ECS Task Execution Role (ECR pull & CloudWatch logs)
resource "aws_iam_role" "ecs_execution_role" {
  name = "${var.project_name}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_policy" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ECS Task Role (Permissions used by application runtime: S3, Rekognition, Textract, SES)
resource "aws_iam_role" "ecs_task_role" {
  name = "${var.project_name}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_policy" "ecs_task_policy" {
  name        = "${var.project_name}-task-app-permissions"
  description = "Allows ECS backend task to use S3, Rekognition, Textract, and SES"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3ItemImagesAccess"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.item_images.arn,
          "${aws_s3_bucket.item_images.arn}/*"
        ]
      },
      {
        Sid    = "RekognitionDetectLabels"
        Effect = "Allow"
        Action = [
          "rekognition:DetectLabels"
        ]
        Resource = "*"
      },
      {
        Sid    = "TextractDetectText"
        Effect = "Allow"
        Action = [
          "textract:DetectDocumentText"
        ]
        Resource = "*"
      },
      {
        Sid    = "SESSendEmail"
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_app_permissions" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.ecs_task_policy.arn
}

