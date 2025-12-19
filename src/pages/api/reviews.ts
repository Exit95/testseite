import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

const REVIEWS_FILE = path.join(process.cwd(), 'data', 'reviews.json');

// Sicherstellen, dass das data-Verzeichnis existiert
function ensureDataDir() {
  const dataDir = path.dirname(REVIEWS_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(REVIEWS_FILE)) {
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify([], null, 2));
  }
}

interface Review {
  id: string;
  name: string;
  rating: number;
  comment: string;
  date: string;
  approved: boolean;
}

// GET - Alle Bewertungen abrufen (für Admin) oder nur freigegebene (für Webseite)
export const GET: APIRoute = async ({ request, url }) => {
  ensureDataDir();
  
  const showAll = url.searchParams.get('all') === 'true';
  const authHeader = request.headers.get('Authorization');
  
  try {
    const reviews: Review[] = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf-8'));
    
    // Wenn showAll=true, prüfe Admin-Authentifizierung
    if (showAll) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const base64Credentials = authHeader.split(' ')[1];
      const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
      const [username, password] = credentials.split(':');
      
      if (username !== 'admin' || password !== import.meta.env.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Admin sieht alle Bewertungen
      return new Response(JSON.stringify(reviews), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Öffentlich: nur freigegebene Bewertungen
    const approvedReviews = reviews.filter(r => r.approved);
    return new Response(JSON.stringify(approvedReviews), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Fehler beim Lesen der Bewertungen:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST - Neue Bewertung erstellen
export const POST: APIRoute = async ({ request }) => {
  ensureDataDir();
  
  try {
    const body = await request.json();
    const { name, rating, comment } = body;
    
    if (!name || !rating || !comment) {
      return new Response(JSON.stringify({ error: 'Fehlende Felder' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (rating < 1 || rating > 5) {
      return new Response(JSON.stringify({ error: 'Bewertung muss zwischen 1 und 5 sein' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const reviews: Review[] = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf-8'));
    
    const newReview: Review = {
      id: Date.now().toString(),
      name,
      rating: parseInt(rating),
      comment,
      date: new Date().toISOString(),
      approved: false
    };
    
    reviews.push(newReview);
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2));

    // E-Mail-Benachrichtigung an Admin senden
    await sendReviewNotificationEmail(newReview);

    return new Response(JSON.stringify({ success: true, review: newReview }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Fehler beim Erstellen der Bewertung:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Hilfsfunktion: E-Mail-Benachrichtigung senden
async function sendReviewNotificationEmail(review: Review) {
  const bookingEmail = import.meta.env.BOOKING_EMAIL || 'info@keramik-auszeit.de';
  const fromEmail = import.meta.env.FROM_EMAIL || 'info@keramik-auszeit.de';

  if (!import.meta.env.SMTP_HOST || !import.meta.env.SMTP_USER || !import.meta.env.SMTP_PASS) {
    console.log('⚠️ SMTP nicht konfiguriert - E-Mail-Benachrichtigung wird übersprungen');
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: import.meta.env.SMTP_HOST,
      port: parseInt(import.meta.env.SMTP_PORT || '465'),
      secure: import.meta.env.SMTP_PORT === '465',
      auth: {
        user: import.meta.env.SMTP_USER,
        pass: import.meta.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const stars = '⭐'.repeat(review.rating);
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6B5B53 0%, #D9C9B9 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .review-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #B1735C; }
          .stars { font-size: 24px; margin: 10px 0; }
          .comment { font-style: italic; color: #555; margin: 15px 0; padding: 15px; background: #f5f5f5; border-radius: 6px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          .btn { display: inline-block; padding: 12px 24px; background: #B1735C; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎨 Neue Kundenbewertung</h1>
            <p>Atelier Auszeit</p>
          </div>
          <div class="content">
            <p>Eine neue Kundenbewertung wurde abgegeben und wartet auf Ihre Freigabe:</p>

            <div class="review-box">
              <h2>${review.name}</h2>
              <div class="stars">${stars}</div>
              <p><strong>Bewertung:</strong> ${review.rating} von 5 Sternen</p>
              <p><strong>Datum:</strong> ${new Date(review.date).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
              <div class="comment">
                "${review.comment}"
              </div>
            </div>

            <p>Bitte melden Sie sich im Admin-Panel an, um die Bewertung zu prüfen und freizugeben:</p>
            <a href="https://keramik-auszeit.de/admin" class="btn">Zum Admin-Panel</a>

            <div class="footer">
              <p>Diese E-Mail wurde automatisch generiert.</p>
              <p>Atelier Auszeit – Keramik Malatelier<br>
              Feldstiege 6a, 48599 Gronau</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"Atelier Auszeit - Bewertungssystem" <${fromEmail}>`,
      to: bookingEmail,
      subject: `⭐ Neue Kundenbewertung von ${review.name} (${review.rating} Sterne)`,
      html: emailHtml,
      text: `
Neue Kundenbewertung - Atelier Auszeit

Von: ${review.name}
Bewertung: ${review.rating} von 5 Sternen
Datum: ${new Date(review.date).toLocaleDateString('de-DE')}

Kommentar:
"${review.comment}"

Bitte melden Sie sich im Admin-Panel an, um die Bewertung zu prüfen und freizugeben:
https://keramik-auszeit.de/admin

---
Diese E-Mail wurde automatisch generiert.
Atelier Auszeit – Keramik Malatelier
Feldstiege 6a, 48599 Gronau
      `
    });

    console.log('✅ Bewertungs-Benachrichtigung erfolgreich gesendet an:', bookingEmail);
  } catch (error) {
    console.error('❌ Fehler beim Senden der Bewertungs-Benachrichtigung:', error);
    // Fehler nicht weiterwerfen, damit die Bewertung trotzdem gespeichert wird
  }
}

// PATCH - Bewertung freigeben/ablehnen
export const PATCH: APIRoute = async ({ request }) => {
  ensureDataDir();
  
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');
  
  if (username !== 'admin' || password !== import.meta.env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const body = await request.json();
    const { id, approved } = body;
    
    const reviews: Review[] = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf-8'));
    const reviewIndex = reviews.findIndex(r => r.id === id);
    
    if (reviewIndex === -1) {
      return new Response(JSON.stringify({ error: 'Bewertung nicht gefunden' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    reviews[reviewIndex].approved = approved;
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2));
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Bewertung:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// DELETE - Bewertung löschen
export const DELETE: APIRoute = async ({ request, url }) => {
  ensureDataDir();
  
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');
  
  if (username !== 'admin' || password !== import.meta.env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const id = url.searchParams.get('id');
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID fehlt' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const reviews: Review[] = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf-8'));
    const filteredReviews = reviews.filter(r => r.id !== id);
    
    if (filteredReviews.length === reviews.length) {
      return new Response(JSON.stringify({ error: 'Bewertung nicht gefunden' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(filteredReviews, null, 2));
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Fehler beim Löschen der Bewertung:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

