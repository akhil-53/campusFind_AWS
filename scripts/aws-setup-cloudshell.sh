#!/usr/bin/env bash
# ==============================================================================
# CampusFind - AWS Cloud Provisioning Script (Run inside AWS CloudShell)
# ==============================================================================
# This script sets up:
# 1. Amazon S3 Private Bucket with CORS & Encryption for item photos
# 2. Amazon ECR Repositories for Docker images
# 3. IAM Policy & Local Dev User with Rekognition, Textract & S3 permissions
# 4. Generates the exact AWS credentials to paste into backend/.env
# ==============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${GREEN}      CampusFind AWS CloudShell Setup Initializer    ${NC}"
echo -e "${BLUE}====================================================${NC}"

# Detect AWS Region or default to ap-south-1 (Mumbai)
AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-ap-south-1}}"
echo -e "${CYAN}Target AWS Region:${NC} ${AWS_REGION}"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${CYAN}AWS Account ID:${NC}    ${ACCOUNT_ID}"

RANDOM_SUFFIX=$(head /dev/urandom | tr -dc a-z0-9 | head -c 6)
BUCKET_NAME="campusfind-images-${ACCOUNT_ID}-${RANDOM_SUFFIX}"

echo -e "\n${YELLOW}[1/4] Creating Amazon S3 Bucket: ${BUCKET_NAME}...${NC}"

# Create S3 Bucket
if [ "$AWS_REGION" = "us-east-1" ]; then
  aws s3api create-bucket --bucket "${BUCKET_NAME}" --region "${AWS_REGION}" > /dev/null
else
  aws s3api create-bucket \
    --bucket "${BUCKET_NAME}" \
    --region "${AWS_REGION}" \
    --create-bucket-configuration LocationConstraint="${AWS_REGION}" > /dev/null
fi

# Block Public Access (Keep files private, accessed only via backend presigned URLs)
aws s3api put-public-access-block \
  --bucket "${BUCKET_NAME}" \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Server-Side Encryption (AES256)
aws s3api put-bucket-encryption \
  --bucket "${BUCKET_NAME}" \
  --server-side-encryption-configuration '{"Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]}'

# Configure CORS for uploads and previews
aws s3api put-bucket-cors \
  --bucket "${BUCKET_NAME}" \
  --cors-configuration '{"CORSRules": [{"AllowedHeaders": ["*"], "AllowedMethods": ["GET", "PUT", "POST", "HEAD"], "AllowedOrigins": ["*"], "ExposeHeaders": ["ETag"], "MaxAgeSeconds": 3000}]}'

echo -e "${GREEN}✓ S3 Bucket created and secured: ${BUCKET_NAME}${NC}"

# --- 2. Amazon ECR Repositories ---
echo -e "\n${YELLOW}[2/4] Setting up Amazon ECR Repositories...${NC}"
aws ecr create-repository --repository-name campusfind-backend --region "${AWS_REGION}" > /dev/null 2>&1 || echo "ECR repo campusfind-backend already exists."
aws ecr create-repository --repository-name campusfind-frontend --region "${AWS_REGION}" > /dev/null 2>&1 || echo "ECR repo campusfind-frontend already exists."
echo -e "${GREEN}✓ Amazon ECR Repositories ready.${NC}"

# --- 3. IAM User & Policy for Rekognition, Textract & S3 ---
echo -e "\n${YELLOW}[3/4] Creating IAM Permissions for AI (Rekognition & Textract) and S3...${NC}"
IAM_USER_NAME="campusfind-app-user"
POLICY_NAME="CampusFindAppAccessPolicy"

POLICY_DOC=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3Access",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::${BUCKET_NAME}",
        "arn:aws:s3:::${BUCKET_NAME}/*"
      ]
    },
    {
      "Sid": "RekognitionAccess",
      "Effect": "Allow",
      "Action": [
        "rekognition:DetectLabels"
      ],
      "Resource": "*"
    },
    {
      "Sid": "TextractAccess",
      "Effect": "Allow",
      "Action": [
        "textract:DetectDocumentText"
      ],
      "Resource": "*"
    }
  ]
}
EOF
)

# Create policy or update it
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"
aws iam create-policy --policy-name "${POLICY_NAME}" --policy-document "${POLICY_DOC}" > /dev/null 2>&1 || \
  aws iam create-policy-version --policy-arn "${POLICY_ARN}" --policy-document "${POLICY_DOC}" --set-as-default > /dev/null 2>&1 || true

# Create IAM user if not exists
aws iam create-user --user-name "${IAM_USER_NAME}" > /dev/null 2>&1 || true

# Attach policy to user
aws iam attach-user-policy --user-name "${IAM_USER_NAME}" --policy-arn "${POLICY_ARN}"

# Generate new Access Keys
echo -e "\n${YELLOW}[4/4] Generating AWS Access Keys for Local Development...${NC}"
KEY_OUTPUT=$(aws iam create-access-key --user-name "${IAM_USER_NAME}" --output json)
ACCESS_KEY_ID=$(echo "${KEY_OUTPUT}" | grep -o '"AccessKeyId": "[^"]*' | cut -d'"' -f4)
SECRET_ACCESS_KEY=$(echo "${KEY_OUTPUT}" | grep -o '"SecretAccessKey": "[^"]*' | cut -d'"' -f4)

echo -e "\n${GREEN}====================================================================${NC}"
echo -e "${GREEN} 🎉 AWS SETUP COMPLETE! COPY THE FOLLOWING INTO YOUR backend/.env: ${NC}"
echo -e "${GREEN}====================================================================${NC}"

cat <<EOF

# --- Paste into backend/.env ---
AWS_REGION=${AWS_REGION}
AWS_S3_BUCKET=${BUCKET_NAME}
AWS_ACCESS_KEY_ID=${ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${SECRET_ACCESS_KEY}
CRON_SECRET=campusfind-cloud-cron-secret-key

EOF

echo -e "${GREEN}====================================================================${NC}"
echo -e "${CYAN}ECR Registry URI:${NC} ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
echo -e "${CYAN}S3 Bucket:${NC}        ${BUCKET_NAME}"
echo -e "${GREEN}====================================================================${NC}\n"

