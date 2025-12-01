import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

export const GET: APIRoute = async ({ params }) => {
  try {
    const filePath = params.path || '';
    
    // Sicherheitscheck: Verhindere Directory Traversal
    const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
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
    
    // Bestimme Content-Type basierend auf Dateiendung
    const ext = path.extname(fullPath).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    
    const contentType = contentTypeMap[ext] || 'application/octet-stream';

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

