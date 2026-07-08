import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const accountId = import.meta.env.VITE_R2_ACCOUNT_ID;
const accessKeyId = import.meta.env.VITE_R2_ACCESS_KEY_ID;
const secretAccessKey = import.meta.env.VITE_R2_SECRET_ACCESS_KEY;
const bucketName = import.meta.env.VITE_R2_BUCKET_NAME || 'facial-imprint-img';
const publicUrl = import.meta.env.VITE_R2_PUBLIC_URL;

const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId || '',
    secretAccessKey: secretAccessKey || '',
  },
});

export const uploadSnapshotToR2 = async (base64Data: string, prefix: string = 'snapshot'): Promise<string | null> => {
  if (!accessKeyId || !secretAccessKey || !accountId) {
    console.error('R2 credentials are not fully configured in .env.local');
    return null;
  }

  try {
    const base64String = base64Data.replace(/^data:image\/\w+;base64,/, '');
    
    const binaryString = window.atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const randomStr = Math.random().toString(36).substring(2, 8);
    const fileName = `${prefix}_${timestamp}_${randomStr}.webp`;

    const params = {
      Bucket: bucketName,
      Key: fileName,
      Body: bytes,
      ContentType: 'image/webp',
    };

    await S3.send(new PutObjectCommand(params));

    return `${publicUrl.replace(/\/$/, '')}/${fileName}`;
  } catch (error) {
    console.error('Error uploading snapshot to R2:', error);
    return null;
  }
};
