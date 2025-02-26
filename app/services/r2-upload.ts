import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export class R2UploadService {
  private s3Client: S3Client;
  private bucketName: string;
  private uploadDomain: string;

  constructor() {
    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      throw new Error('Cloudflare R2 credentials are not fully configured');
    }

    this.bucketName = process.env.R2_BUCKET_NAME || 'default-bucket';
    this.uploadDomain = process.env.R2_UPLOAD_DOMAIN || 'https://files.merakiweddingplanner.com';
    
    this.s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
      }
    });
  }

  async uploadFile(file: Buffer, originalFilename: string, contentType: string): Promise<string> {
    // Generate a unique filename with timestamp
    const timestamp = Date.now();
    const fileExtension = path.extname(originalFilename);
    const sanitizedFilename = this.sanitizeFilename(originalFilename);
    const uniqueFilename = `${timestamp}-${sanitizedFilename}${fileExtension}`;

    // Construct the upload path (portfolio folder)
    const uploadPath = `portfolio/${uniqueFilename}`;

    try {
      const uploadParams = {
        Bucket: this.bucketName,
        Key: uploadPath,
        Body: file,
        ContentType: contentType
      };

      await this.s3Client.send(new PutObjectCommand(uploadParams));

      // Construct and return the full URL
      return `${this.uploadDomain}/${uploadPath}`;
    } catch (error) {
      console.error('R2 Upload Error:', error);
      throw new Error('Failed to upload file to R2');
    }
  }

  private sanitizeFilename(filename: string): string {
    // Remove special characters and replace spaces
    return filename
      .normalize('NFD')           // Normalize to decomposed form
      .replace(/[\u0300-\u036f]/g, '') // Remove accent marks
      .replace(/[^a-z0-9]/gi, '_')     // Replace non-alphanumeric with underscore
      .toLowerCase()
      .replace(/_+/g, '_')        // Replace multiple underscores with single
      .trim();
  }
} 