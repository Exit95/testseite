import type { APIRoute } from 'astro';
import { getWorkshops } from '../../lib/storage';

export const GET: APIRoute = async () => {
  try {
    const workshops = await getWorkshops();
    const activeWorkshops = workshops.filter((w) => w.active);

    if (activeWorkshops.length === 0) {
      return new Response(
        '<div class="workshops__empty">Aktuell sind keine Workshops verfügbar.</div>',
        {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        }
      );
    }

    // HTML für jede Workshop-Karte generieren
    const cardsHTML = activeWorkshops.map((workshop) => {
      const currentParticipants = workshop.currentParticipants ?? 0;
      const availableSpots = workshop.maxParticipants - currentParticipants;
      const isFull = availableSpots <= 0;

      const imageUrl = workshop.imageFilename
        ? `/uploads/${workshop.imageFilename}`
        : '/becher.jpeg';

      const location = (workshop as any).location || 'Atelier Auszeit, Feldstiege 6a, Gronau';

      const date = new Date(workshop.date + 'T00:00:00');
      const day = date.getDate();
      const month = date.toLocaleDateString('de-DE', { month: 'short' });

      const badgeLabel = isFull ? 'Ausgebucht' : `${availableSpots} Plätze frei`;
      const badgeVariant = isFull ? 'sold' : 'available';

      const escapeHtml = (text: string) => {
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };

      return `
        <article class="workshop-card" data-workshop-id="${workshop.id}">
          <div class="card-link">
            <div class="card-image">
              <img src="${imageUrl}" alt="${escapeHtml(workshop.title)}" loading="lazy" />
              <span class="badge badge--${badgeVariant} workshop-badge">${badgeLabel}</span>
              <div class="card-date">
                <span class="day">${day}</span>
                <span class="month">${month}</span>
              </div>
            </div>
            <div class="card-content">
              <h3>${escapeHtml(workshop.title)}</h3>
              <div class="card-meta">
                <span>⏰ ${workshop.time} Uhr</span>
                <span>📍 ${escapeHtml(location)}</span>
              </div>
              <p class="description">${escapeHtml(workshop.description)}</p>
              <div class="card-footer">
                <span class="price">${workshop.price}</span>
                <span class="btn-text">Details & Buchung →</span>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join('');

    const html = `<div class="workshops__grid">${cardsHTML}</div>`;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } catch (error) {
    console.error('Error loading workshops:', error);
    return new Response(
      '<div class="workshops__empty">Fehler beim Laden der Workshops.</div>',
      {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }
    );
  }
};

