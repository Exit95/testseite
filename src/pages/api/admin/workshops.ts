import type { APIRoute } from 'astro';
import { getWorkshops, addWorkshop, updateWorkshop, deleteWorkshop } from '../../../lib/storage';

// Authentifizierung (gleiche Logik wie bei admin/slots)
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

// GET - Alle Workshops abrufen (inkl. inaktive)
export const GET: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const workshops = await getWorkshops();
    return new Response(JSON.stringify(workshops), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch workshops' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST - Neuen Workshop erstellen
export const POST: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const data = await request.json();
    const { title, description, detailedDescription, date, time, price, maxParticipants, active, imageFilename } = data;

    if (!title || !description || !date || !time || !price || !maxParticipants) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const newWorkshop = await addWorkshop({
      title,
      description,
      detailedDescription: detailedDescription || undefined,
      date,
      time,
      price,
      maxParticipants: parseInt(String(maxParticipants), 10),
      active: active === true || active === 'true',
      imageFilename: imageFilename || undefined
    });

    return new Response(JSON.stringify(newWorkshop), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to create workshop' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// PUT - Workshop aktualisieren
export const PUT: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const data = await request.json();
    const { id, title, description, detailedDescription, date, time, price, maxParticipants, active, imageFilename } = data;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing workshop ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (detailedDescription !== undefined) updates.detailedDescription = detailedDescription || undefined;
    if (date !== undefined) updates.date = date;
    if (time !== undefined) updates.time = time;
    if (price !== undefined) updates.price = price;
    if (maxParticipants !== undefined) updates.maxParticipants = parseInt(String(maxParticipants), 10);
    if (active !== undefined) updates.active = active === true || active === 'true';
    if (imageFilename !== undefined) updates.imageFilename = imageFilename || undefined;

    const updated = await updateWorkshop(id, updates);

    if (!updated) {
      return new Response(JSON.stringify({ error: 'Workshop not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to update workshop' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// DELETE - Workshop löschen
export const DELETE: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing workshop ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const success = await deleteWorkshop(id);

    if (!success) {
      return new Response(JSON.stringify({ error: 'Workshop not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to delete workshop' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

