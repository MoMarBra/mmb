import { RESTAURANTS } from './data.js';

const boundedText = (value, limit) => typeof value === 'string' && value.length > 0 &&
  value.length <= limit && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
const knownRestaurant = id => typeof id === 'string' && RESTAURANTS.some(r => r.id === id);

/** Optional evidence belongs only to this active benchmark. Never infer a menu,
 * price or date from old progress IDs or today's catalogue during load/import. */
export function normalizeFieldNotes(raw, task) {
  if (task?.type !== 'benchmark' || !Array.isArray(task.progress) || !Array.isArray(raw)) return [];
  const result = [], seen = new Set();
  for (const note of raw) {
    if (!note || typeof note !== 'object' || Array.isArray(note) ||
        !knownRestaurant(note.restaurantId) || !task.progress.includes(note.restaurantId) ||
        seen.has(note.restaurantId) || !boundedText(note.restaurantName, 80) || !boundedText(note.dishName, 120) ||
        !Number.isSafeInteger(note.priceCents) || note.priceCents <= 0 || note.priceCents > 1_000_000 ||
        !Number.isSafeInteger(note.observedAt) || note.observedAt < 0) continue;
    result.push({ restaurantId: note.restaurantId, restaurantName: note.restaurantName,
      dishName: note.dishName, priceCents: note.priceCents, observedAt: note.observedAt });
    seen.add(note.restaurantId);
    if (result.length === 3) break;
  }
  return result;
}

/** Call only after a NEW progress stamp, before its progress event and save.
 * The first real menu dish is the concrete observed sample, not a mean price.
 * `price` is Simulation.price(food) at that exact moment, including happy hour. */
export function recordBenchmarkNote(task, restaurant, price, observedAt) {
  const notes = normalizeFieldNotes(task?.fieldNotes, task);
  if (!restaurant?.foods?.[0] || notes.some(n => n.restaurantId === restaurant.id) || notes.length >= 3)
    return notes;
  return normalizeFieldNotes([...notes, {
    restaurantId: restaurant.id, restaurantName: restaurant.name, dishName: restaurant.foods[0].name,
    priceCents: Math.round(price * 100), observedAt: Math.floor(observedAt),
  }], task);
}
