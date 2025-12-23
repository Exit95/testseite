import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// Hetzner Object Storage Konfiguration
const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || import.meta.env.S3_ENDPOINT,
  region: process.env.S3_REGION || import.meta.env.S3_REGION || 'eu-central',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || import.meta.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || import.meta.env.S3_SECRET_KEY || '',
  },
  forcePathStyle: true, // Wichtig für Hetzner
});

const BUCKET = process.env.S3_BUCKET || import.meta.env.S3_BUCKET || '';

// Prüfen ob S3 konfiguriert ist
export function isS3Configured(): boolean {
  const endpoint = process.env.S3_ENDPOINT || import.meta.env.S3_ENDPOINT;
  const accessKey = process.env.S3_ACCESS_KEY || import.meta.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY || import.meta.env.S3_SECRET_KEY;
  const bucket = process.env.S3_BUCKET || import.meta.env.S3_BUCKET;
  return !!(endpoint && accessKey && secretKey && bucket);
}

// Bild hochladen
export async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read',
  });

  await s3Client.send(command);

  // Öffentliche URL zurückgeben
  const endpoint = process.env.S3_ENDPOINT || import.meta.env.S3_ENDPOINT;
  return `${endpoint}/${BUCKET}/${key}`;
}

// Bild löschen
export async function deleteFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  await s3Client.send(command);
}

// Alle Bilder in einem Ordner auflisten
export async function listS3Objects(prefix: string): Promise<{
  key: string;
  url: string;
  size: number;
  lastModified: Date;
}[]> {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: prefix,
  });

  const response = await s3Client.send(command);
  const endpoint = process.env.S3_ENDPOINT || import.meta.env.S3_ENDPOINT;

  return (response.Contents || []).map((obj) => ({
    key: obj.Key || '',
    url: `${endpoint}/${BUCKET}/${obj.Key}`,
    size: obj.Size || 0,
    lastModified: obj.LastModified || new Date(),
  }));
}

// Content-Type aus Dateiname ermitteln
export function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  };
  return types[ext || ''] || 'application/octet-stream';
}

