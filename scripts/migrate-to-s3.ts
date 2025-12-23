/**
 * Migration Script: Lokale Bilder → Hetzner Object Storage (S3)
 * 
 * Verwendung:
 *   npx ts-node scripts/migrate-to-s3.ts
 * 
 * Voraussetzung: .env Datei mit S3-Credentials
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// .env laden
dotenv.config();

const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_BUCKET = process.env.S3_BUCKET;
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY;
const S3_REGION = process.env.S3_REGION || 'eu-central';

if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY || !S3_SECRET_KEY) {
  console.error('❌ Fehler: S3 Umgebungsvariablen nicht gesetzt!');
  console.error('   Benötigt: S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY');
  process.exit(1);
}

const s3Client = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

const VALID_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return types[ext || ''] || 'application/octet-stream';
}

async function uploadFile(localPath: string, s3Key: string): Promise<boolean> {
  try {
    // Prüfen ob Datei bereits existiert
    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }));
      console.log(`   ⏭️  Übersprungen (existiert bereits): ${s3Key}`);
      return false;
    } catch {
      // Datei existiert nicht - hochladen
    }

    const fileBuffer = fs.readFileSync(localPath);
    const contentType = getContentType(localPath);

    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: 'public-read',
    }));

    console.log(`   ✅ Hochgeladen: ${s3Key}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Fehler bei ${s3Key}:`, error);
    return false;
  }
}

async function migrateDirectory(localDir: string, s3Prefix: string): Promise<number> {
  if (!fs.existsSync(localDir)) {
    console.log(`   📁 Ordner existiert nicht: ${localDir}`);
    return 0;
  }

  const files = fs.readdirSync(localDir);
  let uploaded = 0;

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!VALID_EXTENSIONS.includes(ext)) continue;

    const localPath = path.join(localDir, file);
    const s3Key = `${s3Prefix}/${file}`;

    if (await uploadFile(localPath, s3Key)) {
      uploaded++;
    }
  }

  return uploaded;
}

async function uploadJsonFile(localPath: string, s3Key: string): Promise<boolean> {
  try {
    if (!fs.existsSync(localPath)) {
      console.log(`   ⏭️  Datei existiert nicht lokal: ${localPath}`);
      return false;
    }

    const fileContent = fs.readFileSync(localPath, 'utf-8');

    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'application/json',
    }));

    console.log(`   ✅ Hochgeladen: ${s3Key}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Fehler bei ${s3Key}:`, error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starte Migration zu Hetzner Object Storage...\n');
  console.log(`   Endpoint: ${S3_ENDPOINT}`);
  console.log(`   Bucket: ${S3_BUCKET}\n`);

  let totalUploaded = 0;

  // JSON-Daten migrieren
  console.log('\n📋 Migriere JSON-Daten...');
  const jsonFiles = [
    'time-slots.json',
    'bookings.json',
    'workshops.json',
    'workshop-bookings.json',
    'reviews.json',
    'gallery-categories.json',
    'image-metadata.json',
  ];

  for (const jsonFile of jsonFiles) {
    const localPath = path.join(process.cwd(), 'data', jsonFile);
    if (await uploadJsonFile(localPath, `data/${jsonFile}`)) {
      totalUploaded++;
    }
  }

  // Produkt-Bilder migrieren
  const categories = ['tassen', 'teller', 'spardosen', 'anhaenger'];
  for (const category of categories) {
    console.log(`\n📦 Migriere: products/${category}/`);
    const uploaded = await migrateDirectory(
      path.join(process.cwd(), 'public', 'products', category),
      `products/${category}`
    );
    totalUploaded += uploaded;
  }

  // Uploads migrieren
  console.log(`\n📦 Migriere: uploads/`);
  const uploadsCount = await migrateDirectory(
    path.join(process.cwd(), 'uploads'),
    'uploads'
  );
  totalUploaded += uploadsCount;

  console.log(`\n✅ Migration abgeschlossen! ${totalUploaded} Dateien hochgeladen.`);
  console.log(`\n📌 Daten sind jetzt in S3 gespeichert:`);
  console.log(`   JSON-Daten: ${S3_ENDPOINT}/${S3_BUCKET}/data/[dateiname]`);
  console.log(`   Bilder: ${S3_ENDPOINT}/${S3_BUCKET}/products/[kategorie]/[dateiname]`);
  console.log(`   Uploads: ${S3_ENDPOINT}/${S3_BUCKET}/uploads/[dateiname]`);
}

main().catch(console.error);

