import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';
import { isS3Configured, getImageFromS3, getS3Key } from '../../lib/s3-storage';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

const contentTypeMap: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

export const GET: APIRoute = async ({ params }) => {
  try {
    const filePath = params.path || '';

    // Sicherheitscheck: Verhindere Directory Traversal
    const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const ext = path.extname(safePath).toLowerCase();
    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    // S3-Modus
    if (isS3Configured()) {
      const s3Key = getS3Key(`uploads/${safePath}`);
      const imageBuffer = await getImageFromS3(s3Key);

      if (!imageBuffer) {
        return new Response('Not Found', { status: 404 });
      }

      return new Response(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000'
        }
      });
    }

    // Lokaler Fallback
    const fullPath = path.join(UPLOAD_DIR, safePath);

    // Prüfe ob Datei im Upload-Verzeichnis liegt
    if (!fullPath.startsWith(UPLOAD_DIR)) {
      return new Response('Forbidden', { status: 403 });
    }

    // Prüfe ob Datei existiert
    if (!fs.existsSync(fullPath)) {
      return new Response('Not Found', { status: 404 });
    }

    // Prüfe ob es eine Datei ist
    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) {
      return new Response('Not Found', { status: 404 });
    }

    // Lese Datei
    const fileBuffer = fs.readFileSync(fullPath);

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000'
      }
    });
  } catch (error) {
    console.error('Error serving file:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};

