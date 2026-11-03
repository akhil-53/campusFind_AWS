resource "random_string" "s3_suffix" {
  length  = 8
  special = false
  upper   = false
}

resource "aws_s3_bucket" "item_images" {
  bucket        = "${var.project_name}-item-images-${var.environment}-${random_string.s3_suffix.result}"
  force_destroy = false

  tags = {
    Name = "${var.project_name}-item-images"
  }
}

# Block all public access — images served via temporary pre-signed URLs only
resource "aws_s3_bucket_public_access_block" "item_images" {
  bucket = aws_s3_bucket.item_images.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Server-Side Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "item_images" {
  bucket = aws_s3_bucket.item_images.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# CORS Configuration for direct uploads & previews
resource "aws_s3_bucket_cors_configuration" "item_images" {
  bucket = aws_s3_bucket.item_images.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Lifecycle rules: Transition older item evidence to Glacier / clean up
resource "aws_s3_bucket_lifecycle_configuration" "item_images" {
  bucket = aws_s3_bucket.item_images.id

  rule {
    id     = "archive-old-items"
    status = "Enabled"

    filter {
      prefix = "items/"
    }

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 180
      storage_class = "GLACIER"
    }
  }
}

