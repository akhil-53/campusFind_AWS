import { randomUUID } from 'crypto';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3, isAwsConfigured } from '../config/aws.js';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';

const SUPABASE_BUCKET = 'item-images';

/**
 * Upload an item image to AWS S3 (or Supabase Storage / base64 fallback)
 */
export async function uploadItemImage(foundId, file) {
  const extension = file.mimetype.split('/')[1] || 'jpg';
  const path = `${foundId}/${randomUUID()}.${extension}`;

  // 1. AWS S3 Storage (Primary Cloud Storage)
  if (isAwsConfigured.s3) {
    try {
      const command = new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: `items/${path}`,
        Body: file.buffer,
        ContentType: file.mimetype
      });
      await s3.send(command);
      return `s3://items/${path}`;
    } catch (err) {
      console.error('[Storage] AWS S3 upload failed:', err.message);
      throw err;
    }
  }

  // 2. Supabase Storage fallback
  if (supabase) {
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      console.error('[Storage] Supabase upload failed:', error.message);
      throw error;
    }
    return data.path;
  }

  // 3. Fallback for development if no cloud storage credentials configured
  const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
  return base64;
}

/**
 * Generate a pre-signed temporary URL for reading an image
 */
export async function getSignedImageUrl(storagePath, expiresIn = 3600) {
  if (!storagePath) return null;

  if (storagePath.startsWith('data:')) {
    return storagePath;
  }

  // 1. Handle AWS S3 storage path
  if (storagePath.startsWith('s3://') || (isAwsConfigured.s3 && !storagePath.startsWith('http'))) {
    try {
      const s3Key = storagePath.startsWith('s3://')
        ? storagePath.replace('s3://', '')
        : `items/${storagePath}`;

      const command = new GetObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: s3Key
      });

      return await getSignedUrl(s3, command, { expiresIn });
    } catch (err) {
      console.warn('[Storage] AWS S3 signed URL error:', err.message);
      return null;
    }
  }

  // 2. Supabase Storage
  if (supabase) {
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      console.warn('[Storage] Signed URL creation warning:', error.message);
      return null;
    }
    return data?.signedUrl || null;
  }

  return storagePath;
}
