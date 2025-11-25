import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { name, email, phone, participants, date, time, notes } = data;

    // E-Mail-Adressen aus Environment-Variablen
    const bookingEmail = import.meta.env.BOOKING_EMAIL || 'info@auszeit-keramik.de';
    const fromEmail = import.meta.env.FROM_EMAIL || 'buchungen@auszeit-keramik.de';

    // E-Mail-Benachrichtigung vorbereiten
    const emailData = {
      to: bookingEmail,
      from: fromEmail,
      subject: `Neue Buchung: ${name} - ${date} ${time}`,
      html: `
        <h2>Neue Buchungsanfrage</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>E-Mail:</strong> ${email}</p>
        <p><strong>Telefon:</strong> ${phone || 'Nicht angegeben'}</p>
        <p><strong>Anzahl Personen:</strong> ${participants}</p>
        <p><strong>Datum:</strong> ${date}</p>
        <p><strong>Uhrzeit:</strong> ${time}</p>
        <p><strong>Notizen:</strong> ${notes || 'Keine'}</p>
      `,
      text: `
Neue Buchungsanfrage

Name: ${name}
E-Mail: ${email}
Telefon: ${phone || 'Nicht angegeben'}
Anzahl Personen: ${participants}
Datum: ${date}
Uhrzeit: ${time}
Notizen: ${notes || 'Keine'}
      `
    };

    // Kalender-Event erstellen (iCal Format)
    const eventDate = new Date(`${date} ${time}`);
    const endDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000); // 2 Stunden später
    
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const icalEvent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Auszeit Keramik Malatelier//Booking//DE
BEGIN:VEVENT
UID:${Date.now()}@auszeit-keramik.de
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(eventDate)}
DTEND:${formatDate(endDate)}
SUMMARY:Keramik-Termin: ${name}
DESCRIPTION:Buchung für ${participants} Person(en)\\nE-Mail: ${email}\\nTelefon: ${phone || 'Nicht angegeben'}\\nNotizen: ${notes || 'Keine'}
LOCATION:Auszeit Keramik Malatelier
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

    // Hier würdest du normalerweise einen E-Mail-Service verwenden
    // Beispiele: SendGrid, Resend, Nodemailer, etc.
    
    // Für die Entwicklung: Log die Daten
    console.log('Buchungsdaten:', data);
    console.log('E-Mail würde gesendet an:', emailData.to);
    console.log('Kalender-Event:', icalEvent);

    // TODO: Implementiere hier deinen E-Mail-Service
    // Beispiel mit Resend (https://resend.com):
    /*
    const resend = new Resend(import.meta.env.RESEND_API_KEY);
    
    await resend.emails.send({
      from: 'buchungen@auszeit-keramik.de',
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      attachments: [
        {
          filename: 'termin.ics',
          content: Buffer.from(icalEvent).toString('base64'),
        },
      ],
    });
    */

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Buchung erfolgreich erstellt',
        calendarEvent: icalEvent,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Fehler bei der Buchung:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Fehler bei der Buchung',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};

