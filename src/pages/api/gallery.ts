import type { APIRoute } from 'astro';
import { Readable } from 'stream';
import Busboy from 'busboy';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

// S3 Client (Lazy-loaded)
let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!_s3Client) {
    // Unterstützt beide Varianten der Umgebungsvariablen
    const accessKey = process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || '';
    const secretKey = process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || '';

    _s3Client = new S3Client({
      endpoint: process.env.S3_ENDPOINT || 'https://nbg1.your-objectstorage.com',
      region: process.env.S3_REGION || 'eu-central',
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true,
    });
  }
  return _s3Client;
}

const getBucket = () => process.env.S3_BUCKET || 'danapfel-digital';
const PREFIX = 'Auszeit/gallery';

// Auth check
function checkAuth(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  if (!authHeader) return false;
  const [type, credentials] = authHeader.split(' ');
  if (type !== 'Basic') return false;
  const decoded = Buffer.from(credentials, 'base64').toString();
  const [username, password] = decoded.split(':');
  return username === 'admin' && password === adminPassword;
}

// Kategorien und ihre Pfade im products-Ordner
const PRODUCT_CATEGORIES = [
  { id: 'tassen', path: 'Auszeit/products/tassen' },
  { id: 'teller', path: 'Auszeit/products/teller' },
  { id: 'spardosen', path: 'Auszeit/products/spardosen' },
  { id: 'anhaenger', path: 'Auszeit/products/weihnachtsanhaenger' },
];

// GET - Liste aller Bilder (aus gallery/ UND products/)
export const GET: APIRoute = async () => {
  try {
    const endpoint = process.env.S3_ENDPOINT || '';
    const bucket = getBucket();
    const allImages: Array<{
      filename: string;
      url: string;
      size: number;
      date: Date;
      source: 'gallery' | 'products';
      category?: string;
    }> = [];

    // 1. Bilder aus gallery/ laden
    const galleryResponse = await getS3Client().send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `${PREFIX}/`,
      })
    );

    if (galleryResponse.Contents) {
      for (const obj of galleryResponse.Contents) {
        if (obj.Key && !obj.Key.endsWith('/')) {
          allImages.push({
            filename: obj.Key.replace(`${PREFIX}/`, ''),
            url: `${endpoint}/${bucket}/${obj.Key}`,
            size: obj.Size || 0,
            date: obj.LastModified || new Date(),
            source: 'gallery',
          });
        }
      }
    }

    // 2. Bilder aus products/ laden (mit Kategorie-Mapping)
    for (const cat of PRODUCT_CATEGORIES) {
      const productsResponse = await getS3Client().send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: `${cat.path}/`,
        })
      );

      if (productsResponse.Contents) {
        for (const obj of productsResponse.Contents) {
          if (obj.Key && !obj.Key.endsWith('/') && /\.(jpg|jpeg|png|gif|webp)$/i.test(obj.Key)) {
            const filename = obj.Key.split('/').pop() || '';
            allImages.push({
              filename: `products/${cat.id}/${filename}`,
              url: `${endpoint}/${bucket}/${obj.Key}`,
              size: obj.Size || 0,
              date: obj.LastModified || new Date(),
              source: 'products',
              category: cat.id,
            });
          }
        }
      }
    }

    // Nach Datum sortieren
    allImages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return new Response(JSON.stringify(allImages), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error listing gallery:', error);
    return new Response(JSON.stringify({ error: 'Failed to list images' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// POST - Bild hochladen
export const POST: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Promise((resolve) => {
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('multipart/form-data')) {
      resolve(new Response(JSON.stringify({ error: 'Invalid content type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }));
      return;
    }

    const busboy = Busboy({ headers: { 'content-type': contentType } });
    let fileBuffer: Buffer | null = null;
    let originalFilename = '';

    busboy.on('field', (name, val) => {
      if (name === 'filename') originalFilename = val;
    });

    busboy.on('file', (_, file) => {
      const chunks: Buffer[] = [];
      file.on('data', (chunk) => chunks.push(chunk));
      file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
    });

    busboy.on('finish', async () => {
      if (!fileBuffer) {
        resolve(new Response(JSON.stringify({ error: 'No file uploaded' }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        }));
        return;
      }

      try {
        const ext = originalFilename.split('.').pop() || 'jpg';
        const filename = `${Date.now()}.${ext}`;
        const key = `${PREFIX}/${filename}`;
        const mimeTypes: Record<string, string> = {
          jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
          gif: 'image/gif', webp: 'image/webp',
        };

        await getS3Client().send(new PutObjectCommand({
          Bucket: getBucket(),
          Key: key,
          Body: fileBuffer,
          ContentType: mimeTypes[ext.toLowerCase()] || 'application/octet-stream',
          ACL: 'public-read',
        }));

        const url = `${process.env.S3_ENDPOINT}/${getBucket()}/${key}`;
        resolve(new Response(JSON.stringify({ success: true, url, filename }), {
          headers: { 'Content-Type': 'application/json' },
        }));
      } catch (error) {
        console.error('Upload error:', error);
        resolve(new Response(JSON.stringify({ error: 'Upload failed' }), {
          status: 500, headers: { 'Content-Type': 'application/json' },
        }));
      }
    });

    const nodeStream = Readable.fromWeb(request.body as any);
    nodeStream.pipe(busboy);
  });
};

// DELETE - Bild löschen
export const DELETE: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(request.url);
    const filename = url.searchParams.get('filename');

    if (!filename) {
      return new Response(JSON.stringify({ error: 'Missing filename' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const key = `${PREFIX}/${filename}`;
    await getS3Client().send(new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }));

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete error:', error);
    return new Response(JSON.stringify({ error: 'Delete failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

