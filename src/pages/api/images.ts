import type { APIRoute } from 'astro';
import busboy from 'busboy';
import fs from 'fs';
import path from 'path';
import { isS3Configured, uploadToS3, deleteFromS3, listS3Objects, getContentType, getS3Key } from '../../lib/s3-storage';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const PRODUCTS_DIR = path.join(PUBLIC_DIR, 'products');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// Verfügbare Kategorien
const VALID_CATEGORIES = ['tassen', 'teller', 'spardosen', 'anhaenger'];

// Sicherstellen, dass Upload-Verzeichnis existiert
function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

// Sicherstellen, dass Kategorie-Verzeichnis existiert
function ensureCategoryDir(category: string) {
  const categoryDir = path.join(PRODUCTS_DIR, category);
  if (!fs.existsSync(categoryDir)) {
    fs.mkdirSync(categoryDir, { recursive: true });
  }
  return categoryDir;
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

// GET - Liste aller Bilder abrufen (aus allen Kategorien)
export const GET: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const imageFiles: any[] = [];

    // S3 Modus
    if (isS3Configured()) {
      // Bilder aus S3 laden
      for (const category of VALID_CATEGORIES) {
        const s3Objects = await listS3Objects(getS3Key(`products/${category}/`));
        const categoryImages = s3Objects
          .filter(obj => {
            const ext = obj.key.split('.').pop()?.toLowerCase();
            return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
          })
          .map(obj => ({
            filename: obj.key.split('/').pop() || '',
            category: category,
            path: obj.url,
            size: obj.size,
            created: obj.lastModified,
            modified: obj.lastModified
          }));
        imageFiles.push(...categoryImages);
      }

      // Uploads aus S3
      const uploadObjects = await listS3Objects(getS3Key('uploads/'));
      const uploadImages = uploadObjects
        .filter(obj => {
          const ext = obj.key.split('.').pop()?.toLowerCase();
          return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
        })
        .map(obj => ({
          filename: obj.key.split('/').pop() || '',
          category: 'uploads',
          path: obj.url,
          size: obj.size,
          created: obj.lastModified,
          modified: obj.lastModified
        }));
      imageFiles.push(...uploadImages);

    } else {
      // Lokaler Modus (Fallback)
      for (const category of VALID_CATEGORIES) {
        const categoryDir = path.join(PRODUCTS_DIR, category);

        if (fs.existsSync(categoryDir)) {
          const files = fs.readdirSync(categoryDir);
          const categoryImages = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
          }).map(file => {
            const filePath = path.join(categoryDir, file);
            const stats = fs.statSync(filePath);
            return {
              filename: file,
              category: category,
              path: `/products/${category}/${file}`,
              size: stats.size,
              created: stats.birthtime,
              modified: stats.mtime
            };
          });
          imageFiles.push(...categoryImages);
        }
      }

      if (fs.existsSync(UPLOAD_DIR)) {
        const files = fs.readdirSync(UPLOAD_DIR);
        const uploadImages = files.filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) && file !== 'temp';
        }).map(file => {
          const filePath = path.join(UPLOAD_DIR, file);
          const stats = fs.statSync(filePath);
          return {
            filename: file,
            category: 'uploads',
            path: `/uploads/${file}`,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          };
        });
        imageFiles.push(...uploadImages);
      }
    }

    // Sortiere nach Erstellungsdatum (neueste zuerst)
    imageFiles.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

    return new Response(JSON.stringify(imageFiles), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error listing images:', error);
    return new Response(JSON.stringify({ error: 'Failed to list images' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST - Bild hochladen (Chunked Upload)
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
    let category: string | null = null;
    const chunks: { index: number; buffer: Buffer }[] = [];

    // 1. Metadaten sammeln (kommen ZUERST)
    bb.on('field', (fieldname, val) => {
      if (fieldname === 'filename') {
        filename = val;
      } else if (fieldname === 'category') {
        category = val;
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

        if (!category) {
          resolve(new Response(JSON.stringify({ error: 'Missing category' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }));
          return;
        }

        if (!VALID_CATEGORIES.includes(category)) {
          resolve(new Response(JSON.stringify({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` }), {
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

        let resultPath: string;

        // S3 Upload wenn konfiguriert
        if (isS3Configured()) {
          const s3Key = getS3Key(`products/${category}/${filename}`);
          const contentTypeHeader = getContentType(filename);
          resultPath = await uploadToS3(finalBuffer, s3Key, contentTypeHeader);
          console.log(`S3 Upload complete: ${filename} → ${s3Key} (${finalBuffer.length} bytes)`);
        } else {
          // Lokaler Upload (Fallback)
          const categoryDir = ensureCategoryDir(category);
          const filepath = path.join(categoryDir, filename);
          fs.writeFileSync(filepath, finalBuffer);
          resultPath = `/products/${category}/${filename}`;
          console.log(`Upload complete: ${filename} → ${category}/ (${finalBuffer.length} bytes, ${chunks.length} chunks)`);
        }

        resolve(new Response(JSON.stringify({
          success: true,
          message: 'Upload complete',
          filename: filename,
          category: category,
          path: resultPath,
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

// DELETE - Bild löschen (aus Kategorie-Ordnern, uploads/ oder S3)
export const DELETE: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL(request.url);
    const filename = url.searchParams.get('filename');
    const category = url.searchParams.get('category');

    if (!filename) {
      return new Response(JSON.stringify({ error: 'Missing filename' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const safeName = path.basename(filename);

    // S3 Modus
    if (isS3Configured()) {
      let s3Key: string;
      if (category && VALID_CATEGORIES.includes(category)) {
        s3Key = getS3Key(`products/${category}/${safeName}`);
      } else if (category === 'uploads') {
        s3Key = getS3Key(`uploads/${safeName}`);
      } else {
        return new Response(JSON.stringify({ error: 'Category required for S3 delete' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await deleteFromS3(s3Key);
      console.log(`S3 Deleted: ${s3Key}`);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Lokaler Modus (Fallback)
    let filePath: string | null = null;

    if (category && VALID_CATEGORIES.includes(category)) {
      filePath = path.join(PRODUCTS_DIR, category, safeName);
    } else if (category === 'uploads') {
      filePath = path.join(UPLOAD_DIR, safeName);
    } else {
      for (const cat of VALID_CATEGORIES) {
        const testPath = path.join(PRODUCTS_DIR, cat, safeName);
        if (fs.existsSync(testPath)) {
          filePath = testPath;
          break;
        }
      }
      if (!filePath) {
        const uploadPath = path.join(UPLOAD_DIR, safeName);
        if (fs.existsSync(uploadPath)) {
          filePath = uploadPath;
        }
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      return new Response(JSON.stringify({ error: 'Invalid file' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    fs.unlinkSync(filePath);
    console.log(`Deleted: ${filePath}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting image:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete image' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

