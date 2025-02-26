import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export class R2Uploader {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      throw new Error('Cloudflare R2 credentials are not fully configured');
    }

    this.bucketName = process.env.R2_BUCKET_NAME || 'default-bucket';
    
    this.s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
      }
    });
  }

  async uploadFile(file: Buffer, filename: string, contentType: string): Promise<string> {
    const key = `portfolio/${Date.now()}-${filename}`;

    const uploadParams = {
      Bucket: this.bucketName,
      Key: key,
      Body: file,
      ContentType: contentType
    };

    try {
      await this.s3Client.send(new PutObjectCommand(uploadParams));
      
      // Construct public URL 
      const publicUrl = `https://pub-${this.bucketName}.r2.dev/${key}`;
      
      return publicUrl;
    } catch (error) {
      console.error('R2 Upload Error:', error);
      throw new Error(`Failed to upload file to R2: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 