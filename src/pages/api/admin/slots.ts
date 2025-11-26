import type { APIRoute } from 'astro';
import { getTimeSlots, addTimeSlot, deleteTimeSlot, updateTimeSlot } from '../../../lib/storage';

// Einfache Authentifizierung (später durch besseres System ersetzen)
function checkAuth(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  const adminPassword = 'admin12345'; // Fest eingebautes Passwort

  if (!authHeader) return false;

  const [type, credentials] = authHeader.split(' ');
  if (type !== 'Basic') return false;

  const decoded = Buffer.from(credentials, 'base64').toString();
  const [username, password] = decoded.split(':');

  return username === 'admin' && password === adminPassword;
}

// GET - Alle Zeitslots abrufen
export const GET: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const slots = await getTimeSlots();
    return new Response(JSON.stringify(slots), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch slots' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST - Neuen Zeitslot erstellen
export const POST: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
		const data = await request.json();
		const { date, time, startTime, endTime, maxCapacity } = data as any;

		// Unterstützt sowohl altes Format (time) als auch neues Format (startTime/endTime)
		const slotTime = startTime || time;

		if (!date || !slotTime || !maxCapacity) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const newSlot = await addTimeSlot({
		  date,
		  time: slotTime,
		  endTime: endTime || undefined,
		  maxCapacity: parseInt(maxCapacity, 10),
		  available: parseInt(maxCapacity, 10),
    });

    return new Response(JSON.stringify(newSlot), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to create slot' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// DELETE - Zeitslot löschen
export const DELETE: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { id } = await request.json();

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing slot ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const success = await deleteTimeSlot(id);

    if (!success) {
      return new Response(JSON.stringify({ error: 'Slot not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to delete slot' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// PUT - Zeitslot aktualisieren
export const PUT: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { id, ...updates } = await request.json();

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing slot ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const updatedSlot = await updateTimeSlot(id, updates);

    if (!updatedSlot) {
      return new Response(JSON.stringify({ error: 'Slot not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(updatedSlot), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to update slot' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

