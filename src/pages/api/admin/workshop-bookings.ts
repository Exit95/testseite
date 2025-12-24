import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import nodemailer from 'nodemailer';
import { isS3Configured, readJsonFromS3, writeJsonToS3 } from '../../../lib/s3-storage';
import { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL, isSmtpConfigured } from '../../../lib/env';

const DATA_DIR = path.join(process.cwd(), 'data');
const WORKSHOP_BOOKINGS_FILENAME = 'workshop-bookings.json';
const WORKSHOPS_FILENAME = 'workshops.json';

interface WorkshopBooking {
  id: string;
  workshopId: string;
  name: string;
  email: string;
  phone?: string;
  participants: number;
  notes?: string;
  createdAt: string;
  status: 'pending' | 'confirmed' | 'cancelled';
}

interface Workshop {
  id: string;
  title: string;
  date: string;
  time: string;
  price: string;
  maxParticipants: number;
  active: boolean;
}

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

async function getWorkshopBookings(): Promise<WorkshopBooking[]> {
  if (isS3Configured()) {
    return await readJsonFromS3<WorkshopBooking[]>(WORKSHOP_BOOKINGS_FILENAME, []);
  }
  const filePath = path.join(DATA_DIR, WORKSHOP_BOOKINGS_FILENAME);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveWorkshopBookings(bookings: WorkshopBooking[]): Promise<void> {
  if (isS3Configured()) {
    await writeJsonToS3(WORKSHOP_BOOKINGS_FILENAME, bookings);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, WORKSHOP_BOOKINGS_FILENAME), JSON.stringify(bookings, null, 2));
}

