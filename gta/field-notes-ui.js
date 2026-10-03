import { euro } from './data.js';

const esc = value => String(value).replace(/[&<>"']/g,
  character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

/** Render the already-normalized primitive records, never live catalogue data.
 * All fields are escaped; the existing minimal view stays collapsed by default. */
export function fieldNotesMarkup(notes) {
  if (!Array.isArray(notes) || !notes.length) return '';
  const rows = notes.slice(0, 3).map(note => {
    const day = Math.floor(note.observedAt / 1440) + 1, minutes = note.observedAt % 1440;
    const time = String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
    return `<div class="field-note"><div class="mission-meta"><strong>${esc(note.restaurantName)}</strong><span>${esc(euro(note.priceCents / 100))}</span></div><small>${esc(note.dishName)} · ${esc('Tag ' + day + ', ' + time)}</small></div>`;
  }).join('');
  return `<details class="mission-extra field-notes"><summary>Feldnotizen · ${Math.min(3, notes.length)}</summary>${rows}</details>`;
}
