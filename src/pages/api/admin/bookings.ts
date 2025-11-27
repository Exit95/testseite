	import type { APIRoute } from 'astro';
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

					return new Response(JSON.stringify({ success: true }), {
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
