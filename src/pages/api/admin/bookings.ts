import type { APIRoute } from 'astro';
import { getBookings, getTimeSlots, cancelBooking } from '../../../lib/storage';

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

// POST - Buchung stornieren
export const POST: APIRoute = async ({ request }) => {
	if (!checkAuth(request)) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const { id } = await request.json();

		if (!id) {
			return new Response(JSON.stringify({ error: 'Missing booking ID' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

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
		return new Response(JSON.stringify({ error: 'Failed to cancel booking' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
