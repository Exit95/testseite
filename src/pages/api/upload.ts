import type { APIRoute } from 'astro';
import busboy from 'busboy';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// Sicherstellen, dass Upload-Verzeichnis existiert
function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

// Authentifizierung
function checkAuth(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  const adminPassword = import.meta.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

  if (!authHeader) return false;

  const [type, credentials] = authHeader.split(' ');
  if (type !== 'Basic') return false;

  const decoded = Buffer.from(credentials, 'base64').toString();
  const [username, password] = decoded.split(':');

  return username === 'admin' && password === adminPassword;
}

export const POST: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  ensureUploadDir();

  return new Promise((resolve) => {
    const contentType = request.headers.get('content-type') || '';

    const bb = busboy({
      headers: {
        'content-type': contentType
      },
      limits: {
        fileSize: MAX_FILE_SIZE
      }
    });

    let filename: string | null = null;
    const chunks: { index: number; buffer: Buffer }[] = [];

    // 1. Metadaten sammeln (kommen ZUERST)
    bb.on('field', (fieldname, val) => {
      if (fieldname === 'filename') {
        filename = val;
      }
      // totalChunks und fileSize werden nur für Logging verwendet
    });

    // 2. Chunks sammeln (kommen NACH Metadaten)
    bb.on('file', (fieldname, file) => {
      // Chunk-Index aus Fieldname extrahieren (chunk_0, chunk_1, etc.)
      const match = fieldname.match(/^chunk_(\d+)$/);
      if (!match) {
        file.resume();
        return;
      }

      const chunkIndex = parseInt(match[1], 10);
      const buffers: Buffer[] = [];

      file.on('data', (data: Buffer) => {
        buffers.push(data);
      });

      file.on('end', () => {
        const chunkBuffer = Buffer.concat(buffers);
        chunks.push({ index: chunkIndex, buffer: chunkBuffer });
      });

      file.on('error', (err) => {
        console.error('File stream error:', err);
        resolve(new Response(JSON.stringify({ error: 'Upload failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }));
      });
    });

    // 3. Alle Chunks verarbeitet - Datei zusammensetzen
    bb.on('finish', async () => {
      try {
        if (!filename) {
          resolve(new Response(JSON.stringify({ error: 'Missing filename' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }));
          return;
        }

        if (chunks.length === 0) {
          resolve(new Response(JSON.stringify({ error: 'No chunks received' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }));
          return;
        }

        // Chunks nach Index sortieren
        chunks.sort((a, b) => a.index - b.index);

        // Alle Chunks zu einem Buffer zusammenfügen
        const finalBuffer = Buffer.concat(chunks.map(c => c.buffer));

        // Datei speichern
        const filepath = path.join(UPLOAD_DIR, filename);
        fs.writeFileSync(filepath, finalBuffer);

        console.log(`Upload complete: ${filename} (${finalBuffer.length} bytes, ${chunks.length} chunks)`);

        resolve(new Response(JSON.stringify({
          success: true,
          message: 'Upload complete',
          filename: filename,
          size: finalBuffer.length,
          chunks: chunks.length
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }));

      } catch (error) {
        console.error('Upload error:', error);
        resolve(new Response(JSON.stringify({ error: 'Upload failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }));
      }
    });

    bb.on('error', (err: any) => {
      console.error('Busboy error:', err);
      resolve(new Response(JSON.stringify({ error: 'Upload failed: ' + (err?.message || 'Unknown error') }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }));
    });

    // Request-Body an Busboy pipen
    request.body?.pipeTo(new WritableStream({
      write(chunk) {
        bb.write(chunk);
      },
      close() {
        bb.end();
      },
      abort(err) {
        console.error('Stream aborted:', err);
        bb.destroy();
      }
    }));
  });
};

