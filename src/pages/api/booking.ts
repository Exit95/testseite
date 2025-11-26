import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';
import { getTimeSlots, addBooking } from '../../lib/storage';

export const POST: APIRoute = async ({ request }) => {
	  try {
	    const data = await request.json();
	    const { name, email, phone, participants, date, time, notes } = data;

	    // Finde den passenden Slot
	    const slots = await getTimeSlots();
	    const dateStr = new Date(date).toISOString().split('T')[0];
	    const slot = slots.find(s => s.date === dateStr && s.time === time);

    if (!slot) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Dieser Termin ist nicht mehr verfügbar',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

	    if (slot.available < parseInt(participants, 10)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Nur noch ${slot.available} Plätze verfügbar`,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

	    // Buchung speichern
	    const booking = await addBooking({
	      slotId: slot.id,
	      name,
	      email,
	      phone: phone || '',
	      participants: parseInt(participants, 10),
	      notes: notes || '',
	    });

    if (!booking) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Buchung konnte nicht gespeichert werden',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

		    // E-Mail-Adressen aus Environment-Variablen
		    const bookingEmail = import.meta.env.BOOKING_EMAIL || 'keramik-auszeit@web.de';
		    const fromEmail = import.meta.env.FROM_EMAIL || 'buchungen@auszeit-keramik.de';

	    // Anzeigeformat für die Uhrzeit (mit optionaler Endzeit)
	    const timeDisplay = slot.endTime ? `${slot.time} - ${slot.endTime}` : slot.time;

	    // E-Mail-Benachrichtigung für Admin vorbereiten
	    const adminEmailData = {
	      to: bookingEmail,
	      from: fromEmail,
	      subject: `Neue Buchung: ${name} - ${date} ${timeDisplay} Uhr`,
      html: `
        <h2>Neue Buchungsanfrage</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>E-Mail:</strong> ${email}</p>
        <p><strong>Telefon:</strong> ${phone || 'Nicht angegeben'}</p>
        <p><strong>Anzahl Personen:</strong> ${participants}</p>
	        <p><strong>Datum:</strong> ${date}</p>
	        <p><strong>Uhrzeit:</strong> ${timeDisplay} Uhr</p>
        <p><strong>Notizen:</strong> ${notes || 'Keine'}</p>
      `,
      text: `
Neue Buchungsanfrage

Name: ${name}
E-Mail: ${email}
Telefon: ${phone || 'Nicht angegeben'}
Anzahl Personen: ${participants}
	  Datum: ${date}
	  Uhrzeit: ${timeDisplay} Uhr
Notizen: ${notes || 'Keine'}
      `
    };

	    // Bestätigungs-E-Mail für Kunden vorbereiten
	    const customerEmailData = {
      to: email,
      from: fromEmail,
	      subject: `Buchungsbestätigung - Atelier Auszeit am ${date} um ${timeDisplay} Uhr`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8B6F47;">Vielen Dank für Ihre Buchung!</h2>
          <p>Liebe/r ${name},</p>
          <p>Ihre Buchung wurde erfolgreich bestätigt. Wir freuen uns auf Ihren Besuch!</p>

          <div style="background-color: #F5F0E8; padding: 20px; border-radius: 8px; margin: 20px 0;">
	            <h3 style="color: #8B6F47; margin-top: 0;">Ihre Buchungsdetails:</h3>
	            <p><strong>Datum:</strong> ${date}</p>
	            <p><strong>Uhrzeit:</strong> ${timeDisplay} Uhr</p>
            <p><strong>Anzahl Personen:</strong> ${participants}</p>
            ${notes ? `<p><strong>Ihre Notizen:</strong> ${notes}</p>` : ''}
          </div>

          <div style="background-color: #E8DCC8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #8B6F47; margin-top: 0;">Veranstaltungsort:</h3>
            <p>
              <strong>Atelier Auszeit</strong><br>
              Feldstiege 6a<br>
              48599 Gronau
            </p>
          </div>

          <p><strong>Wichtig:</strong> Im Anhang dieser E-Mail finden Sie eine Kalenderdatei (.ics), die Sie direkt in Ihren Kalender importieren können.</p>

	          <p>Bei Fragen oder Änderungswünschen können Sie uns gerne kontaktieren:</p>
	          <p>
	            📧 E-Mail: keramik-auszeit@web.de<br>
	            📱 Telefon: +49 176 34255005
	          </p>

          <p style="margin-top: 30px;">Herzliche Grüße,<br>
          <strong>Irena Woschkowiak</strong><br>
          Atelier Auszeit</p>
        </div>
      `,
      text: `
Vielen Dank für Ihre Buchung!

Liebe/r ${name},

Ihre Buchung wurde erfolgreich bestätigt. Wir freuen uns auf Ihren Besuch!

IHRE BUCHUNGSDETAILS:
	  Datum: ${date}
	  Uhrzeit: ${timeDisplay} Uhr
Anzahl Personen: ${participants}
${notes ? `Ihre Notizen: ${notes}` : ''}

VERANSTALTUNGSORT:
Atelier Auszeit
Feldstiege 6a
48599 Gronau

Im Anhang dieser E-Mail finden Sie eine Kalenderdatei (.ics), die Sie direkt in Ihren Kalender importieren können.

	Bei Fragen oder Änderungswünschen können Sie uns gerne kontaktieren:
	E-Mail: keramik-auszeit@web.de
Telefon: +49 176 34255005

Herzliche Grüße,
Irena Woschkowiak
Atelier Auszeit
      `
    };

	    // Kalender-Event erstellen (iCal Format)
	    const eventDate = new Date(`${slot.date}T${slot.time}:00`);
	    const endDate = slot.endTime
	      ? new Date(`${slot.date}T${slot.endTime}:00`)
	      : new Date(eventDate.getTime() + 2 * 60 * 60 * 1000); // Fallback: 2 Stunden später
    
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const icalEvent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Atelier Auszeit//Booking//DE
BEGIN:VEVENT
UID:${Date.now()}@auszeit-keramik.de
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(eventDate)}
DTEND:${formatDate(endDate)}
SUMMARY:Keramik-Termin: ${name}
DESCRIPTION:Buchung für ${participants} Person(en)\\nE-Mail: ${email}\\nTelefon: ${phone || 'Nicht angegeben'}\\nNotizen: ${notes || 'Keine'}
LOCATION:Atelier Auszeit, Feldstiege 6a, 48599 Gronau
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

    // E-Mail-Versand (nur wenn SMTP konfiguriert ist)
    let emailSent = false;
    let customerEmailSent = false;
    let emailError = null;

    if (import.meta.env.SMTP_HOST && import.meta.env.SMTP_USER && import.meta.env.SMTP_PASS) {
      try {
        // Nodemailer konfigurieren
        const transporter = nodemailer.createTransport({
          host: import.meta.env.SMTP_HOST,
          port: parseInt(import.meta.env.SMTP_PORT || '587'),
          secure: import.meta.env.SMTP_PORT === '465', // true für Port 465, false für andere Ports
          auth: {
            user: import.meta.env.SMTP_USER,
            pass: import.meta.env.SMTP_PASS,
          },
          tls: {
            rejectUnauthorized: false // Für selbstsignierte Zertifikate
          }
        });

        // Verbindung testen
        await transporter.verify();
        console.log('SMTP-Verbindung erfolgreich');

        // E-Mail an Admin senden
        console.log('📧 Sende Admin-E-Mail an:', bookingEmail);
        const adminResult = await transporter.sendMail({
          from: `"Atelier Auszeit - Irena Woschkowiak" <${fromEmail}>`,
          to: bookingEmail,
          subject: adminEmailData.subject,
          text: adminEmailData.text,
          html: adminEmailData.html,
          icalEvent: {
            filename: 'termin.ics',
            method: 'REQUEST',
            content: icalEvent,
          },
        });

        emailSent = true;
        console.log('✅ Admin-E-Mail erfolgreich gesendet an:', bookingEmail);
        console.log('📨 Admin-E-Mail Response:', {
          messageId: adminResult.messageId,
          accepted: adminResult.accepted,
          rejected: adminResult.rejected,
          response: adminResult.response
        });

        // Bestätigungs-E-Mail an Kunden senden
        console.log('📧 Sende Kunden-E-Mail an:', email);
        const customerResult = await transporter.sendMail({
          from: `"Atelier Auszeit - Irena Woschkowiak" <${fromEmail}>`,
          to: customerEmailData.to,
          subject: customerEmailData.subject,
          text: customerEmailData.text,
          html: customerEmailData.html,
          icalEvent: {
            filename: 'termin.ics',
            method: 'REQUEST',
            content: icalEvent,
          },
        });

        customerEmailSent = true;
        console.log('✅ Bestätigungs-E-Mail erfolgreich gesendet an:', email);
        console.log('📨 Kunden-E-Mail Response:', {
          messageId: customerResult.messageId,
          accepted: customerResult.accepted,
          rejected: customerResult.rejected,
          response: customerResult.response
        });
      } catch (error: any) {
        emailError = error.message;
        console.error('❌ Fehler beim E-Mail-Versand:', error);
        console.error('SMTP Config:', {
          host: import.meta.env.SMTP_HOST,
          port: import.meta.env.SMTP_PORT,
          user: import.meta.env.SMTP_USER,
          hasPassword: !!import.meta.env.SMTP_PASS
        });
      }
    } else {
      console.warn('⚠️ SMTP nicht konfiguriert - E-Mail wird nicht gesendet');
      emailError = 'SMTP nicht konfiguriert';
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Buchung erfolgreich erstellt',
        calendarEvent: icalEvent,
        emailSent: emailSent,
        customerEmailSent: customerEmailSent,
	        emailError: emailError,
	        // Debug-Infos zum SMTP-Setup (nur Host/Port, kein Passwort)
	        smtpHost: import.meta.env.SMTP_HOST,
	        smtpPort: import.meta.env.SMTP_PORT || '587',
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

