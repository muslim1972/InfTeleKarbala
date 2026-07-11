import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export default async function handler(req: any, res: any) {
  // Allow CORS for local dev, Vercel handles production CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { base64Data, prefix = 'snapshot' } = req.body;
    
    if (!base64Data) {
      return res.status(400).json({ error: 'Missing image data' });
    }

    // Read securely from Vercel backend environment (No VITE_ prefix!)
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME || 'facial-imprint-img';
    const publicUrl = process.env.R2_PUBLIC_URL || 'https://pub-85ba096ac24b4405a261899040809740.r2.dev';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      return res.status(500).json({ error: 'Server R2 credentials not configured' });
    }

    const S3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    const base64String = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64String, 'base64');
    
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const randomStr = Math.random().toString(36).substring(2, 8);
    const fileName = `${prefix}_${timestamp}_${randomStr}.webp`;

    await S3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: buffer,
      ContentType: 'image/webp',
    }));

    const baseUrl = publicUrl.replace(/\/$/, '');
    res.status(200).json({ url: `${baseUrl}/${fileName}` });
  } catch (error) {
    console.error('S3 Upload Error:', error);
    res.status(500).json({ error: 'Failed to upload to R2' });
  }
}
