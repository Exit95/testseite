	import type { APIRoute } from 'astro';
	import nodemailer from 'nodemailer';
	import { getBookings, getTimeSlots, cancelBooking, updateBooking } from '../../../lib/storage';

// Einfache Authentifizierung (gleiche Logik wie bei admin/slots)
function checkAuth(request: Request): boolean {
	const authHeader = request.headers.get('Authorization');
	const adminPassword = 'admin12345';

	if (!authHeader) return false;

	const [type, credentials] = authHeader.split(' ');
	if (type !== 'Basic') return false;

	const decoded = Buffer.from(credentials, 'base64').toString();
	const [username, password] = decoded.split(':');

	return username === 'admin' && password === adminPassword;
}

// GET - Alle Buchungen (mit Slot-Infos) abrufen
export const GET: APIRoute = async ({ request }) => {
	if (!checkAuth(request)) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const [bookings, slots] = await Promise.all([getBookings(), getTimeSlots()]);

		const enriched = bookings.map((b) => {
			const slot = slots.find((s) => s.id === b.slotId);
			return {
				...b,
				slotDate: slot?.date ?? null,
				slotTime: slot?.time ?? null,
				slotEndTime: slot?.endTime ?? null,
				slotMaxCapacity: slot?.maxCapacity ?? null,
				slotAvailable: slot?.available ?? null,
			};
		});

		return new Response(JSON.stringify(enriched), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: 'Failed to fetch bookings' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

	// POST - Buchung stornieren oder bestätigen
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

				// Aktion: Buchung als bestätigt markieren
				if (action === 'confirm') {
					try {
						const updated = await updateBooking(id, { status: 'confirmed' });
						if (!updated) {
							return new Response(JSON.stringify({ error: 'Booking not found' }), {
								status: 404,
								headers: { 'Content-Type': 'application/json' },
							});
						}

						// Nach Bestätigung: Zusätzliche Benachrichtigung an Kund:in schicken
						let customerEmailSent = false;
						let emailError: string | null = null;
						try {
							// Slot-Daten für Datum/Uhrzeit laden
							const slots = await getTimeSlots();
							const slot = slots.find((s) => s.id === updated.slotId);

							const date = slot?.date ?? '';
							const timeDisplay = slot
								? (slot.endTime ? `${slot.time} - ${slot.endTime}` : slot.time)
								: '';

							const fromEmail = import.meta.env.FROM_EMAIL || 'buchungen@auszeit-keramik.de';

							const customerSubject = date && timeDisplay
								? `Dein Termin wurde bestätigt - Atelier Auszeit am ${date} um ${timeDisplay} Uhr`
								: 'Dein Termin im Atelier Auszeit wurde bestätigt';

							const customerHtml = `
							  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
							    <h2 style="color: #8B6F47;">Dein Termin ist jetzt bestätigt</h2>
							    <p>Liebe/r ${updated.name},</p>
							    <p>wir haben deine Buchung im Atelier Auszeit gerade im System bestätigt.</p>
							    <p><strong>Termin:</strong><br/>
							    ${date || ''}${date && timeDisplay ? ' · ' : ''}${timeDisplay || ''}</p>
							    <p><strong>Teilnehmer:</strong> ${updated.participants}</p>
							    ${updated.notes ? `<p><strong>Notizen:</strong> ${updated.notes}</p>` : ''}
							    <p style="margin-top: 20px;">
							      <strong>Ort:</strong><br/>
							      Atelier Auszeit<br/>
							      Feldstiege 6a<br/>
							      48599 Gronau
							    </p>
							    <p style="margin-top: 20px;">
							      Wenn du Fragen hast oder etwas ändern möchtest, melde dich gerne bei uns:<br/>
							      E-Mail: keramik-auszeit@web.de<br/>
							      Telefon: +49 176 34255005
							    </p>
							    <p style="margin-top: 20px;">Herzliche Grüße<br/>Dein Atelier Auszeit</p>
							  </div>
							`;

							const customerText = `
Liebe/r ${updated.name},

wir haben deine Buchung im Atelier Auszeit gerade im System bestätigt.

TERMIN:
${date || ''}${date && timeDisplay ? ' · ' : ''}${timeDisplay || ''}

Teilnehmer: ${updated.participants}
${updated.notes ? `Notizen: ${updated.notes}\n` : ''}

ORT:
Atelier Auszeit
Feldstiege 6a
48599 Gronau

Bei Fragen oder Änderungswünschen erreichst du uns unter:
E-Mail: keramik-auszeit@web.de
Telefon: +49 176 34255005

Herzliche Grüße
Dein Atelier Auszeit
`;

							// Kalender-Event nur mit der finalen Bestätigung mitschicken
							let icalEvent: string | null = null;
							if (slot && slot.date && slot.time) {
								const eventDate = new Date(`${slot.date}T${slot.time}:00`);
								const endDate = slot.endTime
									? new Date(`${slot.date}T${slot.endTime}:00`)
									: new Date(eventDate.getTime() + 2 * 60 * 60 * 1000);

								const formatDate = (date: Date) =>
									date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

								icalEvent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Atelier Auszeit//Booking//DE
BEGIN:VEVENT
UID:${Date.now()}@auszeit-keramik.de
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(eventDate)}
DTEND:${formatDate(endDate)}
SUMMARY:Keramik-Termin: ${updated.name}
DESCRIPTION:Buchung für ${updated.participants} Person(en)\\nE-Mail: ${updated.email}\\nTelefon: ${updated.phone || 'Nicht angegeben'}\\nNotizen: ${updated.notes || 'Keine'}
LOCATION:Atelier Auszeit, Feldstiege 6a, 48599 Gronau
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
							}

							if (import.meta.env.SMTP_HOST && import.meta.env.SMTP_USER && import.meta.env.SMTP_PASS) {
								const transporter = nodemailer.createTransport({
									host: import.meta.env.SMTP_HOST,
									port: parseInt(import.meta.env.SMTP_PORT || '587'),
									secure: import.meta.env.SMTP_PORT === '465',
									auth: {
										user: import.meta.env.SMTP_USER,
										pass: import.meta.env.SMTP_PASS,
									},
									tls: {
										rejectUnauthorized: false,
									},
								});

								// Wir testen hier nicht extra mit verify(), um die Bestätigung im Admin nicht zu blockieren,
								// sondern loggen nur Fehler.
								await transporter.sendMail({
									from: `"Atelier Auszeit - Irena Woschkowiak" <${fromEmail}>`,
									to: updated.email,
									subject: customerSubject,
									text: customerText,
									html: customerHtml,
									...(icalEvent
										? {
											icalEvent: {
												filename: 'termin.ics',
												method: 'REQUEST',
												content: icalEvent,
											},
										}
										: {}),
								});

								customerEmailSent = true;
								console.log('✅ Bestätigungs-E-Mail nach Admin-Bestätigung gesendet an:', updated.email);
							} else {
								console.warn('⚠️ SMTP nicht konfiguriert - Bestätigungs-E-Mail nach Admin-Bestätigung wird nicht gesendet');
								emailError = 'SMTP nicht konfiguriert';
							}
						} catch (err: any) {
							emailError = err?.message || String(err);
							console.error('❌ Fehler beim Versand der Bestätigungs-E-Mail nach Admin-Bestätigung:', err);
						}

						return new Response(JSON.stringify({ success: true, customerEmailSent, emailError }), {
							status: 200,
							headers: { 'Content-Type': 'application/json' },
						});
					} catch (error) {
						return new Response(JSON.stringify({ error: 'Failed to confirm booking' }), {
							status: 500,
							headers: { 'Content-Type': 'application/json' },
						});
					}
				}

			// Standard: Buchung stornieren (Rückwärtskompatibilität ohne action-Flag)
			const success = await cancelBooking(id);
			if (!success) {
				return new Response(JSON.stringify({ error: 'Booking not found' }), {
					status: 404,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			return new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (error) {
			return new Response(JSON.stringify({ error: 'Failed to update booking' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	};

	// PUT - Buchung bearbeiten (z.B. Teilnehmerzahl, Notizen)
	export const PUT: APIRoute = async ({ request }) => {
		if (!checkAuth(request)) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		try {
			const body = await request.json();
			const { id, name, email, phone, participants, notes, status } = body;

			if (!id) {
				return new Response(JSON.stringify({ error: 'Missing booking ID' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			const updates: any = {};
			if (typeof name === 'string') updates.name = name;
			if (typeof email === 'string') updates.email = email;
			if (typeof phone === 'string') updates.phone = phone;
			if (typeof participants === 'number') updates.participants = participants;
			if (typeof notes === 'string') updates.notes = notes;
			if (typeof status === 'string') {
				if (status === 'pending' || status === 'confirmed') {
					updates.status = status;
				} else {
					return new Response(JSON.stringify({ error: 'Invalid status value' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					});
				}
			}

			if (Object.keys(updates).length === 0) {
				return new Response(JSON.stringify({ error: 'No updates provided' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			try {
				const updated = await updateBooking(id, updates);
				if (!updated) {
					return new Response(JSON.stringify({ error: 'Booking not found' }), {
						status: 404,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				return new Response(JSON.stringify({ success: true, booking: updated }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				});
			} catch (error: any) {
				const message = error instanceof Error ? error.message : String(error);
				if (message === 'NOT_ENOUGH_CAPACITY') {
					return new Response(
						JSON.stringify({ error: 'Nicht genug freie Plätze für diese Änderung.' }),
						{
							status: 400,
							headers: { 'Content-Type': 'application/json' },
						},
					);
				}
				if (message === 'INVALID_PARTICIPANTS') {
					return new Response(
						JSON.stringify({ error: 'Die Teilnehmerzahl muss größer als 0 sein.' }),
						{
							status: 400,
							headers: { 'Content-Type': 'application/json' },
						},
					);
				}
				if (message === 'USE_CANCEL_BOOKING') {
					return new Response(
						JSON.stringify({ error: 'Zum Stornieren bitte die Stornieren-Funktion verwenden.' }),
						{
							status: 400,
							headers: { 'Content-Type': 'application/json' },
						},
					);
				}

				return new Response(JSON.stringify({ error: 'Failed to update booking' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		} catch (error) {
			return new Response(JSON.stringify({ error: 'Failed to update booking' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	};
