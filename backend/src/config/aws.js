import { S3Client } from '@aws-sdk/client-s3';
import { RekognitionClient } from '@aws-sdk/client-rekognition';
import { TextractClient } from '@aws-sdk/client-textract';
import { SESClient } from '@aws-sdk/client-ses';
import { env } from './env.js';

const region = env.AWS_REGION || 'ap-south-1';

// Configure credentials only if explicitly set in environment;
// otherwise AWS SDK automatically resolves credentials from ECS Task Role, EC2 Metadata, or ~/.aws
const clientConfig = { region };
if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
  clientConfig.credentials = {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY
  };
}

export const s3 = env.AWS_S3_BUCKET ? new S3Client(clientConfig) : null;
export const rekognition = (env.AWS_ACCESS_KEY_ID || process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI || process.env.AWS_EXECUTION_ENV) ? new RekognitionClient(clientConfig) : null;
export const textract = (env.AWS_ACCESS_KEY_ID || process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI || process.env.AWS_EXECUTION_ENV) ? new TextractClient(clientConfig) : null;
export const ses = env.AWS_SES_FROM_EMAIL ? new SESClient(clientConfig) : null;

export const isAwsConfigured = {
  s3: Boolean(s3 && env.AWS_S3_BUCKET),
  rekognition: Boolean(rekognition),
  textract: Boolean(textract),
  ses: Boolean(ses)
};