async function getWorkshops(): Promise<Workshop[]> {
  if (isS3Configured()) {
    return await readJsonFromS3<Workshop[]>(WORKSHOPS_FILENAME, []);
  }
  const filePath = path.join(DATA_DIR, WORKSHOPS_FILENAME);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// GET - Alle Workshop-Buchungen abrufen
export const GET: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const [bookings, workshops] = await Promise.all([getWorkshopBookings(), getWorkshops()]);

    const enriched = bookings.map((b) => {
      const workshop = workshops.find((w) => w.id === b.workshopId);
      return {
        ...b,
        workshopTitle: workshop?.title ?? 'Unbekannt',
        workshopDate: workshop?.date ?? null,
        workshopTime: workshop?.time ?? null,
        workshopPrice: workshop?.price ?? null,
      };
    });

    return new Response(JSON.stringify(enriched), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch workshop bookings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// POST - Workshop-Buchung bestätigen oder stornieren
export const POST: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { id, action } = await request.json();

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing booking ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const bookings = await getWorkshopBookings();
    const bookingIndex = bookings.findIndex((b) => b.id === id);

    if (bookingIndex === -1) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const booking = bookings[bookingIndex];
    const workshops = await getWorkshops();
    const workshop = workshops.find((w) => w.id === booking.workshopId);

    if (action === 'confirm') {
      bookings[bookingIndex].status = 'confirmed';
      await saveWorkshopBookings(bookings);

      let customerEmailSent = false;
      let emailError: string | null = null;

      try {
        const fromEmail = FROM_EMAIL;
        const workshopTitle = workshop?.title ?? 'Workshop';
        const workshopDate = workshop?.date ?? '';
        const workshopTime = workshop?.time ?? '';

        const customerSubject = `Deine Workshop-Buchung wurde bestätigt - ${workshopTitle}`;

        const customerHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #8B6F47;">Deine Workshop-Buchung ist bestätigt!</h2>
            <p>Liebe/r ${booking.name},</p>
            <p>wir freuen uns, dir mitzuteilen, dass deine Buchung für den Workshop <strong>${workshopTitle}</strong> bestätigt wurde!</p>

            <div style="background-color: #F5F0E8; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #8B6F47; margin-top: 0;">Workshop-Details:</h3>
              <p><strong>Workshop:</strong> ${workshopTitle}</p>
              <p><strong>Datum:</strong> ${workshopDate}</p>
              <p><strong>Uhrzeit:</strong> ${workshopTime} Uhr</p>
              <p><strong>Teilnehmer:</strong> ${booking.participants}</p>
              ${workshop?.price ? `<p><strong>Preis:</strong> ${workshop.price}</p>` : ''}
            </div>

            <p style="margin-top: 20px;">
              <strong>Ort:</strong><br/>
              Atelier Auszeit<br/>
              Feldstiege 6a<br/>
              48599 Gronau
            </p>

            <p>Bei Fragen oder Änderungswünschen erreichst du uns unter:<br/>
            E-Mail: info@keramik-auszeit.de<br/>
            Telefon: +49 176 34255005</p>

            <p style="margin-top: 20px;">Wir freuen uns auf dich!<br/>
            <strong>Dein Atelier Auszeit</strong></p>
          </div>
        `;

        const customerText = `
Deine Workshop-Buchung ist bestätigt!

Liebe/r ${booking.name},

wir freuen uns, dir mitzuteilen, dass deine Buchung für den Workshop "${workshopTitle}" bestätigt wurde!

Workshop-Details:
- Workshop: ${workshopTitle}
- Datum: ${workshopDate}
- Uhrzeit: ${workshopTime} Uhr
- Teilnehmer: ${booking.participants}
${workshop?.price ? `- Preis: ${workshop.price}` : ''}

Ort:
Atelier Auszeit
Feldstiege 6a
48599 Gronau

Bei Fragen oder Änderungswünschen erreichst du uns unter:
E-Mail: info@keramik-auszeit.de
Telefon: +49 176 34255005

Wir freuen uns auf dich!
Dein Atelier Auszeit
`;

        // Kalender-Event erstellen
        let icalEvent: string | null = null;
        if (workshopDate && workshopTime) {
          const eventDate = new Date(`${workshopDate}T${workshopTime}:00`);
          const endDate = new Date(eventDate.getTime() + 3 * 60 * 60 * 1000); // 3 Stunden

          const formatDate = (date: Date) =>
            date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

          icalEvent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Atelier Auszeit//Workshop//DE
BEGIN:VEVENT
UID:${Date.now()}@auszeit-keramik.de
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(eventDate)}
DTEND:${formatDate(endDate)}
SUMMARY:Workshop: ${workshopTitle}
DESCRIPTION:Buchung für ${booking.participants} Person(en)\\nE-Mail: ${booking.email}\\nTelefon: ${booking.phone || 'Nicht angegeben'}
LOCATION:Atelier Auszeit, Feldstiege 6a, 48599 Gronau
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
        }

        if (isSmtpConfigured()) {
          const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: parseInt(SMTP_PORT),
            secure: SMTP_PORT === '465',
            auth: { user: SMTP_USER, pass: SMTP_PASS },
            tls: { rejectUnauthorized: false },
          });

          await transporter.sendMail({
            from: `"Atelier Auszeit - Irena Woschkowiak" <${fromEmail}>`,
            to: booking.email,
            subject: customerSubject,
            text: customerText,
            html: customerHtml,
            ...(icalEvent ? { icalEvent: { filename: 'workshop.ics', method: 'REQUEST', content: icalEvent } } : {}),
          });

          customerEmailSent = true;
          console.log('✅ Workshop-Bestätigungs-E-Mail gesendet an:', booking.email);
        } else {
          emailError = 'SMTP nicht konfiguriert';
        }
      } catch (err: any) {
        emailError = err?.message || String(err);
        console.error('❌ Fehler beim Versand der Workshop-Bestätigungs-E-Mail:', err);
      }

      return new Response(JSON.stringify({ success: true, customerEmailSent, emailError }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'cancel') {
      bookings[bookingIndex].status = 'cancelled';
      await saveWorkshopBookings(bookings);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating workshop booking:', error);
    return new Response(JSON.stringify({ error: 'Failed to update booking' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

